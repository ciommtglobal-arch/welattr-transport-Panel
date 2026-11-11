import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareGeminiLogisticsInstruction, summarizeGeminiLogistics } from "../src/lib/gemini-logistics";

const entry = (id: string, role: "load" | "carrier" | "buyer" | "seller", overrides = {}) =>
  ({ id, role, isTest: false, active: true, eligible: true, verified: true, ...overrides });
const base = () => ({
  entries: [entry("load", "load"), entry("carrier", "carrier")],
  matches: [{ entryIds: ["load", "carrier"], status: "pending" as const }],
  sources: [], externalDiscoveryConfigured: false,
});

test("summarizes actual TEST-excluded eligible entries and pending pairs", () => {
  const result = summarizeGeminiLogistics(base());
  assert.equal(result.loads, 1);
  assert.equal(result.carriers, 1);
  assert.equal(result.pending, 1);
});

test("TEST, inactive and ineligible entries never inflate work-ready counts", () => {
  const pool = base();
  pool.entries.push(entry("test", "load", { isTest: true }), entry("inactive", "carrier", { active: false }), entry("excluded", "load", { eligible: false }));
  pool.matches.push({ entryIds: ["test", "carrier"], status: "pending" });
  const result = summarizeGeminiLogistics(pool);
  assert.equal(result.loads, 1);
  assert.equal(result.carriers, 1);
  assert.equal(result.testRecords, 1);
  assert.equal(result.pending, 1);
});

test("empty or missing match participants are not counted as ready", () => {
  const pool = base();
  pool.matches = [{ entryIds: [], status: "pending" }, { entryIds: ["unknown", "carrier"], status: "pending" }];
  const result = summarizeGeminiLogistics(pool);
  assert.equal(result.pending, 0);
  assert.equal(result.incompleteMatches, 2);
});

test("unverified records and source errors remain visible without claiming discovery", () => {
  const pool = { ...base(), sources: [{ lastError: "PRIVATE_SOURCE_DETAIL" }] };
  pool.entries[0].verified = false;
  const result = summarizeGeminiLogistics(pool);
  assert.equal(result.unverified, 1);
  assert.equal(result.sourceErrors, 1);
  const prompt = prepareGeminiLogisticsInstruction(result, "2026-10-29T00:00:00Z", "plan");
  assert.ok(!prompt.includes("PRIVATE_SOURCE_DETAIL"));
  assert.ok(prompt.includes("yok"));
});

test("prompts contain aggregates, snapshot time and action boundaries, not source payloads", () => {
  const pool = { ...base(), entries: [
    { ...entry("load", "load"), name: "PRIVATE_NAME", contact: "PRIVATE_PHONE", reference: "PRIVATE_REFERENCE" },
    entry("carrier", "carrier"),
  ] };
  for (const purpose of ["plan", "checks"] as const) {
    const prompt = prepareGeminiLogisticsInstruction(summarizeGeminiLogistics(pool), "2026-10-29T01:00:00Z", purpose);
    assert.ok(prompt.includes("2026-10-29T01:00:00Z"));
    assert.ok(prompt.includes("yük=1"));
    assert.ok(prompt.includes("Onay ve yayın ayrı kurucu kararlarıdır"));
    assert.ok(!prompt.includes("PRIVATE_"));
    assert.ok(prompt.length < 3000);
  }
});

test("no records stays explicitly empty instead of inventing loads or carriers", () => {
  const result = summarizeGeminiLogistics({ ...base(), entries: [], matches: [] });
  assert.equal(result.loads + result.carriers + result.buyers + result.sellers + result.pending, 0);
});
