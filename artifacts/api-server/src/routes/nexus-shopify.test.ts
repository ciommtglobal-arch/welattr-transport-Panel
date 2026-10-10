import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createHmac } from "node:crypto";
const state = vi.hoisted(() => ({
  duplicate: false, fail: false, user: "founder", inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[], transactions: 0,
}));
vi.mock("@workspace/db", () => ({
  nexusShopifyEventsTable: { id: "eventId" },
  nexusShopifyIntakesTable: { shopDomain: "shop", orderId: "order", lineId: "line", sourceUpdatedAt: "updated", createdAt: "created" },
  db: {
    transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      state.transactions++;
      if (state.fail) throw new Error("storage offline");
      return run({ insert: () => ({ values: (row: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({ returning: async () => state.duplicate ? [] : [{ id: 1 }] }),
        onConflictDoUpdate: async (options: { set: Record<string, unknown> }) => {
          state.inserts.push(row); state.updates.push(options.set);
        },
      }) }) });
    },
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [] }) }) }) }),
  },
}));
vi.mock("../lib/staffAuth", () => ({
  requireUser: (_req: unknown, res: express.Response) => {
    if (!state.user) { res.status(401).json({ error: "sign in" }); return null; }
    return state.user;
  },
}));
vi.mock("../lib/logisticsListingAuth", () => ({ isLogisticsFounder: (id: string) => id === "founder" }));
import router from "./nexus-shopify";
const app = express();
app.use("/api/webhook/shopify/nexus", express.raw({ type: "application/json" }));
app.use(express.json());
app.use("/api", router);
const path = "/api/webhook/shopify/nexus";
const body = JSON.stringify({
  id: 10, name: "#10", currency: "TRY", updated_at: "2026-10-10T10:00:00Z", financial_status: "paid",
  line_items: [{ id: 20, variant_id: 101, title: "Reservation", quantity: 1, price: "75000.00" }],
});
function send(shop = "test-shop.myshopify.com", data = body, signature = createHmac("sha256", "test-secret").update(data).digest("base64")) {
  return request(app).post(path).set("Content-Type", "application/json")
    .set("X-Shopify-Hmac-Sha256", signature).set("X-Shopify-Shop-Domain", shop)
    .set("X-Shopify-Topic", "orders/paid").set("X-Shopify-Webhook-Id", "test-event-1").send(data);
}
beforeEach(() => {
  state.duplicate = false; state.fail = false; state.user = "founder";
  state.inserts = []; state.updates = []; state.transactions = 0;
  vi.stubEnv("SHOPIFY_NEXUS_SHOP_DOMAIN", "test-shop.myshopify.com");
  vi.stubEnv("SHOPIFY_NEXUS_RESERVATION_VARIANT_IDS", "101");
  vi.stubEnv("SHOPIFY_NEXUS_FINANCING_VARIANT_IDS", "102");
  vi.stubEnv("SHOPIFY_NEXUS_WEBHOOK_SECRET", "test-secret");
});
afterEach(() => vi.unstubAllEnvs());
describe("Nexus webhook and desk", () => {
  it("persists pending records in a transaction without updating founder status", async () => {
    expect((await send()).status).toBe(200);
    expect(state.transactions).toBe(1);
    expect(state.inserts[0].status).toBe("PENDING_FOUNDER_APPROVAL");
    expect(state.updates[0]).not.toHaveProperty("status");
  });
  it("acknowledges duplicate notifications without a second intake", async () => {
    state.duplicate = true;
    expect((await send()).body).toEqual({ duplicate: true, received: 0 });
    expect(state.inserts).toEqual([]);
  });
  it("rejects tampering and other shops before writing", async () => {
    expect((await send("other.myshopify.com")).status).toBe(403);
    expect((await send("test-shop.myshopify.com", `${body} `, createHmac("sha256", "test-secret").update(body).digest("base64"))).status).toBe(401);
    expect(state.transactions).toBe(0);
  });
  it("returns 503, not success, on missing configuration or storage failure", async () => {
    state.fail = true; expect((await send()).status).toBe(503);
    vi.stubEnv("SHOPIFY_NEXUS_WEBHOOK_SECRET", "");
    expect((await send()).status).toBe(503);
  });
  it.each(["admin", "operations", "finance", "leader", "assistant"])("denies desk access to %s", async user => {
    state.user = user;
    expect((await request(app).get("/api/nexus/intakes")).status).toBe(403);
  });
  it("requires sign-in and permits the allowlisted founder", async () => {
    state.user = ""; expect((await request(app).get("/api/nexus/intakes")).status).toBe(401);
    state.user = "founder"; expect((await request(app).get("/api/nexus/intakes")).body).toEqual([]);
  });
});
