import { Router } from "express";
import { and, eq, lte, notInArray, sql } from "drizzle-orm";
import { db, nexusShopifyEventsTable as events, nexusShopifyIntakesTable as intakes } from "@workspace/db";
import { nexusMapping, verifyShopifySignature } from "../lib/nexusShopify";
import { parseLogisticsShopifyOrder, shopifyLogisticsTopics, type ShopifyRawRequest } from "../lib/nexusLogisticsShopify";

const router = Router();
const topics = new Set<string>(shopifyLogisticsTopics);
const pending = "PENDING_FOUNDER_APPROVAL" as const;
type SourceRow = ReturnType<typeof parseLogisticsShopifyOrder>["rows"][number];
const sourceFields = [
  "orderName", "variantId", "kind", "productTitle", "quantity", "unitPrice",
  "currency", "financialStatus", "cancelled", "warning",
] as const;
function sameSource(old: typeof intakes.$inferSelect, row: SourceRow): boolean {
  return sourceFields.every(field => old[field] === row[field]);
}
// Unchanged deliveries must not reset an owner's decision. Material changes
// invalidate approval of the old snapshot, never grant a new approval.
function nextStatus(row: SourceRow) {
  const changed = sql.join(sourceFields.map(field =>
    sql`${intakes[field]} IS DISTINCT FROM ${row[field]}`), sql` OR `);
  return sql`CASE WHEN (${changed}) THEN ${pending}::nexus_approval_status ELSE ${intakes.status} END`;
}
class ConflictingSnapshot extends Error {}

router.post("/mmt/secure-sync", async (req, res): Promise<void> => {
  const mapping = nexusMapping(true);
  const secret = process.env.SHOPIFY_NEXUS_WEBHOOK_SECRET;
  if (!mapping || !secret) {
    res.status(503).json({ error: "Shopify logistics configuration is incomplete." }); return;
  }
  const raw = (req as ShopifyRawRequest).rawBody;
  if ((typeof raw !== "string" && !Buffer.isBuffer(raw)) ||
      !verifyShopifySignature(raw, req.get("X-Shopify-Hmac-Sha256") ?? "", secret)) {
    res.status(401).json({ error: "Missing raw body or invalid Shopify signature." }); return;
  }
  if (req.get("X-Shopify-Shop-Domain")?.toLowerCase() !== mapping.shopDomain) {
    res.status(403).json({ error: "Unexpected Shopify shop." }); return;
  }
  const topic = req.get("X-Shopify-Topic") ?? "";
  const webhookId = req.get("X-Shopify-Webhook-Id") ?? "";
  if (!topics.has(topic) || !/^[a-zA-Z0-9-]{1,128}$/.test(webhookId)) {
    res.status(400).json({ error: "Invalid Shopify topic or webhook identity." }); return;
  }
  let snapshot: ReturnType<typeof parseLogisticsShopifyOrder>;
  try {
    snapshot = parseLogisticsShopifyOrder(
      JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8")), mapping, topic,
    );
  } catch {
    res.status(400).json({ error: "Invalid order data, required line fields or logistics corridor." }); return;
  }
  try {
    const result = await db.transaction(async tx => {
      // Serialize snapshots of one order across server instances. The existing
      // unique indexes still enforce event and line identity in PostgreSQL.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${mapping.shopDomain}:${snapshot.orderId}`}, 0))`);
      const [event] = await tx.insert(events).values({
        shopDomain: mapping.shopDomain,
        // Separate this receiver's retry key from the legacy Nexus receiver.
        webhookId: `logistics:${webhookId}`, topic,
      }).onConflictDoNothing().returning({ id: events.id });
      if (!event) return { duplicate: true, stale: false, received: 0, removed: 0 };
      const orderWhere = and(eq(intakes.shopDomain, mapping.shopDomain), eq(intakes.orderId, snapshot.orderId));
      const previous = await tx.select().from(intakes).where(orderWhere);
      const latest = Math.max(...previous.map(row => row.sourceUpdatedAt.getTime()), -Infinity);
      const incoming = snapshot.sourceUpdatedAt.getTime();
      if (incoming < latest) return { duplicate: false, stale: true, received: 0, removed: 0 };
      const byLine = new Map(previous.map(row => [row.lineId, row]));
      const lineIds = snapshot.rows.map(row => row.lineId);
      const removedRows = previous.filter(row => !lineIds.includes(row.lineId));
      const removalWarning = `${snapshot.warning}; Shopify siparişinde bu kalem kaldırıldı.`;
      const removalRows = removedRows.map(row => ({
        ...row, orderName: snapshot.orderName, quantity: 0, currency: snapshot.currency,
        financialStatus: snapshot.financialStatus, cancelled: snapshot.cancelled,
        warning: removalWarning, status: pending, sourceUpdatedAt: snapshot.sourceUpdatedAt,
      }));
      // Equal timestamp + changed contents has no provable ordering. Roll back
      // the event and all rows, rather than overwrite an unseen source version.
      if (incoming === latest && (
        snapshot.rows.some(row => !byLine.has(row.lineId) || !sameSource(byLine.get(row.lineId)!, row)) ||
        removalRows.some(row => !sameSource(byLine.get(row.lineId)!, row))
      )) throw new ConflictingSnapshot();
      for (const row of snapshot.rows) {
        const { shopDomain: _shop, orderId: _order, lineId: _line, status: _status, ...source } = row;
        await tx.insert(intakes).values(row).onConflictDoUpdate({
          target: [intakes.shopDomain, intakes.orderId, intakes.lineId],
          set: { ...source, status: nextStatus(row) },
          setWhere: lte(intakes.sourceUpdatedAt, snapshot.sourceUpdatedAt),
        });
      }
      // Keep historical lines, but record their removal from the complete
      // Shopify snapshot; no existing record is deleted.
      for (const row of removalRows) {
        await tx.update(intakes).set({
          orderName: row.orderName, quantity: 0, currency: row.currency,
          financialStatus: row.financialStatus, cancelled: row.cancelled,
          warning: row.warning, sourceUpdatedAt: row.sourceUpdatedAt, status: nextStatus(row),
        }).where(and(orderWhere, eq(intakes.lineId, row.lineId),
          lte(intakes.sourceUpdatedAt, snapshot.sourceUpdatedAt),
          lineIds.length ? notInArray(intakes.lineId, lineIds) : undefined));
      }
      return { duplicate: false, stale: false, received: snapshot.rows.length, removed: removalRows.length };
    });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ConflictingSnapshot) {
      req.log?.warn("Conflicting Shopify order snapshots require review.");
      res.status(409).json({ error: "Conflicting snapshots have the same source timestamp; review required." }); return;
    }
    req.log?.warn("Shopify logistics snapshot could not be persisted; retry required.");
    res.status(503).json({ error: "Order snapshot could not be saved; retry required." });
  }
});

export default router;
