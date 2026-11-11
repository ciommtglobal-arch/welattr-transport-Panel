import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, count } from "drizzle-orm";

// Opt-in only. The token must belong to fixtures seeded through the explicit
// development SQL callback, NOT via this test process's connection string.
// Repeatable seed instructions: tests/company-fund-fixtures.md.
const fixture = process.env.TEST_FUND_FIXTURE_TOKEN;
vi.mock("../lib/staffAuth", () => ({
  requireUser: (req: any, res: any) => {
    const token = process.env.TEST_FUND_FIXTURE_TOKEN;
    const actor = req.get("x-test-actor");
    if (!token || !actor || !["owner", "manager", "admin", "member", "revoked", "other", "fakeowner"].includes(actor)) {
      res.status(401).json({ error: "Test actor required" }); return null;
    }
    return `fund-test-${token}:${actor}`;
  },
}));
import { db, pool, b2bBusinessProfilesTable as profiles, companyFundRecordsTable as funds, companyFundAmendmentsTable as amendments } from "@workspace/db";
import router from "./company-fund-records";
const app = express();
app.use(express.json());
app.use("/api", router);
const base = "/api/celik-kubbe/fon-islem";
const status = "/api/celik-kubbe/durum";

describe.skipIf(!fixture)("development-only fund correction database fixtures", () => {
  let companyId: number;
  let originalId: number;
  let replacementId: number;
  let snapshot: unknown;
  const correctionKey = randomUUID();
  const correction = {
    tur: "duzeltme", gerekce: "TEST: Yanlış tutar ve kurum düzeltmesi.", istek_anahtari: correctionKey,
    yeni_kayit: { kurum: "TEST Correct Institution", islem_turu: "TEST Internal Record", miktar: "999999999999.99", para_birimi: "USD", aciklama: "TEST development fixture only" },
  };
  const post = (id: number, body: object, actor = "owner") =>
    request(app).post(`${base}/${id}/duzeltmeler`).set("x-test-actor", actor).send(body);

  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || !/^[a-f0-9-]{36}$/.test(fixture!))
      throw new Error("Development fixture token required");
    const [profile] = await db.select().from(profiles).where(eq(profiles.ownerClerkUserId, `fund-test-${fixture}:owner`));
    // Refuse ALL writes if this process cannot see the callback-seeded marker.
    if (!profile || profile.internalNote !== `TEST FUND DEVELOPMENT ${fixture}`)
      throw new Error("Confirmed development fixture unavailable; refusing writes");
    companyId = profile.id;
    const created = await request(app).post(base).set("x-test-actor", "owner").send({
      kurum: "TEST Original Institution", islem_turu: "TEST Internal Record",
      miktar: "0.01", para_birimi: "TRY", aciklama: "TEST immutable original", istek_anahtari: randomUUID(),
    });
    expect(created.status).toBe(201);
    originalId = created.body.veri.id;
    [snapshot] = await db.select().from(funds).where(eq(funds.id, originalId));
  });
  afterAll(async () => { await pool.end(); });

  it("uses real active memberships and rejects revoked or forged owners and foreign company IDs", async () => {
    for (const actor of ["manager", "admin", "member", "revoked", "fakeowner"])
      expect((await post(originalId, correction, actor)).status).toBe(403);
    expect((await post(originalId, correction, "other")).status).toBe(404);
    expect((await request(app).get(status).set("x-test-actor", "member")).status).toBe(403);
    expect((await request(app).get(status).set("x-test-actor", "revoked")).status).toBe(403);
  });

  it("atomically serializes real concurrent retries, preserves original and stores exact decimals", async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, () => post(originalId, correction)));
    expect(responses.map((r) => r.status)).toEqual(Array(6).fill(201));
    expect(new Set(responses.map((r) => r.body.id)).size).toBe(1);
    replacementId = responses[0]!.body.yeni_kayit_id;
    const [original] = await db.select().from(funds).where(eq(funds.id, originalId));
    expect(original).toEqual(snapshot);
    const [replacement] = await db.select().from(funds).where(eq(funds.id, replacementId));
    expect(replacement).toMatchObject({ businessProfileId: companyId, amount: "999999999999.99", currency: "USD" });
    const [edges] = await db.select({ total: count() }).from(amendments).where(and(
      eq(amendments.businessProfileId, companyId), eq(amendments.originalRecordId, originalId),
    ));
    expect(edges!.total).toBe(1);
    expect((await post(originalId, { ...correction, istek_anahtari: randomUUID() })).status).toBe(409);
  });

  it("keeps audit readable to managers/admins across pages and cancels only the current replacement", async () => {
    for (const actor of ["manager", "admin"]) {
      const list = await request(app).get(`${status}?fon_limit=1&fon_offset=1`).set("x-test-actor", actor);
      expect(list.status).toBe(200);
      expect(list.body.canCreate).toBe(false);
      expect(list.body.fon_havuzu[0]).toMatchObject({ id: originalId, guncel_durum: "yerine_gecmis" });
      expect(list.body.fon_havuzu[0].duzeltmeler[0].yeni_kayit_id).toBe(replacementId);
    }
    const cancellation = { tur: "iptal", gerekce: "TEST: Gerekçeli iç kayıt iptali.", istek_anahtari: randomUUID() };
    const first = await post(replacementId, cancellation);
    expect(first.status).toBe(201); expect(first.body.yeni_kayit_id).toBeNull();
    expect((await post(replacementId, cancellation)).body).toEqual(first.body);
    const list = await request(app).get(status).set("x-test-actor", "owner");
    expect(list.body.toplam_fon_islem).toBe(2);
    expect(list.body.fon_havuzu[0]).toMatchObject({ id: replacementId, guncel_durum: "iptal" });
    expect(list.body.fon_havuzu[0].duzeltmeler).toHaveLength(2);
    const foreign = await request(app).get(status).set("x-test-actor", "other");
    expect(foreign.body.fon_havuzu).toEqual([]);
    const [original] = await db.select().from(funds).where(eq(funds.id, originalId));
    expect(original).toEqual(snapshot);
  });

  it("enforces database cross-company edges and unique-successor constraints", async () => {
    const [edge] = await db.select().from(amendments).where(eq(amendments.originalRecordId, originalId));
    const { id: _id, ...input } = edge!;
    await expect(db.insert(amendments).values({ ...input, requestKey: randomUUID() })).rejects.toThrow();
    const [foreign] = await db.select().from(profiles).where(eq(profiles.ownerClerkUserId, `fund-test-${fixture}:other`));
    await expect(db.insert(amendments).values({
      ...input, originalRecordId: replacementId, replacementRecordId: null, kind: "iptal",
      businessProfileId: foreign!.id, requestKey: randomUUID(),
    })).rejects.toThrow();
  });
});