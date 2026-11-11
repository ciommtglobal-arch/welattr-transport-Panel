import { timingSafeEqual } from "node:crypto";
import { z } from "zod/v4";
import { feedItemSchema } from "./logisticsPoolFeed";

// A source is bound to one Telegram group, not to an arbitrary sender-supplied ID.
export const telegramSourceUrl = /^telegram:\/\/group\/(-[1-9]\d{0,18})$/;
export function webhookSecretMatches(actual: string | undefined, expected: string | undefined) {
  if (!expected || expected.length < 32 || !actual) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
const messageSchema = z.object({
  message_id: z.number().int().positive(),
  date: z.number().int().positive(),
  chat: z.object({ id: z.number().int().safe(), type: z.enum(["group", "supergroup"]) }),
  text: z.string().max(8192),
});
export const telegramMarketUpdateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: messageSchema,
});
// Deliberately structured ingestion first: never guess a price/contact/permission
// from free text, or execute instructions embedded in market announcements.
export const marketItemSchema = feedItemSchema.omit({ id: true, sourceUrl: true, isTest: true })
  .extend({
    vehicleType: z.enum(["tenteli", "acik", "damper", "frigo", "sasi"]).optional(),
    role: z.enum(["load", "carrier"]),
    origin: z.string().trim().min(2).max(200),
    destination: z.string().trim().min(2).max(200),
    transportMode: z.literal("road"),
  }).strict().superRefine((item, ctx) => {
    if (item.role === "load" && (!item.requiredKg || !item.requiredDate) ||
        item.role === "carrier" && (!item.capacityKg || !item.availableDate)) {
      ctx.addIssue({ code: "custom", message: "Ağırlık/kapasite ve tarih zorunlu." });
    }
  });

export function marketPricingNote(
  load: { quotedPriceMinor?: number; currency?: string; commissionBps?: number },
  carrier: { quotedPriceMinor?: number; currency?: string },
) {
  if (!load.quotedPriceMinor || !carrier.quotedPriceMinor || !load.currency ||
      load.currency !== carrier.currency || load.commissionBps === undefined) {
    return "Fiyat analizi bekliyor: müşteri satış fiyatı, taşıyıcı bedeli, aynı para birimi ve komisyon oranı teyit edilmeli; tahmini fiyat üretilmedi.";
  }
  const spread = load.quotedPriceMinor - carrier.quotedPriceMinor;
  const commission = Math.round(load.quotedPriceMinor * load.commissionBps / 10000);
  return `Doğrulanmamış fiyat beyanı: satış ${(load.quotedPriceMinor / 100).toFixed(2)}, taşıyıcı bedeli ${(carrier.quotedPriceMinor / 100).toFixed(2)}, brüt ticari fark ${(spread / 100).toFixed(2)} ${load.currency}; satış bazlı ayrı komisyon taslağı ${(commission / 100).toFixed(2)} ${load.currency} (%${load.commissionBps / 100}). Brüt fark net kâr değildir; komisyonun tahsilat/hakediş dağılımı, vergi ve tüm fiyatlar kurucu teyidi bekler.`;
}
