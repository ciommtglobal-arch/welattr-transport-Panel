import { describe, expect, it } from "vitest";
import { permittedInternalLogisticsRecord } from "./logisticsPoolDraftPolicy";

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
});
