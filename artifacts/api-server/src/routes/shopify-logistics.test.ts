import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createHmac } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import { createShopifyLogisticsRawParser } from "../lib/nexusLogisticsShopify";

type Stored = Record<string, unknown>;
const state = vi.hoisted(() => ({
  rows: [] as Stored[], events: new Set<string>(), fail: false, failLineId: "",
  transactions: 0, lockQueries: [] as string[], statusQueries: [] as string[],
  queue: Promise.resolve() as Promise<void>,
}));
vi.mock("@workspace/db", async () => {
  // Import schema definitions only: no Pool, DATABASE_URL or real DB connection.
  const tables = await import("../../../../lib/db/src/schema/nexus-shopify");
  const { PgDialect: Dialect } = await import("drizzle-orm/pg-core");
  const dialect = new Dialect();
  const params = (query: Parameters<typeof dialect.sqlToQuery>[0]) => dialect.sqlToQuery(query).params;
  const key = (row: Stored) => `${row.shopDomain}:${row.orderId}:${row.lineId}`;
  function save(source: Stored, set: Stored) {
    const old = state.rows.find(row => key(row) === key(source));
    if (!old) { state.rows.push({ ...source, id: state.rows.length + 1, createdAt: new Date() }); return; }
    if ((old.sourceUpdatedAt as Date).getTime() > (source.sourceUpdatedAt as Date).getTime()) return;
    const keys = Object.keys(set).filter(field => field !== "status" && field !== "sourceUpdatedAt");
    const changed = keys.some(field => old[field] !== set[field]);
    state.statusQueries.push(dialect.sqlToQuery(set.status as Parameters<typeof dialect.sqlToQuery>[0]).sql);
    Object.assign(old, { ...set, status: changed ? "PENDING_FOUNDER_APPROVAL" : old.status });
  }
  return {
    ...tables,
    db: {
      transaction: async (run: (tx: unknown) => Promise<unknown>) => {
        state.transactions++;
        const before = state.queue;
        let release!: () => void;
        state.queue = new Promise<void>(resolve => { release = resolve; });
        await before;
        const oldRows = state.rows.map(row => ({ ...row }));
        const oldEvents = new Set(state.events);
        try {
          if (state.fail) throw new Error("test storage unavailable");
          return await run({
            execute: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
              state.lockQueries.push(dialect.sqlToQuery(query).sql);
            },
            select: () => ({ from: () => ({ where: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
              const [shop, order] = params(query);
              return state.rows.filter(row => row.shopDomain === shop && row.orderId === order).map(row => ({ ...row }));
            } }) }),
            insert: (table: unknown) => ({ values: (row: Stored) => ({
              onConflictDoNothing: () => ({ returning: async () => {
                const eventKey = `${row.shopDomain}:${row.webhookId}`;
                if (state.events.has(eventKey)) return [];
                state.events.add(eventKey);
                return [{ id: state.events.size }];
              } }),
              onConflictDoUpdate: async (options: { set: Stored }) => {
                if (table !== tables.nexusShopifyIntakesTable) throw new Error("Unexpected table");
                if (row.lineId === state.failLineId) throw new Error("test failure while saving a later line");
                save(row, options.set);
              },
            }) }),
            update: () => ({ set: (set: Stored) => ({ where: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
              const [shop, order, line] = params(query);
              const old = state.rows.find(row => row.shopDomain === shop && row.orderId === order && row.lineId === line);
              if (old) save({ ...old, ...set }, set);
            } }) }),
          });
        } catch (error) {
          state.rows = oldRows; state.events = oldEvents; throw error;
        } finally { release(); }
      },
    },
  };
});
import router from "./shopify-logistics";
const app = express();
app.use("/api/mmt/secure-sync", createShopifyLogisticsRawParser());
app.use(express.json());
app.use("/api", router);
const noRawApp = express();
noRawApp.use(express.json()); noRawApp.use("/api", router);
const path = "/api/mmt/secure-sync";
const secret = "unit-test-not-a-credential";
const source = () => ({
  id: "10", name: "#10", corridor: "Samsun-Irak-Proje", currency: "TRY",
  updated_at: "2026-10-10T10:00:00Z", financial_status: "paid", cancelled_at: null,
  line_items: [
    { id: "20", variant_id: "101", title: "Boru", quantity: 2, price: "12.50" },
    { id: "21", variant_id: "999", title: "Ek parça", quantity: 3, price: "8.00" },
  ],
});
function send(payload: unknown = source(), event = "event-1", topic = "orders/paid", shop = "test-shop.myshopify.com", target = app) {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  return request(target).post(path).set("Content-Type", "application/json")
    .set("X-Shopify-Hmac-Sha256", createHmac("sha256", secret).update(raw).digest("base64"))
    .set("X-Shopify-Shop-Domain", shop).set("X-Shopify-Topic", topic)
    .set("X-Shopify-Webhook-Id", event).send(raw);
}
beforeEach(() => {
  state.rows = []; state.events = new Set(); state.fail = false; state.failLineId = ""; state.transactions = 0;
  state.lockQueries = []; state.statusQueries = []; state.queue = Promise.resolve();
  vi.stubEnv("SHOPIFY_NEXUS_SHOP_DOMAIN", "test-shop.myshopify.com");
  vi.stubEnv("SHOPIFY_NEXUS_WEBHOOK_SECRET", secret);
  vi.stubEnv("SHOPIFY_NEXUS_RESERVATION_VARIANT_IDS", "");
  vi.stubEnv("SHOPIFY_NEXUS_FINANCING_VARIANT_IDS", "");
});
afterEach(() => vi.unstubAllEnvs());
describe("Shopify logistics receiver (in-memory DB double, no real writes)", () => {
  it("uses captured raw bytes and persists every line under the allowed corridor", async () => {
    const raw = JSON.stringify(source(), null, 2);
    expect((await send(raw)).body).toEqual({ duplicate: false, stale: false, received: 2, removed: 0 });
    expect(state.rows).toHaveLength(2);
    expect(state.rows.every(row => row.status === "PENDING_FOUNDER_APPROVAL")).toBe(true);
    expect(state.rows[1]).toMatchObject({ variantId: "999", quantity: 3, warning: "Koridor: Samsun-Irak-Proje" });
    expect(state.lockQueries[0]).toContain("pg_advisory_xact_lock");
  });
  it("does not fall back to parsed JSON when rawBody is absent", async () => {
    expect((await send(source(), "event-1", "orders/paid", "test-shop.myshopify.com", noRawApp)).status).toBe(401);
    expect(state.transactions).toBe(0);
  });
  it("rejects missing/forged signatures and byte-level tampering before writes", async () => {
    expect((await request(app).post(path).send(source())).status).toBe(401);
    const raw = JSON.stringify(source());
    expect((await request(app).post(path).set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", createHmac("sha256", secret).update(raw).digest("base64"))
      .send(`${raw} `)).status).toBe(401);
    expect(state.transactions).toBe(0);
  });
  it("rejects other shops, invalid topics, invalid identities and malformed JSON", async () => {
    expect((await send(source(), "e", "orders/create", "other.myshopify.com")).status).toBe(403);
    expect((await send(source(), "e", "customers/create")).status).toBe(400);
    expect((await send(source(), "bad/id")).status).toBe(400);
    expect((await send("{broken json")).status).toBe(400);
    expect(state.transactions).toBe(0);
  });
  it("rejects missing or unapproved corridors and one invalid later line atomically", async () => {
    expect((await send({ ...source(), corridor: undefined })).status).toBe(400);
    expect((await send({ ...source(), corridor: "Other" })).status).toBe(400);
    const payload = source(); payload.line_items[1].quantity = -1;
    expect((await send(payload)).status).toBe(400);
    expect(state.rows).toEqual([]); expect(state.events.size).toBe(0);
  });
  it("accepts the Georgia corridor via real Shopify note attributes", async () => {
    const { corridor: _, ...payload } = source();
    expect((await send({ ...payload, note_attributes: [{ name: "corridor", value: "Samsun-Gurcistan" }] })).status).toBe(200);
    expect(state.rows[0].warning).toBe("Koridor: Samsun-Gurcistan");
  });
  it("deduplicates retries and concurrent deliveries", async () => {
    const results = await Promise.all([send(), send()]);
    expect(results.every(response => response.status === 200)).toBe(true);
    expect(results.filter(response => response.body.duplicate)).toHaveLength(1);
    expect(state.rows).toHaveLength(2); expect(state.events.size).toBe(1);
  });
  it("updates quantity/price/status, records cancellation and invalidates old approval", async () => {
    await send();
    state.rows[0].status = "FOUNDER_APPROVED";
    const payload = source();
    payload.updated_at = "2026-10-10T11:00:00Z";
    payload.line_items[0].quantity = 0; payload.line_items[0].price = "10.00";
    payload.financial_status = "refunded";
    expect((await send(payload, "event-2", "orders/cancelled")).status).toBe(200);
    expect(state.rows).toHaveLength(2);
    expect(state.rows[0]).toMatchObject({
      quantity: 0, unitPrice: "10.00", financialStatus: "refunded", cancelled: 1,
      status: "PENDING_FOUNDER_APPROVAL",
    });
    expect(state.statusQueries[0]).toContain("IS DISTINCT FROM");
    expect(state.statusQueries[0]).toContain("nexus_approval_status");
  });
  it("retains founder decisions for unchanged new deliveries", async () => {
    await send(); state.rows[0].status = "FOUNDER_REJECTED";
    const payload = source(); payload.updated_at = "2026-10-10T11:00:00Z";
    expect((await send(payload, "event-2", "orders/updated")).status).toBe(200);
    expect(state.rows[0].status).toBe("FOUNDER_REJECTED");
  });
  it("adds new lines and preserves removed lines at zero without deleting history", async () => {
    await send();
    const payload = source(); payload.updated_at = "2026-10-10T11:00:00Z";
    payload.line_items = [payload.line_items[0], { id: "22", variant_id: "888", title: "Yeni kalem", quantity: 4, price: "9.00" }];
    const response = await send(payload, "event-2", "orders/updated");
    expect(response.body).toMatchObject({ received: 2, removed: 1 });
    expect(state.rows).toHaveLength(3);
    expect(state.rows.find(row => row.lineId === "21")).toMatchObject({
      quantity: 0, warning: "Koridor: Samsun-Irak-Proje; Shopify siparişinde bu kalem kaldırıldı.",
    });
    expect(state.rows.find(row => row.lineId === "22")?.quantity).toBe(4);
  });
  it("handles fully removed/cancelled order snapshots", async () => {
    await send();
    const payload = { ...source(), updated_at: "2026-10-10T11:00:00Z", line_items: [] };
    expect((await send(payload, "event-2", "orders/cancelled")).body).toMatchObject({ received: 0, removed: 2 });
    expect(state.rows.every(row => row.quantity === 0 && row.cancelled === 1)).toBe(true);
  });
  it("acknowledges stale updates without reverting newer quantities or cancellation", async () => {
    await send();
    const payload = source(); payload.updated_at = "2026-10-10T11:00:00Z"; payload.line_items[0].quantity = 8;
    await send(payload, "event-2", "orders/cancelled");
    expect((await send(source(), "event-3", "orders/updated")).body).toMatchObject({ stale: true, received: 0 });
    expect(state.rows[0]).toMatchObject({ quantity: 8, cancelled: 1 });
  });
  it("rolls back ambiguous equal-timestamp changes, including the event identity", async () => {
    await send(); const payload = source(); payload.line_items[0].quantity = 9;
    expect((await send(payload, "event-2", "orders/updated")).status).toBe(409);
    expect(state.rows[0].quantity).toBe(2); expect(state.events.size).toBe(1);
    payload.updated_at = "2026-10-10T11:00:00Z";
    expect((await send(payload, "event-2", "orders/updated")).status).toBe(200);
    expect(state.rows[0].quantity).toBe(9);
  });
  it("returns retryable errors for missing configuration or database failure", async () => {
    state.fail = true; expect((await send()).status).toBe(503);
    expect(state.rows).toEqual([]); expect(state.events.size).toBe(0);
    state.fail = false; vi.stubEnv("SHOPIFY_NEXUS_WEBHOOK_SECRET", "");
    expect((await send()).status).toBe(503);
  });
  it("compiles the real existing unique indexes and schema without importing a DB client", async () => {
    const { nexusShopifyIntakesTable } = await import("../../../../lib/db/src/schema/nexus-shopify");
    const { sql } = await import("drizzle-orm");
    const query = new PgDialect().sqlToQuery(sql`SELECT ${nexusShopifyIntakesTable.lineId} FROM ${nexusShopifyIntakesTable}`);
    expect(query.sql).toContain('"nexus_shopify_intakes"');
  });
  it("rolls back a mid-order failure and permits retry of the same event", async () => {
    state.failLineId = "21";
    expect((await send()).status).toBe(503);
    expect(state.rows).toEqual([]);
    expect(state.events.size).toBe(0);
    state.failLineId = "";
    expect((await send()).body).toMatchObject({ received: 2, duplicate: false });
    expect(state.rows).toHaveLength(2);
    expect(state.events.size).toBe(1);
  });
  it("preserves founder approval for equivalent prices without float rounding", async () => {
    const payload = source(); payload.line_items[0].price = "2";
    await send(payload);
    state.rows[0].status = "FOUNDER_APPROVED";
    payload.updated_at = "2026-10-10T11:00:00Z";
    payload.line_items[0].price = "2.00";
    expect((await send(payload, "event-2", "orders/updated")).status).toBe(200);
    expect(state.rows[0]).toMatchObject({ unitPrice: "2.00", status: "FOUNDER_APPROVED" });
  });
  it("rejects malformed or wrong-length signatures before any database work", async () => {
    for (const signature of ["", "invalid", "a".repeat(44), `${"A".repeat(43)}=`]) {
      expect((await request(app).post(path).set("Content-Type", "application/json")
        .set("X-Shopify-Hmac-Sha256", signature).send(JSON.stringify(source()))).status).toBe(401);
    }
    expect(state.transactions).toBe(0);
  });
  it("rejects signed null-variant and invalid-date snapshots before any writes", async () => {
    expect((await send({
      ...source(), line_items: [source().line_items[0], { ...source().line_items[1], variant_id: null }],
    })).status).toBe(400);
    expect((await send({ ...source(), cancelled_at: "2026-02-30T10:00:00Z" })).status).toBe(400);
    expect(state.rows).toEqual([]);
    expect(state.events.size).toBe(0);
    expect(state.transactions).toBe(0);
  });
  it("rejects signed conflicting corridor aliases before any writes", async () => {
    expect((await send({
      ...source(), note_attributes: [{ name: "koridor", value: "Samsun-Gurcistan" }],
    })).status).toBe(400);
    expect(state.transactions).toBe(0);
  });
  it("enforces body size and compression limits without any database work", async () => {
    expect((await send(`${JSON.stringify(source())}${" ".repeat(1024 * 1024)}`)).status).toBe(413);
    expect((await request(app).post(path).set("Content-Type", "application/json")
      .set("Content-Encoding", "gzip").send("not-an-accepted-body")).status).toBe(415);
    expect(state.transactions).toBe(0);
  });
});
