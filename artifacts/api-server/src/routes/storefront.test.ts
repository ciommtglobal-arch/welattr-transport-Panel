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
import { checkoutConstructionCart } from "../lib/shopifyStorefrontClient";
import router from "./storefront";
const app = express();
app.use(express.json());
app.use("/api", router);
describe("construction checkout gate", () => {
  beforeEach(() => vi.mocked(checkoutConstructionCart).mockReset());
  it("never exposes Shopify checkout URL even with a supplied cart ID", async () => {
    vi.mocked(checkoutConstructionCart).mockRejectedValueOnce(new Error("Not verified"));
    const response = await request(app).post("/api/storefront/construction/cart/gid%3A%2F%2Fshopify%2FCart%2F123/checkout");
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toMatch(/checkoutUrl|https?:\/\//);
  });
  it("returns only a verified hosted checkout URL on an authorized request", async () => {
    vi.mocked(checkoutConstructionCart).mockResolvedValueOnce({
      checkoutUrl: "https://store.myshopify.com/checkouts/abc",
    });
    const response = await request(app).post("/api/storefront/construction/cart/gid%3A%2F%2Fshopify%2FCart%2F123/checkout");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ checkoutUrl: "https://store.myshopify.com/checkouts/abc" });
  });
});
describe("public construction quote", () => {
  const body = {
    quantity: 2, dimensions: "  200 x 100 cm  ", deliveryLocation: "  Istanbul  ",
    contactName: "  Example Buyer  ", contactEmail: "  buyer@example.com  ",
    contactPhone: "  5551234567  ",
  };
  it("trims submitted contact details and returns a PII-free receipt", async () => {
    const response = await request(app).post("/api/storefront/construction/quotes").send(body);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 1, status: "new" });
    expect(quoteInsert.values).toMatchObject({
      dimensions: "200 x 100 cm", deliveryLocation: "Istanbul",
      contactName: "Example Buyer", contactEmail: "buyer@example.com",
      contactPhone: "5551234567",
    });
    expect(JSON.stringify(response.body)).not.toMatch(/buyer@example.com|5551234567|Example Buyer|contact/i);
  });
  it("rejects a filled spam honeypot", async () => {
    const response = await request(app).post("/api/storefront/construction/quotes")
      .send({ ...body, website: "https://spam.example" });
    expect(response.status).toBe(400);
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