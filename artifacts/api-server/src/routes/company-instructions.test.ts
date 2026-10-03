import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  role: "owner" as string | null,
  companyId: 7,
  rows: [] as Record<string, any>[],
  scopes: [] as number[],
  failed: false,
}));

vi.mock("../lib/companyAuth", () => ({
  requireMyCompany: async (_req: unknown, res: any, roles: string[]) => {
    if (!state.role) { res.status(401).json({ error: "Sign in required" }); return null; }
    if (!roles.includes(state.role)) { res.status(403).json({ error: "Forbidden" }); return null; }
    return { profile: { id: state.companyId }, member: { id: 11, fullName: "Test Owner", role: state.role } };
  },
}));
vi.mock("../lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@workspace/db", async () => {
  const { pgTable, integer, timestamp } = await import("drizzle-orm/pg-core");
  const table = pgTable("company_instructions", {
    id: integer("id"),
    businessProfileId: integer("business_profile_id"),
    createdAt: timestamp("created_at"),
  });
  return {
    companyInstructionsTable: table,
    db: {
      insert: () => ({
        values: (data: any) => ({
          returning: async () => {
            if (state.failed) throw new Error("Database unavailable");
            const row = { ...data, id: state.rows.length + 1, signatureLabel: "WelatTR", ecosystemLabel: "Çelik Kubbe", createdAt: new Date() };
            state.rows.push(row);
            return [row];
          },
        }),
      }),
      select: (projection?: unknown) => ({
        from: () => ({
          where: (scope: any) => {
            const companyId = new PgDialect().sqlToQuery(scope).params[0] as number;
            state.scopes.push(companyId);
            const rows = state.rows.filter((row) => row.businessProfileId === companyId);
            if (state.failed) throw new Error("Database unavailable");
            if (projection) return Promise.resolve([{ total: rows.length }]);
            return { orderBy: () => ({ limit: (limit: number) => ({ offset: async (offset: number) => rows.slice().reverse().slice(offset, offset + limit) }) }) };
          },
        }),
      }),
    },
  };
});

import router from "./company-instructions";
const app = express();
app.use(express.json());
app.use("/api", router);
const body = { kurum_adi: " Örnek Kurum ", icerik: " Kurum içi koordinasyon talimatı. " };

beforeEach(() => {
  state.role = "owner";
  state.companyId = 7;
  state.rows = [];
  state.scopes = [];
  state.failed = false;
});

describe("company instruction authorization and persistence contract", () => {
  it("stores a trimmed owner record with server-owned attribution and returns it on later requests", async () => {
    const create = await request(app).post("/api/talimat-ekle").send(body);
    expect(create.status).toBe(201);
    expect(create.body.veri).toMatchObject({ kurum: "Örnek Kurum", icerik: body.icerik.trim(), imza: "WelatTR", olusturan: "Test Owner" });
    expect(state.rows[0]).toMatchObject({ businessProfileId: 7, authorMemberId: 11, operationType: "Resmi Talimat" });
    const list = await request(app).get("/api/talimatlari-listele");
    expect(list.status).toBe(200);
    expect(list.body.toplam_talimat).toBe(1);
    expect(list.body.liste[0].id).toBe(create.body.veri.id);
    expect(list.body.canCreate).toBe(true);
    expect(state.scopes).toEqual([7, 7]);
  });

  it("does not allow unsigned, expert, manager or admin callers to create", async () => {
    for (const role of [null, "member", "manager", "admin"]) {
      state.role = role;
      expect((await request(app).post("/api/talimat-ekle").send(body)).status).toBe(role === null ? 401 : 403);
    }
    expect(state.rows).toHaveLength(0);
  });

  it("restricts reading to active management authorization and does not expose another company", async () => {
    await request(app).post("/api/talimat-ekle").send(body);
    for (const role of ["manager", "admin"]) {
      state.role = role;
      const list = await request(app).get("/api/talimatlari-listele");
      expect(list.status).toBe(200);
      expect(list.body.canCreate).toBe(false);
    }
    state.companyId = 8;
    expect((await request(app).get("/api/talimatlari-listele")).body.liste).toEqual([]);
    for (const role of ["member", null]) {
      state.role = role;
      expect((await request(app).get("/api/talimatlari-listele")).status).toBe(role === null ? 401 : 403);
    }
  });

  it("rejects blank/oversize values, spoofed attribution and company selectors", async () => {
    for (const invalid of [
      {}, { ...body, kurum_adi: "   " }, { ...body, icerik: "     " },
      { ...body, icerik: "a".repeat(8001) }, { ...body, kurum_adi: "a".repeat(201) },
      { ...body, islem_turu: "  " }, { ...body, businessProfileId: 8 },
      { ...body, imza: "Spoofed" }, { ...body, zaman: "2026-01-01" },
    ]) {
      expect((await request(app).post("/api/talimat-ekle").send(invalid)).status).toBe(400);
    }
    for (const query of ["limit=0", "limit=101", "offset=-1", "limit=abc", "businessProfileId=8"]) {
      expect((await request(app).get(`/api/talimatlari-listele?${query}`)).status).toBe(400);
    }
    expect(state.rows).toHaveLength(0);
  });

  it("returns total and a bounded page", async () => {
    for (let index = 0; index < 3; index++) await request(app).post("/api/talimat-ekle").send(body);
    const page = await request(app).get("/api/talimatlari-listele?limit=1&offset=1");
    expect(page.body).toMatchObject({ toplam_talimat: 3, limit: 1, offset: 1 });
    expect(page.body.liste).toHaveLength(1);
  });

  it("fails explicitly without reporting a successful save when the database is unavailable", async () => {
    state.failed = true;
    expect((await request(app).post("/api/talimat-ekle").send(body)).status).toBe(503);
    expect((await request(app).get("/api/talimatlari-listele")).status).toBe(503);
  });
});