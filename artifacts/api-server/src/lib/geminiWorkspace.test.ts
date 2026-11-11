import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  selects: [] as any[][], inserted: [] as any[], returned: [] as any[],
  writes: [] as any[], calls: 0, reply: "TEST yanıt", providerFails: false,
}));
const operational = vi.hoisted(() => ({ fail: false, calls: 0, config: "" }));
vi.mock("./geminiOperationalContext", () => ({
  getGeminiOperationalContext: async () => {
    operational.calls++;
    if (operational.fail) throw new Error("PRIVATE_DB_ERROR");
    return '{"counts":{"real_loads":1,"real_carriers":0}}';
  },
}));
vi.mock("@workspace/db", async original => {
  const actual = await original<typeof import("@workspace/db")>();
  function selectChain(): any {
    const chain: any = {
      from: () => chain, where: () => chain, orderBy: () => chain, limit: () => chain,
      then: (resolve: any, reject: any) => Promise.resolve(state.selects.shift() ?? []).then(resolve, reject),
    };
    return chain;
  }
  return { ...actual, db: {
    select: selectChain,
    insert: () => ({ values: () => ({ onConflictDoNothing: () => ({ returning: async () => state.inserted }) }) }),
    update: () => ({ set: (value: any) => {
      state.writes.push(value);
      return { where: () => ({ returning: async () => state.returned, then: (resolve: any) => Promise.resolve().then(resolve) }) };
    } }),
  } };
});
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: async (input: any) => {
      operational.config = input.config.systemInstruction;
      state.calls++;
      if (state.providerFails) throw new Error("DO_NOT_LEAK_PROVIDER_SECRET");
      return { text: state.reply };
    } };
  },
}));
import { getGeminiWorkspace, sendGeminiInstruction } from "./geminiWorkspace";
const id = "11111111-1111-4111-8111-111111111111";
const input = { requestId: id, instruction: "TEST talimat" };
const row = () => ({
  id, ownerClerkUserId: "TEST_OWNER", instruction: input.instruction,
  reply: null, status: "pending", failureMessage: null,
  createdAt: new Date(), updatedAt: new Date(),
});
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("REPLIT_DEPLOYMENT", "");
  vi.stubEnv("AI_INTEGRATIONS_GEMINI_API_KEY", "TEST_DUMMY");
  vi.stubEnv("AI_INTEGRATIONS_GEMINI_BASE_URL", "https://example.invalid");
  state.selects = []; state.inserted = [row()]; state.returned = [];
  state.writes = []; state.calls = 0; state.reply = "TEST yanıt"; state.providerFails = false;
  operational.fail = false; operational.calls = 0; operational.config = "";
});
afterEach(() => vi.unstubAllEnvs());
describe("Gemini workspace persistence boundaries", () => {
  it("blocks direct service access in production without DB/model access", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(getGeminiWorkspace("TEST_OWNER")).rejects.toMatchObject({ status: 404 });
    await expect(sendGeminiInstruction("TEST_OWNER", input)).rejects.toMatchObject({ status: 404 });
    expect(state.writes).toEqual([]); expect(state.calls).toBe(0);
  });
  it("returns an existing request without a second model call", async () => {
    state.selects = [[{ ...row(), status: "answered", reply: "önceki yanıt" }]];
    const result = await sendGeminiInstruction("TEST_OWNER", input);
    expect(result.reply).toBe("önceki yanıt"); expect(state.calls).toBe(0); expect(state.writes).toEqual([]);
  });
  it("rejects reusing a request id for different text", async () => {
    state.selects = [[row()]];
    await expect(sendGeminiInstruction("TEST_OWNER", { ...input, instruction: "farklı" })).rejects.toMatchObject({ status: 409 });
    expect(state.calls).toBe(0);
  });
  it("rejects whitespace-only instructions", async () => {
    await expect(sendGeminiInstruction("TEST_OWNER", { ...input, instruction: "   " })).rejects.toMatchObject({ status: 400 });
    expect(state.calls).toBe(0);
  });
  it("does not create a pending turn when provider config is missing", async () => {
    vi.stubEnv("AI_INTEGRATIONS_GEMINI_API_KEY", "");
    await expect(sendGeminiInstruction("TEST_OWNER", input)).rejects.toMatchObject({ status: 503 });
    expect(state.writes).toEqual([]); expect(state.calls).toBe(0);
  });
  it("persists valid replies as answered", async () => {
    state.selects = [[], []];
    state.returned = [{ ...row(), status: "answered", reply: state.reply }];
    const result = await sendGeminiInstruction("TEST_OWNER", input);
    expect(result.status).toBe("answered"); expect(result.reply).toBe(state.reply);
    expect(state.calls).toBe(1);
    expect(state.writes.at(-1)).toMatchObject({ status: "answered", reply: state.reply });
    expect(operational.config).toContain('"real_carriers":0');
    expect(operational.config).toContain("Kurucudan gereken tek karar");
  });
  it("does not call Gemini or invent zero counts when operational context fails", async () => {
    operational.fail = true;
    state.selects = [[], [], [{ ...row(), status: "failed", failureMessage: "Talimat korundu." }]];
    const result = await sendGeminiInstruction("TEST_OWNER", input);
    expect(result.status).toBe("failed");
    expect(state.calls).toBe(0);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_DB_ERROR");
  });
  it.each(["", "x".repeat(16_001)])("does not label invalid model output answered", async reply => {
    state.reply = reply; state.selects = [[], [], [{ ...row(), status: "failed", failureMessage: "Güvenli hata" }]];
    const result = await sendGeminiInstruction("TEST_OWNER", input);
    expect(result.status).toBe("failed"); expect(result.reply).toBeNull();
    expect(state.writes.at(-1).status).toBe("failed");
  });
  it("keeps failed instructions without exposing provider errors", async () => {
    state.providerFails = true;
    state.selects = [[], [], [{ ...row(), status: "failed", failureMessage: "Talimat korundu." }]];
    const result = await sendGeminiInstruction("TEST_OWNER", input);
    expect(result.status).toBe("failed");
    expect(JSON.stringify(result)).not.toContain("DO_NOT_LEAK");
    expect(state.writes.at(-1)).toMatchObject({ status: "failed" });
  });
  it("enforces model cost limits before generation", async () => {
    state.selects = [[], [row(), row(), row()]];
    await expect(sendGeminiInstruction("TEST_OWNER", input)).rejects.toMatchObject({ status: 429 });
    expect(state.calls).toBe(0); expect(state.writes).toEqual([]);
  });
  it("does not generate a second request when the DB pending lock is held", async () => {
    state.selects = [[], [], []]; state.inserted = [];
    await expect(sendGeminiInstruction("TEST_OWNER", input)).rejects.toMatchObject({ status: 409 });
    expect(state.calls).toBe(0);
  });
  it("recovers a concurrent duplicate without a model call", async () => {
    state.selects = [[], [], [row()]]; state.inserted = [];
    expect((await sendGeminiInstruction("TEST_OWNER", input)).id).toBe(id);
    expect(state.calls).toBe(0);
  });
  it("shows interrupted turns as failed without claiming an answer or calling AI", async () => {
    state.selects = [[{ ...row(), createdAt: new Date(Date.now() - 120_000) }]];
    const result = await getGeminiWorkspace("TEST_OWNER");
    expect(result.turns[0].status).toBe("failed"); expect(result.turns[0].reply).toBeNull();
    expect(state.calls).toBe(0); expect(state.writes).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("ownerClerkUserId");
  });
});
