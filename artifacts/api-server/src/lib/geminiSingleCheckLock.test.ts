import { describe, expect, it, vi } from "vitest";
import {
  createSingleCheckHandler,
  createSingleCheckLock,
  isPrefetchOrNonActionableRequest,
  type FailureKind,
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

function makeHandler({
  lock = createSingleCheckLock(),
  runGeminiCheck = vi.fn(async () => "ok"),
  classifyError = (() => "transient" as FailureKind),
}: {
  lock?: ReturnType<typeof createSingleCheckLock>;
  runGeminiCheck?: ReturnType<typeof vi.fn<() => Promise<string>>>;
  classifyError?: (error: unknown) => FailureKind;
} = {}) {
  return {
    lock,
    runGeminiCheck,
    handle: createSingleCheckHandler({
      lock,
      runGeminiCheck,
      classifyError,
      maskError: () => ({ statusCode: 502, body: { success: false } }),
    }),
  };
}

describe("single-check lock", () => {
  it("returns 200 once after success, then rejects the next request with 409", async () => {
    const { handle, runGeminiCheck, lock } = makeHandler();
    const first = makeResponse();
    await handle({ method: "GET" }, first.response);

    expect(first.statusCode).toBe(200);
    expect(first.body).toEqual({ success: true, data: "ok" });
    expect(lock.state.status).toBe("finished");

    const second = makeResponse();
    await handle({ method: "GET" }, second.response);
    expect(second.statusCode).toBe(409);
    expect(runGeminiCheck).toHaveBeenCalledTimes(1);
  });

  it("keeps configuration failures blocked after the cooldown period", async () => {
    let now = 0;
    const lock = createSingleCheckLock({ cooldownMs: 30, nowFn: () => now });
    const runGeminiCheck = vi.fn(async () => { throw new Error("bad configuration"); });
    const { handle } = makeHandler({
      lock,
      runGeminiCheck,
      classifyError: () => "config",
    });

    const failed = makeResponse();
    await handle({ method: "GET" }, failed.response);
    expect(failed.statusCode).toBe(502);
    expect(lock.state.status).toBe("blocked");

    now = 60_000;
    const retry = makeResponse();
    await handle({ method: "GET" }, retry.response);
    expect(retry.statusCode).toBe(409);
    expect(runGeminiCheck).toHaveBeenCalledTimes(1);
  });

  it("returns 429 during transient cooldown, then allows a retry after cooldown", async () => {
    let now = 0;
    const lock = createSingleCheckLock({ cooldownMs: 30, nowFn: () => now });
    const runGeminiCheck = vi.fn()
      .mockRejectedValueOnce(new Error("temporary provider failure"))
      .mockResolvedValueOnce("recovered");
    const { handle } = makeHandler({ lock, runGeminiCheck });

    const failed = makeResponse();
    await handle({ method: "GET" }, failed.response);
    expect(failed.statusCode).toBe(502);
    expect(lock.state.status).toBe("failed");

    now = 10;
    const tooSoon = makeResponse();
    await handle({ method: "GET" }, tooSoon.response);
    expect(tooSoon.statusCode).toBe(429);
    expect(tooSoon.body).toMatchObject({ retryAfterMs: 20 });
    expect(runGeminiCheck).toHaveBeenCalledTimes(1);

    now = 30;
    const retry = makeResponse();
    await handle({ method: "GET" }, retry.response);
    expect(retry.statusCode).toBe(200);
    expect(retry.body).toEqual({ success: true, data: "recovered" });
    expect(lock.state.status).toBe("finished");
    expect(runGeminiCheck).toHaveBeenCalledTimes(2);
  });

  it("expires a stuck run, clears startedAt, and safely normalizes a null startedAt", () => {
    const lock = createSingleCheckLock({ ttlMs: 100, nowFn: () => 0 });
    const run = lock.markRunning(0);
    lock.normalize(100);

    expect(lock.state.status).toBe("failed");
    expect(lock.state.startedAt).toBeNull();
    expect(lock.markFinished(run)).toBe(false);
    expect(() => lock.normalize(1_000)).not.toThrow();

    const freshLock = createSingleCheckLock({ nowFn: () => 0 });
    expect(() => freshLock.normalize(1_000)).not.toThrow();
    expect(freshLock.state.startedAt).toBeNull();
    expect(freshLock.state.status).toBe("idle");
  });

  it("does not let a late old request change a newer generation's state", async () => {
    let now = 0;
    const lock = createSingleCheckLock({ ttlMs: 100, cooldownMs: 10, nowFn: () => now });
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
    const duringCooldown = makeResponse();
    await handle({ method: "GET" }, duringCooldown.response);
    expect(duringCooldown.statusCode).toBe(429);

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

  it.each([
    ["HEAD", {}],
    ["OPTIONS", {}],
    ["GET", { purpose: "prefetch" }],
    ["GET", { "sec-purpose": "prefetch" }],
    ["GET", { "sec-purpose": "prerender" }],
    ["GET", { "x-purpose": "preview" }],
  ])("recognizes non-actionable request %s", (method, headers) => {
    expect(isPrefetchOrNonActionableRequest({ method, headers })).toBe(true);
  });

  it.each([
    ["HEAD", {}],
    ["OPTIONS", {}],
    ["GET", { purpose: "prefetch" }],
    ["GET", { "sec-purpose": "prefetch" }],
  ])("does not consume the lock or call Gemini for %s helper requests", async (method, headers) => {
    const { handle, runGeminiCheck, lock } = makeHandler();
    const response = makeResponse();

    await handle({ method, headers }, response.response);

    expect(response.statusCode).toBe(204);
    expect(response.ended).toBe(true);
    expect(runGeminiCheck).not.toHaveBeenCalled();
    expect(lock.state.status).toBe("idle");
  });
});
