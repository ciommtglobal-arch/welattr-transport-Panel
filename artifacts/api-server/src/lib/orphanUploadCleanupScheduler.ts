import type { Logger } from "pino";

const HOUR_IN_MS = 60 * 60 * 1000;
const DEFAULT_INTERVAL_HOURS = 24;
const INITIAL_DELAY_MS = 5 * 60 * 1000;
const RETRY_DELAYS_MS = [60 * 1000, 5 * 60 * 1000];

type SchedulerLogger = Pick<Logger, "info" | "warn" | "error">;

interface SchedulerOptions {
  runCleanup: () => Promise<void>;
  logger: SchedulerLogger;
  env?: NodeJS.ProcessEnv;
}

function getPositiveInteger(
  value: string | undefined,
  name: string,
  defaultValue: number,
) {
  if (value === undefined || value === "") return defaultValue;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function isSchedulerEnabled(env: NodeJS.ProcessEnv) {
  const configured = env.ORPHAN_UPLOAD_CLEANUP_ENABLED;
  if (configured === "true") return true;
  if (configured === "false") return false;
  if (configured !== undefined) {
    throw new Error(
      "ORPHAN_UPLOAD_CLEANUP_ENABLED must be either true or false.",
    );
  }

  return env.NODE_ENV !== "development" && env.NODE_ENV !== "test";
}

export function startOrphanUploadCleanupScheduler({
  runCleanup,
  logger,
  env = process.env,
}: SchedulerOptions) {
  if (!isSchedulerEnabled(env)) {
    logger.info(
      "Zamanlanmış sahipsiz yükleme temizliği bu ortamda devre dışı",
    );
    return () => {};
  }

  const intervalHours = getPositiveInteger(
    env.ORPHAN_UPLOAD_CLEANUP_INTERVAL_HOURS,
    "ORPHAN_UPLOAD_CLEANUP_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * HOUR_IN_MS;
  if (!Number.isSafeInteger(intervalMs)) {
    throw new Error(
      "ORPHAN_UPLOAD_CLEANUP_INTERVAL_HOURS is too large.",
    );
  }

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (delayMs: number, callback: () => void) => {
    if (stopped) return;
    timer = setTimeout(callback, delayMs);
    timer.unref?.();
  };

  const runAttempt = async (attempt: number) => {
    try {
      await runCleanup();
      if (stopped) return;
      logger.info(
        { intervalHours },
        "Zamanlanmış sahipsiz yükleme temizliği başarıyla tamamlandı",
      );
      schedule(intervalMs, () => void runAttempt(1));
    } catch (error) {
      if (stopped) return;

      const retryDelayMs = RETRY_DELAYS_MS[attempt - 1];
      if (retryDelayMs !== undefined) {
        logger.warn(
          { err: error, attempt, retryInMs: retryDelayMs },
          "Zamanlanmış sahipsiz yükleme temizliği başarısız; yeniden denenecek",
        );
        schedule(retryDelayMs, () => void runAttempt(attempt + 1));
        return;
      }

      logger.error(
        { err: error, attempts: attempt, nextRunInMs: intervalMs },
        "Zamanlanmış sahipsiz yükleme temizliği yeniden denemelerden sonra başarısız oldu",
      );
      schedule(intervalMs, () => void runAttempt(1));
    }
  };

  logger.info(
    {
      initialDelayMs: INITIAL_DELAY_MS,
      intervalHours,
      retryDelaysMs: RETRY_DELAYS_MS,
    },
    "Zamanlanmış sahipsiz yükleme temizliği etkin",
  );
  schedule(INITIAL_DELAY_MS, () => void runAttempt(1));

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}