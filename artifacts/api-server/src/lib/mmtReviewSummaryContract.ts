/**
 * MMT Connect / WelatTR cross-workspace read-only review projection (v1).
 *
 * This is NOT an authorization mechanism or a provider integration.
 * A server route must authenticate its caller, derive the trusted owner scope
 * from verified claims, and independently authorize the source record before
 * calling this pure projector. Never pass a browser-supplied scope as trusted.
 */
export const REVIEW_SOURCE_SYSTEMS = [
  "mmt-connect-replit",
  "welattr-gemini-pilot",
  "render-welattr-api-test",
  "mmt-global-dashboard",
] as const;

export type ReviewSourceSystem = (typeof REVIEW_SOURCE_SYSTEMS)[number];

const TASK_STATUSES = new Set([
  "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "UNKNOWN_OUTCOME", "NOT_CONNECTED",
]);
const GEMINI_REVIEW_STATUSES = new Set([
  "NOT_REQUESTED", "PENDING", "MANUAL_REVIEW", "COMPLETED", "BLOCKED", "UNVERIFIED",
]);
const CIO_DECISION_STATUSES = new Set([
  "NO_DECISION", "PENDING", "APPROVED", "REJECTED", "HOLD",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export interface ReadOnlyReviewSummary {
  sourceSystem: ReviewSourceSystem;
  recordId: string;
  version: number;
  taskStatus: string;
  geminiReviewStatus: string;
  cioDecisionStatus: string;
  updatedAt: string;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isAllowed(value: unknown, allowed: ReadonlySet<string>): value is string {
  return typeof value === "string" && allowed.has(value);
}

/**
 * Returns a strict allowlist projection or null (fail-closed).
 * Sensitive source fields such as prompt, memory, message, document, email,
 * tenant identifier, API key, raw Gemini response and user ID are NEVER copied.
 *
 * expectedOwnerScope and expectedSourceSystem MUST originate from verified
 * server-side authorization, never from a query string or request body.
 */
export function projectAuthorizedReviewSummary(
  input: unknown,
  expectedOwnerScope: string,
  expectedSourceSystem: ReviewSourceSystem,
): ReadOnlyReviewSummary | null {
  if (!isRecord(input)
    || typeof expectedOwnerScope !== "string"
    || expectedOwnerScope.length < 1
    || expectedOwnerScope.length > 128
    || !REVIEW_SOURCE_SYSTEMS.includes(expectedSourceSystem)
    || input.ownerScope !== expectedOwnerScope
    || input.sourceSystem !== expectedSourceSystem
    || typeof input.recordId !== "string"
    || !UUID_PATTERN.test(input.recordId)
    || typeof input.version !== "number"
    || !Number.isSafeInteger(input.version)
    || input.version < 1
    || !isAllowed(input.taskStatus, TASK_STATUSES)
    || !isAllowed(input.geminiReviewStatus, GEMINI_REVIEW_STATUSES)
    || !isAllowed(input.cioDecisionStatus, CIO_DECISION_STATUSES)
    || typeof input.updatedAt !== "string"
    || !UTC_TIMESTAMP.test(input.updatedAt)
    || !Number.isFinite(Date.parse(input.updatedAt))) {
    return null;
  }

  return {
    sourceSystem: expectedSourceSystem,
    recordId: input.recordId,
    version: input.version,
    taskStatus: input.taskStatus,
    geminiReviewStatus: input.geminiReviewStatus,
    cioDecisionStatus: input.cioDecisionStatus,
    updatedAt: input.updatedAt,
  };
}
