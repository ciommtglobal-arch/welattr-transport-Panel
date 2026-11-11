import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { userId: "TEST_FOUNDER", isFounder: true } as { userId: string; isFounder: boolean } | null,
  match: {
    id: "11111111-1111-4111-8111-111111111111",
    entryIds: [
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ],
    status: "pending",
    version: 1,
    snapshotHash: "snapshot-1",
  } as Record<string, any>,
  entries: [] as Array<Record<string, any>>,
  sources: [] as Array<Record<string, any>>,
  drafts: [] as Array<Record<string, any>>,
  generatedText: JSON.stringify({
    summary: "Beyan edilen rota ve taşıma türü örtüşüyor; bilgilerin ayrıca teyidi gerekir.",
    introductionDraft: "Merhaba, MMT Global üzerinden olası bir lojistik iş birliğini değerlendirmek ister misiniz?",
  }),
  prompt: "",
  generateCalls: 0,
  databaseWrites: 0,
  lockAvailable: true,
  release: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const table = (name: string) => ({ name });
  const matches = table("logistics_pool_matches");
  const entries = table("logistics_pool_entries");
  const sources = table("logistics_pool_sources");
  const drafts = table("logistics_pool_ai_drafts");
  const rowsFor = (source: { name: string }) =>
    source.name === matches.name ? [state.match]
      : source.name === entries.name ? state.entries
        : source.name === sources.name ? state.sources
          : source.name === drafts.name ? state.drafts : [];
  const select = () => ({
    from: (source: { name: string }) => {
      const chain: any = {
        where: () => chain,
        limit: () => chain,
        then: (resolve: (rows: any[]) => unknown, reject?: (error: unknown) => unknown) =>
          Promise.resolve(rowsFor(source)).then(resolve, reject),
      };
      return chain;
    },
  });
  return {
    pool: { connect: async () => ({
      query: async () => ({ rows: [{ locked: state.lockAvailable }] }),
      release: state.release,
    }) },
    db: {
      select,
      insert: (source: { name: string }) => ({
        values: (value: Record<string, any>) => ({
          onConflictDoNothing: async () => {
            state.databaseWrites++;
            if (source.name === drafts.name && !state.drafts.some((draft) =>
              draft.matchId === value.matchId && draft.matchVersion === value.matchVersion)) {
              state.drafts.push({
                ...value,
                id: "44444444-4444-4444-8444-444444444444",
                createdAt: new Date(),
                status: "pending_review",
              });
            }
          },
        }),
      }),
      update: () => { state.databaseWrites++; throw new Error("Writes are forbidden in this test"); },
      delete: () => { state.databaseWrites++; throw new Error("Writes are forbidden in this test"); },
    },
    logisticsPoolMatchesTable: matches,
    logisticsPoolEntriesTable: entries,
    logisticsPoolSourcesTable: sources,
    logisticsPoolAiDraftsTable: drafts,
  };
});

vi.mock("drizzle-orm", () => ({
  and: () => ({}),
  eq: () => ({}),
  inArray: () => ({}),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async ({ contents }: { contents: Array<{ parts: Array<{ text: string }> }> }) => {
        state.generateCalls++;
        state.prompt = contents[0]?.parts[0]?.text ?? "";
        return { text: state.generatedText };
      },
    };
    constructor(_options: unknown) {}
  },
}));

vi.mock("../lib/logisticsWorkflowAuth", () => ({
  requireLogisticsOperator: async (_req: unknown, res: express.Response) => {
    if (!state.actor) {
      res.status(401).json({ error: "Oturum gerekli." });
      return null;
    }
    return state.actor;
  },
}));

import router from "./logistics-pool";

const app = express();
app.use(express.json());
app.use("/api", router);

const loadId = "22222222-2222-4222-8222-222222222222";
const carrierId = "33333333-3333-4333-8333-333333333333";
const body = {
  matchId: "11111111-1111-4111-8111-111111111111",
  expectedVersion: 1,
};
const payload = (role: "load" | "carrier") => ({
  role,
  name: role === "load" ? "CONFIDENTIAL LOAD COMPANY" : "CONFIDENTIAL CARRIER COMPANY",
  location: "Mersin",
  origin: "Mersin",
  destination: "Erbil",
  products: ["citrus"],
  transportMode: "road",
  capacityKg: role === "carrier" ? 25_000 : null,
  requiredKg: role === "load" ? 20_000 : null,
  volumeM3: role === "load" ? 30 : null,
  availableDate: role === "carrier" ? "2027-05-01" : null,
  requiredDate: role === "load" ? "2027-05-03" : null,
  contact: "private@example.invalid +900000000000",
  reference: "PRIVATE-REFERENCE",
  sourceUrl: "https://private.example.invalid/feed?secret=hidden",
  isTest: true,
  verified: false,
  eligible: true,
});

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("REPLIT_DEPLOYMENT", "");
  vi.stubEnv("AI_INTEGRATIONS_GEMINI_BASE_URL", "https://example.invalid");
  vi.stubEnv("AI_INTEGRATIONS_GEMINI_API_KEY", "TEST-only-placeholder");
  state.actor = { userId: `TEST_FOUNDER_${Date.now()}_${Math.random()}`, isFounder: true };
  state.match = {
    id: body.matchId,
    entryIds: [loadId, carrierId],
    status: "pending",
    version: 1,
    snapshotHash: "snapshot-1",
  };
  state.entries = [
    { id: loadId, sourceId: null, active: true, lastSeenAt: new Date(), payload: payload("load") },
    { id: carrierId, sourceId: null, active: true, lastSeenAt: new Date(), payload: payload("carrier") },
  ];
  state.sources = [];
  state.drafts = [];
  state.generatedText = JSON.stringify({
    summary: "Beyan edilen rota ve taşıma türü örtüşüyor; bilgilerin ayrıca teyidi gerekir.",
    introductionDraft: "Merhaba, MMT Global üzerinden olası bir lojistik iş birliğini değerlendirmek ister misiniz?",
  });
  state.prompt = "";
  state.generateCalls = 0;
  state.databaseWrites = 0;
  state.lockAvailable = true;
  state.release.mockClear();
});

