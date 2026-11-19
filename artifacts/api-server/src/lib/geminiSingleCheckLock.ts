export type LockStatus = "idle" | "running" | "failed" | "blocked" | "finished";

export type FailureKind = "transient" | "config";

export interface SingleCheckLockState {
  status: LockStatus;
  generation: number;
  activeGeneration: number | null;
  startedAt: number | null;
  failedAt: number | null;
  lastFailureKind: FailureKind | null;
}

export interface SingleCheckLock {
  readonly state: Readonly<SingleCheckLockState>;
  normalize(now?: number): void;
  getRetryRemainingMs(now?: number): number;
  markRunning(now?: number): number;
  markFinished(generation: number): boolean;
  markFailed(generation: number, kind: FailureKind, now?: number): boolean;
}

export interface MaskedErrorResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

export interface RequestLike {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface ResponseLike {
  status(code: number): {
    json(payload: unknown): unknown;
    end(): unknown;
  };
}

export interface CreateLockOptions {
  ttlMs?: number;
  cooldownMs?: number;
  nowFn?: () => number;
}

const DEFAULT_LOCK_TTL_MS = 2 * 60 * 1000;
const DEFAULT_FAILURE_COOLDOWN_MS = 30 * 1000;

export function createSingleCheckLock({
  ttlMs = DEFAULT_LOCK_TTL_MS,
  cooldownMs = DEFAULT_FAILURE_COOLDOWN_MS,
  nowFn = () => Date.now(),
}: CreateLockOptions = {}): SingleCheckLock {
  const internalState: SingleCheckLockState = {
    status: "idle",
    generation: 0,
    activeGeneration: null,
    startedAt: null,
    failedAt: null,
    lastFailureKind: null,
  };
  const state = internalState as Readonly<SingleCheckLockState>;

  function normalize(now: number = nowFn()): void {
    if (internalState.status === "running" && internalState.startedAt !== null
      && now - internalState.startedAt >= ttlMs) {
      // Invalidate this run so a late response cannot overwrite a later attempt.
      internalState.activeGeneration = null;
      internalState.startedAt = null;
      internalState.status = "failed";
      internalState.failedAt = now;
      internalState.lastFailureKind = "transient";
    }
  }

  function getRetryRemainingMs(now: number = nowFn()): number {
    normalize(now);
    if (internalState.status !== "failed"
      || internalState.lastFailureKind !== "transient"
      || internalState.failedAt === null) return 0;
    return Math.max(0, internalState.failedAt + cooldownMs - now);
  }

  function markRunning(now: number = nowFn()): number {
    internalState.generation += 1;
    const runId = internalState.generation;
    internalState.activeGeneration = runId;
    internalState.status = "running";
    internalState.startedAt = now;
    internalState.failedAt = null;
    internalState.lastFailureKind = null;
    return runId;
  }

  function markFinished(generation: number): boolean {
    if (internalState.status !== "running" || internalState.activeGeneration !== generation) return false;
    internalState.activeGeneration = null;
    internalState.startedAt = null;
    internalState.status = "finished";
    internalState.failedAt = null;
    internalState.lastFailureKind = null;
    return true;
  }

  function markFailed(generation: number, kind: FailureKind, now: number = nowFn()): boolean {
    if (internalState.status !== "running" || internalState.activeGeneration !== generation) return false;
    internalState.activeGeneration = null;
    internalState.startedAt = null;
    internalState.lastFailureKind = kind;
    if (kind === "config") {
      internalState.status = "blocked";
      internalState.failedAt = null;
    } else {
      internalState.status = "failed";
      internalState.failedAt = now;
    }
    return true;
  }

  return { state, normalize, getRetryRemainingMs, markRunning, markFinished, markFailed };
}

function headerValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value.join(",") : value ?? "").toLowerCase();
}

export function isPrefetchOrNonActionableRequest(req: RequestLike): boolean {
  const method = String(req.method || "").toUpperCase();
  if (method === "HEAD" || method === "OPTIONS") return true;

  const headers = req.headers || {};
  const blockedTokens = ["prefetch", "preview", "prerender"];
  return ["purpose", "x-purpose", "sec-purpose"]
    .some((name) => blockedTokens.some((token) => headerValue(headers[name]).includes(token)));
}

export interface CreateSingleCheckHandlerParams<TResult> {
  lock: SingleCheckLock;
  runGeminiCheck: () => Promise<TResult>;
  classifyError: (err: unknown) => FailureKind;
  maskError: (err: unknown, kind: FailureKind) => MaskedErrorResponse;
  nowFn?: () => number;
}

export function createSingleCheckHandler<TResult>({
  lock,
  runGeminiCheck,
  classifyError,
  maskError,
  nowFn = () => Date.now(),
}: CreateSingleCheckHandlerParams<TResult>) {
  return async function handleSingleCheck(req: RequestLike, res: ResponseLike): Promise<void> {
    if (isPrefetchOrNonActionableRequest(req)) {
      res.status(204).end();
      return;
    }

    const now = nowFn();
    lock.normalize(now);

    if (lock.state.status === "finished") {
      res.status(409).json({ success: false, error: "Tek bağlantı kontrolü bu dağıtımda zaten tamamlandı." });
      return;
    }
    if (lock.state.status === "blocked") {
      res.status(409).json({ success: false, error: "Yapılandırma hatası nedeniyle istek engellendi; önce yapılandırmayı düzeltin." });
      return;
    }
    if (lock.state.status === "running") {
      res.status(409).json({ success: false, error: "Tek bağlantı kontrolü zaten devam ediyor." });
      return;
    }

    const retryAfterMs = lock.getRetryRemainingMs(now);
    if (lock.state.status === "failed" && retryAfterMs > 0) {
      res.status(429).json({
        success: false,
        retryAfterMs,
        error: "Geçici hata sonrası bekleme süresi dolmadan yeni istek gönderilmedi.",
      });
      return;
    }

    const runId = lock.markRunning(now);
    try {
      const data = await runGeminiCheck();
      if (!lock.markFinished(runId)) {
        res.status(409).json({ success: false, error: "Bu kontrolün süresi doldu; sonucu artık geçerli değil." });
        return;
      }
      res.status(200).json({ success: true, data });
    } catch (err: unknown) {
      const kind = classifyError(err);
      const currentRun = lock.markFailed(runId, kind, nowFn());
      const masked = maskError(err, kind);
      // A stale run may report its own error, but cannot alter the active run's lock.
      res.status(currentRun ? masked.statusCode : 409).json(
        currentRun ? masked.body : { success: false, error: "Bu kontrolün süresi doldu; hata eski isteğe ait." },
      );
    }
  };
}
