import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const quoteInsert = vi.hoisted(() => ({ values: {} as Record<string, unknown> }));
const authState = vi.hoisted(() => ({ role: "finance" as "finance" | "reviewer" | "operations" | "admin" }));
vi.mock("@workspace/db", () => ({
  db: { insert: () => ({
    values: (values: Record<string, unknown>) => ({
      returning: async () => {
        quoteInsert.values = values;
        return [{ ...values, id: 1, status: "new", createdAt: new Date() }];
      },
    }),
  }) },
  constructionQuotesTable: {},
}));
vi.mock("../lib/staffAuth", () => ({
  requireStaff: vi.fn(async () => ({ staff: { role: authState.role } })),
  requireOperationsStaff: vi.fn(async (_req: unknown, res: {
    status: (status: number) => { json: (body: unknown) => void };
  }) => {
    if (authState.role === "operations" || authState.role === "admin")
      return { staff: { role: authState.role } };
    res.status(403).json({ error: "Operations or admin access required" });
    return null;
  }),
}));
vi.mock("../lib/shopifyStorefrontClient", () => ({
  getConstructionCatalog: vi.fn(), getConstructionProduct: vi.fn(), getConstructionCart: vi.fn(),
  createConstructionCart: vi.fn(), addConstructionCartLine: vi.fn(),
  updateConstructionCartLine: vi.fn(), removeConstructionCartLine: vi.fn(),
  checkoutConstructionCart: vi.fn(),
  CartValidationError: class extends Error {},
}));
import {
  getConstructionCatalog, getConstructionProduct, getConstructionCart,
  createConstructionCart, addConstructionCartLine, updateConstructionCartLine,
  removeConstructionCartLine, checkoutConstructionCart,
} from "../lib/shopifyStorefrontClient";
import router from "./storefront";
const app = express();
app.use(express.json());
app.use("/api", router);
describe("reopened construction products store", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getConstructionCatalog).mockResolvedValue({
      connected: true, fetchedAt: new Date().toISOString(),
      shopName: "Store", products: [], collections: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    });
    vi.mocked(getConstructionProduct).mockResolvedValue(null);
    vi.mocked(getConstructionCart).mockResolvedValue(null);
    vi.mocked(checkoutConstructionCart).mockRejectedValue(new Error("Merchant not verified"));
    quoteInsert.values = {};
  });
  it("opens public catalog, product and cart reads without inventing products", async () => {
    const catalog = await request(app).get("/api/storefront/construction/catalog");
    const product = await request(app).get("/api/storefront/construction/products/example");
    const cart = await request(app).get("/api/storefront/construction/cart/gid%3A%2F%2Fshopify%2FCart%2F123");
    expect(catalog.status).toBe(200);
    expect(catalog.body.products).toEqual([]);
    expect(product.status).toBe(404);
    expect(cart.status).toBe(404);
    expect(getConstructionProduct).toHaveBeenCalledWith("example");
    expect(getConstructionCart).toHaveBeenCalledWith("gid://shopify/Cart/123");
  });
  it("allows validated cart creation and line edits to reach Shopify", async () => {
    const cart = "/api/storefront/construction/cart/gid%3A%2F%2Fshopify%2FCart%2F123";
    const variantId = "gid://shopify/ProductVariant/123";
    const lineId = "gid://shopify/CartLine/123";
    expect((await request(app).post("/api/storefront/construction/cart").send({ variantId, quantity: 2 })).status).toBe(201);
    expect((await request(app).post(`${cart}/lines`).send({ variantId, quantity: 2 })).status).toBe(200);
    expect((await request(app).patch(`${cart}/lines`).send({ lineId, quantity: 3 })).status).toBe(200);
    expect((await request(app).delete(`${cart}/lines`).send({ lineId })).status).toBe(200);
    expect(createConstructionCart).toHaveBeenCalledWith(variantId, 2);
    expect(addConstructionCartLine).toHaveBeenCalledWith("gid://shopify/Cart/123", variantId, 2);
    expect(updateConstructionCartLine).toHaveBeenCalledWith("gid://shopify/Cart/123", lineId, 3);
    expect(removeConstructionCartLine).toHaveBeenCalledWith("gid://shopify/Cart/123", lineId);
  });
  it("retains the merchant verification checkout gate", async () => {
    const response = await request(app).post("/api/storefront/construction/cart/gid%3A%2F%2Fshopify%2FCart%2F123/checkout");
    expect(response.status).toBe(503);
    expect(response.body.checkoutUrl).toBeUndefined();
    expect(checkoutConstructionCart).toHaveBeenCalledWith("gid://shopify/Cart/123");
  });
  it("accepts project quotes and returns only a receipt, not contact details", async () => {
    const response = await request(app).post("/api/storefront/construction/quotes").send({
      quantity: 2, dimensions: " 1200 x 600 mm ", deliveryLocation: " Test location ",
      contactName: " Test customer ", contactEmail: " TEST@example.com ", contactPhone: "+900000000000",
    });
    expect(response.status).toBe(201);
    expect(response.body.reference).toMatch(/^INS-\d{4}-[A-F0-9]{12}$/);
    expect(response.body.status).toBe("new");
    expect(response.body.contactEmail).toBeUndefined();
    expect(quoteInsert.values).toMatchObject({
      dimensions: "1200 x 600 mm", contactEmail: "test@example.com",
    });
  });
  it("rejects invalid quote details without saving a record", async () => {
    const response = await request(app).post("/api/storefront/construction/quotes").send({});
    expect(response.status).toBe(400);
    expect(quoteInsert.values).toEqual({});
  });
});
describe("construction quote staff authorization", () => {
  beforeEach(() => { authState.role = "finance"; });
  it.each(["finance", "reviewer"] as const)(
    "denies %s staff access to quote list and status routes",
    async (role) => {
      authState.role = role;
      const list = await request(app).get("/api/storefront/construction/quotes/staff");
      const status = await request(app)
        .patch("/api/storefront/construction/quotes/staff/1/status")
        .send({ status: "reviewing" });
      expect(list.status).toBe(403);
      expect(status.status).toBe(403);
    },
  );
});