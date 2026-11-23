import { describe, expect, it } from "vitest";
import { projectAuthorizedReviewSummary } from "./mmtReviewSummaryContract";

const RECORD_ID = "550e8400-e29b-41d4-a716-446655440000";
const OWNER_SCOPE = "mmt-global-owner";
const SOURCE = "mmt-connect-replit" as const;

function validRecord() {
  return {
    sourceSystem: SOURCE,
    ownerScope: OWNER_SCOPE,
    recordId: RECORD_ID,
    version: 2,
    taskStatus: "UNKNOWN_OUTCOME",
    geminiReviewStatus: "UNVERIFIED",
    cioDecisionStatus: "PENDING",
    updatedAt: "2026-11-23T20:00:00Z",
    prompt: "private prompt",
    content: "private memory",
    rawGeminiResponse: "private Gemini answer",
    email: "person@example.com",
    clerkUserId: "user_secret",
    apiKey: "secret",
    metadata: { token: "secret" },
    document: "private legal document",
  };
}

describe("MMT Gemini / Replit read-only review contract", () => {
  it("returns only explicitly allowed fields and no personal or provider content", () => {
    const result = projectAuthorizedReviewSummary(validRecord(), OWNER_SCOPE, SOURCE);
    expect(result).toEqual({
      sourceSystem: SOURCE,
      recordId: RECORD_ID,
      version: 2,
      taskStatus: "UNKNOWN_OUTCOME",
      geminiReviewStatus: "UNVERIFIED",
      cioDecisionStatus: "PENDING",
      updatedAt: "2026-11-23T20:00:00Z",
    });
    const serialized = JSON.stringify(result);
    for (const secret of [
      "private prompt", "private memory", "private Gemini answer",
      "person@example.com", "user_secret", "secret", "private legal document",
      OWNER_SCOPE,
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("fails closed when the verified owner scope differs", () => {
    expect(projectAuthorizedReviewSummary(validRecord(), "other-company", SOURCE)).toBeNull();
    expect(projectAuthorizedReviewSummary(validRecord(), "", SOURCE)).toBeNull();
  });

  it("fails closed when the verified source system differs", () => {
    expect(projectAuthorizedReviewSummary(validRecord(), OWNER_SCOPE, "render-welattr-api-test")).toBeNull();
  });

  it("rejects malformed, unknown or incomplete records", () => {
    expect(projectAuthorizedReviewSummary(null, OWNER_SCOPE, SOURCE)).toBeNull();
    expect(projectAuthorizedReviewSummary({}, OWNER_SCOPE, SOURCE)).toBeNull();
    expect(projectAuthorizedReviewSummary({ ...validRecord(), recordId: "person@example.com" }, OWNER_SCOPE, SOURCE)).toBeNull();
    expect(projectAuthorizedReviewSummary({ ...validRecord(), taskStatus: "AUTO_APPROVED" }, OWNER_SCOPE, SOURCE)).toBeNull();
    expect(projectAuthorizedReviewSummary({ ...validRecord(), geminiReviewStatus: "APPROVED" }, OWNER_SCOPE, SOURCE)).toBeNull();
    expect(projectAuthorizedReviewSummary({ ...validRecord(), version: 0 }, OWNER_SCOPE, SOURCE)).toBeNull();
    expect(projectAuthorizedReviewSummary({ ...validRecord(), updatedAt: "not-a-date" }, OWNER_SCOPE, SOURCE)).toBeNull();
  });

  it("does not mutate source records, call Gemini or write a database", () => {
    const record = Object.freeze(validRecord());
    const result = projectAuthorizedReviewSummary(record, OWNER_SCOPE, SOURCE);
    expect(result?.taskStatus).toBe("UNKNOWN_OUTCOME");
    expect(record.prompt).toBe("private prompt");
    expect(result).not.toHaveProperty("prompt");
    expect(result).not.toHaveProperty("ownerScope");
  });
});
