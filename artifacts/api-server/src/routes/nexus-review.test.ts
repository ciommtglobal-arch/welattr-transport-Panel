import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { writeFileSync } from "node:fs";
import { nexusShopifyIntakesTable as intakes } from "@workspace/db";

const state = vi.hoisted(() => ({
  user: "founder", fail: false, rows: [] as Record<string, unknown>[],
  locks: [] as string[], writes: 0, queue: Promise.resolve(),
}));
vi.mock("@workspace/db", async () => {
  const tables = await import("../../../../lib/db/src/schema/nexus-shopify");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  function selected() {
    let values: unknown[] = [];
    const read = () => state.rows.filter(row => {
      if (typeof values[0] === "number") return row.id === values[0] && row.shopDomain === values[1];
      return row.shopDomain === values[0] &&
        (values.length < 2 || row.status === values[1] && row.publishedAt !== null);
    });
    const builder = {
      from: () => builder,
      where: (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
        values = dialect.sqlToQuery(query).params; return builder;
      },
      orderBy: () => builder,
      limit: (size: number) => Object.assign(Promise.resolve(read().slice(0, size)), {
        for: async (lock: string) => { state.locks.push(lock); return read().slice(0, size); },
      }),
    };
    return builder;
  }
  return {
    ...tables,
    db: {
      select: () => { if (state.fail) throw new Error("Storage offline"); return selected(); },
      transaction: async (run: (tx: unknown) => Promise<unknown>) => {
        const before = state.queue; let release!: () => void;
        state.queue = new Promise<void>(resolve => { release = resolve; }); await before;
        const snapshot = state.rows.map(row => ({ ...row }));
        try {
          if (state.fail) throw new Error("Storage offline");
          return await run({
            select: selected,
            update: () => ({ set: (changes: Record<string, unknown>) => ({
              where: (scope: Parameters<typeof dialect.sqlToQuery>[0]) => ({
                returning: async () => {
                  const [id, shop] = dialect.sqlToQuery(scope).params;
                  const row = state.rows.find(item => item.id === id && item.shopDomain === shop);
                  if (!row) return [];
                  Object.assign(row, changes); state.writes++; return [{ ...row }];
                },
              }),
            }) }),
          });
        } catch (error) { state.rows = snapshot; throw error; }
        finally { release(); }
      },
    },
  };
});
vi.mock("../lib/staffAuth", () => ({
  requireUser: (_req: unknown, res: express.Response) => {
    if (!state.user) { res.status(401).json({ error: "Sign in" }); return null; }
    return state.user;
  },
}));
import router from "./nexus-review";
import {
  nexusSourceHash, nexusSnapshotToken, applyNexusDecision, applyNexusPublication,
  isPublishedNexus, nexusReviewUpdate, type NexusRecord,
} from "../lib/nexusReview";
const app = express();
app.use(express.json()); app.use(express.urlencoded({ extended: false })); app.use("/api", router);
const shop = "test-shop.myshopify.com";
function record(): NexusRecord {
  return {
    id: 1, shopDomain: shop, orderId: "10", orderName: "PRIVATE-ORDER-NAME", lineId: "20",
    variantId: "101", kind: "reservation", productTitle: "PRIVATE-PRODUCT-TEXT",
    quantity: 3, unitPrice: "75000.00", currency: "TRY", financialStatus: "paid", cancelled: 0,
    warning: "PRIVATE-NOTE", corridor: "Samsun-Irak-Proje", status: "PENDING_FOUNDER_APPROVAL",
    sourceUpdatedAt: new Date("2026-10-12T09:00:00Z"), createdAt: new Date("2026-10-12T09:00:00Z"),
    reviewedSourceHash: null, reviewedAt: null, reviewedBy: null,
    publishedSourceHash: null, publishedAt: null, publishedBy: null,
  };
}
const current = () => state.rows[0] as NexusRecord;
function decision(action = "approve", token = nexusSnapshotToken(current()), id = 1) {
  return request(app).post(`/api/nexus/intakes/${id}/decision`).send({ action, snapshotToken: token });
}
function publish(action = "publish", token = nexusSnapshotToken(current())) {
  return request(app).post("/api/nexus/intakes/1/publication").send({ action, snapshotToken: token });
}
beforeEach(() => {
  state.user = "founder"; state.fail = false; state.rows = [record()]; state.writes = 0;
  state.locks = []; state.queue = Promise.resolve();
  vi.stubEnv("MMT_FOUNDER_REVIEWER_CLERK_USER_ID", "founder");
  vi.stubEnv("SHOPIFY_NEXUS_SHOP_DOMAIN", shop);
});
afterEach(() => vi.unstubAllEnvs());

