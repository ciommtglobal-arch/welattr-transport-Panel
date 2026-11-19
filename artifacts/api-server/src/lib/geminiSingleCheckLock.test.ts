import { describe, expect, it, vi } from "vitest";
import {
  createSingleCheckHandler,
  createSingleCheckLock,
  isPrefetchOrNonActionableRequest,
  type ResponseLike,
} from "./geminiSingleCheckLock.js";

function makeResponse() {
  let statusCode = 0;
  let body: unknown;
  let ended = false;
  const response: ResponseLike = {
    status(code: number) {
      statusCode = code;
      return {
        json(payload: unknown) { body = payload; return response; },
        end() { ended = true; return response; },
      };
    },
  };
  return {
    response,
    get statusCode() { return statusCode; },
    get body() { return body; },
    get ended() { return ended; },
  };
}

describe("single-check lock", () => {
  it("does not let an expired generation overwrite a newer run", () => {
    const lock = createSingleCheckLock({ ttlMs: 100, cooldownMs: 10, nowFn: () => 0 });
    const oldRun = lock.markRunning(0);
    lock.normalize(100);
    expect(lock.state.status).toBe("failed");
    expect(lock.markFinished(oldRun)).toBe(false);

    const newRun = lock.markRunning(110);
    expect(lock.markFinished(oldRun)).toBe(false);
    expect(lock.state.status).toBe("running");
    expect(lock.markFinished(newRun)).toBe(true);
    expect(lock.state.status).toBe("finished");
  });

  it("marks configuration failures blocked and transient failures retryable after cooldown", () => {
    const lock = createSingleCheckLock({ cooldownMs: 30, nowFn: () => 0 });
    const configRun = lock.markRunning(0);
    expect(lock.markFailed(configRun, "config", 5)).toBe(true);
    expect(lock.state.status).toBe("blocked");
    expect(lock.getRetryRemainingMs(100)).toBe(0);

    const transientLock = createSingleCheckLock({ cooldownMs: 30, nowFn: () => 0 });
    const transientRun = transientLock.markRunning(0);
    transientLock.markFailed(transientRun, "transient", 5);
    expect(transientLock.getRetryRemainingMs(20)).toBe(15);
    expect(transientLock.getRetryRemainingMs(35)).toBe(0);
  });

  it.each([
    ["HEAD", {}],
    ["OPTIONS", {}],
    ["GET", { purpose: "prefetch" }],
    ["GET", { "sec-purpose": "prerender" }],
    ["GET", { "x-purpose": "preview" }],
  ])("ignores non-actionable request %s", (method, headers) => {
    expect(isPrefetchOrNonActionableRequest({ method, headers })).toBe(true);
  });

  it("does not call Gemini for a browser prefetch", async () => {
    const lock = createSingleCheckLock();
    const runGeminiCheck = vi.fn(async () => "ok");
    const handle = createSingleCheckHandler({
      lock,
      runGeminiCheck,
      classifyError: () => "transient",
      maskError: () => ({ statusCode: 502, body: { success: false } }),
    });
    const res = makeResponse();

    await handle({ method: "GET", headers: { purpose: "prefetch" } }, res.response);

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(runGeminiCheck).not.toHaveBeenCalled();
    expect(lock.state.status).toBe("idle");
  });

  it("keeps the newer generation authoritative when an expired provider call returns late", async () => {
    let now = 0;
    const lock = createSingleCheckLock({
      ttlMs: 100,
      cooldownMs: 10,
      nowFn: () => now,
    });
    let resolveOld!: (value: string) => void;
    const oldProviderCall = new Promise<string>((resolve) => { resolveOld = resolve; });
    const runGeminiCheck = vi.fn()
      .mockReturnValueOnce(oldProviderCall)
      .mockResolvedValueOnce("new result");
    const handle = createSingleCheckHandler({
      lock,
      runGeminiCheck,
      classifyError: () => "transient",
      maskError: () => ({ statusCode: 502, body: { success: false } }),
      nowFn: () => now,
    });

    const oldResponse = makeResponse();
    const oldRequest = handle({ method: "GET" }, oldResponse.response);
    await Promise.resolve();
    expect(lock.state.status).toBe("running");

    now = 100;
    const cooldownResponse = makeResponse();
    await handle({ method: "GET" }, cooldownResponse.response);
    expect(cooldownResponse.statusCode).toBe(429);

    now = 110;
    const newResponse = makeResponse();
    await handle({ method: "GET" }, newResponse.response);
    expect(newResponse.statusCode).toBe(200);
    expect(lock.state.status).toBe("finished");

    resolveOld("stale result");
    await oldRequest;
    expect(oldResponse.statusCode).toBe(409);
    expect(lock.state.status).toBe("finished");
  });
});
