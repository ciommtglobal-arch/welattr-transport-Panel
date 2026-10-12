import { raw, type Request } from "express";
import type { NexusMapping } from "./nexusShopify";

export type ShopifyRawRequest = Request & { rawBody?: Buffer | string };
export function createShopifyLogisticsRawParser() {
  return raw({
    type: "application/json", limit: "1mb", inflate: false,
    verify(req, _res, body) {
      (req as ShopifyRawRequest).rawBody = Buffer.from(body);
    },
  });
}
export const logisticsCorridors = ["Samsun-Irak-Proje", "Samsun-Gurcistan"] as const;
export type LogisticsCorridor = typeof logisticsCorridors[number];
export const shopifyLogisticsTopics = ["orders/create", "orders/paid", "orders/updated", "orders/cancelled"] as const;

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object");
  return value as JsonObject;
}
function text(value: unknown, limit: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new Error("Invalid text");
  return value;
}
function id(value: unknown): string {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value <= 0)) throw new Error("Unsafe ID");
  if (typeof value !== "string" && typeof value !== "number") throw new Error("Missing ID");
  const result = String(value);
  if (!/^[1-9]\d{0,24}$/.test(result)) throw new Error("Invalid ID");
  return result;
}
function date(value: unknown): Date {
  const source = text(value, 50);
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(Z|[+-]\d\d:\d\d)$/.exec(source);
  if (!match) throw new Error("Invalid timestamp");
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // JS Date normalizes some invalid dates (e.g. February 30 or 24:00).
  // Reject these before any source version or cancellation reaches storage.
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] ||
      hour > 23 || minute > 59 || second > 59) throw new Error("Invalid timestamp");
  const result = new Date(source);
  if (!Number.isFinite(result.getTime())) throw new Error("Invalid timestamp");
  return result;
}
function money(value: unknown): string {
  const source = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof source !== "string" || !/^\d{1,12}(?:\.\d{1,2})?$/.test(source)) throw new Error("Invalid price");
  const [whole, fraction = ""] = source.split(".");
  return `${BigInt(whole)}.${fraction.padEnd(2, "0")}`;
}
function corridorFor(order: JsonObject): LogisticsCorridor {
  const candidates: unknown[] = [];
  if (order.corridor !== undefined) candidates.push(order.corridor);
  if (order.note_attributes !== undefined) {
    if (!Array.isArray(order.note_attributes)) throw new Error("Invalid note attributes");
    for (const value of order.note_attributes) {
      const attribute = object(value);
      if (attribute.name === "corridor" || attribute.name === "koridor") candidates.push(attribute.value);
    }
  }
  if (!candidates.length || candidates.some(value => value !== candidates[0]) ||
      !logisticsCorridors.includes(candidates[0] as LogisticsCorridor)) throw new Error("Invalid corridor");
  return candidates[0] as LogisticsCorridor;
}

/** Strict, complete order snapshots. No defaults, dropped lines, or invented IDs.
 * Existing `kind` denotes an internal intake purpose, not a Shopify product type.
 * Logistics merchandise enters as a reservation; configured financing variants
 * remain financing interests and never become approved bank applications.
 */
export function parseLogisticsShopifyOrder(payload: unknown, mapping: NexusMapping, topic: string) {
  if (!shopifyLogisticsTopics.some(allowed => allowed === topic)) throw new Error("Invalid topic");
  const order = object(payload);
  const corridor = corridorFor(order);
  const orderId = id(order.id);
  const orderName = text(order.name, 100);
  const currency = text(order.currency, 3);
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Invalid currency");
  const financialStatus = text(order.financial_status, 50);
  if (!/^[a-z_]+$/.test(financialStatus)) throw new Error("Invalid financial status");
  const sourceUpdatedAt = date(order.updated_at);
  if (order.cancelled_at !== null && order.cancelled_at !== undefined) date(order.cancelled_at);
  const cancelled = topic === "orders/cancelled" || order.cancelled_at != null ? 1 : 0;
  if (!Array.isArray(order.line_items) || order.line_items.length > 500) throw new Error("Invalid lines");
  if (!order.line_items.length && topic !== "orders/updated" && topic !== "orders/cancelled")
    throw new Error("Empty new order");
  const seen = new Set<string>();
  const warning = `Koridor: ${corridor}`;
  const rows = order.line_items.map(value => {
    const line = object(value);
    const lineId = id(line.id);
    if (seen.has(lineId)) throw new Error("Duplicate line");
    seen.add(lineId);
    // The existing table requires a real, non-null variant ID. Unsupported
    // custom/deleted-product lines reject the whole delivery instead of being lost.
    const variantId = id(line.variant_id);
    const validQuantity = (value: unknown) =>
      Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 2147483647;
    if (!validQuantity(line.quantity) ||
        (line.current_quantity !== undefined && !validQuantity(line.current_quantity)))
      throw new Error("Invalid quantity");
    const quantity = line.current_quantity === undefined ? Number(line.quantity) : Number(line.current_quantity);
    const kind = mapping.financing.includes(variantId) ? "financing_interest" as const : "reservation" as const;
    return {
      shopDomain: mapping.shopDomain, orderId, orderName, lineId, variantId, kind,
      productTitle: text(line.title, 1000), quantity, unitPrice: money(line.price),
      currency, financialStatus, cancelled, warning, corridor,
      status: "PENDING_FOUNDER_APPROVAL" as const, sourceUpdatedAt,
    };
  });
  return { orderId, orderName, corridor, currency, financialStatus, cancelled, sourceUpdatedAt, warning, rows };
}
