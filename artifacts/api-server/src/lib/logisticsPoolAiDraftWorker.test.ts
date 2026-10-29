import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  locked: true, releases: [] as boolean[], queries: [] as string[], connections: 0,
  candidates: [] as any[], participants: [] as any[], saved: [] as any[],
  queued: false, inserts: 0,
}));
const generate = vi.hoisted(() => vi.fn());
vi.mock("@workspace/db", async (original) => {
  const actual = await original<typeof import("@workspace/db")>();
  return {
    ...actual,
    pool: { connect: async () => {
      state.connections++;
      return {
        query: async (text: string) => { state.queries.push(text); return { rows: [{ locked: state.locked }] }; },
        release: (destroy: boolean) => state.releases.push(destroy),
      };
    } },
    db: {
      select: () => ({ from: (table: unknown) => {
        const rows = table === actual.logisticsPoolMatchesTable ? state.candidates :
          table === actual.logisticsPoolEntriesTable ? state.participants : state.saved;
        const chain = {
          where: () => chain, orderBy: () => chain, limit: () => Promise.resolve(rows),
          then: (resolve: (rows: any[]) => unknown) => Promise.resolve(rows).then(resolve),
        };
        return chain;
      } }),
      insert: () => ({ values: (value: any) => {
        expect(value.status).toBe("dry_run");
        return { onConflictDoNothing: () => ({ returning: async () => {
          if (state.queued) return [];
          state.inserts++; state.queued = true; return [{ id: "TEST-NOTIFICATION" }];
        } }) };
      } }),
    },
  };
});
vi.mock("./logisticsPoolAiDraft", async () => {
  const { logisticsDraftMode } = await import("./logisticsPoolDraftPolicy");
  return {
    isLogisticsPoolAiDraftPreviewEnabled: () => logisticsDraftMode() !== "disabled",
    LOGISTICS_POOL_AI_DRAFT_WORKER_ACTOR: "TEST-SYSTEM-ACTOR",
    createLogisticsPoolMatchAiDraft: generate,
    LogisticsPoolAiDraftError: class extends Error {
      constructor(public status: number) { super("TEST-safe-error"); }
    },
  };
});
import { runLogisticsPoolAiDraftWorkerOnce, startLogisticsPoolAiDraftWorker } from "./logisticsPoolAiDraftWorker";
import { LogisticsPoolAiDraftError } from "./logisticsPoolAiDraft";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("REPLIT_DEPLOYMENT", "");
  vi.stubEnv("AI_INTEGRATIONS_GEMINI_API_KEY", "TEST-PLACEHOLDER");
  vi.stubEnv("AI_INTEGRATIONS_GEMINI_BASE_URL", "https://gemini.example.com");
  vi.stubEnv("MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED", "");
  vi.stubEnv("MMT_LOGISTICS_POOL_WORKER_ROLE", "");
  state.locked = true; state.releases = []; state.queries = []; state.connections = 0;
  state.queued = false; state.inserts = 0;
  state.candidates = [{ id: "TEST-MATCH", entryIds: ["TEST-LOAD", "TEST-CARRIER"], version: 1, snapshotHash: "TEST-HASH" }];
  state.participants = ["load", "carrier"].map((role) => ({ active: true, payload: { role, isTest: true } }));
  state.saved = [{ id: "TEST-DRAFT", snapshotHash: "TEST-HASH", status: "pending_review" }];
  generate.mockReset().mockResolvedValue({ saved: true });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("distributed sendless draft worker", () => {
  it("does not schedule the embedded TEST worker without explicit activation", () => {
    vi.stubEnv("MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED", "false");
    const schedule = vi.spyOn(globalThis, "setInterval");
    startLogisticsPoolAiDraftWorker();
    expect(schedule).not.toHaveBeenCalled();
    expect(state.connections).toBe(0);
    expect(generate).not.toHaveBeenCalled();
  });
  it("fails closed in production without explicit activation", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("REPLIT_DEPLOYMENT", "1");
    expect(await runLogisticsPoolAiDraftWorkerOnce()).toBe("disabled");
    expect(state.connections).toBe(0);
  });
  it("requires a dedicated worker even after production draft activation", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("REPLIT_DEPLOYMENT", "1");
    vi.stubEnv("MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED", "true");
    expect(await runLogisticsPoolAiDraftWorkerOnce()).toBe("disabled");
  });
  it("does not start an embedded production API timer", () => {
    vi.stubEnv("NODE_ENV", "production");
    const interval = vi.spyOn(globalThis, "setInterval");
    startLogisticsPoolAiDraftWorker();
    expect(interval).not.toHaveBeenCalled();
  });
  it("does no work if another process holds the advisory lock", async () => {
    state.locked = false;
    expect(await runLogisticsPoolAiDraftWorkerOnce()).toBe("busy");
    expect(generate).not.toHaveBeenCalled();
    expect(state.releases).toEqual([false]);
    expect(state.queries).toHaveLength(1);
  });
  it("revalidates via the service and records only an unsent notification", async () => {
    expect(await runLogisticsPoolAiDraftWorkerOnce()).toBe("queued");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(state.inserts).toBe(1);
    expect(state.queries.at(-1)).toContain("pg_advisory_unlock");
    expect(state.releases).toEqual([false]);
    expect(await runLogisticsPoolAiDraftWorkerOnce()).toBe("idle");
    expect(state.inserts).toBe(1);
  });
  it("does not mix real data into local TEST generation", async () => {
    state.participants[1].payload.isTest = false;
    expect(await runLogisticsPoolAiDraftWorkerOnce()).toBe("idle");
    expect(generate).not.toHaveBeenCalled();
  });
  it("processes only real matches after explicit dedicated production activation", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("REPLIT_DEPLOYMENT", "1");
    vi.stubEnv("MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED", "true");
    vi.stubEnv("MMT_LOGISTICS_POOL_WORKER_ROLE", "dedicated");
    expect(await runLogisticsPoolAiDraftWorkerOnce()).toBe("idle");
    expect(generate).not.toHaveBeenCalled();
    state.participants.forEach((p) => { p.payload.isTest = false; });
    expect(await runLogisticsPoolAiDraftWorkerOnce()).toBe("queued");
  });
  it("does not enqueue invalid/stale matches or report provider failure as success", async () => {
    generate.mockRejectedValueOnce(new LogisticsPoolAiDraftError(409, "TEST"));
    expect(await runLogisticsPoolAiDraftWorkerOnce()).toBe("idle");
    generate.mockRejectedValueOnce(new LogisticsPoolAiDraftError(503, "TEST"));
    expect(await runLogisticsPoolAiDraftWorkerOnce()).toBe("blocked");
    expect(state.inserts).toBe(0);
    expect(state.releases).toEqual([false, false]);
  });
});
