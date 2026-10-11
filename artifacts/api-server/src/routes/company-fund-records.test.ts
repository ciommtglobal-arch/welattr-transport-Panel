import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "owner" as string | null, active: true, companyId: 7, failed: false, failAmendment: false, trueOwner: true,
  rows: {} as Record<string, Record<string, any>[]>, scopes: [] as number[],
  schemaReady: true as unknown, guardQueries: [] as string[],
}));
vi.mock("../lib/companyAuth", () => ({
  requireMyCompany: async (_req: unknown, res: any, roles: string[]) => {
    if (!state.role) { res.status(401).json({ error: "Sign in required" }); return null; }
    if (!state.active || !roles.includes(state.role)) { res.status(403).json({ error: "Forbidden" }); return null; }
    return { userId: "test-owner", profile: { id: state.companyId, ownerClerkUserId: state.trueOwner ? "test-owner" : "other-owner" }, member: { id: 11, fullName: "Test Owner", role: state.role } };
  },
}));
vi.mock("../lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@workspace/db", async () => {
  const { pgTable, integer, timestamp, text, PgDialect } = await import("drizzle-orm/pg-core");
  const { getTableName } = await import("drizzle-orm");
  const table = (name: string) => pgTable(name, {
    id: integer("id"), businessProfileId: integer("business_profile_id"),
    createdAt: timestamp("created_at"), requestKey: text("request_key"),
     originalRecordId: integer("original_record_id"), replacementRecordId: integer("replacement_record_id"),
  });
  let queue = Promise.resolve();
  const db: any = {
      execute: async (statement: any) => {
        if (state.failed) throw new Error("Database unavailable");
        const query = new PgDialect().sqlToQuery(statement);
        state.guardQueries.push(query.sql);
        return { rows: query.sql.trimStart().startsWith("LOCK") ? [] : [{ ready: state.schemaReady }] };
      },
      insert: (tbl: any) => ({
        values: (data: any) => {
          let deduplicate = false;
          const writer = {
            onConflictDoNothing: () => { deduplicate = true; return writer; },
            returning: async () => {
              if (state.failed) throw new Error("Database unavailable");
              const rows = state.rows[getTableName(tbl)]!;
               if (getTableName(tbl) === "amendments" && state.failAmendment) throw new Error("Audit insert failed");
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
            const query = new PgDialect().sqlToQuery(scope);
            const [company, value] = query.params;
            state.scopes.push(company as number);
            const rows = state.rows[getTableName(tbl)]!.filter((r) => {
              if (r.businessProfileId !== company) return false;
              if (query.sql.includes('"request_key"')) return r.requestKey === value;
              if (getTableName(tbl) === "funds" && query.sql.includes('"id" =')) return r.id === value;
              if (query.sql.includes('"original_record_id"') && query.sql.includes('"replacement_record_id"'))
                return query.params.slice(1).includes(r.originalRecordId) || query.params.slice(1).includes(r.replacementRecordId);
              if (query.sql.includes('"original_record_id"')) return r.originalRecordId === value;
              return true;
            });
            if (projection) return Promise.resolve([{ total: rows.length }]);
            let limit = rows.length;
            const result = {
              orderBy: () => result,
              limit: (value: number) => { limit = value; return result; },
               for: () => result,
              offset: async (value: number) => rows.slice().reverse().slice(value, value + limit),
              then: (resolve: any, reject: any) => Promise.resolve(rows.slice(0, limit)).then(resolve, reject),
            };
            return result;
          },
        }),
      }),
    transaction: (fn: any) => {
      const task = queue.then(async () => {
        const snapshot = structuredClone(state.rows);
        try { return await fn(db); } catch (e) { state.rows = snapshot; throw e; }
      });
      queue = task.then(() => undefined, () => undefined);
      return task;
    },
  };
  return {
    companyFundRecordsTable: table("funds"), companyInstructionsTable: table("instructions"),
    companyFundAmendmentsTable: table("amendments"), db,
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
  state.rows = { funds: [], instructions: [], amendments: [] }; state.scopes = [];
  state.trueOwner = true; state.failAmendment = false;
  state.schemaReady = true; state.guardQueries = [];
});

describe("append-only fund corrections and cancellations", () => {
  const correction = () => ({
    tur: "duzeltme", gerekce: "Yanlış kurum ve tutar girildi.", istek_anahtari: randomUUID(),
    yeni_kayit: { kurum: "Correct Institution", islem_turu: "Correct Record", miktar: "999999999999.99", para_birimi: "EUR", aciklama: "Correct note" },
  });
  const cancel = () => ({ tur: "iptal", gerekce: "Yanlış kayıt nedeniyle iptal.", istek_anahtari: randomUUID() });
  const path = (id: number) => `${fundPath}/${id}/duzeltmeler`;
  async function original() {
    return (await request(app).post(fundPath).send(body())).body.veri.id as number;
  }

  it("blocks both correction and cancellation without verified schema, with zero writes", async () => {
    const id = await original();
    const snapshot = structuredClone(state.rows);
    state.scopes = [];
    for (const readiness of [false, undefined, null, "true", 1]) {
      state.schemaReady = readiness;
      for (const draft of [correction(), cancel()]) {
        const result = await request(app).post(path(id)).send(draft);
        expect(result.status).toBe(503);
        expect(result.body.code).toBe("FUND_SCHEMA_PENDING");
        expect(state.rows).toEqual(snapshot);
      }
    }
    expect(state.guardQueries[0]).toContain("LOCK TABLE");
    expect(state.guardQueries[1]).toContain("c.convalidated");
    expect(state.scopes).toEqual([]);
    state.schemaReady = true;
    expect((await request(app).post(path(id)).send(correction())).status).toBe(201);
  });

  it("cannot override schema readiness through body, query or unauthorized roles", async () => {
    const id = await original();
    state.schemaReady = false;
    expect((await request(app).post(path(id)).send({ ...cancel(), ready: true })).status).toBe(400);
    expect((await request(app).post(`${path(id)}?ready=true`).send(cancel())).status).toBe(400);
    for (const role of [null, "admin", "manager", "member"]) {
      state.role = role;
      expect((await request(app).post(path(id)).send(cancel())).status).toBe(role === null ? 401 : 403);
    }
    expect(state.guardQueries).toEqual([]);
    expect(state.rows.amendments).toHaveLength(0);
  });

  it("preserves original content/author/time, derives statuses and permits a subsequent correction of the replacement", async () => {
    const id = await original();
    const snapshot = structuredClone(state.rows.funds![0]);
    const data = correction();
    const saved = await request(app).post(path(id)).send(data);
    expect(saved.status).toBe(201);
    expect(saved.headers["cache-control"]).toBe("private, no-store");
    expect(saved.body).toMatchObject({ onceki_kayit_id: id, yeni_kayit_id: 2, tur: "duzeltme", olusturan: "Test Owner" });
    expect(state.rows.funds![0]).toEqual(snapshot);
    expect(state.rows.funds![1]).toMatchObject({ amount: "999999999999.99", currency: "EUR", businessProfileId: 7, authorMemberId: 11 });
    const list = (await request(app).get(statusPath)).body.fon_havuzu;
    expect(list.find((r: any) => r.id === id)).toMatchObject({ guncel_durum: "yerine_gecmis", miktar: "10.10", duzeltmeler: [saved.body] });
    expect(list.find((r: any) => r.id === 2)).toMatchObject({ guncel_durum: "guncel", duzeltmeler: [saved.body] });
    expect((await request(app).post(path(2)).send(cancel())).status).toBe(201);
    expect(state.rows.funds![0]).toEqual(snapshot);
    const page = await request(app).get(`${statusPath}?fon_limit=1`);
    expect(page.body.fon_havuzu[0]).toMatchObject({ id: 2, guncel_durum: "iptal" });
    expect(page.body.fon_havuzu[0].duzeltmeler).toHaveLength(2);
  });

  it("replays concurrent/sequential retries without duplicates and rejects competing corrections or changed draft", async () => {
    const id = await original(), data = correction();
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(app).post(path(id)).send(data)));
    expect(responses.every((r) => r.status === 201 && r.body.id === responses[0]!.body.id)).toBe(true);
    expect(state.rows.funds).toHaveLength(2); expect(state.rows.amendments).toHaveLength(1);
    expect((await request(app).post(path(id)).send({ ...data, yeni_kayit: { ...data.yeni_kayit, miktar: "9" } })).status).toBe(409);
    expect((await request(app).post(path(id)).send(correction())).status).toBe(409);
    expect((await request(app).post(path(id)).send(cancel())).status).toBe(409);
    expect((await request(app).post(path(2)).send(data)).status).toBe(409);
    expect(state.rows.funds).toHaveLength(2);
  });

  it("cancels without new fund rows and preserves the original plus reason history", async () => {
    const id = await original(), data = cancel();
    const first = await request(app).post(path(id)).send(data);
    expect(first.status).toBe(201); expect(first.body.yeni_kayit_id).toBeNull();
    expect((await request(app).post(path(id)).send(data)).body).toEqual(first.body);
    expect(state.rows.funds).toHaveLength(1);
    expect((await request(app).get(statusPath)).body.fon_havuzu[0].guncel_durum).toBe("iptal");
  });

  it("rejects inactive/non-owner callers and cross-firm targets; managers/admins read audit only", async () => {
    const id = await original();
    await request(app).post(path(id)).send(correction());
    for (const role of ["member", "admin", "manager", null]) {
      state.role = role;
      expect((await request(app).post(path(id)).send(cancel())).status).toBe(role === null ? 401 : 403);
      const read = await request(app).get(statusPath);
      expect(read.status).toBe(role === null ? 401 : role === "member" ? 403 : 200);
      if (role === "admin" || role === "manager") {
        expect(read.body.canCreate).toBe(false); expect(read.body.fon_havuzu[0].duzeltmeler).toHaveLength(1);
      }
    }
    state.role = "owner"; state.active = false;
    expect((await request(app).post(path(id)).send(cancel())).status).toBe(403);
    state.active = true; state.trueOwner = false;
    expect((await request(app).post(path(id)).send(cancel())).status).toBe(403);
    state.trueOwner = true; state.companyId = 8;
    expect((await request(app).post(path(id)).send(cancel())).status).toBe(404);
    expect((await request(app).get(statusPath)).body.fon_havuzu).toEqual([]);
    expect(state.rows.amendments).toHaveLength(1);
  });

  it("rejects spoofed author/company/time/role, blank reasons, invalid IDs, money and nested extras", async () => {
    const id = await original(), data = correction();
    for (const patch of [
      { gerekce: "     " }, { gerekce: "a".repeat(2001) }, { tur: "unknown" },
      { istek_anahtari: "bad" }, { businessProfileId: 8 }, { authorMemberId: 20 },
      { zaman: "2026-01-01" }, { role: "owner" }, { olusturan: "Spoof" },
      { yeni_kayit: { ...data.yeni_kayit, businessProfileId: 8 } },
      { yeni_kayit: { ...data.yeni_kayit, para_birimi: "GBP" } },
      { yeni_kayit: { ...data.yeni_kayit, kurum: "  " } },
      { yeni_kayit: undefined }, { ...cancel(), yeni_kayit: data.yeni_kayit },
    ]) expect((await request(app).post(path(id)).send({ ...data, ...patch })).status).toBe(400);
    for (const amount of [1.2, "0", "0.00", "1e3", "-1", "01", "1.234", "1000000000000", "1,25"]) {
      expect((await request(app).post(path(id)).send({ ...data, yeni_kayit: { ...data.yeni_kayit, miktar: amount } })).status).toBe(400);
    }
    for (const invalidId of ["0", "-1", "abc", "1.5", "2147483648"])
      expect((await request(app).post(`${fundPath}/${invalidId}/duzeltmeler`).send(data)).status).toBe(400);
    expect((await request(app).post(`${path(id)}?companyId=8`).send(data)).status).toBe(400);
    expect(state.rows.funds).toHaveLength(1); expect(state.rows.amendments).toHaveLength(0);
  });

  it("rolls back a replacement if audit insertion fails, then safely retries same key", async () => {
    const id = await original(), data = correction();
    state.failAmendment = true;
    expect((await request(app).post(path(id)).send(data)).status).toBe(503);
    expect(state.rows.funds).toHaveLength(1);
    state.failAmendment = false;
    expect((await request(app).post(path(id)).send(data)).status).toBe(201);
    expect((await request(app).post(path(id)).send(data)).status).toBe(201);
    expect(state.rows.funds).toHaveLength(2); expect(state.rows.amendments).toHaveLength(1);
  });
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