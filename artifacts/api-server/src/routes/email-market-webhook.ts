import { Router } from "express";
import { Webhook } from "svix";
import { createHash } from "node:crypto";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db, logisticsPoolSourcesTable as sources } from "@workspace/db";
import { processMarketFeedText } from "../lib/marketFeedService";

const envelope = z.object({
  type:z.literal("event"), event_type:z.literal("message.received"),
  message:z.object({
    inbox_id:z.string().min(1).max(320), message_id:z.string().min(1).max(998),
    created_at:z.string().datetime({offset:true}),
    subject:z.string().max(998).optional(),
    extracted_text:z.string().max(8192).optional(),
    text:z.string().max(8192).optional(),
  }),
});
const router = Router();
router.post("/webhook/email", async (req,res): Promise<void> => {
  const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
  const inbox = process.env.MMT_EMAIL_INBOX?.trim().toLowerCase();
  const sourceId = process.env.MMT_EMAIL_SOURCE_ID;
  // Domain verification and mailbox creation are external prerequisites.
  // This route never registers domains, changes DNS or sends email.
  if (!secret || !inbox || !/^[^\s@]+@welattr\.com$/.test(inbox) ||
      !z.string().uuid().safeParse(sourceId).success) {
    res.status(503).json({error:"E-posta kaynağı yapılandırılmadı."}); return;
  }
  if (!Buffer.isBuffer(req.body)) { res.status(400).json({error:"Ham içerik gerekli."}); return; }
  let body: unknown;
  try {
    new Webhook(secret).verify(req.body.toString("utf8"), {
      "svix-id":req.get("svix-id") ?? "",
      "svix-timestamp":req.get("svix-timestamp") ?? "",
      "svix-signature":req.get("svix-signature") ?? "",
    });
    body = JSON.parse(req.body.toString("utf8"));
  } catch { res.status(401).json({error:"İmza doğrulanamadı."}); return; }
  if ((body as {event_type?:string})?.event_type !== "message.received") {
    res.status(200).json({status:"ignored",messagesSent:false}); return;
  }
  const parsed = envelope.safeParse(body);
  if (!parsed.success) { res.status(400).json({error:"Geçersiz e-posta olayı."}); return; }
  const message = parsed.data.message;
  if (message.inbox_id.toLowerCase() !== inbox) {
    res.status(403).json({error:"İzinli kutu değil."}); return;
  }
  const occurredAt = new Date(message.created_at);
  const age = Date.now()-occurredAt.getTime();
  if (age>86400000 || age < -300000) { res.status(400).json({error:"Eski veya geçersiz olay."}); return; }
  // No HTML execution, attachment downloads, URL fetching or quoted-chain guessing.
  const text = message.extracted_text?.trim() || message.text?.trim();
  if (!text) { res.status(503).json({error:"Düz metin gövdesi eksik; sağlayıcıdan tamamlanmalı."}); return; }
  try {
    const [source] = await db.select().from(sources).where(eq(sources.id,sourceId!));
    if (!source?.enabled || !source.consentBy || !source.consentAt ||
        source.url !== "market://source/welattr-email") {
      res.status(403).json({error:"E-posta kaynak izni bulunamadı."}); return;
    }
    // Stable identity even if the provider delivers the same mail under new event IDs.
    const id = "email_"+createHash("sha256").update(JSON.stringify([inbox,message.message_id])).digest("hex");
    const combined = [message.subject,text].filter(Boolean).join("\n");
    if (combined.length>8192) { res.status(400).json({error:"İlan metni çok uzun."}); return; }
    res.status(200).json(await processMarketFeedText(source,id,combined,occurredAt));
  } catch {
    req.log.warn("E-posta piyasa kaydı tamamlanamadı.");
    res.status(503).json({error:"Kayıt tamamlanamadı; tekrar deneyin."});
  }
});
export default router;
