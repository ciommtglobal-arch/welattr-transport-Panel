import { Router } from "express";
import { GetNexusIntakesResponse } from "@workspace/api-zod";
import { and, desc, eq, lte } from "drizzle-orm";
import { db, nexusShopifyEventsTable as events, nexusShopifyIntakesTable as intakes } from "@workspace/db";
import { requireUser } from "../lib/staffAuth";
import { isLogisticsFounder } from "../lib/logisticsListingAuth";
import { nexusMapping, parseNexusOrder, verifyShopifySignature } from "../lib/nexusShopify";

const router = Router();
const topics = new Set(["orders/create", "orders/paid", "orders/updated", "orders/cancelled"]);

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
  try { rows = parseNexusOrder(JSON.parse(req.body.toString("utf8")), mapping); }
  catch { res.status(400).json({ error: "Invalid Nexus order data." }); return; }
  try {
    const result = await db.transaction(async tx => {
      const [event] = await tx.insert(events).values({ shopDomain: mapping.shopDomain, webhookId, topic })
        .onConflictDoNothing().returning({ id: events.id });
      if (!event) return { duplicate: true, received: 0 };
      for (const row of rows) {
        // Status is deliberately absent from conflict updates: provider events never override founder decisions.
        const { status: _status, ...source } = row;
        await tx.insert(intakes).values(row).onConflictDoUpdate({
          target: [intakes.shopDomain, intakes.orderId, intakes.lineId],
          set: source,
          setWhere: lte(intakes.sourceUpdatedAt, row.sourceUpdatedAt),
        });
      }
      return { duplicate: false, received: rows.length };
    });
    res.status(200).json(result);
  } catch {
    req.log?.warn("Nexus webhook could not be persisted; Shopify should retry.");
    res.status(503).json({ error: "Nexus records could not be saved; retry required." });
  }
});

router.get("/nexus/intakes", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  if (!isLogisticsFounder(userId)) {
    res.status(403).json({ error: "Bu denetim masası yalnız kurucuya açıktır." }); return;
  }
  const mapping = nexusMapping(true);
  if (!mapping) { res.status(503).json({ error: "Nexus mağaza eşleştirmesi henüz yapılandırılmadı." }); return; }
  try {
    const rows = await db.select().from(intakes)
      .where(and(eq(intakes.shopDomain, mapping.shopDomain)))
      .orderBy(desc(intakes.createdAt)).limit(100);
    res.setHeader("Cache-Control", "no-store");
    res.json(GetNexusIntakesResponse.parse(rows.map(row => ({
      ...row, createdAt: row.createdAt.toISOString(), sourceUpdatedAt: row.sourceUpdatedAt.toISOString(),
    }))));
  } catch { res.status(503).json({ error: "Nexus denetim kayıtları henüz alınamıyor." }); }
});
export default router;
