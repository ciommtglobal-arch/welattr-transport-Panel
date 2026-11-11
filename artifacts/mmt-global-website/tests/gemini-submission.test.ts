import assert from "node:assert/strict";
import { test } from "node:test";
import { canClearGeminiInput, createGeminiSubmissionController, mergeGeminiTurn } from "../src/lib/gemini-submission";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

test("same-tick duplicate submit is blocked without another request ID", () => {
  let ids = 0;
  const controller = createGeminiSubmissionController(() => { ids++; return UUID_A; });
  assert.deepEqual(controller.begin("  TEST talimatı  "), { requestId: UUID_A, instruction: "TEST talimatı" });
  assert.equal(controller.begin("TEST talimatı"), null);
  assert.equal(ids, 1);
});

test("ambiguous failure retains the request ID on explicit retry", () => {
  let ids = 0;
  const controller = createGeminiSubmissionController(() => { ids++; return UUID_A; });
  const first = controller.begin("TEST");
  controller.finish(true);
  assert.deepEqual(controller.begin(" TEST "), first);
  assert.equal(ids, 1);
});

test("a confirmed completion or rejection releases the request ID", () => {
  let ids = 0;
  const controller = createGeminiSubmissionController(() => ++ids === 1 ? UUID_A : UUID_B);
  assert.equal(controller.begin("TEST")?.requestId, UUID_A);
  controller.finish(false);
  assert.equal(controller.begin("TEST")?.requestId, UUID_B);
});

test("an edited instruction gets a new ID after an ambiguous failure", () => {
  let ids = 0;
  const controller = createGeminiSubmissionController(() => ++ids === 1 ? UUID_A : UUID_B);
  controller.begin("TEST ilk");
  controller.finish(true);
  assert.equal(controller.begin("TEST yeni")?.requestId, UUID_B);
});

test("blank input neither locks submission nor generates an ID", () => {
  let ids = 0;
  const controller = createGeminiSubmissionController(() => { ids++; return UUID_A; });
  assert.equal(controller.begin(" \n "), null);
  assert.equal(ids, 0);
  assert.equal(controller.begin("TEST")?.requestId, UUID_A);
});

test("an unchanged confirmed input may be cleared", () => {
  assert.equal(canClearGeminiInput(4, 4, " TEST ", "TEST"), true);
});

test("typing during the request preserves new text, even if edited back", () => {
  assert.equal(canClearGeminiInput(4, 5, "Yeni TEST", "TEST"), false);
  assert.equal(canClearGeminiInput(4, 6, "TEST", "TEST"), false);
});

test("separate workspace instances share neither pending locks nor retry IDs", () => {
  const first = createGeminiSubmissionController(() => UUID_A);
  const second = createGeminiSubmissionController(() => UUID_B);
  assert.equal(first.begin("TEST")?.requestId, UUID_A);
  assert.equal(second.begin("TEST")?.requestId, UUID_B);
  first.finish(true);
  assert.equal(first.begin("TEST")?.requestId, UUID_A);
  assert.equal(second.begin("TEST"), null);
});

test("confirmed server turn replaces a pending turn without duplicate history", () => {
  const pending = { id: UUID_A, createdAt: "2026-10-29T00:00:00Z", status: "pending" };
  const answered = { ...pending, status: "answered" };
  assert.deepEqual(mergeGeminiTurn([pending], answered), [answered]);
});

test("history stays chronological and capped at the latest 40 server records", () => {
  const turns = Array.from({ length: 40 }, (_, i) => ({
    id: String(i), createdAt: new Date(Date.UTC(2026, 9, 29, 0, i)).toISOString(),
  }));
  const newest = { id: UUID_B, createdAt: "2026-10-29T02:00:00.000Z" };
  const merged = mergeGeminiTurn(turns.slice().reverse(), newest);
  assert.equal(merged.length, 40);
  assert.equal(merged[0].id, "1");
  assert.equal(merged.at(-1)?.id, UUID_B);
});
