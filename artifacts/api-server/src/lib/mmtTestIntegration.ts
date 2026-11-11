import { createHmac, timingSafeEqual } from "node:crypto";
import { raw, type RequestHandler, type Request } from "express";
import { and, eq, like, sql } from "drizzle-orm";
import {
  db, logisticsRequestsTable, logisticsShipmentsTable,
  logisticsCommunicationsTable,
} from "@workspace/db";
import { isLogisticsFounder } from "./logisticsListingAuth";
import type { LogisticsActor } from "./logisticsWorkflowAuth";

export class MmtTestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Explicit server-side TEST mode, never enabled by a browser/body/header.
export function mmtTestEnabled(): boolean {
  return ["development", "test"].includes(process.env.NODE_ENV ?? "") &&
    !process.env.REPLIT_DEPLOYMENT &&
    process.env.MMT_TEST_INTEGRATION_ENABLED === "true";
}

export const requireMmtTestEnvironment: RequestHandler = (_req, res, next) => {
  if (!mmtTestEnabled()) {
    res.status(404).json({ error: "Bu entegrasyon bu ortamda kapalı." });
    return;
  }
  next();
};

export function createMmtTestRawParser(): RequestHandler {
  const parser = raw({ type: "application/json", limit: "16kb", inflate: false });
  return (req, res, next) => {
    parser(req, res, (error?: { status?: number }) => {
      if (error) {
        const status = error.status === 413 ? 413 : error.status === 415 ? 415 : 400;
        res.status(status).json({ error: "Ham istek gövdesi kabul edilmedi." });
        return;
      }
      next();
    });
  };
}

