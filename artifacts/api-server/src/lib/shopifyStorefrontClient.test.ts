import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
vi.stubEnv("REPLIT_CONNECTORS_HOSTNAME", "connectors.example.com");
vi.stubEnv("REPL_IDENTITY", "test-identity");

function connection() {
  return { ok: true, json: async () => ({ items: [{
    settings: { shop_domain: "store.myshopify.com", storefront_access_token: "public-token" },
  }] }) };
}
function gql(data: unknown) {
  return { ok: true, status: 200, json: async () => ({ data }) };
}
describe("Shopify construction buyer client", () => {
  beforeEach(() => {
    fetchMock.mockReset(); vi.resetModules();
    for (const key of [
      "SHOPIFY_CHECKOUT_MODE", "SHOPIFY_CHECKOUT_MERCHANT_VERIFIED",
      "SHOPIFY_CHECKOUT_VERIFIED_SHOP_DOMAIN", "SHOPIFY_CHECKOUT_MERCHANT_VERIFIED_AT",
    ]) vi.stubEnv(key, "");
  });
  it("uses direct Storefront API and preserves cursor, collection membership, money and stock", async () => {
    fetchMock.mockResolvedValueOnce(connection()).mockResolvedValueOnce(gql({
      shop: { name: "Store" }, collections: { nodes: [], pageInfo: { hasNextPage: false } },
      products: {
        pageInfo: { hasNextPage: true, endCursor: "next" },
        nodes: [{
          id: "gid://shopify/Product/1", title: "Panel", handle: "panel", description: "Real panel",
          productType: "Panel", vendor: "Supplier", tags: ["quote-only"],
          featuredImage: null, collections: { nodes: [{ id: "c1", title: "Panels", handle: "panels" }] },
          variants: { pageInfo: { hasNextPage: false }, nodes: [{
            id: "gid://shopify/ProductVariant/2", title: "Standard",
            price: { amount: "200.00", currencyCode: "TRY" },
            availableForSale: true, quantityAvailable: 7,
          }] },
        }],
      },
    }));
    const { getConstructionCatalog } = await import("./shopifyStorefrontClient");
    const result = await getConstructionCatalog(3, "cursor-test");
    expect(result.pageInfo).toEqual({ hasNextPage: true, endCursor: "next" });
    expect(result.products[0].collections[0].handle).toBe("panels");
    expect(result.products[0].variants[0]).toMatchObject({
      currency: "TRY", inventoryQuantity: 7, availableForSale: true, quoteRequired: true,
    });
    expect(fetchMock.mock.calls[1][0]).toBe("https://store.myshopify.com/api/2026-04/graphql.json");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).variables).toEqual({ first: 3, after: "cursor-test" });
  });
  it("rejects quote-only and excess-stock variants before creating a Shopify cart", async () => {
    const { createConstructionCart, CartValidationError } = await import("./shopifyStorefrontClient");
    fetchMock.mockResolvedValueOnce(connection());
    fetchMock.mockResolvedValueOnce(gql({ node: {
      id: "gid://shopify/ProductVariant/3", availableForSale: true,
      quantityAvailable: 12, price: { amount: "0.00", currencyCode: "TRY" }, product: { tags: [] },
    } }));
    await expect(createConstructionCart("gid://shopify/ProductVariant/3", 1)).rejects.toThrow(CartValidationError);
    fetchMock.mockResolvedValueOnce(gql({ node: {
      id: "gid://shopify/ProductVariant/3", availableForSale: true,
      quantityAvailable: 1, price: { amount: "25.00", currencyCode: "TRY" }, product: { tags: [] },
    } }));
    await expect(createConstructionCart("gid://shopify/ProductVariant/3", 2)).rejects.toThrow("stock");
    expect(fetchMock.mock.calls.filter(call => JSON.parse(call[1]?.body ?? "{}").query?.includes("cartCreate"))).toHaveLength(0);
  });
  it("blocks checkout by default and with mode/attestation but no bound domain", async () => {
    const { checkoutConstructionCart, CheckoutNotReadyError } = await import("./shopifyStorefrontClient");
    await expect(checkoutConstructionCart("gid://shopify/Cart/123")).rejects.toThrow(CheckoutNotReadyError);
    vi.stubEnv("SHOPIFY_CHECKOUT_MODE", "test");
    vi.stubEnv("SHOPIFY_CHECKOUT_MERCHANT_VERIFIED", "true");
    vi.stubEnv("SHOPIFY_CHECKOUT_MERCHANT_VERIFIED_AT", new Date().toISOString());
    await expect(checkoutConstructionCart("gid://shopify/Cart/123")).rejects.toThrow("not been verified");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("validates every line before retrieving a hosted checkout URL on the verified shop", async () => {
    vi.stubEnv("SHOPIFY_CHECKOUT_MODE", "test");
    vi.stubEnv("SHOPIFY_CHECKOUT_MERCHANT_VERIFIED", "true");
    vi.stubEnv("SHOPIFY_CHECKOUT_MERCHANT_VERIFIED_AT", new Date().toISOString());
    vi.stubEnv("SHOPIFY_CHECKOUT_VERIFIED_SHOP_DOMAIN", "store.myshopify.com");
    fetchMock.mockResolvedValueOnce(connection())
      .mockResolvedValueOnce(gql({ cart: { lines: {
        pageInfo: { hasNextPage: false }, nodes: [{
          quantity: 2, merchandise: { id: "gid://shopify/ProductVariant/3",
            availableForSale: true, quantityAvailable: 3,
            price: { amount: "35.00", currencyCode: "TRY" }, product: { tags: [] } },
        }],
      } } }))
      .mockResolvedValueOnce(gql({ cart: { checkoutUrl: "https://store.myshopify.com/checkouts/abc" } }));
    const { checkoutConstructionCart } = await import("./shopifyStorefrontClient");
    await expect(checkoutConstructionCart("gid://shopify/Cart/123")).resolves.toEqual({
      checkoutUrl: "https://store.myshopify.com/checkouts/abc",
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).query).not.toContain("checkoutUrl");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).query).toContain("checkoutUrl");
  });
  it("rejects a checkout URL on an unexpected host", async () => {
    vi.stubEnv("SHOPIFY_CHECKOUT_MODE", "live");
    vi.stubEnv("SHOPIFY_CHECKOUT_MERCHANT_VERIFIED", "true");
    vi.stubEnv("SHOPIFY_CHECKOUT_MERCHANT_VERIFIED_AT", new Date().toISOString());
    vi.stubEnv("SHOPIFY_CHECKOUT_VERIFIED_SHOP_DOMAIN", "store.myshopify.com");
    fetchMock.mockResolvedValueOnce(connection())
      .mockResolvedValueOnce(gql({ cart: { lines: {
        pageInfo: { hasNextPage: false }, nodes: [{
          quantity: 1, merchandise: { id: "gid://shopify/ProductVariant/3",
            availableForSale: true, quantityAvailable: 3,
            price: { amount: "35.00", currencyCode: "TRY" }, product: { tags: [] } },
        }],
      } } }))
      .mockResolvedValueOnce(gql({ cart: { checkoutUrl: "https://store.myshopify.com.evil.example/checkouts/abc" } }));
    const { checkoutConstructionCart } = await import("./shopifyStorefrontClient");
    await expect(checkoutConstructionCart("gid://shopify/Cart/123")).rejects.toThrow("Untrusted");
  });
});