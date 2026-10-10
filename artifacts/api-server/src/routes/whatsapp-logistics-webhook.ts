import { Router, type IRouter } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  db,
  logisticsInboundDraftsTable,
  logisticsInboundMessagesTable,
  logisticsRequestsTable,
  logisticsShipmentsTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { requireStaff } from "../lib/staffAuth";
import {
  applyWhatsAppMessageToDraft,
  buildMissingInformationReply,
  extractWhatsAppTextMessages,
  getMissingIntakeFields,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
  type LogisticsIntakeValues,
  type WhatsAppTextMessage,
} from "../lib/whatsappLogisticsIntake";

const router: IRouter = Router();

function referenceCode(prefix: string) {
  return `${prefix}-${new Date().getUTCFullYear()}-${randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function toIntakeValues(draft: typeof logisticsInboundDraftsTable.$inferSelect) {
  return {
    requesterName: draft.requesterName,
    organization: draft.organization,
    email: draft.email,
    origin: draft.origin,
    destination: draft.destination,
    cargoType: draft.cargoType,
    weightKg: draft.weightKg,
    volumeM3: draft.volumeM3,
    transportMode: draft.transportMode,
    loadingDate: draft.loadingDate,
    notes: draft.notes,
  } satisfies LogisticsIntakeValues;
}

async function prepareReply(message: WhatsAppTextMessage) {
  return db.transaction(async (tx) => {
    // Serialize updates from one sender so two quick replies cannot overwrite
    // each other's fields or create duplicate active drafts.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${message.senderPhone}))`);

    const [priorMessage] = await tx
      .select()
      .from(logisticsInboundMessagesTable)
      .where(eq(logisticsInboundMessagesTable.providerMessageId, message.providerMessageId))
      .limit(1);
    if (priorMessage) {
      return {
        id: priorMessage.id,
        replyText: priorMessage.replyText,
        alreadySent: priorMessage.replyStatus === "sent",
      };
    }

    const [messageRecord] = await tx
      .insert(logisticsInboundMessagesTable)
      .values({
        providerMessageId: message.providerMessageId,
        senderPhone: message.senderPhone,
      })
      .onConflictDoNothing()
      .returning();
    if (!messageRecord) {
      const [duplicate] = await tx
        .select()
        .from(logisticsInboundMessagesTable)
        .where(eq(logisticsInboundMessagesTable.providerMessageId, message.providerMessageId))
        .limit(1);
      return {
        id: duplicate.id,
        replyText: duplicate.replyText,
        alreadySent: duplicate.replyStatus === "sent",
      };
    }

    let [draft] = await tx
      .select()
      .from(logisticsInboundDraftsTable)
      .where(
        and(
          eq(logisticsInboundDraftsTable.senderPhone, message.senderPhone),
          eq(logisticsInboundDraftsTable.status, "collecting"),
        ),
      )
      .for("update")
      .limit(1);

    if (!draft) {
      [draft] = await tx
        .insert(logisticsInboundDraftsTable)
        .values({
          senderPhone: message.senderPhone,
          requesterName: message.profileName,
        })
        .onConflictDoNothing()
        .returning();
      if (!draft) {
        [draft] = await tx
          .select()
          .from(logisticsInboundDraftsTable)
          .where(
            and(
              eq(logisticsInboundDraftsTable.senderPhone, message.senderPhone),
              eq(logisticsInboundDraftsTable.status, "collecting"),
            ),
          )
          .for("update")
          .limit(1);
      }
    }
    if (!draft) throw new Error("Could not create an inbound logistics draft.");

    const parsed = applyWhatsAppMessageToDraft(
      toIntakeValues(draft),
      message.text,
      message.profileName,
    );
    const [updatedDraft] = await tx
      .update(logisticsInboundDraftsTable)
      .set({ ...parsed.values, updatedAt: new Date() })
      .where(eq(logisticsInboundDraftsTable.id, draft.id))
      .returning();

    const missingFields = getMissingIntakeFields(toIntakeValues(updatedDraft));
    let replyText: string;
    if (missingFields.length > 0) {
      replyText = buildMissingInformationReply(missingFields, parsed.invalidFields);
    } else {
      const [request] = await tx
        .insert(logisticsRequestsTable)
        .values({
          referenceCode: referenceCode("LOAD"),
          requesterName: updatedDraft.requesterName!,
          organization: updatedDraft.organization,
          email: updatedDraft.email!,
          phone: updatedDraft.senderPhone,
          origin: updatedDraft.origin!,
          destination: updatedDraft.destination!,
          cargoType: updatedDraft.cargoType!,
          weightKg: updatedDraft.weightKg!,
          volumeM3: updatedDraft.volumeM3!,
          transportMode: updatedDraft.transportMode!,
          loadingDate: updatedDraft.loadingDate!,
          notes: updatedDraft.notes,
          isTest: false,
        })
        .returning();
      await tx.insert(logisticsShipmentsTable).values({
        requestId: request.id,
        referenceCode: request.referenceCode,
        status: "new_request",
      });
      await tx
        .update(logisticsInboundDraftsTable)
        .set({ status: "completed", requestId: request.id, updatedAt: new Date() })
        .where(eq(logisticsInboundDraftsTable.id, updatedDraft.id));
      replyText = `Teşekkürler, lojistik talebiniz alındı. Referans numaranız: ${request.referenceCode}. MMT ekibi talebi inceleyip size dönüş yapacak.`;
    }

    await tx
      .update(logisticsInboundMessagesTable)
      .set({ draftId: updatedDraft.id, replyText })
      .where(eq(logisticsInboundMessagesTable.id, messageRecord.id));

    return {
      id: messageRecord.id,
      replyText,
      alreadySent: false,
    };
  });
}

