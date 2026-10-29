import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  logisticsPoolAiDraftsTable as drafts,
  logisticsPoolDraftNotificationsTable as notifications,
  logisticsPoolEntriesTable as entries,
  logisticsPoolMatchesTable as matches,
} from "@workspace/db";
import { logger } from "./logger";
import { isQuarantinedMarketPayload } from "./marketSourcePolicy";
import {
  createLogisticsPoolMatchAiDraft,
  isLogisticsPoolAiDraftPreviewEnabled,
  LOGISTICS_POOL_AI_DRAFT_WORKER_ACTOR,
  LogisticsPoolAiDraftError,
} from "./logisticsPoolAiDraft";
import { logisticsDraftMode, MAX_PENDING_BACKGROUND_DRAFTS } from "./logisticsPoolDraftPolicy";

const INTERVAL_MS = 120_000;
const MAX_MATCHES_TO_CHECK = 100;
const WORKER_LOCK_ID = 4135532;
let timer: ReturnType<typeof setInterval> | undefined;
export type DraftWorkerResult = "disabled" | "busy" | "idle" | "queued" | "blocked" | "error";

async function recordDryRunTelegramNotification(draftId: string): Promise<boolean> {
  const inserted = await db.insert(notifications).values({
    draftId,
    channel: "telegram",
    status: "dry_run",
  }).onConflictDoNothing().returning({ id: notifications.id });
  return inserted.length > 0;
}

async function generateOneDraft(testOnly: boolean): Promise<DraftWorkerResult> {
  if (!testOnly) {
    // Only current pending matches consume review capacity. Old revisions and
    // decided matches must not permanently block the founder's queue.
    const waiting = await db.select({ id: drafts.id }).from(drafts)
      .innerJoin(matches, and(
        eq(matches.id, drafts.matchId),
        eq(matches.version, drafts.matchVersion),
        eq(matches.snapshotHash, drafts.snapshotHash),
      ))
      .where(and(eq(drafts.status, "pending_review"), eq(matches.status, "pending")))
      .limit(MAX_PENDING_BACKGROUND_DRAFTS);
    if (waiting.length >= MAX_PENDING_BACKGROUND_DRAFTS) {
      logger.info("Kurucu inceleme kuyruğu sınırında; yeni arka plan Gemini çağrısı yapılmadı.");
      return "idle";
    }
  }
  const candidates = await db.select().from(matches)
    .where(eq(matches.status, "pending"))
    .orderBy(desc(matches.updatedAt))
    .limit(MAX_MATCHES_TO_CHECK);

  for (const match of candidates) {
    if (match.entryIds.length !== 2) continue;
    const participants = await db.select().from(entries)
      .where(inArray(entries.id, match.entryIds));
    if (participants.length !== 2 ||
        participants.some((entry) => isQuarantinedMarketPayload(entry.payload) || !entry.active || entry.payload.isTest !== testOnly) ||
        participants[0]!.payload.isTest !== participants[1]!.payload.isTest ||
        !participants.some((entry) => entry.payload.role === "load") ||
        !participants.some((entry) => entry.payload.role === "carrier")) {
      continue;
    }

    try {
      // Reuse also goes through freshness/source checks; an old saved draft is
      // not enough to enqueue a notification for a now-invalid match.
      await createLogisticsPoolMatchAiDraft(
        { matchId: match.id, expectedVersion: match.version },
        LOGISTICS_POOL_AI_DRAFT_WORKER_ACTOR,
      );
      const [savedDraft] = await db.select().from(drafts).where(and(
        eq(drafts.matchId, match.id),
        eq(drafts.matchVersion, match.version),
      )).limit(1);
      if (savedDraft?.snapshotHash === match.snapshotHash && savedDraft.status === "pending_review") {
        const recorded = await recordDryRunTelegramNotification(savedDraft.id);
        if (recorded) {
          logger.info("Gemini taslağı ve gönderimsiz bildirim kaydı kurucu kuyruğuna alındı; dış mesaj gönderilmedi.");
          return "queued";
        }
      }
    } catch (error) {
      if (error instanceof LogisticsPoolAiDraftError) {
        if ([400, 404, 409].includes(error.status)) continue;
        logger.warn({ status: error.status }, "Gemini taslağı bu turda üretilemedi; operasyon durumu değiştirilmedi.");
      } else {
        logger.warn("Gemini taslak turu doğrulanamadı; operasyon durumu değiştirilmedi.");
      }
      return "blocked";
    }
  }
  return "idle";
}

/** Same pool, no second DB connection pool; session lock spans the model call. */
export async function runLogisticsPoolAiDraftWorkerOnce(): Promise<DraftWorkerResult> {
  const mode = logisticsDraftMode();
  if (mode === "disabled" ||
      (mode === "production_drafts" && process.env.MMT_LOGISTICS_POOL_WORKER_ROLE !== "dedicated")) return "disabled";
  const client = await pool.connect();
  let locked = false;
  let destroy = false;
  try {
    const result = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1::bigint) AS locked", [WORKER_LOCK_ID],
    );
    locked = result.rows[0]?.locked === true;
    if (!locked) return "busy";
    return await generateOneDraft(mode === "test_drafts");
  } catch {
    logger.warn("Gemini worker turu doğrulanamadı; başarı kaydedilmedi.");
    return "error";
  } finally {
    try {
      if (locked) await client.query("SELECT pg_advisory_unlock($1::bigint)", [WORKER_LOCK_ID]);
    } catch {
      destroy = true;
    }
    client.release(destroy);
  }
}

export function startLogisticsPoolAiDraftWorker(): void {
  // Production uses the separate entry point, never an autoscaling API timer.
  if (process.env.NODE_ENV === "production" ||
      process.env.MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED !== "true" ||
      !isLogisticsPoolAiDraftPreviewEnabled() || timer) return;

  let busy = false;
  const run = async () => {
    if (busy || !isLogisticsPoolAiDraftPreviewEnabled()) return;
    busy = true;
    try {
      await runLogisticsPoolAiDraftWorkerOnce();
    } catch {
      logger.warn("Gemini TEST taslak worker'ı doğrulanamadı; işlem başarı olarak kaydedilmedi.");
    } finally {
      busy = false;
    }
  };

  logger.info("Gemini TEST taslak worker'ı etkin; yalnız sentetik TEST eşleşmelerine taslak hazırlar.");
  timer = setInterval(() => { void run(); }, INTERVAL_MS);
  timer.unref();
  void run();
}
