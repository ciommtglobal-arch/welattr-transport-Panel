import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "drafter" as string | null,
  rows: {} as Record<string, Record<string, any>[]>,
  clerkUsers: [] as any[],
}));
vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: state.userId }),
  clerkClient: { users: { getUserList: async () => ({ data: state.clerkUsers }) } },
}));
vi.mock("../lib/objectStorage", () => ({ ObjectStorageService: class {} }));
vi.mock("@workspace/db", async (original) => {
  const real = await original<typeof import("@workspace/db")>();
  const { getTableName } = await import("drizzle-orm");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const property = (column: string) => column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  const match = (row: any, condition: any) => {
    if (!condition) return true;
    const query = new PgDialect().sqlToQuery(condition);
    return [...query.sql.matchAll(/"([a-z_]+)"\s*=\s*\$(\d+)/g)]
      .every((entry) => row[property(entry[1]!)] === query.params[Number(entry[2]) - 1]);
  };
  let queue = Promise.resolve();
  const db: any = {
    select: (projection?: unknown) => ({
      from: (table: any) => {
        let condition: any; let limit = Infinity; let offset = 0;
        const chain = {
          where: (value: any) => { condition = value; return chain; },
          orderBy: () => chain, for: () => chain,
          limit: (value: number) => { limit = value; return chain; },
          offset: (value: number) => { offset = value; return chain; },
          then: (resolve: any, reject: any) => {
            const rows = (state.rows[getTableName(table)] ?? []).filter((row) => match(row, condition));
            const result = projection && "count" in (projection as any) ? [{ count: rows.length }] : rows.slice(offset, offset + limit);
            return Promise.resolve(result).then(resolve, reject);
          },
        };
        return chain;
      },
    }),
    insert: (table: any) => ({
      values: (values: any) => {
        let conflict: any;
        const writer = {
          onConflictDoUpdate: (value: any) => { conflict = value; return writer; },
          returning: async () => {
            const rows = state.rows[getTableName(table)]!;
            const existing = conflict && rows.find((row) => row.clerkUserId === values.clerkUserId);
            if (existing) { Object.assign(existing, conflict.set); return [existing]; }
            const row = {
              id: rows.length + 1, revision: 1, publishedListingId: null, publishedBy: null, publishedAt: null,
              fullName: "", organization: "", location: "", contact: "", description: "",
              createdAt: new Date(), updatedAt: new Date(), ...values,
            };
            rows.push(row); return [row];
          },
        };
        return writer;
      },
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: (condition: any) => ({
          returning: async () => {
            const rows = state.rows[getTableName(table)]!.filter((row) => match(row, condition));
            rows.forEach((row) => Object.assign(row, values)); return rows;
          },
        }),
      }),
    }),
    transaction: (run: any) => {
      const task = queue.then(async () => {
        const saved = structuredClone(state.rows);
        try { return await run(db); } catch (error) { state.rows = saved; throw error; }
      });
      queue = task.then(() => undefined, () => undefined); return task;
    },
  };
  return { ...real, db };
});

import logisticsRouter from "./logistics-listing-workspace";
import b2bRouter from "./b2b-listings";
import staffRouter from "./staff-profiles";
import { requireFinanceStaff, requireOperationsStaff } from "../lib/staffAuth";

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = { info: vi.fn(), error: vi.fn(), warn: vi.fn() } as any;
  next();
});
app.use(logisticsRouter, staffRouter, b2bRouter);
app.post("/finance-check", async (req, res) => {
  if (await requireFinanceStaff(req, res)) res.json({ ok: true });
});
app.post("/budget-check", async (req, res) => {
  if (await requireOperationsStaff(req, res)) res.json({ ok: true });
});
const base = "/logistics-listings";
const post = (path: string) => request(app).post(path).set("Origin", "http://127.0.0.1").set("Host", "127.0.0.1");
const patch = (path: string) => request(app).patch(path).set("Origin", "http://127.0.0.1").set("Host", "127.0.0.1");
const remove = (path: string) => request(app).delete(path).set("Origin", "http://127.0.0.1").set("Host", "127.0.0.1");
const fields = { title: "Lojistik test ilanı", fullName: "Test Operatör", organization: "TEST Lojistik",
  location: "Test güzergâh", contact: "operator@example.test", description: "Bu yalnızca lojistik ilan yetkilerinin kontrollü test açıklamasıdır." };
const drafts = () => state.rows.logistics_listing_drafts!;
const grants = () => state.rows.logistics_listing_grants!;
const users = () => state.rows.staff_users!;

