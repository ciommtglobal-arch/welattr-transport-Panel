export function normalizeIdempotencyKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    normalized.length < 8
    || normalized.length > 200
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalized)
  ) return null;
  return normalized;
}

export function isGeminiWorkerEnabled(env: Record<string, string | undefined>): boolean {
  return env.GEMINI_TASK_WORKER_ENABLED === "true"
    && env.GEMINI_FREE_TIER_ONLY_CONFIRMED === "true"
    && Boolean(env.GEMINI_API_KEY?.trim());
}

export type GeminiProviderFailure = {
  httpStatus: number | null;
  category: "authentication_or_permission" | "invalid_request" | "not_found" | "rate_limited" | "provider_unavailable" | "unknown";
};

/** Extracts only numeric HTTP status metadata; never returns provider text or payloads. */
export function getGeminiProviderFailure(error: unknown): GeminiProviderFailure {
  const root = isRecord(error) ? error : {};
  const response = isRecord(root.response) ? root.response : {};
  const cause = isRecord(root.cause) ? root.cause : {};
  const causeResponse = isRecord(cause.response) ? cause.response : {};
  const candidates = [root.status, response.status, cause.status, causeResponse.status];
  const rawStatus = candidates.find((value) =>
    typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
  );
  const httpStatus = typeof rawStatus === "number" ? rawStatus : null;

  let category: GeminiProviderFailure["category"] = "unknown";
  if (httpStatus === 401 || httpStatus === 403) category = "authentication_or_permission";
  else if (httpStatus === 400 || httpStatus === 422) category = "invalid_request";
  else if (httpStatus === 404) category = "not_found";
  else if (httpStatus === 429) category = "rate_limited";
  else if (httpStatus !== null && httpStatus >= 500) category = "provider_unavailable";

  return { httpStatus, category };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
