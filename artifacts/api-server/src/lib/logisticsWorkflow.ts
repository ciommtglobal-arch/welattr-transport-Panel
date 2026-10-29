import {
  db, logisticsCarriersTable as carriers, logisticsRequestsTable as requests,
  logisticsOffersTable as offers, logisticsShipmentsTable as shipments,
  logisticsCommunicationsTable as communications, staffUsersTable,
  type LogisticsShipment, type LogisticsOffer,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type {
  CreateLogisticsOfferBody, ReviseLogisticsOfferBody, UpdateLogisticsRequestStatusBody,
} from "@workspace/api-zod";
import { isLogisticsFounder } from "./logisticsListingAuth";
import type { LogisticsActor } from "./logisticsWorkflowAuth";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type OfferInput = ReturnType<typeof CreateLogisticsOfferBody.parse>;
type Revision = ReturnType<typeof ReviseLogisticsOfferBody.parse>;
type ShipmentUpdate = ReturnType<typeof UpdateLogisticsRequestStatusBody.parse>;
type Status = LogisticsShipment["status"];
export class LogisticsWorkflowError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function fail(status: number, message: string): never { throw new LogisticsWorkflowError(status, message); }
function founder(actor: LogisticsActor) {
  if (!actor.isFounder || !isLogisticsFounder(actor.userId)) fail(403, "Bu karar yalnız kurucudan gelebilir.");
}
const nextStatuses: Record<Status, Status | null> = {
  new_request: "planning", planning: "quote_approval", quote_approval: "customer_approval",
  customer_approval: "loading", loading: "in_transit", in_transit: "delivered", delivered: null,
};
export function isLogisticsTransitionAllowed(from: Status, to: Status) {
  return from === to || nextStatuses[from] === to;
}
export function validateLogisticsOffer(input: Omit<Revision, "expectedUpdatedAt">, now = new Date()) {
  for (const amount of [input.carrierCostAmount, input.customerPriceAmount]) {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999999.99 ||
        !/^\d+(?:\.\d{1,2})?$/.test(String(amount))) fail(400, "Fiyat pozitif ve en fazla iki ondalıklı olmalıdır.");
  }
  if (!/^[A-Z]{3}$/.test(input.currency.trim().toUpperCase())) fail(400, "Üç harfli para birimi kullanın.");
  if (input.includedServices.trim().length < 2) fail(400, "Dahil hizmetleri belirtin.");
  if (!Number.isFinite(input.validUntil.getTime()) || input.validUntil <= now) fail(400, "Teklif geçerlilik zamanı gelecekte olmalıdır.");
}
function assertVersion(row: { updatedAt: Date }, expected: Date) {
  if (!expected || row.updatedAt.getTime() !== expected.getTime()) fail(409, "Kayıt incelendikten sonra değişmiş. Güncel kaydı yükleyip yeniden değerlendirin.");
}
function nextVersion(row: { updatedAt: Date }) {
  // Do not allow two edits in the same millisecond to share an approval version.
  return new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1));
}
function ownerApproved(offer: LogisticsOffer) {
  return Boolean(offer.approvedAt && offer.approvedByClerkUserId && isLogisticsFounder(offer.approvedByClerkUserId));
}
function unexpired(offer: LogisticsOffer) {
  if (offer.validUntil <= new Date()) fail(409, "Teklifin geçerlilik süresi dolmuş; yeni taslak veya revizyon gerekli.");
}
async function audit(tx: Tx, requestId: number, actor: LogisticsActor, message: string, isTest: boolean,
  channel: "phone" | "email" | "whatsapp" | "note" = "note", direction: "internal" | "outbound" = "internal") {
  await tx.insert(communications).values({ requestId, createdByClerkUserId: actor.userId, channel, direction, message, isTest });
}
async function lockedShipment(tx: Tx, requestId: number) {
  const [row] = await tx.select().from(shipments).where(eq(shipments.requestId, requestId)).limit(1).for("update");
  if (!row) fail(404, "Sevkiyat kaydı bulunamadı.");
  return row;
}
async function lockedOffer(tx: Tx, id: number) {
  const [hint] = await tx.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!hint) fail(404, "Teklif bulunamadı.");
  // All offer actions lock the shipment first, then the offer, preventing double acceptance.
  const shipment = await lockedShipment(tx, hint.requestId);
  const [offer] = await tx.select().from(offers).where(eq(offers.id, id)).limit(1).for("update");
  if (!offer) fail(404, "Teklif bulunamadı.");
  return { offer, shipment };
}
function preLoading(shipment: LogisticsShipment) {
  if (!["planning", "quote_approval", "customer_approval"].includes(shipment.status)) {
    fail(409, "Teklif işlemi yalnız planlama ve onay aşamasında yapılabilir.");
  }
}
async function approvedCarrier(tx: Tx, carrierId: number, isTest: boolean) {
  const [carrier] = await tx.select().from(carriers).where(eq(carriers.id, carrierId)).limit(1).for("update");
  if (!carrier || carrier.status !== "approved") fail(400, "Kurucu tarafından değerlendirilmiş onaylı taşıyıcı seçin.");
  if (carrier.isTest !== isTest) fail(400, "TEST kayıtları gerçek operasyonla eşleştirilemez.");
  return carrier;
}

