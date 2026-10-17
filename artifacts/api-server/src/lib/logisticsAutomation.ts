import { createHash, randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { and, asc, eq } from "drizzle-orm";
import {
  db, logisticsRequestsTable as requests, logisticsAutomationJobsTable as jobs,
  logisticsAutomationDocumentsTable as documents, type LogisticsRequest,
  type LogisticsAutomationJob, type LogisticsAutomationDocument, type AutomationEvent,
} from "@workspace/db";
import { ActLogisticsAutomationBody } from "@workspace/api-zod";
import { ObjectStorageService } from "./objectStorage";
import { isLogisticsFounder } from "./logisticsListingAuth";
import type { LogisticsActor } from "./logisticsWorkflowAuth";

export type AutomationTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Input = typeof ActLogisticsAutomationBody._output;
const storage = new ObjectStorageService();
export const defaultDocumentKinds = ["request_confirmation", "cargo_details", "company_authority"];
export class AutomationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function automationFail(status: number, message: string): never { throw new AutomationError(status, message); }
export function logisticsSourceHash(request: LogisticsRequest) {
  return createHash("sha256").update(JSON.stringify({
    source: Object.fromEntries(Object.keys(request).sort().map(key => [key, request[key as keyof LogisticsRequest]])),
    // A changed group/topic must invalidate review, not redirect an old approval.
    targetGroup: process.env.TELEGRAM_GROUP_ID ?? null,
    targetTopic: process.env.LOADS_TOPIC_ID ?? null,
  })).digest("hex");
}
const plain = (text: string) => text.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ").trim();
export function buildPublicLoadMessage(r: LogisticsRequest) {
  // No customer name, organization, contact, notes, document or payment data.
  return [
    r.isTest ? "MMT GLOBAL — TEST YÜK TASLAĞI" : "MMT GLOBAL — YÜK TALEBİ",
    `Referans: ${r.referenceCode}`, `Güzergâh: ${plain(r.origin)} → ${plain(r.destination)}`,
    `Yük: ${plain(r.cargoType)}`, `Ağırlık: ${r.weightKg} kg · Hacim: ${r.volumeM3} m³`,
    `Taşıma: ${r.transportMode} · Yükleme: ${r.loadingDate}`,
    "Teklif ve koordinasyon: MMT Lojistik. Bu ilan sevkiyat veya sözleşme onayı değildir.",
  ].join("\n");
}
export function publicMessageSafe(message: string) {
  const withoutGeneratedReference = message.replace(/^Referans: LOAD-\d{4}-[0-9A-F]{8}$/m, "Referans");
  return message.trim().length >= 10 && message.length <= 3000 &&
    !/[\w.+-]+@[\w.-]+\.\w+|(?:\+?\d[\s().-]*){10,}|\/objects\/|x-goog-|signature=|token=|\bTR\d{24}\b/i.test(withoutGeneratedReference);
}
export function requestInformationComplete(r: LogisticsRequest) {
  return [r.requesterName, r.email, r.phone, r.origin, r.destination, r.cargoType].every(s => Boolean(s?.trim())) &&
    Number.isFinite(r.weightKg) && r.weightKg > 0 && Number.isFinite(r.volumeM3) && r.volumeM3 > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(r.loadingDate)) &&
    String(r.loadingDate) >= new Date().toISOString().slice(0, 10);
}
export function automationDispatchBlockers(isTest = false) {
  return [
    ...(isTest ? ["TEST kaydı dışarı gönderilmez."] : []),
    ...(process.env.NODE_ENV !== "production" || !process.env.REPLIT_DEPLOYMENT
      ? ["Gerçek gönderim yalnız kullanıcı tarafından yayımlanmış production ortamında çalışır."] : []),
    ...(!process.env.TELEGRAM_BOT_TOKEN ? ["Telegram bot bağlantısı tanımlı değil."] : []),
    ...(!/^-[1-9]\d{4,14}$/.test(process.env.TELEGRAM_GROUP_ID ?? "") ? ["Geçerli Telegram hedef grubu tanımlı değil."] : []),
    ...(process.env.LOADS_TOPIC_ID && (!/^[1-9]\d{0,9}$/.test(process.env.LOADS_TOPIC_ID) || Number(process.env.LOADS_TOPIC_ID) > 2147483647)
      ? ["Telegram konu kimliği geçersiz; genel konuya sessiz geçiş yapılmaz."] : []),
  ];
}
export function automationEvent(action: string, detail: string, actor?: LogisticsActor): AutomationEvent {
  return { at: new Date().toISOString(), actorKind: actor ? "user" : "system", actorUserId: actor?.userId ?? null, action, detail };
}
export function requiredDocumentsComplete(job: Pick<LogisticsAutomationJob, "requiredDocuments">, docs: LogisticsAutomationDocument[]) {
  // A pending replacement must never silently fall back to an older document.
  return job.requiredDocuments.length > 0 && job.requiredDocuments.every(kind => {
    const latest = docs.filter(d => d.kind === kind).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return Boolean(latest?.confirmedAt);
  });
}
export async function ensureLogisticsAutomation(tx: AutomationTx, request: LogisticsRequest, actor?: LogisticsActor) {
  const [row] = await tx.insert(jobs).values({
    requestId: request.id, isTest: request.isTest, sourceHash: logisticsSourceHash(request),
    publicMessage: buildPublicLoadMessage(request), requiredDocuments: defaultDocumentKinds,
    events: [automationEvent("prepared", "Talep kontrolü, evrak toplama, doğrulama, kurucu kararı ve gönderim işleri otomatik açıldı.", actor)],
  }).onConflictDoNothing({ target: jobs.requestId }).returning();
  return row;
}
function assertFounder(actor: LogisticsActor) {
  if (!actor.isFounder || !isLogisticsFounder(actor.userId)) automationFail(403, "Bu doğrulama veya karar yalnız mevcut kurucuya aittir.");
}
function assertVersion(job: LogisticsAutomationJob, expected?: number) {
  if (job.version !== expected) automationFail(409, "İncelediğiniz sürüm değişti. Güncel kaydı açıkça yükleyip yeniden değerlendirin.");
}
export async function assertDocumentGenerations(tx: AutomationTx, jobId: number) {
  const docs = await tx.select().from(documents).where(eq(documents.jobId, jobId));
  for (const d of docs.filter(d => d.confirmedAt)) {
    const file = await storage.getObjectEntityFile(d.objectPath);
    const [m] = await file.getMetadata();
    if (String(m.generation) !== d.generation || m.md5Hash !== d.checksum || Number(m.size) !== d.size) {
      automationFail(409, "Evrak sürümü değişmiş; doğrulama ve onay yeniden yapılmalı.");
    }
  }
  return docs;
}
export async function readLogisticsAutomation(tx: AutomationTx, r: LogisticsRequest, actor: LogisticsActor) {
  const [job] = await tx.select().from(jobs).where(eq(jobs.requestId, r.id));
  const docs = job ? await tx.select().from(documents).where(eq(documents.jobId, job.id)).orderBy(asc(documents.createdAt)) : [];
  const current = Boolean(job && job.sourceHash === logisticsSourceHash(r));
  const completeDocs = Boolean(job && requiredDocumentsComplete(job, docs));
  const blockers = automationDispatchBlockers(r.isTest);
  return {
    requestId: r.id, reference: r.referenceCode, isTest: r.isTest, canApprove: actor.isFounder,
    dispatchAvailable: blockers.length === 0, dispatchBlockers: blockers,
    job: job ? { ...job, sourceCurrent: current } : null,
    documents: docs.map(d => ({
      id: d.id, kind: d.kind, fileName: d.fileName, size: d.size, uploadedBy: d.uploadedBy, confirmed: Boolean(d.confirmedAt),
    })),
    tasks: [
      { key: "information", title: "Yük ve güzergâh bilgilerinin tamamlanması", done: requestInformationComplete(r) },
      { key: "documents", title: "İşleme uygun evrakların yüklenmesi", done: completeDocs },
      { key: "verification", title: "Kurucunun evrak, kapsam ve doğruluk incelemesi", done: Boolean(current && job?.verifiedBy && job.verifiedAt) },
      { key: "approval", title: "İncelenen ilan sürümü için son kurucu kararı", done: Boolean(current && job?.approvedBy && job.approvedAt) },
      { key: "dispatch", title: `Telegram gönderim alındısı — hedef: ${process.env.TELEGRAM_GROUP_ID || "tanımlanmamış"}, konu: ${process.env.LOADS_TOPIC_ID || "genel"}`, done: Boolean(job?.status === "sent" && job.providerMessageId) },
    ],
  };
}
export async function getLogisticsAutomation(id: number, actor: LogisticsActor) {
  return db.transaction(async tx => {
    const [r] = await tx.select().from(requests).where(eq(requests.id, id)).for("share");
    if (!r) automationFail(404, "Yük talebi bulunamadı.");
    return readLogisticsAutomation(tx, r, actor);
  });
}
export async function actLogisticsAutomation(id: number, input: Input, actor: LogisticsActor) {
  return db.transaction(async tx => {
    // Same request -> job lock ordering in source creation, decisions and worker.
    const [r] = await tx.select().from(requests).where(eq(requests.id, id)).for("update");
    if (!r) automationFail(404, "Yük talebi bulunamadı.");
    if (input.action === "prepare") {
      await ensureLogisticsAutomation(tx, r, actor);
      return readLogisticsAutomation(tx, r, actor);
    }
    const [job] = await tx.select().from(jobs).where(eq(jobs.requestId, id)).for("update");
    if (!job) automationFail(409, "Önce bu talep için otomasyon işlerini hazırlayın.");
    if (input.action === "download") {
      const [d] = await tx.select().from(documents).where(and(eq(documents.id, input.documentId ?? randomUUID()), eq(documents.jobId, job.id)));
      if (!d?.confirmedAt) automationFail(404, "Bu dosyada doğrulanmış yükleme bulunamadı.");
      await assertDocumentGenerations(tx, job.id);
      const link = await storage.getObjectEntityDownloadURL(d.objectPath);
      return { ...await readLogisticsAutomation(tx, r, actor), downloadURL: link.downloadURL };
    }
    assertVersion(job, input.expectedVersion);
    const changedAt = new Date(Math.max(Date.now(), job.updatedAt.getTime() + 1));
    if (["sending", "sent", "uncertain"].includes(job.status)) {
      automationFail(409, "Gönderilmiş veya alındısı belirsiz işlem değiştirilemez/tekrarlanamaz. Önce sağlayıcı kaydı incelenmeli.");
    }
    const note = input.note?.trim();
    let patch: Partial<typeof jobs.$inferInsert> = {};
    let detail = "";
    let uploadURL: string | undefined;
    let uploadDocumentId: string | undefined;
    const invalidate = {
      status: "draft", verifiedBy: null, verifiedAt: null, approvedBy: null, approvedAt: null,
      sourceHash: logisticsSourceHash(r), lastError: null,
    };
    if (input.action === "edit") {
      if (input.requiredDocuments) assertFounder(actor);
      const publicMessage = input.publicMessage?.trim() ?? buildPublicLoadMessage(r);
      if (!publicMessageSafe(publicMessage)) automationFail(400, "İlan metninden özel iletişim, banka, anahtar ve belge bağlantılarını kaldırın.");
      patch = { ...invalidate, publicMessage, ...(input.requiredDocuments ? { requiredDocuments: input.requiredDocuments } : {}) };
      detail = "Taslak/kapsam güncellendi; önceki doğrulama ve yayın onayı kaldırıldı.";
    } else if (input.action === "request_upload") {
      if (!input.kind || !input.fileName?.trim() || !input.contentType || !input.size) automationFail(400, "Evrak türü, adı, boyutu ve dosya biçimi gerekli.");
      uploadURL = await storage.getObjectEntityUploadURL();
      const [d] = await tx.insert(documents).values({
        jobId: job.id, kind: input.kind, fileName: input.fileName!.trim(),
        contentType: input.contentType!, size: input.size!, uploadedBy: actor.userId,
        objectPath: storage.normalizeObjectEntityPath(uploadURL), createdAt: changedAt,
      }).returning();
      uploadDocumentId = d.id;
      patch = invalidate;
      detail = "Dosyaya bağlı özel evrak yüklemesi açıldı; evrak henüz yüklendi veya doğru sayılmadı.";
    } else if (input.action === "confirm_upload") {
      const [d] = await tx.select().from(documents).where(and(eq(documents.id, input.documentId ?? randomUUID()), eq(documents.jobId, job.id)));
      if (!d || d.uploadedBy !== actor.userId || d.confirmedAt) automationFail(409, "Size ait bekleyen evrak yüklemesi bulunamadı.");
      const file = await storage.getObjectEntityFile(d.objectPath);
      const [m] = await file.getMetadata();
      if (Number(m.size) !== d.size || Number(m.size) > 10485760 || m.contentType !== d.contentType) automationFail(400, "Yüklenen evrak boyutu/biçimi beyanla uyuşmuyor.");
      const [prefix] = await file.download({ start: 0, end: 15 });
      const magicOk = d.contentType === "application/pdf" ? prefix.subarray(0, 5).toString() === "%PDF-"
        : d.contentType === "image/png" ? prefix.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
        : prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff;
      if (!magicOk) automationFail(400, "Evrak içeriği seçilen dosya biçimiyle uyuşmuyor.");
      // Freeze the confirmed object under an unexposed destination: the original
      // upload URL cannot replace a document after the founder has reviewed it.
      const target = file.bucket.file(`${dirname(file.name)}/${randomUUID()}`);
      await file.copy(target, { preconditionOpts: { ifGenerationMatch: 0 } });
      const [saved] = await target.getMetadata();
      if (!saved.generation || !saved.md5Hash || saved.md5Hash !== m.md5Hash ||
          saved.contentType !== d.contentType || Number(saved.size) !== d.size) automationFail(503, "Evrak güvenli sürümü doğrulanamadı.");
      const objectPath = storage.normalizeObjectEntityPath(`https://storage.googleapis.com/${target.bucket.name}/${target.name}`);
      await tx.update(documents).set({
        objectPath, generation: String(saved.generation), checksum: saved.md5Hash, confirmedAt: new Date(),
      }).where(eq(documents.id, d.id));
      patch = invalidate;
      detail = `Evrak özel depoda sabit sürüme kaydedildi: ${d.kind}. İçeriğin ticari doğruluğu otomatik onaylanmadı.`;
    } else if (input.action === "verify") {
      assertFounder(actor);
      if (!note || note.length < 3 || input.informationConfirmed !== true) automationFail(400, "Evrak ve bilgilerin incelendiğine ilişkin açık teyit ve gerekçe gerekli.");
      if (job.sourceHash !== logisticsSourceHash(r) || !requestInformationComplete(r)) automationFail(409, "Kaynak bilgi değişmiş/eksik veya yükleme tarihi geçmiş; taslağı yenileyin.");
      const docs = await assertDocumentGenerations(tx, job.id);
      if (!requiredDocumentsComplete(job, docs)) {
        automationFail(409, "Seçili işlem kapsamının zorunlu evrakları tamamlanmamış.");
      }
      patch = { status: "verified", verifiedBy: actor.userId, verifiedAt: new Date(), approvedBy: null, approvedAt: null, lastError: null };
      detail = `Kurucu evrak kapsamını ve bilgileri inceleyerek teyit etti: ${note}`;
    } else if (input.action === "approve") {
      assertFounder(actor);
      if (!note || note.length < 3 || input.publicContentConfirmed !== true) automationFail(400, "Halka açık ilan metni için ayrı, açık kurucu onayı gerekli.");
      if (job.status !== "verified" || !job.verifiedAt || !job.verifiedBy || !isLogisticsFounder(job.verifiedBy) ||
          job.sourceHash !== logisticsSourceHash(r) || !requestInformationComplete(r) || !publicMessageSafe(job.publicMessage)) {
        automationFail(409, "Güncel bilgi, tamamlanmış evrak incelemesi ve güvenli ilan metni gerekli.");
      }
      await assertDocumentGenerations(tx, job.id);
      patch = { status: "approved", approvedBy: actor.userId, approvedAt: new Date(), lastError: null };
      detail = `Kurucu yalnız bu ilan sürümünün gönderimini onayladı: ${note}. Teklif, sözleşme, tahsilat veya sevkiyat onayı değildir.`;
    } else if (input.action === "reject" || input.action === "retry") {
      assertFounder(actor);
      if (!note || note.length < 3) automationFail(400, "Karar gerekçesi gerekli.");
      if (input.action === "retry" && job.status !== "failed") automationFail(409, "Yalnız kesin reddedilmiş gönderim yeniden incelemeye alınabilir.");
      patch = invalidate;
      detail = `Kurucu işlemi taslağa döndürdü; otomatik tekrar veya onay verilmedi: ${note}`;
    }
    await tx.update(jobs).set({
      ...patch, version: job.version + 1, updatedAt: changedAt,
      events: [...job.events, automationEvent(input.action, detail, actor)],
    }).where(eq(jobs.id, job.id));
    return { ...await readLogisticsAutomation(tx, r, actor), ...(uploadURL ? { uploadURL, uploadDocumentId } : {}) };
  });
}
