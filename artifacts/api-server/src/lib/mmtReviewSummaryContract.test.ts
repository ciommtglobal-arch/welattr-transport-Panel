import { describe, expect, it } from "vitest";
import { projectAuthorizedCorporateFollowUp } from "./mmtReviewSummaryContract";

const RECORD_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_ID = "5a0e8400-e29b-41d4-a716-446655440000";

function sourceRecord() {
  return {
    id: RECORD_ID,
    version: 3,
    approval: "revision_requested",
    at: "2026-11-23T20:00:00.000Z",
    hash: "private-hash",
    actor: "private-clerk-id",
    note: "private legal note",
    previousApproval: "pending_review",
    data: { status: "active", document: "private legal document", scope: "company" },
    history: ["private-history"],
    ownerClerkUserId: "private-user",
    apiKey: "private-secret",
    geminiReview: { response: "unverified answer" },
  };
}

describe("MMT corporate follow-up v1 — Gemini-reviewed minimal projection", () => {
  it("projects exactly id, version, approval and at", () => {
    expect(projectAuthorizedCorporateFollowUp(sourceRecord(), RECORD_ID)).toEqual({
      id: RECORD_ID,
      version: 3,
      approval: "revision_requested",
      at: "2026-11-23T20:00:00.000Z",
    });
  });

  it("never transfers data.status, actor, history, secrets, raw documents or Gemini review", () => {
    const result = projectAuthorizedCorporateFollowUp(sourceRecord(), RECORD_ID);
    expect(Object.keys(result ?? {}).sort()).toEqual(["approval", "at", "id", "version"]);
    const serialized = JSON.stringify(result);
    for (const secret of [
      "private-hash", "private-clerk-id", "private legal note",
      "private legal document", "private-history", "private-user",
      "private-secret", "unverified answer", "company", "active",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("fails closed on unauthorized/mismatched record ID", () => {
    expect(projectAuthorizedCorporateFollowUp(sourceRecord(), OTHER_ID)).toBeNull();
    expect(projectAuthorizedCorporateFollowUp(sourceRecord(), "")).toBeNull();
    expect(projectAuthorizedCorporateFollowUp(sourceRecord(), "TASK-001")).toBeNull();
  });

  it("fails closed on missing or fabricated version, approval and timestamps", () => {
    expect(projectAuthorizedCorporateFollowUp(null, RECORD_ID)).toBeNull();
    expect(projectAuthorizedCorporateFollowUp({ ...sourceRecord(), version: 0 }, RECORD_ID)).toBeNull();
    expect(projectAuthorizedCorporateFollowUp({ ...sourceRecord(), version: undefined }, RECORD_ID)).toBeNull();
    expect(projectAuthorizedCorporateFollowUp({ ...sourceRecord(), approval: "AUTO_APPROVED" }, RECORD_ID)).toBeNull();
    expect(projectAuthorizedCorporateFollowUp({ ...sourceRecord(), at: "2026-11-23" }, RECORD_ID)).toBeNull();
    expect(projectAuthorizedCorporateFollowUp({ ...sourceRecord(), at: "tomorrow" }, RECORD_ID)).toBeNull();
  });

  it("does not mutate the original record", () => {
    const input = Object.freeze(sourceRecord());
    const result = projectAuthorizedCorporateFollowUp(input, RECORD_ID);
    expect(result?.version).toBe(3);
    expect(input.actor).toBe("private-clerk-id");
  });
});