export async function reviewLogisticsCarrier(id: number, status: "approved" | "rejected", note: string, actor: LogisticsActor) {
  founder(actor);
  if (note.trim().length < 3) fail(400, "Değerlendirme gerekçesi gerekli.");
  return db.transaction(async tx => {
    const [existing] = await tx.select().from(carriers).where(eq(carriers.id, id)).limit(1).for("update");
    if (!existing) fail(404, "Taşıyıcı başvurusu bulunamadı.");
    if (existing.status !== "pending") fail(409, "Bu başvuru zaten değerlendirilmiş.");
    const now = new Date();
    const [updated] = await tx.update(carriers).set({
      status, reviewedByClerkUserId: actor.userId, reviewedAt: now,
      notes: [existing.notes, `[Kurucu değerlendirmesi ${now.toISOString()} / ${status}] ${note.trim()}`].filter(Boolean).join("\n"),
    }).where(and(eq(carriers.id, id), eq(carriers.status, "pending"))).returning();
    if (!updated) fail(409, "Başvuru başka oturumda değişmiş; yenileyin.");
    return updated;
  });
}

export async function saveLogisticsOffer(input: OfferInput | Revision, actor: LogisticsActor, revisionId?: number) {
  if (revisionId !== undefined) founder(actor);
  if ("revisionNote" in input && input.revisionNote !== undefined &&
      (input.revisionNote.trim().length < 3 || input.revisionNote.length > 1000)) fail(400, "Revizyon gerekçesi 3–1000 karakter olmalıdır.");
  validateLogisticsOffer(input);
  return db.transaction(async tx => {
    let existing: LogisticsOffer | undefined;
    let shipment: LogisticsShipment;
    if (revisionId !== undefined) {
      const context = await lockedOffer(tx, revisionId); existing = context.offer; shipment = context.shipment;
      assertVersion(existing, (input as Revision).expectedUpdatedAt);
      if (existing.status !== "pending_approval") fail(409, "Yalnız kurucu onayı bekleyen taslak revize edilebilir.");
      if (!actor.isFounder && existing.createdByClerkUserId !== actor.userId) fail(403, "Bu taslağı yalnız hazırlayan kişi veya kurucu düzenleyebilir.");
    } else {
      shipment = await lockedShipment(tx, (input as OfferInput).requestId);
    }
    if (!["planning", "quote_approval"].includes(shipment.status)) fail(409, "Önce talebi planlamaya alın; müşteri onayı veya yükleme aşamasındaki teklifi değiştirmeyin.");
    const [request] = await tx.select().from(requests).where(eq(requests.id, shipment.requestId)).limit(1);
    if (!request) fail(404, "Yük talebi bulunamadı.");
    await approvedCarrier(tx, input.carrierId, request.isTest);
    if ("isTest" in input && input.isTest !== undefined && input.isTest !== request.isTest) fail(400, "Teklif TEST durumu yük talebiyle aynı olmalıdır.");
    const values = {
      carrierId: input.carrierId, carrierCostAmount: input.carrierCostAmount,
      customerPriceAmount: input.customerPriceAmount, currency: input.currency.trim().toUpperCase(),
      includedServices: input.includedServices.trim(), validUntil: input.validUntil,
    };
    if (existing) {
      const [retired] = await tx.update(offers).set({
        status: "revised", updatedAt: nextVersion(existing),
      }).where(and(eq(offers.id, existing.id), eq(offers.status, "pending_approval"))).returning();
      if (!retired) fail(409, "Teklif başka oturumda değişmiş.");
    }
    const [saved] = await tx.insert(offers).values({
        ...values, requestId: request.id, createdByClerkUserId: actor.userId,
        isTest: request.isTest, status: "pending_approval",
        approvedAt: null, approvedByClerkUserId: null, sentAt: null,
      }).returning();
    if (!saved) fail(409, "Teklif başka oturumda değişmiş.");
    await tx.update(shipments).set({ status: "quote_approval", updatedAt: nextVersion(shipment) }).where(eq(shipments.id, shipment.id));
    await audit(tx, request.id, actor, existing
      ? `Teklif #${existing.id} → #${saved.id}: revizyon; kurucu onayı bekliyor.\n` +
        `Gerekçe: ${("revisionNote" in input && input.revisionNote?.trim()) || "Eski istemci: gerekçe belirtilmedi"}.\n` +
        `Eski sürüm: ${existing.updatedAt.toISOString()}; yeni sürüm: ${saved.updatedAt.toISOString()}.\n` +
        `Taşıyıcı maliyeti: ${existing.carrierCostAmount} ${existing.currency} → ${saved.carrierCostAmount} ${saved.currency}.\n` +
        `Müşteri fiyatı: ${existing.customerPriceAmount} ${existing.currency} → ${saved.customerPriceAmount} ${saved.currency}.\n` +
        `Eski şartlar: ${existing.includedServices}\nYeni şartlar: ${saved.includedServices}`
      : `Teklif #${saved.id}: taslak oluşturuldu; kurucu onayı bekliyor.`, request.isTest);
    return saved;
  });
}

