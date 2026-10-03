import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "owner" as string | null, active: true, companyId: 7, failed: false,
  rows: {} as Record<string, Record<string, any>[]>, scopes: [] as number[],
}));
vi.mock("../lib/companyAuth", () => ({
  requireMyCompany: async (_req: unknown, res: any, roles: string[]) => {
    if (!state.role) { res.status(401).json({ error: "Sign in required" }); return null; }
    if (!state.active || !roles.includes(state.role)) { res.status(403).json({ error: "Forbidden" }); return null; }
    return { profile: { id: state.companyId }, member: { id: 11, fullName: "Test Owner", role: state.role } };
  },
}));
vi.mock("../lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@workspace/db", async () => {
  const { pgTable, integer, timestamp, text, PgDialect } = await import("drizzle-orm/pg-core");
  const { getTableName } = await import("drizzle-orm");
  const table = (name: string) => pgTable(name, {
    id: integer("id"), businessProfileId: integer("business_profile_id"),
    createdAt: timestamp("created_at"), requestKey: text("request_key"),
  });
  return {
    companyFundRecordsTable: table("funds"), companyInstructionsTable: table("instructions"),
    db: {
      insert: (tbl: any) => ({
        values: (data: any) => {
          let deduplicate = false;
          const writer = {
            onConflictDoNothing: () => { deduplicate = true; return writer; },
            returning: async () => {
              if (state.failed) throw new Error("Database unavailable");
              const rows = state.rows[getTableName(tbl)]!;
              if (deduplicate && rows.some((r) => r.businessProfileId === data.businessProfileId && r.requestKey === data.requestKey)) return [];
              const row = { ...data, id: rows.length + 1, createdAt: new Date(), signatureLabel: "WelatTR", ecosystemLabel: "Çelik Kubbe" };
              rows.push(row);
              return [row];
            },
          };
          return writer;
        },
      }),
      select: (projection?: unknown) => ({
        from: (tbl: any) => ({
          where: (scope: any) => {
            if (state.failed) throw new Error("Database unavailable");
            const [company, key] = new PgDialect().sqlToQuery(scope).params;
            state.scopes.push(company as number);
            const rows = state.rows[getTableName(tbl)]!.filter((r) => r.businessProfileId === company && (key === undefined || r.requestKey === key));
            if (projection) return Promise.resolve([{ total: rows.length }]);
            let limit = rows.length;
            const result = {
              orderBy: () => result,
              limit: (value: number) => { limit = value; return result; },
              offset: async (value: number) => rows.slice().reverse().slice(value, value + limit),
              then: (resolve: any, reject: any) => Promise.resolve(rows.slice(0, limit)).then(resolve, reject),
            };
            return result;
          },
        }),
      }),
    },
  };
});
import fundsRouter, { normalizeFundAmount } from "./company-fund-records";
import instructionsRouter from "./company-instructions";
const app = express();
app.use(express.json());
app.use("/api", instructionsRouter, fundsRouter);
const fundPath = "/api/celik-kubbe/fon-islem";
const statusPath = "/api/celik-kubbe/durum";
const body = () => ({
  kurum: " Test Institution ", islem_turu: " Kredi / Fon Kaydı ",
  miktar: "10.1", para_birimi: "TRY", aciklama: " Test note ", istek_anahtari: randomUUID(),
});
beforeEach(() => {
  state.role = "owner"; state.active = true; state.companyId = 7; state.failed = false;
  state.rows = { funds: [], instructions: [] }; state.scopes = [];
});

