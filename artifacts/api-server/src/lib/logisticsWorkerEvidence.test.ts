import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeWorkerEvidence, writeWorkerEvidence } from "./logisticsWorkerEvidence";

let directory: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});
describe("worker evidence is factual and fail-closed", () => {
  it("does not claim uptime without a dedicated process evidence path", async () => {
    vi.stubEnv("MMT_LOGISTICS_WORKER_EVIDENCE_PATH", "");
    expect(await describeWorkerEvidence()).toContain("7/24 çalışma doğrulanmadı");
  });
  it("reports fresh, stale and future evidence separately", async () => {
    directory = await mkdtemp(join(tmpdir(), "mmt-evidence-test-"));
    vi.stubEnv("MMT_LOGISTICS_WORKER_EVIDENCE_PATH", join(directory, "evidence.json"));
    const now = Date.now();
    await writeWorkerEvidence({ at: new Date(now).toISOString(), mode: "production_drafts", result: "idle" });
    expect(await describeWorkerEvidence(now)).toContain("sonuç: idle");
    expect(await describeWorkerEvidence(now + 180_001)).toContain("eskimiş");
    expect(await describeWorkerEvidence(now - 1000)).toContain("eskimiş");
  });
  it("does not label an unreadable heartbeat as running", async () => {
    vi.stubEnv("MMT_LOGISTICS_WORKER_EVIDENCE_PATH", "/tmp/TEST-does-not-exist/evidence.json");
    expect(await describeWorkerEvidence()).toContain("çalışıyor sayılmıyor");
  });
});
