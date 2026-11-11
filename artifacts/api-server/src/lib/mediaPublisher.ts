import { createHmac } from "node:crypto";
import {
  db,
  mediaDeliveriesTable,
  mediaItemsTable,
  type MediaItem,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";

const objectStorageService = new ObjectStorageService();
const PILOT_NOTICE = "MMT Global, uzman ekibiyle pilot çalışma ve altyapı doğrulama aşamasındadır.";

type TelegramResponse = {
  ok?: boolean;
  result?: { message_id?: number };
  description?: string;
};

function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId =
    process.env.MEDIA_TELEGRAM_CHAT_ID?.trim() ||
    process.env.TELEGRAM_CHANNEL_ID?.trim() ||
    process.env.TELEGRAM_GROUP_ID?.trim();

  if (!token || !chatId) return null;
  return { token, chatId };
}

function getWebhookConfig() {
  const url = process.env.SOCIAL_DISTRIBUTION_WEBHOOK_URL?.trim();
  const secret = process.env.SOCIAL_DISTRIBUTION_WEBHOOK_SECRET?.trim();
  if (!url || !secret) return null;
  return { url, secret };
}

function buildCaption(item: MediaItem) {
  const source = item.sourceUrl ? `\n\nKaynak: ${item.sourceUrl}` : "";
  return `${PILOT_NOTICE}\n\n${item.title}\n\n${item.summary}${source}`.slice(0, 1024);
}

async function sendTelegram(item: MediaItem) {
  const config = getTelegramConfig();
  if (!config) {
    throw new Error(
      "Telegram medya dağıtımı için TELEGRAM_BOT_TOKEN ve MEDIA_TELEGRAM_CHAT_ID yapılandırılmalıdır.",
    );
  }

  const endpoint = `https://api.telegram.org/bot${config.token}`;
  const caption = buildCaption(item);
  let method = "sendMessage";
  const form = new FormData();
  form.set("chat_id", config.chatId);

  if (!item.objectPath) {
    form.set("text", `${PILOT_NOTICE}\n\n${item.title}\n\n${item.summary}${item.sourceUrl ? `\n\nKaynak: ${item.sourceUrl}` : ""}`.slice(0, 4096));
  } else {
    const file = await objectStorageService.getObjectEntityFile(item.objectPath);
    const [bytes] = await file.download();
    const fileBytes = new Uint8Array(bytes.length);
    fileBytes.set(bytes);
    const blob = new Blob([fileBytes.buffer as ArrayBuffer], {
      type: item.contentType ?? "application/octet-stream",
    });
    form.set("caption", caption);
    form.set(
      item.contentType?.startsWith("image/")
        ? "photo"
        : item.contentType?.startsWith("video/")
          ? "video"
          : item.contentType?.startsWith("audio/")
            ? "audio"
            : "document",
      blob,
      item.fileName ?? "mmt-global-media",
    );
    method = item.contentType?.startsWith("image/")
      ? "sendPhoto"
      : item.contentType?.startsWith("video/")
        ? "sendVideo"
        : item.contentType?.startsWith("audio/")
          ? "sendAudio"
          : "sendDocument";
  }

  const response = await fetch(`${endpoint}/${method}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json()) as TelegramResponse;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.description ?? "Telegram gönderimi başarısız.");
  }

  return payload.result?.message_id
    ? String(payload.result.message_id)
    : null;
}

async function sendWebhook(item: MediaItem) {
  const config = getWebhookConfig();
  if (!config) return null;

  const mediaUrl = item.objectPath
    ? (
        await objectStorageService.getObjectEntityDownloadURL(
          item.objectPath,
          15 * 60,
        )
      ).downloadURL
    : null;
  const payload = {
    event: "media.published",
    version: 1,
    idempotencyKey: `media-${item.id}-${item.updatedAt.getTime()}`,
    item: {
      id: item.id,
      title: item.title,
      summary: item.summary,
      category: item.category,
      sourceUrl: item.sourceUrl,
      mediaUrl,
      fileName: item.fileName,
      contentType: item.contentType,
      size: item.size,
      publishedAt: item.publishedAt?.toISOString() ?? null,
    },
  };
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", config.secret)
    .update(body, "utf8")
    .digest("hex");
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MMT-Event": "media.published",
      "X-MMT-Signature": `sha256=${signature}`,
      "X-MMT-Idempotency-Key": payload.idempotencyKey,
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Sosyal dağıtım webhook'u ${response.status} döndürdü.`);
  }

  const responseBody = (await response.json().catch(() => null)) as
    | { id?: string }
    | null;
  return responseBody?.id ?? response.headers.get("x-delivery-id");
}

