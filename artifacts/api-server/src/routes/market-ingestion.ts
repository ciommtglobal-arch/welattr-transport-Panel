import { Router, type IRouter } from "express";
import { db, logisticsPoolSourcesTable as sources } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { ingestTelegramMarketItem } from "../lib/logisticsPool";
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
    res.status(200).json({ status: "ignored", reason: "structured_json_required" }); return;
  }
  const item = marketItemSchema.safeParse(body);
  if (!item.success) {
    res.status(200).json({ status: "ignored", reason: "invalid_market_item" }); return;
  }
  try {
    const inserted = await ingestTelegramMarketItem(source, update.message.message_id, {
      ...item.data, id: String(update.message.message_id), isTest: false,
    });
    res.status(200).json({ status: inserted ? "accepted" : "duplicate", messagesSent: false });
  } catch {
    req.log.warn("Piyasa kaydı saklanamadı; Telegram tekrar deneyebilir.");
    res.status(503).json({ error: "Kayıt tamamlanamadı." });
  }
});
export default router;
