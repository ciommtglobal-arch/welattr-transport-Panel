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
  it("accepts the koridor alias but rejects aliases that disagree", () => {
    const { corridor: _, ...source } = order();
    expect(parseLogisticsShopifyOrder({
      ...source, note_attributes: [{ name: "koridor", value: "Samsun-Gurcistan" }],
    }, mapping, "orders/create").corridor).toBe("Samsun-Gurcistan");
    expect(() => parseLogisticsShopifyOrder({
      ...source, note_attributes: [
        { name: "corridor", value: "Samsun-Irak-Proje" },
        { name: "koridor", value: "Samsun-Gurcistan" },
      ],
    }, mapping, "orders/create")).toThrow();
  });
  it.each([null, {}, "corridor", [null], [false], [[]]])("rejects malformed note attributes: %j", note_attributes => {
    expect(() => parseLogisticsShopifyOrder({ ...order(), note_attributes }, mapping, "orders/paid")).toThrow();
  });
  it.each(["", null, undefined])("never hides a supplied empty corridor value: %s", value => {
    expect(() => parseLogisticsShopifyOrder({
      ...order(), note_attributes: [{ name: "corridor", value }],
    }, mapping, "orders/paid")).toThrow();
  });
  it.each(["id", "variant_id"])("validates real IDs on every line: %s", field => {
    for (const invalid of ["0", "00", "-1", "0x10", "1e3", "abc", true, Number.MAX_SAFE_INTEGER + 1]) {
      const source = order();
      expect(() => parseLogisticsShopifyOrder({
        ...source, line_items: [{ ...source.line_items[0], [field]: invalid }],
      }, mapping, "orders/create")).toThrow();
    }
  });
  it("preserves large textual line and variant IDs without numeric coercion", () => {
    const source = order();
    const parsed = parseLogisticsShopifyOrder({
      ...source, line_items: [{
        ...source.line_items[0], id: "9007199254740999", variant_id: "9007199254740997",
      }],
    }, mapping, "orders/create");
    expect(parsed.rows[0]).toMatchObject({ lineId: "9007199254740999", variantId: "9007199254740997" });
  });
  it.each([
    "2026-10-10", "2026-10-10T10:00:00",
    "2026-02-30T10:00:00Z", "2026-04-31T10:00:00Z",
    "2026-10-10T24:00:00Z", "2026-10-10T10:60:00Z",
    "2026-10-10T10:00:60Z", "0000-01-01T00:00:00Z",
  ])("rejects invalid calendar/version/cancellation dates: %s", value => {
    for (const field of ["updated_at", "cancelled_at"]) {
      expect(() => parseLogisticsShopifyOrder({
        ...order(), [field]: value,
      }, mapping, "orders/updated")).toThrow();
    }
  });
  it("accepts real leap days and explicit timezone offsets", () => {
    const parsed = parseLogisticsShopifyOrder({
      ...order(), updated_at: "2024-02-29T13:00:00+03:00",
    }, mapping, "orders/updated");
    expect(parsed.sourceUpdatedAt.toISOString()).toBe("2024-02-29T10:00:00.000Z");
  });
  it("normalizes equivalent prices exactly and rejects malformed or overprecise prices", () => {
    for (const price of ["2", "2.0", "2.00", "0002.00"]) {
      expect(parseLogisticsShopifyOrder({
        ...order(), line_items: [{ ...order().line_items[0], price }],
      }, mapping, "orders/create").rows[0].unitPrice).toBe("2.00");
    }
    for (const price of ["", " ", "0x10", "1e2", "1.239", -1, Infinity, null]) {
      expect(() => parseLogisticsShopifyOrder({
        ...order(), line_items: [{ ...order().line_items[0], price }],
      }, mapping, "orders/create")).toThrow();
    }
  });
  it.each([null, "", "0", false, 1.5, Infinity])("never coerces an invalid current_quantity: %s", current_quantity => {
    expect(() => parseLogisticsShopifyOrder({
      ...order(), line_items: [{ ...order().line_items[0], current_quantity }],
    }, mapping, "orders/updated")).toThrow();
  });
  it("rejects unsupported topics even when the parser is used independently", () => {
    expect(() => parseLogisticsShopifyOrder({
      ...order(), line_items: [],
    }, mapping, "orders/unknown")).toThrow();
  });
});
