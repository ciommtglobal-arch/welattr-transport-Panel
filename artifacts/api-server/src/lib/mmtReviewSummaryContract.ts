/**
 * MMT Connect corporate follow-up: minimum read-only source projection (v1).
 *
 * This pure function does NOT authorize a user, fetch source data, create a
 * network gateway, or call Gemini. The SOURCE SERVER must first authenticate
 * the caller and verify owner_clerk_user_id / record ownership, then apply
 * this allowlist BEFORE sending data across any workspace boundary.
 *
 * Never accept the trustedAuthorizedRecordId from a browser payload.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|\+00:00)$/;
const CORPORATE_APPROVALS = new Set([
  "pending_review", "approved", "rejected", "revision_requested",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUtcTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && UTC_TIMESTAMP.test(value)
    && Number.isFinite(Date.parse(value));
}

export interface CorporateFollowUpSummary {
  id: string;
  version: number;
  approval: "pending_review" | "approved" | "rejected" | "revision_requested";
  at: string;
}

/**
 * Projects exactly the four actual fields of a source-authorized
 * GET /api/staff/corporate-follow-up record.
 *
 * - approval is the corporate file approval state, NOT a Gemini decision.
 * - data.status is deliberately omitted from v1.
 * - This function is fail-closed on unknown/invalid fields or wrong record ID.
 * - It cannot verify tenant or ownership on its own.
 */
export function projectAuthorizedCorporateFollowUp(
  input: unknown,
  trustedAuthorizedRecordId: string,
): CorporateFollowUpSummary | null {
  if (!isRecord(input)
    || typeof trustedAuthorizedRecordId !== "string"
    || !UUID_PATTERN.test(trustedAuthorizedRecordId)
    || input.id !== trustedAuthorizedRecordId
    || typeof input.version !== "number"
    || !Number.isSafeInteger(input.version)
    || input.version < 1
    || typeof input.approval !== "string"
    || !CORPORATE_APPROVALS.has(input.approval)
    || !isUtcTimestamp(input.at)) {
    return null;
  }
  return {
    id: trustedAuthorizedRecordId,
    version: input.version,
    approval: input.approval as CorporateFollowUpSummary["approval"],
    at: input.at,
  };
}
