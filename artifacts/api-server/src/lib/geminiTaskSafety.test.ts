import { describe, expect, it } from "vitest";
import { getGeminiProviderFailure, isGeminiWorkerEnabled, normalizeIdempotencyKey } from "./geminiTaskSafety";

describe("Gemini task safety", () => {
  it("keeps the worker disabled unless every explicit gate and a key are present", () => {
    expect(isGeminiWorkerEnabled({})).toBe(false);
    expect(isGeminiWorkerEnabled({
      GEMINI_TASK_WORKER_ENABLED: "true",
      GEMINI_API_KEY: "server-only",
    })).toBe(false);
    expect(isGeminiWorkerEnabled({
      GEMINI_TASK_WORKER_ENABLED: "true",
      GEMINI_FREE_TIER_ONLY_CONFIRMED: "true",
      GEMINI_API_KEY: "  ",
    })).toBe(false);
    expect(isGeminiWorkerEnabled({
      GEMINI_TASK_WORKER_ENABLED: "true",
      GEMINI_FREE_TIER_ONLY_CONFIRMED: "true",
      GEMINI_API_KEY: "server-only",
    })).toBe(true);
  });

  it("normalizes stable idempotency keys and rejects unsafe or empty input", () => {
    expect(normalizeIdempotencyKey("  review:commit-123  ")).toBe("review:commit-123");
    expect(normalizeIdempotencyKey(undefined)).toBeNull();
    expect(normalizeIdempotencyKey("short")).toBeNull();
    expect(normalizeIdempotencyKey("contains spaces")).toBeNull();
    expect(normalizeIdempotencyKey("x".repeat(201))).toBeNull();
  });
  it("keeps provider failure diagnostics to safe status metadata", () => {
    expect(getGeminiProviderFailure({
      status: 429,
      message: "secret-bearing provider response",
      response: { data: { prompt: "private prompt", apiKey: "never-log-this" } },
    })).toEqual({ httpStatus: 429, category: "rate_limited" });
    expect(getGeminiProviderFailure({ status: 403 })).toEqual({
      httpStatus: 403,
      category: "authentication_or_permission",
    });
    expect(getGeminiProviderFailure(new Error("sensitive detail"))).toEqual({
      httpStatus: null,
      category: "unknown",
    });
    expect(getGeminiProviderFailure({ status: 700 })).toEqual({
      httpStatus: null,
      category: "unknown",
    });
  });
});
