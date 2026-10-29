import { Router, type IRouter } from "express";
import { telegramMarketUpdateSchema, webhookSecretMatches } from "../lib/marketIngestion";
import { verifyTelegramMarketAdmin } from "../lib/telegramMarketListener";
import { enrollTelegramMarketSource } from "../lib/logisticsPool";
import { processMarketFeedText } from "../lib/marketFeedService";

const router: IRouter = Router();
router.post("/telegram/webhook", async (req, res): Promise<void> => {
  if (!webhookSecretMatches(req.get("X-Telegram-Bot-Api-Secret-Token"), process.env.MMT_TELEGRAM_WEBHOOK_SECRET)) {
    res.status(401).json({ error: "Webhook doğrulanamadı." }); return;
  }
  const parsed = telegramMarketUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(200).json({ status: "ignored", reason: "group_text_required" }); return;
  }
  const { message } = parsed.data;
  const age = Date.now() / 1000 - message.date;
  if (message.chat.id >= 0 || age > 86400 || age < -300) {
    res.status(200).json({ status: "ignored", reason: "invalid_or_stale_message" }); return;
  }
  try {
    if (!await verifyTelegramMarketAdmin(message.chat.id)) {
      res.status(200).json({ status: "ignored", reason: "bot_admin_required" }); return;
    }
    const source = await enrollTelegramMarketSource(message.chat.id);
    if (!source.enabled) {
      res.status(200).json({ status: "ignored", reason: "source_disabled" }); return;
    }
    res.status(200).json(await processMarketFeedText(source, String(message.message_id), message.text, new Date(message.date * 1000)));
  } catch {
    req.log.warn("Telegram piyasa doğrulaması veya kaydı tamamlanamadı; yeniden deneme gerekli.");
    res.status(503).json({ error: "Webhook işlenemedi." });
  }
});
export default router;