export function verifyMmtTestRequest(req: Request) {
  const secret = process.env.MMT_TEST_INTEGRATION_HMAC_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new MmtTestError(503, "TEST imza anahtarı yapılandırılmamış.");
  }
  const signature = req.get("X-MMT-Signature") ?? "";
  const timestamp = req.get("X-MMT-Timestamp") ?? "";
  const eventId = req.get("X-MMT-Event-Id") ?? "";
  if (!Buffer.isBuffer(req.body) ||
      !/^[a-f0-9]{64}$/i.test(signature) ||
      !/^\d{13}$/.test(timestamp) ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(eventId) ||
      Math.abs(Date.now() - Number(timestamp)) > 300_000) {
    throw new MmtTestError(401, "Servis isteği doğrulanamadı.");
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${eventId}.`, "utf8")
    .update(req.body)
    .digest();
  const received = Buffer.from(signature, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new MmtTestError(401, "Servis isteği doğrulanamadı.");
  }
  return { eventId, sourceTimestamp: Number(timestamp) };
}

export function decodeMmtTestBody(rawBody: Buffer): unknown {
  try { return JSON.parse(rawBody.toString("utf8")); }
  catch { throw new MmtTestError(400, "JSON gövdesi geçersiz."); }
}

export function validateMmtTestReference(value: string): string {
  const reference = value.normalize("NFC");
  if (!/^[\p{L}\p{N}_:-]{1,256}$/u.test(reference)) {
    throw new MmtTestError(400, "Dosya referansı geçersiz.");
  }
  return reference;
}

type EventInput = { docRef: string; kind: string };
type Envelope = { eventId: string; sourceTimestamp: number };
const integration = "mmt-test-v1";
type Activity = EventInput & Envelope;

function activityProof(activity: Activity, userId: string): string {
  const key = process.env.MMT_TEST_INTEGRATION_HMAC_SECRET;
  if (!key || Buffer.byteLength(key) < 32) {
    throw new MmtTestError(503, "TEST imza anahtarı yapılandırılmamış.");
  }
  // Separate domain: this attestation is NOT a request credential/signature.
  return createHmac("sha256", key).update("mmt-test-activity-v1:")
    .update(JSON.stringify([
      activity.eventId, activity.docRef, activity.kind,
      activity.sourceTimestamp, userId,
    ])).digest("hex");
}

// This is an internal TEST activity, not a review-queue or commercial approval.
// Existing tables only; no DDL, new pool, or synthetic logistics request.
export async function persistMmtTestEvent(
  input: EventInput, envelope: Envelope, actor: LogisticsActor,
) {
  if (!mmtTestEnabled()) throw new MmtTestError(404, "TEST entegrasyonu kapalı.");
  return db.transaction(async (tx) => {
    // Serialize event-id consumers across processes, not with a global Set.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${integration}:${envelope.eventId}`}, 0))`);
    const [record] = await tx.select().from(logisticsRequestsTable)
      .where(and(
        eq(logisticsRequestsTable.referenceCode, input.docRef),
        eq(logisticsRequestsTable.isTest, true),
      )).limit(1).for("update");
    if (!record) throw new MmtTestError(404, "Erişilebilir TEST dosyası bulunamadı.");

    const [shipment] = await tx.select().from(logisticsShipmentsTable)
      .where(eq(logisticsShipmentsTable.requestId, record.id)).limit(1).for("update");
    const founder = actor.isFounder && isLogisticsFounder(actor.userId);
    if (!founder && record.requesterClerkUserId !== actor.userId &&
        shipment?.assignedStaffClerkUserId !== actor.userId) {
      throw new MmtTestError(403, "Bu TEST dosyasında işlem yetkiniz yok.");
    }

    const prefix = JSON.stringify({ integration, eventId: envelope.eventId }).slice(0, -1);
    // eventId allows '_', which must be escaped in a LIKE pattern.
    const escaped = prefix.replace(/[\\%_]/g, "\\$&");
    const [existing] = await tx.select().from(logisticsCommunicationsTable)
      .where(and(
        eq(logisticsCommunicationsTable.isTest, true),
        like(logisticsCommunicationsTable.message, `${escaped},%`),
      )).limit(1);
    if (existing) {
      let previous: Activity & { activityProof?: string };
      try { previous = JSON.parse(existing.message); }
      catch { throw new MmtTestError(409, "Önceki olay kaydı doğrulanamadı."); }
      // A hand-written generic note must never masquerade as a signed receipt.
      if (!previous || !Number.isSafeInteger(previous.sourceTimestamp) ||
          typeof previous.activityProof !== "string" ||
          !/^[a-f0-9]{64}$/.test(previous.activityProof ?? "") ||
          !timingSafeEqual(
            Buffer.from(previous.activityProof!, "hex"),
            Buffer.from(activityProof(previous, existing.createdByClerkUserId), "hex"),
          )) {
        throw new MmtTestError(409, "Önceki olayın servis kaydı doğrulanamadı.");
      }
      if (existing.requestId !== record.id ||
          existing.createdByClerkUserId !== actor.userId ||
          existing.channel !== "note" || existing.direction !== "internal" ||
          previous.docRef !== input.docRef || previous.kind !== input.kind) {
        throw new MmtTestError(409, "Olay kimliği farklı içerik veya kullanıcıyla kullanılmış.");
      }
      return { alreadyReceived: true };
    }

    const [saved] = await tx.insert(logisticsCommunicationsTable).values({
      requestId: record.id,
      channel: "note",
      direction: "internal",
      isTest: true,
      createdByClerkUserId: actor.userId,
      message: JSON.stringify({
        integration, eventId: envelope.eventId,
        action: "TEST_EVENT_RECEIVED",
        docRef: input.docRef, kind: input.kind,
        sourceTimestamp: envelope.sourceTimestamp,
        activityProof: activityProof({ ...input, ...envelope }, actor.userId),
      }),
    }).returning({ id: logisticsCommunicationsTable.id });
    if (!saved) throw new MmtTestError(503, "TEST olay kaydı doğrulanamadı.");
    return { alreadyReceived: false };
  });
}
