import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { parseLogisticsShopifyOrder } from "./nexusLogisticsShopify";
import { verifyShopifySignature } from "./nexusShopify";

const mapping = { shopDomain: "example.myshopify.com", reservations: ["101"], financing: ["102"] };
const order = () => ({
  id: "9007199254740999", name: "#42", corridor: "Samsun-Irak-Proje", currency: "TRY",
  financial_status: "paid", updated_at: "2026-10-10T10:00:00Z", cancelled_at: null,
  line_items: [
    { id: "11", variant_id: "101", title: "Boru", quantity: 2, price: "12.50" },
    { id: "12", variant_id: "999", title: "Bağlantı elemanı", quantity: 3, price: "8.00" },
    { id: "13", variant_id: "102", title: "Finansman ilgisi", quantity: 1, price: "1.00" },
  ],
});
describe("Strict Shopify logistics snapshots", () => {
  it("records every line, including unmapped variants, using real source data", () => {
    const parsed = parseLogisticsShopifyOrder(order(), mapping, "orders/paid");
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.map(row => row.lineId)).toEqual(["11", "12", "13"]);
    expect(parsed.rows[1]).toMatchObject({
      orderId: "9007199254740999", variantId: "999", quantity: 3, unitPrice: "8.00",
      status: "PENDING_FOUNDER_APPROVAL", warning: "Koridor: Samsun-Irak-Proje",
    });
    expect(parsed.rows[2].kind).toBe("financing_interest");
  });
  it("uses actual Shopify note attributes and both allowed corridors", () => {
    const { corridor: _, ...source } = order();
    expect(parseLogisticsShopifyOrder({
      ...source, note_attributes: [{ name: "corridor", value: "Samsun-Gurcistan" }],
    }, mapping, "orders/create").corridor).toBe("Samsun-Gurcistan");
  });
  it("rejects missing, conflicting and unapproved corridors", () => {
    expect(() => parseLogisticsShopifyOrder({ ...order(), corridor: undefined }, mapping, "orders/create")).toThrow();
    expect(() => parseLogisticsShopifyOrder({ ...order(), corridor: "Other" }, mapping, "orders/create")).toThrow();
    expect(() => parseLogisticsShopifyOrder({
      ...order(), note_attributes: [{ name: "corridor", value: "Samsun-Gurcistan" }],
    }, mapping, "orders/create")).toThrow();
  });
  it("retains zero quantities and cancellation events without false defaults", () => {
    const source = order(); source.line_items[0].quantity = 0;
    const parsed = parseLogisticsShopifyOrder(source, mapping, "orders/cancelled");
    expect(parsed.rows[0].quantity).toBe(0);
    expect(parsed.rows.every(row => row.cancelled === 1)).toBe(true);
  });
  it("respects Shopify current_quantity, including a fully removed/refunded line", () => {
    const source = order();
    const parsed = parseLogisticsShopifyOrder({
      ...source, line_items: [{ ...source.line_items[0], current_quantity: 0 }],
    }, mapping, "orders/updated");
    expect(parsed.rows[0].quantity).toBe(0);
    expect(() => parseLogisticsShopifyOrder({
      ...source, line_items: [{ ...source.line_items[0], current_quantity: -1 }],
    }, mapping, "orders/updated")).toThrow();
  });
  it("supports complete empty update snapshots for removed lines", () => {
    expect(parseLogisticsShopifyOrder({ ...order(), line_items: [] }, mapping, "orders/updated").rows).toEqual([]);
    expect(() => parseLogisticsShopifyOrder({ ...order(), line_items: [] }, mapping, "orders/create")).toThrow();
  });
  it.each(["id", "name", "currency", "financial_status", "updated_at"])("does not invent a missing %s", field => {
    expect(() => parseLogisticsShopifyOrder({ ...order(), [field]: undefined }, mapping, "orders/create")).toThrow();
  });
  it.each(["id", "variant_id", "title", "quantity", "price"])("rejects the entire order if a later line lacks %s", field => {
    const source = order();
    expect(() => parseLogisticsShopifyOrder({
      ...source, line_items: [source.line_items[0], { ...source.line_items[1], [field]: undefined }],
    }, mapping, "orders/create")).toThrow();
  });
  it("rejects incompatible custom lines, duplicate IDs and unsafe numbers rather than dropping them", () => {
    const source = order();
    expect(() => parseLogisticsShopifyOrder({
      ...source, line_items: [{ ...source.line_items[0], variant_id: null }],
    }, mapping, "orders/create")).toThrow();
    expect(() => parseLogisticsShopifyOrder({
      ...source, line_items: [source.line_items[0], source.line_items[0]],
    }, mapping, "orders/create")).toThrow();
    expect(() => parseLogisticsShopifyOrder({ ...source, id: Number.MAX_SAFE_INTEGER + 1 }, mapping, "orders/create")).toThrow();
  });
  it.each([-1, 1.5, 2147483648])("rejects invalid PostgreSQL quantities %s", quantity => {
    const source = order(); source.line_items[1].quantity = quantity;
    expect(() => parseLogisticsShopifyOrder(source, mapping, "orders/create")).toThrow();
  });
  it("verifies exact raw strings and buffers without reserializing JSON", () => {
    const raw = '{ "id" : 42, "title":"Boru" }\n';
    const signature = createHmac("sha256", "unit-test-only").update(raw).digest("base64");
    expect(verifyShopifySignature(raw, signature, "unit-test-only")).toBe(true);
    expect(verifyShopifySignature(Buffer.from(raw), signature, "unit-test-only")).toBe(true);
    expect(verifyShopifySignature(raw.trim(), signature, "unit-test-only")).toBe(false);
  });
});
