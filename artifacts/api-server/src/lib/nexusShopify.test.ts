import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { nexusMapping, parseNexusOrder, verifyShopifySignature } from "./nexusShopify";
const mapping = { shopDomain: "test-shop.myshopify.com", reservations: ["101"], financing: ["102"] };
const payload = () => ({
  id: 200, name: "#200", currency: "TRY", updated_at: "2026-10-10T10:00:00Z",
  financial_status: "paid", cancelled_at: null,
  line_items: [{ id: 301, variant_id: 101, title: "Reservation", quantity: 1, price: "75000.00" }],
});
afterEach(() => vi.unstubAllEnvs());
describe("Nexus order intake rules", () => {
  it("creates pending founder approval even for paid orders", () => {
    const [row] = parseNexusOrder(payload(), mapping);
    expect(row).toMatchObject({ status: "PENDING_FOUNDER_APPROVAL", financialStatus: "paid", unitPrice: "75000.00", warning: null });
  });
  it("does not treat unrelated products at the same price as reservations", () => {
    const order = payload(); order.line_items[0].variant_id = 999;
    expect(parseNexusOrder(order, mapping)).toEqual([]);
  });
  it("maps the finance product to interest, not an approved bank application", () => {
    const order = payload(); order.line_items[0].variant_id = 102; order.line_items[0].price = "1";
    expect(parseNexusOrder(order, mapping)[0]).toMatchObject({ kind: "financing_interest", status: "PENDING_FOUNDER_APPROVAL", unitPrice: "1.00" });
  });
  it("keeps amount/currency mismatches for founder inspection", () => {
    const order = payload(); order.currency = "USD"; order.line_items[0].price = "74000.00";
    expect(parseNexusOrder(order, mapping)[0].warning).toBeTruthy();
  });
  it("records cancellation separately without granting approval", () => {
    expect(parseNexusOrder({ ...payload(), cancelled_at: "2026-10-10T11:00:00Z" }, mapping)[0])
      .toMatchObject({ cancelled: 1, status: "PENDING_FOUNDER_APPROVAL" });
  });
  it.each(["NaN", "Infinity", "-1", "75000.001"])("rejects invalid money %s", price => {
    const order = payload(); order.line_items[0].price = price;
    expect(() => parseNexusOrder(order, mapping)).toThrow();
  });
  it("rejects unsafe IDs, duplicate lines, bad dates and quantities", () => {
    expect(() => parseNexusOrder({ ...payload(), id: Number.MAX_SAFE_INTEGER + 1 }, mapping)).toThrow();
    const order = payload();
    expect(() => parseNexusOrder({ ...order, line_items: [...order.line_items, ...order.line_items] }, mapping)).toThrow();
    expect(() => parseNexusOrder({ ...order, updated_at: "not a date" }, mapping)).toThrow();
    order.line_items[0].quantity = -1;
    expect(() => parseNexusOrder(order, mapping)).toThrow();
  });
  it("fails closed if mapping is absent or ambiguous", () => {
    vi.stubEnv("SHOPIFY_NEXUS_SHOP_DOMAIN", mapping.shopDomain);
    vi.stubEnv("SHOPIFY_NEXUS_RESERVATION_VARIANT_IDS", "101");
    vi.stubEnv("SHOPIFY_NEXUS_FINANCING_VARIANT_IDS", "101");
    expect(nexusMapping()).toBeNull();
    vi.stubEnv("SHOPIFY_NEXUS_FINANCING_VARIANT_IDS", "102");
    expect(nexusMapping()).toEqual(mapping);
  });
  it("verifies the untouched raw body and rejects tampering", () => {
    const raw = Buffer.from(JSON.stringify(payload()));
    const signature = createHmac("sha256", "test-secret").update(raw).digest("base64");
    expect(verifyShopifySignature(raw, signature, "test-secret")).toBe(true);
    expect(verifyShopifySignature(Buffer.concat([raw, Buffer.from(" ")]), signature, "test-secret")).toBe(false);
    expect(verifyShopifySignature(raw, "", "test-secret")).toBe(false);
  });
});