async function sendWhatsAppReply(to: string, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) throw new Error("WhatsApp phone number id is not configured.");

  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy(
    "whatsapp-business",
    `/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`WhatsApp reply request failed with status ${response.status}.`);
  }
}

router.get("/webhook/whatsapp", (req, res): void => {
  if (!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    res.status(503).json({ error: "WhatsApp webhook verification is not configured." });
    return;
  }
  const challenge = verifyMetaWebhookChallenge(
    req.query["hub.mode"],
    req.query["hub.challenge"],
    req.query["hub.verify_token"],
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  );
  if (challenge === null) {
    res.sendStatus(403);
    return;
  }
  res.status(200).type("text/plain").send(challenge);
});

router.post("/webhook/whatsapp", async (req, res): Promise<void> => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : null;
  if (
    !rawBody ||
    !verifyMetaWebhookSignature(
      rawBody,
      req.get("x-hub-signature-256"),
      process.env.META_APP_SECRET,
    )
  ) {
    res.sendStatus(401);
    return;
  }
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    res.status(503).json({ error: "WhatsApp phone number id is not configured." });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid WhatsApp webhook JSON." });
    return;
  }
  const messages = extractWhatsAppTextMessages(payload, phoneNumberId);
  try {
    for (const message of messages) {
      const reply = await prepareReply(message);
      if (reply.alreadySent || !reply.replyText) continue;

      await db
        .update(logisticsInboundMessagesTable)
        .set({ replyAttempts: sql`${logisticsInboundMessagesTable.replyAttempts} + 1` })
        .where(eq(logisticsInboundMessagesTable.id, reply.id));
      try {
        await sendWhatsAppReply(message.senderPhone, reply.replyText);
        await db
          .update(logisticsInboundMessagesTable)
          .set({ replyStatus: "sent", repliedAt: new Date() })
          .where(eq(logisticsInboundMessagesTable.id, reply.id));
      } catch {
        await db
          .update(logisticsInboundMessagesTable)
          .set({ replyStatus: "failed" })
          .where(eq(logisticsInboundMessagesTable.id, reply.id));
        req.log.error("WhatsApp automatic reply delivery failed");
        res.status(503).json({ error: "WhatsApp reply could not be delivered." });
        return;
      }
    }
  } catch {
    req.log.error("WhatsApp logistics webhook processing failed");
    res.status(500).json({ error: "WhatsApp logistics request could not be processed." });
    return;
  }

  res.status(200).json({ received: true });
});

router.get("/logistics/inbound-drafts", requireStaff, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: logisticsInboundDraftsTable.id,
      senderPhone: logisticsInboundDraftsTable.senderPhone,
      requesterName: logisticsInboundDraftsTable.requesterName,
      email: logisticsInboundDraftsTable.email,
      origin: logisticsInboundDraftsTable.origin,
      destination: logisticsInboundDraftsTable.destination,
      cargoType: logisticsInboundDraftsTable.cargoType,
      weightKg: logisticsInboundDraftsTable.weightKg,
      volumeM3: logisticsInboundDraftsTable.volumeM3,
      transportMode: logisticsInboundDraftsTable.transportMode,
      loadingDate: logisticsInboundDraftsTable.loadingDate,
      status: logisticsInboundDraftsTable.status,
      updatedAt: logisticsInboundDraftsTable.updatedAt,
    })
    .from(logisticsInboundDraftsTable)
    .where(eq(logisticsInboundDraftsTable.status, "collecting"))
    .orderBy(desc(logisticsInboundDraftsTable.updatedAt))
    .limit(50);

  res.json({ drafts: rows });
});

export default router;
