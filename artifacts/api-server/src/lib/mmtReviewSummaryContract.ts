/**
 * MMT Connect / WelatTR cross-workspace read-only projections (v1).
 *
 * These pure functions are NOT authentication, ownership checks, provider
 * integrations or live gateways. The source server must authenticate the
 * caller and verify each record's ownership before passing its trusted ID.
 * Never use a browser-provided ID as an authorization decision.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|\+00:00)$/;
const CORPORATE_APPROVALS = new Set([
  "pending_review", "approved", "rejected", "revision_requested",
]);
const MANUAL_REVIEW_DECISIONS = new Set([
  "approved", "rejected", "revision_requested",
]);
const MANUAL_REVIEW_TARGETS = new Set(["gmail", "case", "task"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUtcTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && UTC_TIMESTAMP.test(value)
    && Number.isFinite(Date.parse(value));
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export interface CorporateFollowUpSummary {
  sourceSystem: "mmt-connect-replit";
  recordId: string;
  version: number;
  approval: "pending_review" | "approved" | "rejected" | "revision_requested";
  at: string;
}

/**
 * Projects ONLY the four actual GET /api/staff/corporate-follow-up fields.
 * approval is a corporate follow-up state, NOT a Gemini review or a verified
 * CIO e-signature. The source must first verify owner_clerk_user_id and access.
 */
export function projectAuthorizedCorporateFollowUp(
  input: unknown,
  trustedAuthorizedRecordId: string,
): CorporateFollowUpSummary | null {
  if (!isRecord(input)
    || !isUuid(trustedAuthorizedRecordId)
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
    sourceSystem: "mmt-connect-replit",
    recordId: trustedAuthorizedRecordId,
    version: input.version,
    approval: input.approval as CorporateFollowUpSummary["approval"],
    at: input.at,
  };
}

export interface ManualGeminiReviewSummary {
  sourceSystem: "mmt-connect-replit";
  reviewMode: "manual_unverified";
  reviewId: string;
  targetKind: "gmail" | "case" | "task";
  createdAt: string;
  respondedAt: string | null;
  decidedAt: string | null;
  decision: "approved" | "rejected" | "revision_requested" | null;
}

/**
 * Projects only existing metadata from the manual Gemini review LIST response.
 * This NEVER asserts that Google Gemini was called or that the response is
 * provider-authenticated. The source must verify record/target ownership.
 */
export function projectAuthorizedManualGeminiReview(
  input: unknown,
  trustedAuthorizedReviewId: string,
): ManualGeminiReviewSummary | null {
  if (!isRecord(input)
    || !isUuid(trustedAuthorizedReviewId)
    || input.id !== trustedAuthorizedReviewId
    || typeof input.source !== "string"
    || !MANUAL_REVIEW_TARGETS.has(input.source)
    || !isUtcTimestamp(input.createdAt)
    || !(input.respondedAt === null || isUtcTimestamp(input.respondedAt))
    || !(input.decidedAt === null || isUtcTimestamp(input.decidedAt))
    || !(input.decision === null
      || (typeof input.decision === "string" && MANUAL_REVIEW_DECISIONS.has(input.decision)))) {
    return null;
  }
  return {
    sourceSystem: "mmt-connect-replit",
    reviewMode: "manual_unverified",
    reviewId: trustedAuthorizedReviewId,
    targetKind: input.source as ManualGeminiReviewSummary["targetKind"],
    createdAt: input.createdAt,
    respondedAt: input.respondedAt,
    decidedAt: input.decidedAt,
    decision: input.decision as ManualGeminiReviewSummary["decision"],
  };
}
