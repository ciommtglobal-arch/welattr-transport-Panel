import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const fixture = process.env.TEST_FUND_FIXTURE_TOKEN;
// Identity only is mocked. Real company lookup, active roles, SQL filtering,
// repeatable-read transaction and PostgreSQL pagination execute below.
vi.mock("../lib/staffAuth", () => ({
  requireUser: (req: any, res: any) => {
    const token = process.env.TEST_FUND_FIXTURE_TOKEN;
    const actor = req.get("x-test-actor");
    if (!token || !["owner", "admin", "manager", "member", "revoked", "other"].includes(actor)) {
      res.status(401).json({ error: "Sign in required" }); return null;
    }
    return `fund-test-${token}:${actor}`;
  },
}));
import { db, pool, b2bBusinessProfilesTable as profiles } from "@workspace/db";
import router from "./company-record-exports";
const app = express();
app.use("/api", router);
const endpoint = (kind: string, actor?: string, query: object = { start: "2026-01-01", end: "2026-01-02" }) => {
  const call = request(app).get(`/api/company-records/${kind}/export`).query(query);
  return actor ? call.set("x-test-actor", actor) : call;
};
// Supertest receives text/csv as UTF-8 text; preserve BOM for assertions.
const csv = (res: any) => res.text as string;
describe.skipIf(!fixture)("development PostgreSQL private exports", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || !/^[a-f0-9-]{36}$/.test(fixture!)) throw new Error("Development marker required");
    const [profile] = await db.select().from(profiles).where(eq(profiles.ownerClerkUserId, `fund-test-${fixture}:owner`));
    if (profile?.internalNote !== `TEST FUND DEVELOPMENT ${fixture}`) throw new Error("Confirmed development fixture unavailable");
  });
  afterAll(async () => { await pool.end(); });

  it("denies anonymous, member and revoked actors for both file types; never caches failures", async () => {
    for (const kind of ["funds", "instructions"])
      for (const actor of [undefined, "member", "revoked"]) {
        const res = await endpoint(kind, actor);
        expect(res.status).toBe(actor ? 403 : 401);
        expect(res.headers["cache-control"]).toBe("private, no-store");
        expect(res.headers["content-disposition"]).toBeUndefined();
      }
  });
  it("permits all three active roles and includes every page exactly once with precise currencies and authors", async () => {
    for (const kind of ["funds", "instructions"])
      for (const actor of ["owner", "admin", "manager"]) {
        const res = await endpoint(kind, actor);
        expect(res.status).toBe(200);
        expect(res.headers["cache-control"]).toBe("private, no-store");
        expect(res.headers["content-type"]).toContain("text/csv; charset=utf-8");
        expect(res.headers["content-disposition"]).toContain("attachment;");
        const text = csv(res);
        expect(text.charCodeAt(0)).toBe(0xfeff);
        const lines = text.split("\r\n").filter(Boolean);
        expect(lines).toHaveLength(532);
        expect(new Set(lines.slice(1).map((s) => s.split(";")[0])).size).toBe(531);
        expect(text).toContain("' \t=SUM");
        expect(text).toContain("Şirket Çelik");
        expect(text).toContain("TEST owner");
        expect(text).not.toContain("FOREIGN");
        expect(text).not.toContain("OUTSIDE");
        if (kind === "funds") {
          expect(text).toContain('"999999999999,99";"USD"');
          expect(text).toContain('"0,01";"TRY"');
          expect(text).toContain('"12,30";"EUR"');
          expect(text).toContain('"iptal"');
          expect(text).toContain("İptal gerekçesi");
        }
      }
  });
  it("uses inclusive Istanbul days and excludes adjacent instants", async () => {
    for (const kind of ["funds", "instructions"]) {
      const res = await endpoint(kind, "owner", { start: "2026-01-01", end: "2026-01-01" });
      expect(res.status).toBe(200);
      expect(csv(res).split("\r\n").filter(Boolean)).toHaveLength(532);
      expect(csv(res)).not.toContain("OUTSIDE");
    }
  });
  it("isolates another company's archive and returns a valid empty file", async () => {
    for (const kind of ["funds", "instructions"]) {
      const foreign = await endpoint(kind, "other");
      expect(foreign.status).toBe(200);
      expect(csv(foreign)).toContain("FOREIGN");
      expect(csv(foreign)).not.toContain("Şirket Çelik");
      const empty = await endpoint(kind, "owner", { start: "2027-01-01", end: "2027-01-01" });
      expect(empty.status).toBe(200);
      expect(csv(empty).split("\r\n").filter(Boolean)).toHaveLength(1);
    }
  });
  it("rejects forged scopes, unknown kinds, invalid calendars and overlong ranges", async () => {
    for (const query of [
      { start: "2026-01-01", end: "2026-01-02", businessProfileId: 1 },
      { start: "2026-02-30", end: "2026-03-01" },
      { start: "2026-01-01", end: "2026-04-03" },
      { start: "2026-02-02", end: "2026-01-01" },
      { start: "2026-01-01" },
    ]) expect((await endpoint("funds", "owner", query)).status).toBe(400);
    expect((await endpoint("unknown", "owner")).status).toBe(400);
  });
});