async function ensureDelivery(
  mediaItemId: number,
  target: "telegram" | "webhook",
) {
  const [existing] = await db
    .select()
    .from(mediaDeliveriesTable)
    .where(
      and(
        eq(mediaDeliveriesTable.mediaItemId, mediaItemId),
        eq(mediaDeliveriesTable.target, target),
      ),
    )
    .limit(1);

  if (existing?.status === "sent" || existing?.status === "sending") {
    return existing;
  }

  if (existing) {
    const [updated] = await db
      .update(mediaDeliveriesTable)
      .set({
        status: "pending",
        updatedAt: new Date(),
        lastError: null,
      })
      .where(eq(mediaDeliveriesTable.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(mediaDeliveriesTable)
    .values({ mediaItemId, target })
    .returning();
  return created;
}

export async function dispatchMediaToTelegram(mediaItemId: number) {
  const [item] = await db
    .select()
    .from(mediaItemsTable)
    .where(eq(mediaItemsTable.id, mediaItemId))
    .limit(1);
  if (!item) throw new Error("Medya kaydı bulunamadı.");
  if (item.status !== "approved" || item.pilotType !== "pilot_real" || !item.founderApprovedAt) {
    throw new Error("Yalnızca kurucu onaylı gerçek pilot içeriği gönderilebilir.");
  }

  const delivery = await ensureDelivery(mediaItemId, "telegram");
  if (delivery.status === "sent") return delivery;

  const [sending] = await db
    .update(mediaDeliveriesTable)
    .set({
      status: "sending",
      attempts: delivery.attempts + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(mediaDeliveriesTable.id, delivery.id), eq(mediaDeliveriesTable.status, "pending")))
    .returning();
  if (!sending) throw new Error("Telegram gönderimi zaten devam ediyor; kanalı kontrol edin.");

  try {
    const externalId = await sendTelegram(item);
    const [sent] = await db
      .update(mediaDeliveriesTable)
      .set({
        status: "sent",
        externalId,
        lastError: null,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mediaDeliveriesTable.id, sending.id))
      .returning();
    return sent;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const [failed] = await db
      .update(mediaDeliveriesTable)
      .set({ status: "failed", lastError: message, updatedAt: new Date() })
      .where(eq(mediaDeliveriesTable.id, sending.id))
      .returning();
    throw Object.assign(new Error(message), { delivery: failed });
  }
}

export async function dispatchMediaToDestinations(mediaItemId: number) {
  const [item] = await db.select().from(mediaItemsTable).where(eq(mediaItemsTable.id, mediaItemId)).limit(1);
  if (!item || item.status !== "approved" || item.pilotType !== "pilot_real" || !item.founderApprovedAt) {
    throw new Error("TEST veya onaysız medya dış hedeflere gönderilemez.");
  }
  const results = await Promise.allSettled([
    dispatchMediaToTelegram(mediaItemId),
    getWebhookConfig()
      ? dispatchMediaToWebhook(mediaItemId)
      : Promise.resolve(null),
  ]);
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failures.length > 0) {
    throw failures[0].reason;
  }
  return results;
}

export async function dispatchMediaToWebhook(mediaItemId: number) {
  const [item] = await db
    .select()
    .from(mediaItemsTable)
    .where(eq(mediaItemsTable.id, mediaItemId))
    .limit(1);
  if (!item) throw new Error("Medya kaydı bulunamadı.");
  if (item.status !== "approved" || item.pilotType !== "pilot_real" || !item.founderApprovedAt) {
    throw new Error("TEST veya onaysız medya webhook'a gönderilemez.");
  }
  if (!getWebhookConfig()) return null;

  const delivery = await ensureDelivery(mediaItemId, "webhook");
  if (delivery.status === "sent") return delivery;

  const [sending] = await db
    .update(mediaDeliveriesTable)
    .set({
      status: "sending",
      attempts: delivery.attempts + 1,
      updatedAt: new Date(),
    })
    .where(eq(mediaDeliveriesTable.id, delivery.id))
    .returning();

  try {
    const externalId = await sendWebhook(item);
    const [sent] = await db
      .update(mediaDeliveriesTable)
      .set({
        status: "sent",
        externalId,
        lastError: null,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mediaDeliveriesTable.id, sending.id))
      .returning();
    return sent;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(mediaDeliveriesTable)
      .set({ status: "failed", lastError: message, updatedAt: new Date() })
      .where(eq(mediaDeliveriesTable.id, sending.id));
    throw new Error(message);
  }
}

export async function queuePublishedMediaDelivery(mediaItemId: number) {
  // Automatic delivery is intentionally disabled. A founder must explicitly
  // request a real publication after both review stages.
  void mediaItemId;
}