import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ fail: false }));
vi.mock("../lib/companyAuth", () => ({
  requireMyCompany: async () => ({ profile: { id: 7 } }),
}));
vi.mock("@workspace/db", () => ({
  db: { transaction: async () => {
    if (state.fail) throw new Error("SENSITIVE DB PARAMETERS");
    const { ExportTooLarge } = await import("../lib/companyRecordCsv");
    throw new ExportTooLarge();
  } },
}));
import router from "./company-record-exports";
const log = { error: vi.fn() };
const app = express();
app.use((req, _res, next) => { req.log = log as any; next(); });
app.use("/api", router);
beforeEach(() => { state.fail = false; log.error.mockClear(); });
describe("atomic export errors", () => {
  it("returns 413 with narrowing advice, no attachment and no partial CSV", async () => {
    const res = await request(app).get("/api/company-records/funds/export?start=2026-01-01&end=2026-01-02");
    expect(res.status).toBe(413);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["content-disposition"]).toBeUndefined();
    expect(res.body.error).toContain("daraltın");
    expect(log.error).not.toHaveBeenCalled();
  });
  it("returns a clear private 503 without logging error objects or sensitive descriptions", async () => {
    state.fail = true;
    const res = await request(app).get("/api/company-records/instructions/export?start=2026-01-01&end=2026-01-02");
    expect(res.status).toBe(503);
    expect(res.headers["content-disposition"]).toBeUndefined();
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.text).not.toContain("SENSITIVE");
    expect(log.error).toHaveBeenCalledExactlyOnceWith("Şirket içi CSV dışa aktarımı tamamlanamadı.");
  });
});