describe("private immutable internal fund records", () => {
  it("stores exact amounts with server ownership and no financial approval claims", async () => {
    const result = await request(app).post(fundPath).send(body());
    expect(result.status).toBe(201);
    expect(result.headers["cache-control"]).toBe("private, no-store");
    expect(result.body.veri).toMatchObject({ miktar: "10.10", kurum: "Test Institution", olusturan: "Test Owner", kayit_durumu: "firma_ici_kayit" });
    expect(result.body.veri.guvence_durumu).toBeUndefined();
    expect(state.rows.funds![0]).toMatchObject({ businessProfileId: 7, authorMemberId: 11, description: "Test note" });
    const status = await request(app).get(statusPath);
    expect(status.body).toMatchObject({ toplam_fon_islem: 1, toplam_talimat: 0, canCreate: true });
    expect(status.body.fon_havuzu[0].id).toBe(result.body.veri.id);
    expect(status.headers["cache-control"]).toBe("private, no-store");
  });
  it("atomically replays sequential/concurrent same-key requests and refuses changed input", async () => {
    const data = body();
    const responses = await Promise.all(Array.from({ length: 6 }, () => request(app).post(fundPath).send(data)));
    expect(responses.every((r) => r.status === 201 && r.body.veri.id === responses[0]!.body.veri.id)).toBe(true);
    expect(state.rows.funds).toHaveLength(1);
    expect((await request(app).post(fundPath).send({ ...data, miktar: "10.10" })).status).toBe(201);
    expect((await request(app).post(fundPath).send({ ...data, miktar: "11" })).status).toBe(409);
    expect(state.rows.funds).toHaveLength(1);
    // A key can exist separately in another company, never replay another firm's row.
    state.companyId = 8;
    expect((await request(app).post(fundPath).send(data)).status).toBe(201);
    expect(state.rows.funds).toHaveLength(2);
  });
  it("enforces writer/reader roles, active status, unsigned refusal and company isolation", async () => {
    await request(app).post(fundPath).send(body());
    for (const role of ["admin", "manager", "member", null]) {
      state.role = role;
      expect((await request(app).post(fundPath).send(body())).status).toBe(role === null ? 401 : 403);
      expect((await request(app).get(statusPath)).status).toBe(role === null ? 401 : role === "member" ? 403 : 200);
      if (role === "admin" || role === "manager") expect((await request(app).get(statusPath)).body.canCreate).toBe(false);
    }
    state.role = "owner"; state.active = false;
    expect((await request(app).get(statusPath)).status).toBe(403);
    expect((await request(app).post(fundPath).send(body())).status).toBe(403);
    state.active = true; state.companyId = 8; state.scopes = [];
    const status = await request(app).get(statusPath);
    expect(status.body.toplam_fon_islem).toBe(0);
    expect(status.body.fon_havuzu).toEqual([]);
    expect(status.body.talimatlar).toEqual([]);
    expect(state.scopes).toEqual([8, 8, 8, 8]);
  });
  it("rejects invalid money, currencies, UUIDs, blanks, oversize and attribution spoofing", async () => {
    const base = body();
    for (const miktar of [0, 12.2, null, "", "0", "0.00", "-1", "1.234", "1e3", "NaN", "01", "1,25", " 1", "1000000000000", "1.000,00"]) {
      expect((await request(app).post(fundPath).send({ ...base, miktar })).status).toBe(400);
    }
    for (const patch of [
      { para_birimi: "GBP" }, { kurum: "  " }, { islem_turu: "  " },
      { kurum: "a".repeat(201) }, { islem_turu: "a".repeat(101) }, { aciklama: "a".repeat(8001) },
      { istek_anahtari: "bad-key" }, { businessProfileId: 8 }, { yetkili: "Someone" },
      { imza: "Signed" }, { guvence_durumu: "Onaylı" }, { zaman: "2026-01-01" },
    ]) expect((await request(app).post(fundPath).send({ ...base, ...patch })).status).toBe(400);
    expect(state.rows.funds).toHaveLength(0);
    expect(normalizeFundAmount("999999999999.99")).toBe("999999999999.99");
    expect(normalizeFundAmount("0.01")).toBe("0.01");
    expect(normalizeFundAmount("1000000000000")).toBeNull();
  });
  it("shares both instruction routes without duplicate pools or caller-controlled author", async () => {
    const instruction = { kurum_adi: "Test institution", icerik: "Test internal instruction." };
    const alias = await request(app).post("/api/celik-kubbe/talimat-ekle").send(instruction);
    expect(alias.status).toBe(201);
    expect(alias.headers["cache-control"]).toBe("private, no-store");
    expect((await request(app).get("/api/talimatlari-listele")).body.liste[0].id).toBe(alias.body.veri.id);
    expect((await request(app).get(statusPath)).body.talimatlar[0].id).toBe(alias.body.veri.id);
    expect(state.rows.instructions).toHaveLength(1);
    const spoof = await request(app).post("/api/celik-kubbe/talimat-ekle").send({ ...instruction, yetkili: "Forged CIO" });
    expect(spoof.status).toBe(400); expect(spoof.body.error).toContain("Yetkili");
    expect(state.rows.instructions).toHaveLength(1);
    state.role = "manager";
    expect((await request(app).post("/api/celik-kubbe/talimat-ekle").send(instruction)).status).toBe(403);
  });
  it("bounds each list independently and counts only the scoped company", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post(fundPath).send(body());
      await request(app).post("/api/talimat-ekle").send({ kurum_adi: "Test", icerik: `Instruction ${i}` });
    }
    const page = await request(app).get(`${statusPath}?fon_limit=1&fon_offset=1&talimat_limit=2&talimat_offset=0`);
    expect(page.body).toMatchObject({ toplam_fon_islem: 3, toplam_talimat: 3, fon_limit: 1, fon_offset: 1 });
    expect(page.body.fon_havuzu).toHaveLength(1);
    expect(page.body.talimatlar).toHaveLength(2);
    for (const query of ["fon_limit=101", "talimat_limit=0", "fon_offset=-1", "talimat_offset=1000001", "fon_limit=abc", "businessProfileId=8"]) {
      expect((await request(app).get(`${statusPath}?${query}`)).status).toBe(400);
    }
  });
  it("explicitly fails on storage/read failures while same-key retry remains safe", async () => {
    const data = body(); state.failed = true;
    expect((await request(app).post(fundPath).send(data)).status).toBe(503);
    expect((await request(app).get(statusPath)).status).toBe(503);
    state.failed = false;
    expect((await request(app).post(fundPath).send(data)).status).toBe(201);
    expect((await request(app).post(fundPath).send(data)).status).toBe(201);
    expect(state.rows.funds).toHaveLength(1);
  });
});