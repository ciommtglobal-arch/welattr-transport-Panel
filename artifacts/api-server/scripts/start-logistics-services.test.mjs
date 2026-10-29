import { EventEmitter } from "node:events";
import assert from "node:assert/strict";
import { test } from "node:test";
import { launchLogisticsServices } from "./start-logistics-services.mjs";

const base = { NODE_ENV: "production", REPLIT_DEPLOYMENT: "1" };
function harness(env) {
  const calls = [], children = [], failures = [];
  const services = launchLogisticsServices({
    env, makeDirectory: () => "/tmp/TEST-only",
    onFailure: (code) => failures.push(code),
    spawnProcess: (_command, args, options) => {
      const child = new EventEmitter();
      child.signals = [];
      child.kill = (signal) => { child.signals.push(signal); };
      children.push(child); calls.push({ args, options });
      return child;
    },
  });
  return { calls, children, failures, close: () => {
    services.stop(); children.forEach(c => c.emit("close", 0));
  } };
}
test("preview cannot start the production supervisor", () => {
  assert.throws(() => harness({ NODE_ENV: "development" }));
});
test("without explicit activation starts only the existing API", () => {
  const h = harness(base);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.env.MMT_LOGISTICS_POOL_WORKER_ROLE, "");
  h.close();
});
test("missing prerequisites fail before spawning", () => {
  assert.throws(() => harness({ ...base, MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED: "true" }));
});
test("explicit activation creates separate child with dedicated role and private evidence", () => {
  const h = harness({ ...base, MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED: "true",
    MMT_FOUNDER_REVIEWER_CLERK_USER_ID: "TEST_OWNER",
    AI_INTEGRATIONS_GEMINI_API_KEY: "TEST_ONLY",
    AI_INTEGRATIONS_GEMINI_BASE_URL: "https://example.com",
  });
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].options.env.MMT_LOGISTICS_POOL_WORKER_ROLE, "dedicated");
  assert.equal(h.calls[0].options.env.MMT_LOGISTICS_POOL_WORKER_ROLE, "");
  assert.equal(h.calls[0].options.env.MMT_LOGISTICS_WORKER_EVIDENCE_PATH,
    h.calls[1].options.env.MMT_LOGISTICS_WORKER_EVIDENCE_PATH);
  h.children[1].emit("close", 1);
  assert.deepEqual(h.failures, [1]);
  assert.deepEqual(h.children[0].signals, ["SIGTERM"]);
  h.close();
});