export async function approveLogisticsOffer(id: number, actor: LogisticsActor, expectedUpdatedAt: Date) {
  founder(actor);
  return db.transaction(async tx => {
    const { offer, shipment } = await lockedOffer(tx, id);
    assertVersion(offer, expectedUpdatedAt);
    preLoading(shipment);
    if (offer.status !== "pending_approval") fail(409, "Teklif artık kurucu onayı beklemiyor.");
    unexpired(offer);
    await approvedCarrier(tx, offer.carrierId, offer.isTest);
    const [accepted] = await tx.select().from(offers).where(and(eq(offers.requestId, offer.requestId), eq(offers.status, "accepted"))).limit(1);
    if (accepted) fail(409, "Bu talep için müşteri kabulü zaten kaydedilmiş.");
    const [updated] = await tx.update(offers).set({
      status: "approved", approvedByClerkUserId: actor.userId, approvedAt: new Date(), updatedAt: nextVersion(offer),
    }).where(and(eq(offers.id, id), eq(offers.status, "pending_approval"))).returning();
    if (!updated) fail(409, "Teklif başka oturumda değişmiş.");
    await tx.update(shipments).set({ status: "customer_approval", updatedAt: nextVersion(shipment) }).where(eq(shipments.id, shipment.id));
    await audit(tx, offer.requestId, actor, `Teklif #${id}: kurucu onayı kaydedildi. Müşteri kabulü, hukuki imza ve tahsilat değildir.`, offer.isTest);
    return updated;
  });
}

export async function markLogisticsOfferSent(id: number, actor: LogisticsActor,
  input: { channel: "phone" | "email" | "whatsapp"; note: string; expectedUpdatedAt: Date }) {
  if (input.note.trim().length < 3) fail(400, "Harici gönderimin nasıl doğrulandığını belirtin.");
  return db.transaction(async tx => {
    const { offer, shipment } = await lockedOffer(tx, id);
    assertVersion(offer, input.expectedUpdatedAt);
    preLoading(shipment);
    if (offer.status !== "approved" || !ownerApproved(offer)) fail(409, "Önce gerçek kurucu kimliğiyle teklif onayı gerekir.");
    unexpired(offer);
    const [updated] = await tx.update(offers).set({ status: "sent", sentAt: new Date(), updatedAt: nextVersion(offer) })
      .where(and(eq(offers.id, id), eq(offers.status, "approved"))).returning();
    if (!updated) fail(409, "Teklif başka oturumda değişmiş.");
    await audit(tx, offer.requestId, actor, `Teklif #${id}: kullanıcı tarafından doğrulanan manuel gönderim kaydı. ${input.note.trim()}`,
      offer.isTest, input.channel, "outbound");
    return updated;
  });
}