afterEach(() => vi.unstubAllEnvs());

describe("Gemini logistics match draft queue", () => {
  it("stores a validated founder-review draft without sending identifying data or making a decision", async () => {
    const response = await request(app).post("/api/logistics/pool/matches/ai-draft").send(body).expect(200);

    expect(response.body).toMatchObject({
      matchId: body.matchId,
      matchVersion: 1,
      saved: true,
      sent: false,
      decisionMade: false,
    });
    expect(response.body.generatedAt).toBeTruthy();
    expect(response.body.missingChecks).toContain("Fiyat, sigorta, sözleşme, izinler ve ticari koşullar bu taslakta doğrulanmadı.");
    expect(state.prompt).toContain("Mersin");
    expect(state.prompt).toContain("Erbil");
    for (const privateValue of [
      "CONFIDENTIAL LOAD COMPANY",
      "CONFIDENTIAL CARRIER COMPANY",
      "private@example.invalid",
      "+900000000000",
      "PRIVATE-REFERENCE",
      "private.example.invalid",
    ]) expect(state.prompt).not.toContain(privateValue);
    expect(state.generateCalls).toBe(1);
    expect(state.databaseWrites).toBe(1);
    expect(state.drafts).toHaveLength(1);
    expect(state.drafts[0]).toMatchObject({
      matchId: body.matchId,
      matchVersion: 1,
      snapshotHash: "snapshot-1",
      status: "pending_review",
      origin: "founder_request",
    });
  });

  it("reuses the saved draft for the same match version", async () => {
    const first = await request(app).post("/api/logistics/pool/matches/ai-draft").send(body).expect(200);
    const second = await request(app).post("/api/logistics/pool/matches/ai-draft").send(body).expect(200);

    expect(second.body).toEqual(first.body);
    expect(state.generateCalls).toBe(1);
    expect(state.databaseWrites).toBe(1);
  });

  it("requires an actual supported published production runtime", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await request(app).post("/api/logistics/pool/matches/ai-draft").send(body).expect(404);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("REPLIT_DEPLOYMENT", "1");
    await request(app).post("/api/logistics/pool/matches/ai-draft").send(body).expect(404);
    expect(state.generateCalls).toBe(0);
    expect(state.databaseWrites).toBe(0);
  });

  it("allows one founder-requested real draft with the production worker explicitly off", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REPLIT_DEPLOYMENT", "1");
    vi.stubEnv("MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED", "false");
    state.entries.forEach(entry => { entry.payload.isTest = false; });
    await request(app).post("/api/logistics/pool/matches/ai-draft").send(body).expect(200);
    expect(state.generateCalls).toBe(1);
    expect(state.drafts[0]).toMatchObject({ status: "pending_review", origin: "founder_request" });
    expect(state.release).toHaveBeenCalledWith(false);
  });

  it("rejects simultaneous triggering without a model call", async () => {
    state.lockAvailable = false;
    await request(app).post("/api/logistics/pool/matches/ai-draft").send(body).expect(409);
    expect(state.generateCalls).toBe(0);
    expect(state.databaseWrites).toBe(0);
    expect(state.release).toHaveBeenCalledWith(false);
  });

  it("keeps synthetic records out of the production manual flow", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REPLIT_DEPLOYMENT", "1");
    await request(app).post("/api/logistics/pool/matches/ai-draft").send(body).expect(400);
    expect(state.generateCalls).toBe(0);
    expect(state.databaseWrites).toBe(0);
  });

  it("requires a founder session", async () => {
    state.actor = { userId: "TEST_OPERATIONS", isFounder: false };
    await request(app).post("/api/logistics/pool/matches/ai-draft").send(body).expect(403);
    expect(state.generateCalls).toBe(0);
  });

  it("rejects stale versions and unsupported match roles without a model call", async () => {
    state.match.version = 2;
    await request(app).post("/api/logistics/pool/matches/ai-draft").send(body).expect(409);
    state.match.version = 1;
    state.entries[1]!.payload.role = "seller";
    await request(app).post("/api/logistics/pool/matches/ai-draft").send(body).expect(400);
    expect(state.generateCalls).toBe(0);
    expect(state.databaseWrites).toBe(0);
  });

  it("does not return success for malformed model output", async () => {
    state.generatedText = "not-json";
    await request(app).post("/api/logistics/pool/matches/ai-draft").send(body).expect(502);
    expect(state.databaseWrites).toBe(0);
  });
});