beforeEach(() => {
  vi.stubEnv("MMT_FOUNDER_REVIEWER_CLERK_USER_ID", "founder");
  state.userId = "drafter";
  state.rows = {
    staff_users: [{ id: 1, clerkUserId: "admin", role: "admin", active: 1 },
      { id: 2, clerkUserId: "reviewer", role: "reviewer", active: 1 },
      { id: 3, clerkUserId: "finance", role: "finance", active: 1 }],
    logistics_listing_grants: [
      { id: 1, clerkUserId: "drafter", verifiedEmail: "drafter@example.test", displayName: "Test Drafter", active: 1, assignedBy: "admin", updatedAt: new Date() },
      { id: 2, clerkUserId: "other", verifiedEmail: "other@example.test", displayName: "Other Drafter", active: 1, assignedBy: "admin", updatedAt: new Date() }],
    logistics_listing_drafts: [], b2b_listings: [],
  };
  state.clerkUsers = [{ id: "new-drafter", firstName: "TEST", lastName: "Drafter",
    emailAddresses: [{ emailAddress: "new@example.test", verification: { status: "verified" } }] }];
});

describe("independent logistics listing capability", () => {
  it("allows a draft-only user to create, reload and save an incomplete private draft", async () => {
    const created = await post(`${base}/drafts`).send({ ...fields, description: "" });
    expect(created.status).toBe(201);
    expect(created.body.publishedListingId).toBeNull();
    const list = await request(app).get(`${base}/drafts`);
    expect(list.body.items[0].title).toBe(fields.title);
    const saved = await patch(`${base}/drafts/${created.body.id}`).send({ ...fields, title: "Güncellenmiş lojistik ilanı", revision: 1 });
    expect(saved.status).toBe(200);
    expect(saved.body.revision).toBe(2);
    expect((await request(app).get(`${base}/drafts`)).body.items[0].title).toBe("Güncellenmiş lojistik ilanı");
    expect(state.rows.b2b_listings).toHaveLength(0);
    expect(users()).toHaveLength(3);
  });

  it("denies publication, finance, operational budget access and grant administration to a drafter", async () => {
    const created = await post(`${base}/drafts`).send(fields);
    expect((await post(`${base}/drafts/${created.body.id}/publish`).send({ revision: 1 })).status).toBe(403);
    expect((await post("/finance-check")).status).toBe(403);
    expect((await post("/budget-check")).status).toBe(403);
    expect((await request(app).get(`${base}/grants`)).status).toBe(403);
    expect((await post(`${base}/grants`).send({ email: "new@example.test" })).status).toBe(403);
    expect((await remove(`${base}/grants/1`)).status).toBe(403);
    expect(state.rows.b2b_listings).toHaveLength(0);
  });

  it("hides other authors' drafts and blocks spoofed ownership/status fields", async () => {
    const created = await post(`${base}/drafts`).send(fields);
    state.userId = "other";
    expect((await request(app).get(`${base}/drafts`)).body.items).toHaveLength(0);
    expect((await patch(`${base}/drafts/${created.body.id}`).send({ ...fields, revision: 1 })).status).toBe(404);
    expect((await post(`${base}/drafts`).send({ ...fields, authorClerkUserId: "admin" })).status).toBe(400);
    expect((await post(`${base}/drafts`).send({ ...fields, status: "approved", role: "finance" })).status).toBe(400);
    expect(drafts()[0]!.authorClerkUserId).toBe("drafter");
  });

  it("preserves every existing role when granting or revoking only the capability", async () => {
    const original = structuredClone(users());
    state.userId = "admin";
    const assigned = await post(`${base}/grants`).send({ email: "new@example.test" });
    expect(assigned.status).toBe(200);
    expect(assigned.body.clerkUserId).toBe("new-drafter");
    expect(users()).toEqual(original);
    expect((await remove(`${base}/grants/${assigned.body.id}`)).status).toBe(204);
    expect(users()).toEqual(original);
    expect(grants().find((row) => row.clerkUserId === "new-drafter")!.active).toBe(0);
    expect((await post(`${base}/grants`).send({ email: "new@example.test" })).status).toBe(200);
    expect(grants()).toHaveLength(3);
  });

  it.each(["reviewer", "finance", "other", "unrelated"])("does not let %s assign grants", async (user) => {
    state.userId = user;
    expect((await post(`${base}/grants`).send({ email: "new@example.test" })).status).toBe(403);
  });

  it("requires one existing account with an exact verified email", async () => {
    state.userId = "admin";
    state.clerkUsers = [];
    expect((await post(`${base}/grants`).send({ email: "new@example.test" })).status).toBe(400);
    state.clerkUsers = [{ id: "unverified", emailAddresses: [{ emailAddress: "new@example.test", verification: { status: "unverified" } }] }];
    expect((await post(`${base}/grants`).send({ email: "new@example.test" })).status).toBe(400);
    state.clerkUsers = [state.clerkUsers[0], state.clerkUsers[0]];
    expect((await post(`${base}/grants`).send({ email: "new@example.test" })).status).toBe(400);
    expect(grants()).toHaveLength(2);
  });

  it("revokes draft access without deleting drafts or changing other access", async () => {
    await post(`${base}/drafts`).send(fields);
    state.userId = "admin";
    expect((await remove(`${base}/grants/1`)).status).toBe(204);
    state.userId = "drafter";
    expect((await request(app).get(`${base}/access`)).status).toBe(403);
    expect((await request(app).get(`${base}/drafts`)).status).toBe(403);
    expect((await patch(`${base}/drafts/1`).send({ ...fields, revision: 1 })).status).toBe(403);
    expect(drafts()).toHaveLength(1);
  });

  it("makes publication founder-only, idempotent and public only after explicit approval", async () => {
    const created = await post(`${base}/drafts`).send(fields);
    expect((await request(app).get("/b2b-listings?role=logistics")).body.items).toHaveLength(0);
    state.userId = "admin";
    expect((await post(`${base}/drafts/${created.body.id}/publish`).send({ revision: 1 })).status).toBe(403);
    state.userId = "founder";
    const published = await post(`${base}/drafts/${created.body.id}/publish`).send({ revision: 1 });
    expect(published.status).toBe(200);
    expect(published.body.publishedBy).toBe("founder");
    expect(published.body.publishedListingId).toBe(1);
    expect((await post(`${base}/drafts/1/publish`).send({ revision: 1 })).body.publishedListingId).toBe(1);
    expect(state.rows.b2b_listings).toHaveLength(1);
    expect((await request(app).get("/b2b-listings?role=logistics")).body.items).toHaveLength(1);
    state.userId = "drafter";
    expect((await patch(`${base}/drafts/1`).send({ ...fields, revision: 1 })).status).toBe(409);
    state.userId = "admin";
    expect((await patch("/b2b-listings/1/status").send({ status: "approved" })).status).toBe(403);
  });

  it("preserves old unrelated listing moderation", async () => {
    state.userId = "admin";
    state.rows.b2b_listings!.push({
      ...fields, id: 99, role: "producer", referenceCode: "LEGACY",
      status: "pending", createdAt: new Date(), updatedAt: new Date(), publishedAt: null,
    });
    expect((await patch("/b2b-listings/99/status").send({ status: "approved" })).status).toBe(200);
  });

  it.each(["admin", "reviewer", "finance"])("blocks %s approval of an ordinary logistics listing", async userId => {
    state.userId = userId;
    state.rows.b2b_listings!.push({
      ...fields, id: 99, role: "logistics", referenceCode: "LEGACY",
      status: "pending", createdAt: new Date(), updatedAt: new Date(), publishedAt: null,
    });
    expect(drafts()).toHaveLength(0);
    expect((await patch("/b2b-listings/99/status").send({ status: "approved" })).status).toBe(403);
    expect(state.rows.b2b_listings![0]).toMatchObject({ status: "pending", publishedAt: null });
  });

  it("lets the allowlisted founder review and approve ordinary logistics listings without creating a staff grant", async () => {
    state.userId = "founder";
    state.rows.b2b_listings!.push({
      ...fields, id: 99, role: "logistics", referenceCode: "LEGACY",
      status: "pending", createdAt: new Date(), updatedAt: new Date(), publishedAt: null,
    });
    expect((await request(app).get("/b2b-listings/review?status=pending")).status).toBe(200);
    expect((await patch("/b2b-listings/99/status").send({ status: "approved" })).status).toBe(200);
    expect(state.rows.b2b_listings![0]).toMatchObject({ status: "approved", reviewerClerkUserId: "founder" });
    expect(state.rows.b2b_listings![0]!.publishedAt).toBeInstanceOf(Date);
  });

  it("does not publish incomplete or stale draft revisions", async () => {
    await post(`${base}/drafts`).send({ ...fields, contact: "", description: "" });
    state.userId = "founder";
    expect((await post(`${base}/drafts/1/publish`).send({ revision: 1 })).status).toBe(400);
    expect((await post(`${base}/drafts/1/publish`).send({ revision: 2 })).status).toBe(409);
    state.userId = "drafter";
    expect((await patch(`${base}/drafts/1`).send({ ...fields, revision: 2 })).status).toBe(409);
    expect(state.rows.b2b_listings).toHaveLength(0);
  });

  it("requires sign-in and same-origin mutations", async () => {
    state.userId = null;
    expect((await request(app).get(`${base}/access`)).status).toBe(401);
    state.userId = "drafter";
    expect((await request(app).post(`${base}/drafts`).send(fields)).status).toBe(403);
    expect((await post(`${base}/drafts`).set("Sec-Fetch-Site", "cross-site").send(fields)).status).toBe(403);
  });

  it("routes granted nonstaff to the limited workspace and preserves existing staff workspaces", async () => {
    expect((await request(app).get("/staff/access")).body).toEqual({ role: "logistics_listings", workspace: "/staff/lojistik-ilanlari" });
    state.userId = "finance";
    grants().push({ ...grants()[0], clerkUserId: "finance" });
    expect((await request(app).get("/staff/access")).body).toEqual({ role: "finance", workspace: "/staff/calisma-alani" });
    expect((await post("/finance-check")).status).toBe(200);
  });
});