export async function decideLogisticsOffer(id: number, actor: LogisticsActor,
  input: { decision: "reject" | "accept_customer"; note: string; expectedUpdatedAt: Date }) {
  founder(actor);
  if (input.note.trim().length < 3) fail(400, "Karar veya müşteri kabulünün dayanağı gerekli.");
  return db.transaction(async tx => {
    const { offer, shipment } = await lockedOffer(tx, id);
    assertVersion(offer, input.expectedUpdatedAt);
    preLoading(shipment);
    let status: "rejected" | "accepted";
    if (input.decision === "reject") {
      if (!["pending_approval", "approved", "sent"].includes(offer.status)) fail(409, "Bu teklif bu aşamada reddedilemez.");
      status = "rejected";
    } else {
      if (offer.status !== "sent" || !ownerApproved(offer)) fail(409, "Kurucu onayı ve doğrulanmış gönderim kaydı gerekli.");
      unexpired(offer);
      await approvedCarrier(tx, offer.carrierId, offer.isTest);
      const [accepted] = await tx.select().from(offers).where(and(eq(offers.requestId, offer.requestId), eq(offers.status, "accepted"))).limit(1);
      if (accepted) fail(409, "Bir yük talebi için yalnız bir müşteri kabulü kaydedilebilir.");
      status = "accepted";
    }
    const [updated] = await tx.update(offers).set({ status, updatedAt: nextVersion(offer) }).where(and(eq(offers.id, id), eq(offers.status, offer.status))).returning();
    if (!updated) fail(409, "Teklif başka oturumda değişmiş.");
    if (status === "rejected" && shipment.status === "customer_approval") {
      const remaining = await tx.select().from(offers).where(eq(offers.requestId, offer.requestId));
      if (!remaining.some(row => ["approved", "sent", "accepted"].includes(row.status) && ownerApproved(row))) {
        await tx.update(shipments).set({ status: "quote_approval", updatedAt: nextVersion(shipment) }).where(eq(shipments.id, shipment.id));
      }
    }
    await audit(tx, offer.requestId, actor,
      `Teklif #${id}: ${status === "accepted" ? "kurucu tarafından müşterinin harici kabulü kaydedildi; hukuki imza veya tahsilat değildir" : "kurucu tarafından reddedildi"}. ${input.note.trim()}`, offer.isTest);
    return updated;
  });
}

export async function updateLogisticsShipment(id: number, input: ShipmentUpdate, actor: LogisticsActor) {
  return db.transaction(async tx => {
    const existing = await lockedShipment(tx, id);
    assertVersion(existing, input.expectedUpdatedAt);
    if (!isLogisticsTransitionAllowed(existing.status, input.status)) fail(409, "Operasyon adımları sırayla ilerlemelidir; aşama atlanamaz.");
    const changed = existing.status !== input.status;
    if (changed && ["customer_approval", "loading"].includes(input.status)) {
      const candidates = await tx.select().from(offers).where(eq(offers.requestId, id));
      const valid = candidates.find(offer => ownerApproved(offer) &&
        (input.status === "loading" ? offer.status === "accepted" : ["approved", "sent", "accepted"].includes(offer.status)));
      if (!valid) fail(409, input.status === "loading" ? "Yükleme için kurucu onaylı teklif ve müşteri kabul kaydı gerekli." : "Önce teklifin kurucu onayı gerekir.");
      if (input.status === "loading") await approvedCarrier(tx, valid.carrierId, valid.isTest);
    }
    if (input.assignedStaffClerkUserId) {
      const [staff] = await tx.select().from(staffUsersTable).where(and(
        eq(staffUsersTable.clerkUserId, input.assignedStaffClerkUserId), eq(staffUsersTable.active, 1),
      )).limit(1);
      if (!staff) fail(400, "Sorumlu personel bulunamadı.");
    }
    const plannedLoadingAt = input.plannedLoadingAt === undefined ? existing.plannedLoadingAt : input.plannedLoadingAt;
    const plannedDeliveryAt = input.plannedDeliveryAt === undefined ? existing.plannedDeliveryAt : input.plannedDeliveryAt;
    if (plannedLoadingAt && plannedDeliveryAt && plannedDeliveryAt < plannedLoadingAt) fail(400, "Planlanan teslim yüklemeden önce olamaz.");
    const now = new Date();
    const [updated] = await tx.update(shipments).set({
      status: input.status,
      updatedAt: nextVersion(existing),
      assignedStaffClerkUserId: input.assignedStaffClerkUserId === undefined ? existing.assignedStaffClerkUserId : input.assignedStaffClerkUserId,
      plannedLoadingAt, plannedDeliveryAt,
      internalNote: input.internalNote === undefined ? existing.internalNote : input.internalNote?.trim() || null,
      actualLoadingAt: changed && input.status === "loading" ? existing.actualLoadingAt ?? now : existing.actualLoadingAt,
      actualDeliveryAt: changed && input.status === "delivered" ? existing.actualDeliveryAt ?? now : existing.actualDeliveryAt,
    }).where(and(eq(shipments.id, existing.id), eq(shipments.status, existing.status))).returning();
    if (!updated) fail(409, "Sevkiyat başka oturumda değişmiş; yenileyin.");
    const [request] = await tx.select().from(requests).where(eq(requests.id, id)).limit(1);
    await audit(tx, id, actor, changed ? `Operasyon durumu: ${existing.status} → ${input.status}.`
      : "Operasyon planı / iç not güncellendi.", request?.isTest ?? false);
    return updated;
  });
}
