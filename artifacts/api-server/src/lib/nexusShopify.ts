import { createHmac, timingSafeEqual } from "node:crypto";

export type NexusMapping = { shopDomain: string; reservations: string[]; financing: string[] };
export function nexusMapping(allowUnmappedLines = false): NexusMapping | null {
  const shopDomain = process.env.SHOPIFY_NEXUS_SHOP_DOMAIN?.trim().toLowerCase() ?? "";
  const ids = (value?: string) => (value ?? "").split(",").map(x => x.trim()).filter(Boolean);
  const reservations = ids(process.env.SHOPIFY_NEXUS_RESERVATION_VARIANT_IDS);
  const financing = ids(process.env.SHOPIFY_NEXUS_FINANCING_VARIANT_IDS);
  const all = [...reservations, ...financing];
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain) ||
      (!allowUnmappedLines && (!reservations.length || !financing.length)) || all.some(x => !/^\d+$/.test(x)) ||
      new Set(all).size !== all.length) return null;
  return { shopDomain, reservations, financing };
}

export function verifyShopifySignature(raw: Buffer | string, signature: string, secret: string): boolean {
  if (!secret || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const actual = Buffer.from(signature, "base64");
  const expected = createHmac("sha256", secret).update(raw).digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid order object");
  return value as ObjectValue;
}
function id(value: unknown): string {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value <= 0)) throw new Error("Invalid ID");
  const result = String(value ?? "");
  if (!/^[1-9]\d{0,24}$/.test(result)) throw new Error("Invalid ID");
  return result;
}
function price(value: unknown): string {
  const result = String(value ?? "");
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(result)) throw new Error("Invalid money");
  const [whole, fraction = ""] = result.split(".");
  return `${BigInt(whole)}.${fraction.padEnd(2, "0")}`;
}
export function parseNexusOrder(payload: unknown, mapping: NexusMapping) {
  const order = object(payload);
  const orderId = id(order.id);
  const orderName = typeof order.name === "string" ? order.name.slice(0, 100) : orderId;
  if (typeof order.currency !== "string" || !/^[A-Z]{3}$/.test(order.currency)) throw new Error("Invalid currency");
  const currency = order.currency;
  const updated = typeof order.updated_at === "string" ? new Date(order.updated_at) : new Date(NaN);
  if (!Number.isFinite(updated.getTime())) throw new Error("Invalid source timestamp");
  if (!Array.isArray(order.line_items) || order.line_items.length > 500) throw new Error("Invalid order lines");
  const seen = new Set<string>();
  return order.line_items.flatMap(value => {
    const line = object(value);
    if (line.variant_id == null) return [];
    const variantId = id(line.variant_id);
    const kind = mapping.reservations.includes(variantId) ? "reservation" as const
      : mapping.financing.includes(variantId) ? "financing_interest" as const : null;
    if (!kind) return [];
    const lineId = id(line.id);
    if (seen.has(lineId)) throw new Error("Duplicate line");
    seen.add(lineId);
    if (!Number.isSafeInteger(line.quantity) || Number(line.quantity) <= 0 || Number(line.quantity) > 10000) throw new Error("Invalid quantity");
    const unitPrice = price(line.price);
    const warning = currency !== "TRY" || (kind === "reservation" && unitPrice !== "75000.00")
      ? "Tutar veya para birimi beklenen rezervasyon tarifesiyle uyuşmuyor; kurucu incelemesi gerekli." : null;
    return [{
      shopDomain: mapping.shopDomain, orderId, orderName, lineId, variantId, kind,
      productTitle: typeof line.title === "string" ? line.title.slice(0, 300) : "Nexus kaydı",
      quantity: Number(line.quantity), unitPrice, currency,
      financialStatus: typeof order.financial_status === "string" ? order.financial_status.slice(0, 50) : "unknown",
      cancelled: order.cancelled_at ? 1 : 0, warning,
      status: "PENDING_FOUNDER_APPROVAL" as const, sourceUpdatedAt: updated,
    }];
  });
}
