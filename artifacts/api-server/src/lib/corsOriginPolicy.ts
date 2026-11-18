const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function parseCorsAllowedOrigins(value: string | undefined): ReadonlySet<string> {
  const origins = new Set<string>();

  for (const candidate of (value ?? "").split(",")) {
    const origin = candidate.trim();
    if (!origin) continue;

    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("MMT_CORS_ALLOWED_ORIGINS contains an invalid origin.");
    }

    const secure = parsed.protocol === "https:";
    const localDevelopment = parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname);
    if ((!secure && !localDevelopment) || parsed.origin !== origin) {
      throw new Error("MMT_CORS_ALLOWED_ORIGINS must contain exact HTTPS origins (HTTP is allowed only for localhost).");
    }
    origins.add(origin);
  }

  return origins;
}

export function isCorsOriginAllowed(
  requestOrigin: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  // Requests without an Origin header are server-to-server or same-origin cases;
  // the browser CORS policy is not being relaxed for them.
  if (requestOrigin === undefined) return true;
  return allowedOrigins.has(requestOrigin);
}
