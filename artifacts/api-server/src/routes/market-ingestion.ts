import { Router, type IRouter } from "express";
import { db, logisticsPoolSourcesTable as sources } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { ingestTelegramMarketItem } from "../lib/logisticsPool";
import { parseMarketText } from "../lib/marketTextParser";
import { processMarketFeedText } from "../lib/marketFeedService";
import { marketItemSchema, telegramMarketUpdateSchema, telegramSourceUrl, webhookSecretMatches } from "../lib/marketIngestion";

const router: IRouter = Router();
router.post("/logistics/market/telegram/:sourceId", async (req, res): Promise<void> => {
  const id = z.string().uuid().safeParse(req.params.sourceId);
  if (!id.success) { res.status(400).json({ error: "Geçersiz kaynak." }); return; }
  // Separate inbound secret; never reuse a bot token. Configuration alone does
  // not register a Telegram webhook or disturb the existing polling bots.
  const key = `MMT_MARKET_TELEGRAM_SECRET_${id.data.replaceAll("-", "_").toUpperCase()}`;
  if (!webhookSecretMatches(req.get("X-Telegram-Bot-Api-Secret-Token"), process.env[key])) {
    res.status(401).json({ error: "Webhook doğrulanamadı." }); return;
  }
  const parsed = telegramMarketUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(200).json({ status: "ignored", reason: "unsupported_update" }); return; }
  const update = parsed.data;
  const [source] = await db.select().from(sources).where(eq(sources.id, id.data));
  if (!source?.enabled || !source.consentBy || !source.consentAt ||
      telegramSourceUrl.exec(source.url)?.[1] !== String(update.message.chat.id)) {
    res.status(403).json({ error: "Grup kaynağı izinli değil." }); return;
  }
  const age = Date.now() / 1000 - update.message.date;
  if (age > 86400 || age < -300) {
    res.status(200).json({ status: "ignored", reason: "expired_message" }); return;
  }
  let body: unknown;
  try { body = JSON.parse(update.message.text); } catch {
    const extraction = parseMarketText(update.message.text, String(update.message.message_id), new Date(update.message.date * 1000));
    if (!extraction) {
      res.status(200).json({ status: "ignored", reason: "unclassified_text" }); return;
    }
    try {
      const inserted = await ingestTelegramMarketItem(source, update.message.message_id, extraction.item, {...extraction.metadata,marketOccurredAt:new Date(update.message.date * 1000).toISOString()});
      res.status(200).json({ status: !inserted ? "duplicate" : extraction.metadata.eligible ? "accepted" : "needs_review",
        missing: extraction.metadata.parserMissing, messagesSent: false });
    } catch {
      req.log.warn("Piyasa metni kaydedilemedi.");
      res.status(503).json({ error: "Kayıt tamamlanamadı." });
    }
    return;
  }
  const item = marketItemSchema.safeParse(body);
  if (!item.success) {
    res.status(200).json({ status: "ignored", reason: "invalid_market_item" }); return;
  }
  try {
    const inserted = await ingestTelegramMarketItem(source, update.message.message_id, {
      ...item.data, id: String(update.message.message_id), isTest: false,
    }, { vehicleType: item.data.vehicleType, marketOccurredAt:new Date(update.message.date * 1000).toISOString() });
    res.status(200).json({ status: inserted ? "accepted" : "duplicate", messagesSent: false });
  } catch {
    req.log.warn("Piyasa kaydı saklanamadı; Telegram tekrar deneyebilir.");
    res.status(503).json({ error: "Kayıt tamamlanamadı." });
  }
});
const marketEnvelope = z.object({
  sourceId: z.string().uuid(),
  eventId: z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),
  occurredAt: z.string().datetime({ offset: true }),
  text: z.string().trim().min(1).max(8192),
}).strict();
router.post("/ingest/market-feed", async (req, res): Promise<void> => {
  const parsed = marketEnvelope.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz olay." }); return; }
  const { sourceId, eventId, occurredAt, text } = parsed.data;
  const key = `MMT_MARKET_FEED_SECRET_${sourceId.replaceAll("-", "_").toUpperCase()}`;
  if (!webhookSecretMatches(req.get("X-MMT-Market-Secret"), process.env[key])) {
    res.status(401).json({ error: "Kaynak doğrulanamadı." }); return;
  }
  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId));
  if (!source?.enabled || !source.consentBy || !source.consentAt ||
      !/^market:\/\/source\/[a-z0-9-]{3,64}$/.test(source.url)) {
    res.status(403).json({ error: "İzinli piyasa kaynağı gerekli." }); return;
  }
  const age = Date.now() - Date.parse(occurredAt);
  if (age > 86400000 || age < -300000) {
    res.status(400).json({ error: "Olay tarihi geçersiz veya eski." }); return;
  }
  try {
    const result = await processMarketFeedText(source, eventId, text, new Date(occurredAt));
    res.status(result.status === "ignored" ? 422 : 200).json(result);
  } catch {
    req.log.warn("Piyasa kaydı saklanamadı.");
    res.status(503).json({ error: "Kayıt tamamlanamadı." });
  }
});
export default router;
