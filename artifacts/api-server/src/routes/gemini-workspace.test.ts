import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actor: "TEST_FOUNDER" as string | null,
  get: vi.fn(), send: vi.fn(),
}));
vi.mock("../lib/logisticsWorkflowAuth", () => ({
  requireLogisticsFounder: (_req: unknown, res: any) => {
    if (!mocks.actor) { res.status(403).json({ error: "Kurucu yetkisi yok." }); return null; }
    return { userId: mocks.actor, isFounder: true };
  },
}));
vi.mock("../lib/geminiWorkspace", async importOriginal => {
  const original = await importOriginal<typeof import("../lib/geminiWorkspace")>();
  return { ...original, getGeminiWorkspace: mocks.get, sendGeminiInstruction: mocks.send };
});
import router from "./gemini-workspace";
import { GeminiWorkspaceError } from "../lib/geminiWorkspace";
const app = express();
app.use(express.json({ limit: "32kb" }), router);
const turn = {
  id: "11111111-1111-4111-8111-111111111111", instruction: "TEST: görev paylaşımını özetle.",
  reply: "Bu bir öneridir; dış işlem yapılmadı.", status: "answered",
  failureMessage: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("REPLIT_DEPLOYMENT", "");
  mocks.actor = "TEST_FOUNDER";
  mocks.get.mockReset().mockResolvedValue({ mode: "preview_drafts_only", model: "gemini-3.8-flash", turns: [turn] });
  mocks.send.mockReset().mockResolvedValue(turn);
});
afterEach(() => vi.unstubAllEnvs());
describe("Founder Gemini preview API", () => {
  it("returns founder-scoped history and no-store", async () => {
    const res = await request(app).get("/gemini/workspace");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(mocks.get).toHaveBeenCalledWith("TEST_FOUNDER");
    expect(res.body.turns[0].reply).toBe(turn.reply);
  });
  it.each(["production", "staging", ""])("blocks non-preview environment %s", async env => {
    vi.stubEnv("NODE_ENV", env);
    expect((await request(app).post("/gemini/workspace").send({})).status).toBe(404);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("blocks a deployment even if NODE_ENV is development", async () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("REPLIT_DEPLOYMENT", "1");
    expect((await request(app).get("/gemini/workspace")).status).toBe(404);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("rejects non-founders before history or model access", async () => {
    mocks.actor = null;
    expect((await request(app).get("/gemini/workspace")).status).toBe(403);
    expect((await request(app).post("/gemini/workspace").send({ requestId: turn.id, instruction: turn.instruction })).status).toBe(403);
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("uses session actor, not a caller-supplied identity", async () => {
    const res = await request(app).post("/gemini/workspace").send({ requestId: turn.id, instruction: turn.instruction });
    expect(res.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith("TEST_FOUNDER", { requestId: turn.id, instruction: turn.instruction });
  });
  it.each([
    { requestId: turn.id, instruction: turn.instruction, ownerClerkUserId: "OTHER" },
    { requestId: turn.id, instruction: turn.instruction, approved: true },
    { requestId: "bad-id", instruction: "test" },
    { requestId: turn.id, instruction: "" },
    { requestId: turn.id, instruction: "x".repeat(3001) },
  ])("rejects malformed or privileged extra fields", async payload => {
    expect((await request(app).post("/gemini/workspace").send(payload)).status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects oversized body before service access", async () => {
    expect((await request(app).post("/gemini/workspace").send({ instruction: "x".repeat(18_000) })).status).toBe(413);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("preserves explicit throttling errors", async () => {
    mocks.send.mockRejectedValue(new GeminiWorkspaceError(429, "Maliyet koruması"));
    const res = await request(app).post("/gemini/workspace").send({ requestId: turn.id, instruction: turn.instruction });
    expect(res.status).toBe(429);
  });
  it("never leaks provider credentials or error messages", async () => {
    mocks.send.mockRejectedValue(new Error("TEST_SECRET_DO_NOT_EXPOSE"));
    const res = await request(app).post("/gemini/workspace").send({ requestId: turn.id, instruction: turn.instruction });
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("TEST_SECRET_DO_NOT_EXPOSE");
  });
  it("does not report failed model requests as answered", async () => {
    mocks.send.mockResolvedValue({ ...turn, status: "failed", reply: null, failureMessage: "Talimat korundu." });
    const res = await request(app).post("/gemini/workspace").send({ requestId: turn.id, instruction: turn.instruction });
    expect(res.body.status).toBe("failed"); expect(res.body.reply).toBeNull();
  });
});
