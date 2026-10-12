import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createHmac } from "node:crypto";
const state = vi.hoisted(() => ({
  duplicate: false, fail: false, user: "founder", inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[], transactions: 0,
  rows: [] as Record<string, unknown>[],
}));
vi.mock("@workspace/db", async () => ({
  ...await import("../../../../lib/db/src/schema/nexus-shopify"),
  db: {
    transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      state.transactions++;
      if (state.fail) throw new Error("storage offline");
      return run({
        execute: async () => undefined,
        select: () => ({ from: () => ({ where: async () => state.rows.map(row => ({ ...row })) }) }),
        update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => {
          state.rows.forEach(row => Object.assign(row, values));
        } }) }),
        insert: () => ({ values: (row: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({ returning: async () => state.duplicate ? [] : [{ id: 1 }] }),
        onConflictDoUpdate: async (options: { set: Record<string, unknown> }) => {
          state.inserts.push(row); state.updates.push(options.set);
          const old = state.rows.find(item => item.lineId === row.lineId);
          if (!old) state.rows.push({ ...row, id: state.rows.length + 1, createdAt: new Date(), reviewedAt: null, publishedAt: null });
          else {
            const fields = ["orderName", "variantId", "kind", "productTitle", "quantity", "unitPrice",
              "currency", "financialStatus", "cancelled", "warning", "corridor"];
            const changed = fields.some(field => (old[field] ?? null) !== (row[field] ?? null));
            Object.assign(old, row, { status: changed ? "PENDING_FOUNDER_APPROVAL" : old.status });
            if (changed) Object.assign(old, { reviewedSourceHash: null, reviewedAt: null, reviewedBy: null,
              publishedSourceHash: null, publishedAt: null, publishedBy: null });
          }
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
  state.rows = [];
  vi.stubEnv("SHOPIFY_NEXUS_SHOP_DOMAIN", "test-shop.myshopify.com");
  vi.stubEnv("SHOPIFY_NEXUS_RESERVATION_VARIANT_IDS", "101");
  vi.stubEnv("SHOPIFY_NEXUS_FINANCING_VARIANT_IDS", "102");
  vi.stubEnv("SHOPIFY_NEXUS_WEBHOOK_SECRET", "test-secret");
});
afterEach(() => vi.unstubAllEnvs());
describe("Nexus webhook and desk", () => {
  it("preserves approval on a complete unchanged corridor snapshot accepted by either receiver", async () => {
    const complete = JSON.stringify({ ...JSON.parse(body), corridor: "Samsun-Irak-Proje" });
    expect((await send("test-shop.myshopify.com", complete)).status).toBe(200);
    Object.assign(state.rows[0], { status: "FOUNDER_APPROVED", reviewedSourceHash: "reviewed",
      reviewedBy: "founder", reviewedAt: new Date(), publishedSourceHash: "published",
      publishedBy: "founder", publishedAt: new Date() });
    expect((await send("test-shop.myshopify.com", complete).set("X-Shopify-Webhook-Id", "second-event")).status).toBe(200);
    expect(state.rows[0]).toMatchObject({ status: "FOUNDER_APPROVED", corridor: "Samsun-Irak-Proje",
      reviewedSourceHash: "reviewed", publishedSourceHash: "published" });
  });
  it("invalidates a changed legacy price instead of retaining a previous founder decision", async () => {
    await send();
    Object.assign(state.rows[0], { status: "FOUNDER_APPROVED", reviewedSourceHash: "old",
      publishedSourceHash: "old", publishedAt: new Date() });
    const changed = JSON.parse(body);
    changed.updated_at = "2026-10-10T10:01:00Z"; changed.line_items[0].price = "80000.00";
    expect((await send("test-shop.myshopify.com", JSON.stringify(changed))
      .set("X-Shopify-Webhook-Id", "updated-event")).status).toBe(200);
    expect(state.rows[0]).toMatchObject({ status: "PENDING_FOUNDER_APPROVAL",
      unitPrice: "80000.00", reviewedSourceHash: null, publishedAt: null });
  });
  it("withdraws an unmatched previously published line on cancellation, without deleting it", async () => {
    state.rows = [{
      lineId: "99", shopDomain: "test-shop.myshopify.com", orderId: "10", corridor: "Samsun-Irak-Proje",
      sourceUpdatedAt: new Date("2026-10-10T10:00:00Z"), status: "FOUNDER_APPROVED", publishedAt: new Date(),
    }];
    const cancelled = { ...JSON.parse(body), updated_at: "2026-10-10T10:01:00Z", line_items: [] };
    expect((await send("test-shop.myshopify.com", JSON.stringify(cancelled))
      .set("X-Shopify-Topic", "orders/cancelled")).status).toBe(200);
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({ cancelled: 1, status: "PENDING_FOUNDER_APPROVAL",
      corridor: null, publishedAt: null, publishedSourceHash: null });
  });
  it("persists pending records and conditionally invalidates outdated decisions", async () => {
    expect((await send()).status).toBe(200);
    expect(state.transactions).toBe(1);
    expect(state.inserts[0].status).toBe("PENDING_FOUNDER_APPROVAL");
    expect(state.updates[0]).toHaveProperty("status");
    expect(state.updates[0]).toHaveProperty("publishedSourceHash");
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
