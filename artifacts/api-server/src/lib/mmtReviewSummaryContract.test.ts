import { describe, expect, it } from "vitest";
import {
  projectAuthorizedCorporateFollowUp,
  projectAuthorizedManualGeminiReview,
} from "./mmtReviewSummaryContract";

const RECORD_ID = "550e8400-e29b-41d4-a716-446655440000";
const REVIEW_ID = "5a0e8400-e29b-41d4-a716-446655440000";

function corporateRecord() {
  return {
    id: RECORD_ID,
    version: 3,
    approval: "revision_requested",
    at: "2026-11-23T20:00:00.000Z",
    hash: "private-hash",
    actor: "private-clerk-id",
    note: "private legal note",
    data: { status: "active", document: "private legal document" },
    ownerClerkUserId: "private-user",
    apiKey: "private-secret",
  };
}

function manualReview() {
  return {
    id: REVIEW_ID,
    source: "case",
    createdAt: "2026-11-23T20:00:00.000Z",
    respondedAt: null,
    decidedAt: null,
    decision: null,
    packet: "private prompt and documents",
    response: "unverified model answer",
    providerKey: "private-secret",
    targetOwner: "private-user",
  };
}

describe("MMT Connect / Gemini source-aligned read-only bridge", () => {
  it("projects only real corporate follow-up fields, without pretending it is a CIO or Gemini decision", () => {
    const summary = projectAuthorizedCorporateFollowUp(corporateRecord(), RECORD_ID);
    expect(summary).toEqual({
      sourceSystem: "mmt-connect-replit",
      recordId: RECORD_ID,
      version: 3,
      approval: "revision_requested",
      at: "2026-11-23T20:00:00.000Z",
    });
    const serialized = JSON.stringify(summary);
    for (const secret of [
      "private-hash", "private-clerk-id", "private legal note",
      "private legal document", "private-user", "private-secret",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(summary).not.toHaveProperty("geminiReviewStatus");
    expect(summary).not.toHaveProperty("cioDecisionStatus");
  });

  it("fails closed on wrong record, missing version or unsupported approval", () => {
    expect(projectAuthorizedCorporateFollowUp(corporateRecord(), REVIEW_ID)).toBeNull();
    expect(projectAuthorizedCorporateFollowUp({ ...corporateRecord(), version: 0 }, RECORD_ID)).toBeNull();
    expect(projectAuthorizedCorporateFollowUp({ ...corporateRecord(), version: undefined }, RECORD_ID)).toBeNull();
    expect(projectAuthorizedCorporateFollowUp({ ...corporateRecord(), approval: "AUTO_APPROVED" }, RECORD_ID)).toBeNull();
    expect(projectAuthorizedCorporateFollowUp({ ...corporateRecord(), at: "2026-11-23" }, RECORD_ID)).toBeNull();
  });

  it("projects manual review metadata but never its packet, response or provider claims", () => {
    const summary = projectAuthorizedManualGeminiReview(manualReview(), REVIEW_ID);
    expect(summary).toEqual({
      sourceSystem: "mmt-connect-replit",
      reviewMode: "manual_unverified",
      reviewId: REVIEW_ID,
      targetKind: "case",
      createdAt: "2026-11-23T20:00:00.000Z",
      respondedAt: null,
      decidedAt: null,
      decision: null,
    });
    const serialized = JSON.stringify(summary);
    for (const secret of [
      "private prompt and documents", "unverified model answer",
      "private-secret", "private-user",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("preserves the actual revision_requested decision, not a fabricated HOLD state", () => {
    const summary = projectAuthorizedManualGeminiReview({
      ...manualReview(),
      respondedAt: "2026-11-23T20:05:00.000Z",
      decidedAt: "2026-11-23T20:06:00.000Z",
      decision: "revision_requested",
    }, REVIEW_ID);
    expect(summary?.decision).toBe("revision_requested");
  });

  it("rejects unknown targets, invalid timestamps and mismatched review IDs", () => {
    expect(projectAuthorizedManualGeminiReview(manualReview(), RECORD_ID)).toBeNull();
    expect(projectAuthorizedManualGeminiReview({ ...manualReview(), source: "notice" }, REVIEW_ID)).toBeNull();
    expect(projectAuthorizedManualGeminiReview({ ...manualReview(), decision: "AUTO_APPROVED" }, REVIEW_ID)).toBeNull();
    expect(projectAuthorizedManualGeminiReview({ ...manualReview(), createdAt: "today" }, REVIEW_ID)).toBeNull();
    expect(projectAuthorizedManualGeminiReview(null, REVIEW_ID)).toBeNull();
  });
});
