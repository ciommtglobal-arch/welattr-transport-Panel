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
describe("paused construction products store", () => {
  beforeEach(() => {
    vi.mocked(checkoutConstructionCart).mockReset();
    quoteInsert.values = {};
  });
  it("blocks public product and cart reads", async () => {
    const responses = await Promise.all([
      request(app).get("/api/storefront/construction/catalog"),
      request(app).get("/api/storefront/construction/products/example"),
      request(app).get("/api/storefront/construction/cart/gid%3A%2F%2Fshopify%2FCart%2F123"),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: "Construction products store is closed" });
      expect(response.headers["cache-control"]).toBe("no-store");
    }
  });
  it("blocks all new cart, checkout, and quote actions without changing records", async () => {
    const cart = "/api/storefront/construction/cart/gid%3A%2F%2Fshopify%2FCart%2F123";
    const responses = await Promise.all([
      request(app).post("/api/storefront/construction/cart"),
      request(app).post(`${cart}/lines`),
      request(app).patch(`${cart}/lines`),
      request(app).delete(`${cart}/lines`),
      request(app).post(`${cart}/checkout`),
      request(app).post("/api/storefront/construction/quotes"),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: "Construction products store is closed" });
    }
    expect(checkoutConstructionCart).not.toHaveBeenCalled();
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