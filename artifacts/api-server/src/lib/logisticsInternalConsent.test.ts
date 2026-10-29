import { describe, expect, it } from "vitest";
import { logisticsDraftMode, manualLogisticsDraftEnabled, permittedCarrierCandidate, permittedInternalLogisticsRecord } from "./logisticsPoolDraftPolicy";

describe("first-party logistics intake consent", () => {
  it.each([
    [false, null, false],
    [true, null, false],
    [false, "TEST_OPERATOR", false],
    [true, "  ", false],
    [true, "TEST_OPERATOR", true],
  ])("real source consent=%s capturedBy=%s allowed=%s", (consent, actor, allowed) => {
    expect(permittedInternalLogisticsRecord({
      isTest: false, contactUseConfirmed: consent, capturedByClerkUserId: actor,
    })).toBe(allowed);
  });
  it("preserves existing synthetic fixtures without presenting them as real consent", () => {
    expect(permittedInternalLogisticsRecord({
      isTest: true, contactUseConfirmed: false, capturedByClerkUserId: null,
    })).toBe(true);
  });
  it("allows permitted pending carrier candidates without approving them", () => {
    const record = { isTest: false, contactUseConfirmed: true, capturedByClerkUserId: "TEST_OPERATOR", status: "pending" };
    expect(permittedCarrierCandidate(record)).toBe(true);
    expect(record.status).toBe("pending");
    expect(permittedCarrierCandidate({ ...record, status: "rejected" })).toBe(false);
    expect(permittedCarrierCandidate({ ...record, contactUseConfirmed: false })).toBe(false);
  });
  it("separates founder click availability from background production activation", () => {
    const env = { NODE_ENV: "production", REPLIT_DEPLOYMENT: "1",
      AI_INTEGRATIONS_GEMINI_API_KEY: "TEST_ONLY", AI_INTEGRATIONS_GEMINI_BASE_URL: "https://example.invalid",
      MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED: "false" };
    expect(manualLogisticsDraftEnabled(env)).toBe(true);
    expect(logisticsDraftMode(env)).toBe("disabled");
    expect(manualLogisticsDraftEnabled({ ...env, AI_INTEGRATIONS_GEMINI_API_KEY: "" })).toBe(false);
  });
});
