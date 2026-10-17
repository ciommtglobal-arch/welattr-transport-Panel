import { and, asc, eq, isNotNull, lt, notExists } from "drizzle-orm";
import {
  db, logisticsRequestsTable as requests, logisticsShipmentsTable as shipments,
  logisticsAutomationJobsTable as jobs,
} from "@workspace/db";
import { logger } from "./logger";
import { isLogisticsFounder } from "./logisticsListingAuth";
import {
  assertDocumentGenerations, automationDispatchBlockers, automationEvent,
  ensureLogisticsAutomation, logisticsSourceHash, publicMessageSafe, requestInformationComplete,
  requiredDocumentsComplete,
} from "./logisticsAutomation";

export function productionAutomationEnabled() {
  return process.env.NODE_ENV === "production" && Boolean(process.env.REPLIT_DEPLOYMENT);
}

// Durable catch-up handles sources such as WhatsApp which already create real
// requests. It only inserts missing tracking rows; it never approves or edits them.
export async function prepareUntrackedLogisticsRequests() {
  return db.transaction(async tx => {
    const rows = await tx.select().from(requests).where(and(
      eq(requests.isTest, false),
      notExists(tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.requestId, requests.id))),
    )).orderBy(asc(requests.createdAt)).limit(10).for("update", { skipLocked: true });
    for (const request of rows) await ensureLogisticsAutomation(tx, request);
    return rows.length;
  });
}

export async function dispatchOneLogisticsJob(send: typeof fetch = fetch, requestId?: number) {
  // In development/TEST, not even provider configuration or queue is probed.
  if (!productionAutomationEnabled() || automationDispatchBlockers().length) return false;
  const [hint] = await db.select({ id: jobs.id, requestId: jobs.requestId }).from(jobs)
    .where(and(eq(jobs.status, "approved"), eq(jobs.isTest, false),
      requestId === undefined ? undefined : eq(jobs.requestId, requestId))).orderBy(asc(jobs.createdAt)).limit(1);
  if (!hint) return false;
  const claimed = await db.transaction(async tx => {
    const [r] = await tx.select().from(requests).where(eq(requests.id, hint.requestId)).for("update");
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, hint.id)).for("update");
    if (!r || !job || job.status !== "approved") return null;
    const [shipment] = await tx.select({ status: shipments.status }).from(shipments).where(eq(shipments.requestId, r.id)).limit(1);
    const verified = job.verifiedBy && isLogisticsFounder(job.verifiedBy) && job.verifiedAt;
    const approved = job.approvedBy && isLogisticsFounder(job.approvedBy) && job.approvedAt;
    let valid = !r.isTest && !job.isTest && verified && approved && requestInformationComplete(r) &&
      job.sourceHash === logisticsSourceHash(r) && publicMessageSafe(job.publicMessage) &&
      shipment && ["new_request", "planning", "quote_approval"].includes(shipment.status);
    try {
      const docs = await assertDocumentGenerations(tx, job.id);
      valid = Boolean(valid && requiredDocumentsComplete(job, docs));
    } catch { valid = false; }
    if (!valid) {
      await tx.update(jobs).set({
        status: "draft", version: job.version + 1, approvedBy: null, approvedAt: null,
        verifiedBy: null, verifiedAt: null, updatedAt: new Date(),
        lastError: "Bilgi, evrak, kurucu yetkisi veya dosya aşaması değişmiş; yeniden inceleme gerekli.",
        events: [...job.events, automationEvent("blocked", "Gönderim öncesi güvenlik kontrolü onayı askıya aldı; gönderim yapılmadı.")],
      }).where(eq(jobs.id, job.id));
      return null;
    }
    await tx.update(jobs).set({
      status: "sending", version: job.version + 1, updatedAt: new Date(),
      events: [...job.events, automationEvent("sending", "Onaylanan ilan sürümü sağlayıcıya iletilmek üzere kilitlendi.")],
    }).where(eq(jobs.id, job.id));
    return { id: job.id, text: job.publicMessage };
  });
  if (!claimed) return false;
  let status: "sent" | "failed" | "uncertain" = "uncertain";
  let messageId: string | null = null;
  try {
    const topic = process.env.LOADS_TOPIC_ID;
    const response = await send(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_GROUP_ID, text: claimed.text, disable_web_page_preview: true,
        ...(topic && /^\d+$/.test(topic) ? { message_thread_id: Number(topic) } : {}),
      }),
    });
    const payload = await response.json() as { ok?: boolean; result?: { message_id?: number; chat?: { id?: number } } };
    if (response.ok && payload.ok === true && Number.isSafeInteger(payload.result?.message_id) && payload.result!.message_id! > 0 &&
        String(payload.result?.chat?.id) === process.env.TELEGRAM_GROUP_ID) {
      status = "sent"; messageId = String(payload.result!.message_id);
    } else if (!response.ok && payload.ok === false && response.status >= 400 && response.status < 500) {
      status = "failed"; // Explicit provider rejection, never retried automatically.
    }
  } catch {
    // A timeout can follow a successful provider delivery. No automatic retry.
  }
  await db.transaction(async tx => {
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, claimed.id)).for("update");
    if (!job || job.status !== "sending") return;
    const detail = status === "sent" ? "Telegram gönderim alındısı doğrulandı."
      : status === "failed" ? "Telegram isteği açıkça reddetti; yeniden kurucu incelemesi gerekli."
      : "Sağlayıcı alındısı belirsiz; otomatik tekrar kapalı. Telegram kaydı insan tarafından incelenmeli.";
    await tx.update(jobs).set({
      status, providerMessageId: messageId, lastError: status === "sent" ? null : detail,
      version: job.version + 1, updatedAt: new Date(),
      events: [...job.events, automationEvent(status, detail)],
    }).where(eq(jobs.id, job.id));
  });
  return status === "sent";
}

async function markAbandonedClaimsUncertain() {
  await db.transaction(async tx => {
    const rows = await tx.select().from(jobs).where(and(
      eq(jobs.status, "sending"), isNotNull(jobs.approvedAt),
      lt(jobs.updatedAt, new Date(Date.now() - 5 * 60000)),
    )).for("update", { skipLocked: true });
    for (const j of rows) await tx.update(jobs).set({
      status: "uncertain", version: j.version + 1, updatedAt: new Date(),
      lastError: "İşlem kesilmiş; sağlayıcı alındısı bilinmiyor. Otomatik tekrar yapılmayacak.",
      events: [...j.events, automationEvent("uncertain", "Kesilen gönderim yeniden denenmedi; inceleme gerekli.")],
    }).where(eq(jobs.id, j.id));
  });
}

export function startLogisticsAutomationWorker() {
  if (!productionAutomationEnabled()) {
    logger.info("Lojistik gerçek gönderim worker'ı önizleme/TEST ortamında kapalı.");
    return;
  }
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await prepareUntrackedLogisticsRequests();
      await markAbandonedClaimsUncertain();
      await dispatchOneLogisticsJob();
    } catch {
      logger.error("Lojistik otomasyon turu doğrulanamadı; sağlayıcı veya gizli bağlantı bilgileri loglanmadı.");
    } finally { busy = false; }
  }, 15000);
  timer.unref();
}
