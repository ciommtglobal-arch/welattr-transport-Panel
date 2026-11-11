import { Router } from "express";
import { nexusMapping, verifyShopifySignature } from "../lib/nexusShopify";
import { parseLogisticsShopifyOrder, shopifyLogisticsTopics, type ShopifyRawRequest } from "../lib/nexusLogisticsShopify";
import { persistNexusSnapshot, ConflictingNexusSnapshot } from "../lib/nexusSnapshotStorage";

const router = Router();
const topics = new Set<string>(shopifyLogisticsTopics);

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
    const result = await persistNexusSnapshot(snapshot, mapping.shopDomain, `logistics:${webhookId}`, topic);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ConflictingNexusSnapshot) {
      req.log?.warn("Conflicting Shopify order snapshots require review.");
      res.status(409).json({ error: "Conflicting snapshots have the same source timestamp; review required." }); return;
    }
    req.log?.warn("Shopify logistics snapshot could not be persisted; retry required.");
    res.status(503).json({ error: "Order snapshot could not be saved; retry required." });
  }
});

export default router;
