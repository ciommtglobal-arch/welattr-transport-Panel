import { Router } from "express";
import { and, eq, lte, sql } from "drizzle-orm";
import { db, nexusShopifyEventsTable as events, nexusShopifyIntakesTable as intakes } from "@workspace/db";
import { nexusMapping, parseNexusOrder, verifyShopifySignature } from "../lib/nexusShopify";
import { nexusReviewUpdate, sameNexusSource } from "../lib/nexusReview";
import nexusReviewRouter from "./nexus-review";
import { parseLogisticsShopifyOrder } from "../lib/nexusLogisticsShopify";
import { persistNexusSnapshot, ConflictingNexusSnapshot } from "../lib/nexusSnapshotStorage";

const router = Router();
const topics = new Set(["orders/create", "orders/paid", "orders/updated", "orders/cancelled"]);
class ConflictingSnapshot extends Error {}

// Receiver only. This does not register webhooks, charge, fulfil or approve orders.
router.post("/webhook/shopify/nexus", async (req, res) => {
  const mapping = nexusMapping();
  const secret = process.env.SHOPIFY_NEXUS_WEBHOOK_SECRET;
  if (!mapping || !secret) {
    res.status(503).json({ error: "Nexus webhook configuration is incomplete." }); return;
  }
  if (!Buffer.isBuffer(req.body) || !verifyShopifySignature(req.body, req.get("X-Shopify-Hmac-Sha256") ?? "", secret)) {
    res.status(401).json({ error: "Invalid Shopify signature." }); return;
  }
  if (req.get("X-Shopify-Shop-Domain")?.toLowerCase() !== mapping.shopDomain) {
    res.status(403).json({ error: "Unexpected Shopify shop." }); return;
  }
  const topic = req.get("X-Shopify-Topic") ?? "";
  const webhookId = req.get("X-Shopify-Webhook-Id") ?? "";
  if (!topics.has(topic) || !/^[a-zA-Z0-9-]{1,128}$/.test(webhookId)) {
    res.status(400).json({ error: "Invalid webhook identity or topic." }); return;
  }
  let rows: ReturnType<typeof parseNexusOrder>;
  let payload: Record<string, unknown>;
  let sourceUpdatedAt: Date;
  let complete: ReturnType<typeof parseLogisticsShopifyOrder> | null = null;
  try {
    payload = JSON.parse(req.body.toString("utf8"));
    const hasCorridor = payload.corridor !== undefined ||
      Array.isArray(payload.note_attributes) && payload.note_attributes.some(attribute =>
        attribute && typeof attribute === "object" && ["corridor", "koridor"].includes(
          String((attribute as { name?: unknown }).name ?? "").trim().toLowerCase()));
    if (hasCorridor) complete = parseLogisticsShopifyOrder(payload, mapping, topic);
    rows = complete ? [] : parseNexusOrder(payload, mapping);
    sourceUpdatedAt = new Date(String(payload.updated_at ?? payload.created_at ?? ""));
    if (!Number.isFinite(sourceUpdatedAt.getTime())) throw new Error("Missing source timestamp");
    if (topic === "orders/cancelled") rows = rows.map(row => ({ ...row, cancelled: 1 }));
  }
  catch { res.status(400).json({ error: "Invalid Nexus order data." }); return; }
  try {
    if (complete) {
      res.status(200).json(await persistNexusSnapshot(complete, mapping.shopDomain, webhookId, topic)); return;
    }
    const result = await db.transaction(async tx => {
      const orderId = String(payload.id);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${mapping.shopDomain}:${orderId}`}, 0))`);
      const [event] = await tx.insert(events).values({ shopDomain: mapping.shopDomain, webhookId, topic })
        .onConflictDoNothing().returning({ id: events.id });
      if (!event) return { duplicate: true, received: 0 };
      const scope = and(eq(intakes.shopDomain, mapping.shopDomain), eq(intakes.orderId, orderId));
      const previous = await tx.select().from(intakes).where(scope);
      const latest = Math.max(...previous.map(row => row.sourceUpdatedAt.getTime()), -Infinity);
      if (sourceUpdatedAt.getTime() < latest) return { duplicate: false, received: 0, stale: true };
      const byLine = new Map(previous.map(row => [row.lineId, row]));
      for (const item of rows) {
        const row = { ...item, corridor: null };
        const old = byLine.get(row.lineId);
        // Legacy payloads do not validate a corridor. Compare their known
        // source terms, then explicitly remove any prior publication eligibility.
        if (old && old.sourceUpdatedAt.getTime() === sourceUpdatedAt.getTime() &&
            !sameNexusSource({ ...old, corridor: null }, row)) throw new ConflictingSnapshot();
        const { status: _status, ...source } = row;
        await tx.insert(intakes).values(row).onConflictDoUpdate({
          target: [intakes.shopDomain, intakes.orderId, intakes.lineId],
          set: { ...source, ...nexusReviewUpdate(row) },
          setWhere: lte(intakes.sourceUpdatedAt, row.sourceUpdatedAt),
        });
      }
      // Selected-variant legacy notifications are not a complete publication
      // snapshot. Fence existing corridor cards even when their line is unmapped
      // or absent; only secure-sync can restore verified corridor eligibility.
      const matched = new Set(rows.map(row => row.lineId));
      for (const old of previous) {
        if (matched.has(old.lineId)) continue;
        if (old.corridor !== null || topic === "orders/cancelled") {
          await tx.update(intakes).set({
            corridor: null, status: "PENDING_FOUNDER_APPROVAL",
            reviewedSourceHash: null, reviewedAt: null, reviewedBy: null,
            publishedSourceHash: null, publishedAt: null, publishedBy: null,
            ...(topic === "orders/cancelled" ? { cancelled: 1 } : {}),
            sourceUpdatedAt,
          }).where(and(scope, eq(intakes.lineId, old.lineId), lte(intakes.sourceUpdatedAt, sourceUpdatedAt)));
        }
      }
      return { duplicate: false, received: rows.length };
    });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ConflictingSnapshot || error instanceof ConflictingNexusSnapshot) {
      res.status(409).json({ error: "Aynı kaynak zamanında çelişen sipariş sürümleri var." }); return;
    }
    req.log?.warn("Nexus webhook could not be persisted; Shopify should retry.");
    res.status(503).json({ error: "Nexus records could not be saved; retry required." });
  }
});

router.use(nexusReviewRouter);
export default router;
