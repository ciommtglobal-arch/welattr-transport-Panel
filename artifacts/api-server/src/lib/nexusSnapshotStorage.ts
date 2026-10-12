import { and, eq, lte, notInArray, sql } from "drizzle-orm";
import { db, nexusShopifyEventsTable as events, nexusShopifyIntakesTable as intakes } from "@workspace/db";
import type { parseLogisticsShopifyOrder } from "./nexusLogisticsShopify";
import { nexusReviewUpdate, sameNexusSource } from "./nexusReview";

export class ConflictingNexusSnapshot extends Error {}
type Snapshot = ReturnType<typeof parseLogisticsShopifyOrder>;

// A complete, corridor-validated snapshot has the same semantics regardless of
// which signed receiver accepted it. Cross-receiver retries preserve decisions.
export async function persistNexusSnapshot(snapshot: Snapshot, shopDomain: string, webhookId: string, topic: string) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${shopDomain}:${snapshot.orderId}`}, 0))`);
    const [event] = await tx.insert(events).values({ shopDomain, webhookId, topic })
      .onConflictDoNothing().returning({ id: events.id });
    if (!event) return { duplicate: true, stale: false, received: 0, removed: 0 };
    const orderWhere = and(eq(intakes.shopDomain, shopDomain), eq(intakes.orderId, snapshot.orderId));
    const previous = await tx.select().from(intakes).where(orderWhere);
    const latest = Math.max(...previous.map(row => row.sourceUpdatedAt.getTime()), -Infinity);
    const incoming = snapshot.sourceUpdatedAt.getTime();
    if (incoming < latest) return { duplicate: false, stale: true, received: 0, removed: 0 };
    const byLine = new Map(previous.map(row => [row.lineId, row]));
    const lineIds = snapshot.rows.map(row => row.lineId);
    const removalRows = previous.filter(row => !lineIds.includes(row.lineId)).map(row => ({
      ...row, orderName: snapshot.orderName, quantity: 0, currency: snapshot.currency, corridor: snapshot.corridor,
      financialStatus: snapshot.financialStatus, cancelled: snapshot.cancelled,
      warning: `${snapshot.warning}; Shopify siparişinde bu kalem kaldırıldı.`,
      sourceUpdatedAt: snapshot.sourceUpdatedAt,
    }));
    if (incoming === latest && (
      snapshot.rows.some(row => !byLine.has(row.lineId) || !sameNexusSource(byLine.get(row.lineId)!, row)) ||
      removalRows.some(row => !sameNexusSource(byLine.get(row.lineId)!, row))
    )) throw new ConflictingNexusSnapshot();
    for (const row of snapshot.rows) {
      const { shopDomain: _shop, orderId: _order, lineId: _line, status: _status, ...source } = row;
      await tx.insert(intakes).values(row).onConflictDoUpdate({
        target: [intakes.shopDomain, intakes.orderId, intakes.lineId],
        set: { ...source, ...nexusReviewUpdate(row) },
        setWhere: lte(intakes.sourceUpdatedAt, snapshot.sourceUpdatedAt),
      });
    }
    for (const row of removalRows) {
      await tx.update(intakes).set({
        orderName: row.orderName, quantity: 0, currency: row.currency,
        financialStatus: row.financialStatus, cancelled: row.cancelled,
        warning: row.warning, corridor: row.corridor, sourceUpdatedAt: row.sourceUpdatedAt, ...nexusReviewUpdate(row),
      }).where(and(orderWhere, eq(intakes.lineId, row.lineId),
        lte(intakes.sourceUpdatedAt, snapshot.sourceUpdatedAt),
        lineIds.length ? notInArray(intakes.lineId, lineIds) : undefined));
    }
    return { duplicate: false, stale: false, received: snapshot.rows.length, removed: removalRows.length };
  });
}