describe("Nexus founder decisions and privacy (no real DB writes)", () => {
  it("requires authentication and the exact founder, not role or name claims", async () => {
    state.user = "";
    expect((await decision()).status).toBe(401);
    state.user = "mehmet-master-admin";
    expect((await decision()).status).toBe(403);
    expect((await publish()).status).toBe(403);
    expect((await request(app).get("/api/nexus/intakes")).status).toBe(403);
    expect(state.writes).toBe(0);
  });
  it("saves approval without publishing, then requires a separate fresh publish decision", async () => {
    const old = nexusSnapshotToken(current());
    const approved = await decision("approve", old);
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ status: "FOUNDER_APPROVED", canPublish: true, isPublished: false });
    expect(current().reviewedBy).toBe("founder");
    expect((await request(app).get("/api/logistics/nexus/publications")).body).toEqual([]);
    expect((await publish("publish", old)).status).toBe(409);
    expect((await publish()).status).toBe(200);
    expect(state.locks.every(lock => lock === "update")).toBe(true);
  });
  it("returns only the public allowlist, never private order or pricing fields", async () => {
    await decision(); await publish();
    state.user = "";
    const result = await request(app).get("/api/logistics/nexus/publications");
    expect(result.status).toBe(200);
    expect(Object.keys(result.body[0]).sort()).toEqual(["corridor", "id", "kind", "publishedAt"]);
    expect(JSON.stringify(result.body)).not.toContain("PRIVATE");
    expect(JSON.stringify(result.body)).not.toContain("75000");
    expect(result.headers["cache-control"]).toBe("no-store");
  });
  it("rejects unapproved, legacy-approval, cancelled, removed and corridorless publication", async () => {
    expect((await publish()).status).toBe(409);
    current().status = "FOUNDER_APPROVED";
    expect((await publish()).status).toBe(409);
    current().status = "PENDING_FOUNDER_APPROVAL"; current().cancelled = 1;
    expect((await decision()).status).toBe(409);
    current().cancelled = 0; current().quantity = 0;
    expect((await decision()).status).toBe(409);
    current().quantity = 1; current().corridor = null;
    expect((await decision()).status).toBe(200);
    expect((await publish()).status).toBe(409);
  });
  it("blocks a stale open review, and a concurrent second decision", async () => {
    const old = nexusSnapshotToken(current()); current().unitPrice = "90000.00";
    expect((await decision("approve", old)).status).toBe(409);
    const fresh = nexusSnapshotToken(current());
    const responses = await Promise.all([decision("approve", fresh), decision("reject", fresh)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(state.writes).toBe(1);
  });
  it("hides changed, cancelled and foreign-shop records even if old status remains approved", async () => {
    await decision(); await publish();
    const saved = { ...current() };
    for (const changes of [{ quantity: 5 }, { cancelled: 1 }, { corridor: "Samsun-Gurcistan" },
      { shopDomain: "other-shop.myshopify.com" }, { reviewedBy: "not-founder" }]) {
      state.rows = [{ ...saved, ...changes }];
      expect((await request(app).get("/api/logistics/nexus/publications")).body).toEqual([]);
    }
  });
  it("withdraws and rejects previously published records without deleting history rows", async () => {
    await decision(); await publish();
    expect((await publish("withdraw")).body.isPublished).toBe(false);
    expect(state.rows).toHaveLength(1);
    await publish();
    const rejected = await decision("reject");
    expect(rejected.body).toMatchObject({ status: "FOUNDER_REJECTED", isPublished: false, canPublish: false });
    expect((await request(app).get("/api/logistics/nexus/publications")).body).toEqual([]);
  });
  it("does not cross shop boundaries or accept invalid body/token/form submissions", async () => {
    current().shopDomain = "other-shop.myshopify.com";
    expect((await decision()).status).toBe(404);
    state.rows = [record()];
    expect((await decision("approve", "bad")).status).toBe(400);
    expect((await decision("approve", nexusSnapshotToken(current()), -1)).status).toBe(400);
    expect((await request(app).post("/api/nexus/intakes/1/decision").type("form")
      .send({ action: "approve", snapshotToken: nexusSnapshotToken(current()) })).status).toBe(415);
    expect(state.writes).toBe(0);
  });
  it("fails explicitly when configuration or storage is absent", async () => {
    state.fail = true;
    expect((await decision()).status).toBe(503);
    expect((await request(app).get("/api/logistics/nexus/publications")).status).toBe(503);
    state.fail = false; vi.stubEnv("SHOPIFY_NEXUS_SHOP_DOMAIN", "");
    expect((await decision()).status).toBe(503);
    expect(state.writes).toBe(0);
  });
  it("binds every material source field but preserves a timestamp-only refresh", () => {
    const source = record();
    for (const [key, value] of Object.entries({ orderName: "changed", productTitle: "changed", quantity: 7,
      unitPrice: "1.00", currency: "USD", financialStatus: "refunded", warning: null, variantId: "999",
      kind: "financing_interest", cancelled: 1, corridor: "Samsun-Gurcistan", orderId: "11", lineId: "21" })) {
      expect(nexusSourceHash({ ...source, [key]: value })).not.toBe(nexusSourceHash(source));
    }
    const approved = { ...source, ...applyNexusDecision(source, "approve", "founder") };
    const published = { ...approved, ...applyNexusPublication(approved, "publish", "founder") };
    expect(isPublishedNexus({ ...published, sourceUpdatedAt: new Date() })).toBe(true);
  });
  it("generates actual Drizzle CASE statements for a rollback-only native PostgreSQL proof", () => {
    const dialect = new PgDialect();
    function statement(quantity: number) {
      const changes = nexusReviewUpdate({ ...record(), quantity });
      const assignments = Object.entries(changes).map(([name, expression]) =>
        sql`${sql.identifier(intakes[name as keyof typeof changes].name)} = ${expression}`);
      const query = dialect.sqlToQuery(sql`UPDATE ${intakes} SET
        ${sql.join(assignments, sql`, `)}, quantity = ${quantity} WHERE ${intakes.id} = ${-2000000001}`);
      // All parameters are fixed test-fixture constants, never user input.
      const quote = (value: unknown) => {
        if (value === null) return "NULL";
        if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
        if (typeof value === "string" && /^[A-Za-z0-9 _.:/+-]*$/.test(value)) return `'${value}'`;
        throw new Error("Unexpected native proof parameter");
      };
      return query.sql.replace(/\$(\d+)/g, (_match, index: string) => quote(query.params[Number(index) - 1])) + ";";
    }
    const unchanged = statement(3), changed = statement(4);
    expect(changed).toContain('"published_source_hash"');
    expect(changed).toContain("IS DISTINCT FROM");
    writeFileSync("/tmp/nexus-review-proof.sql", `
BEGIN;
SET LOCAL lock_timeout = '5s';
INSERT INTO public.nexus_shopify_intakes
(id, shop_domain, order_id, order_name, line_id, variant_id, kind, product_title, quantity, unit_price,
currency, financial_status, cancelled, warning, corridor, status, source_updated_at,
reviewed_source_hash, reviewed_at, reviewed_by, published_source_hash, published_at, published_by)
VALUES (-2000000001, 'test-only-native.invalid', 'ROLLBACK-PROOF', 'PRIVATE-ORDER-NAME', 'PROOF', '101',
'reservation', 'PRIVATE-PRODUCT-TEXT', 3, '75000.00', 'TRY', 'paid', 0, 'PRIVATE-NOTE',
'Samsun-Irak-Proje', 'FOUNDER_APPROVED', '2026-10-12T09:00:00Z',
'review-proof', now(), 'test-only-founder', 'publication-proof', now(), 'test-only-founder');
${unchanged}
DO $proof$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.nexus_shopify_intakes WHERE id=-2000000001
   AND status='FOUNDER_APPROVED' AND published_source_hash='publication-proof'
   AND reviewed_source_hash='review-proof' AND published_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Unchanged snapshot incorrectly cleared review/publication'; END IF;
END $proof$;
${changed}
DO $proof$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.nexus_shopify_intakes WHERE id=-2000000001
   AND quantity=4 AND status='PENDING_FOUNDER_APPROVAL'
   AND reviewed_source_hash IS NULL AND reviewed_at IS NULL AND reviewed_by IS NULL
   AND published_source_hash IS NULL AND published_at IS NULL AND published_by IS NULL)
 THEN RAISE EXCEPTION 'Changed snapshot retained an old review/publication'; END IF;
END $proof$;
SELECT 'PASS: unchanged source preserves review; changed source clears review and publication' AS proof;
ROLLBACK;
`);
  });
});
