import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  logisticsPoolAiDraftsTable as drafts,
  logisticsPoolEntriesTable as entries,
  logisticsPoolMatchesTable as matches,
} from "@workspace/db";
import { logger } from "./logger";
import {
  createLogisticsPoolMatchAiDraft,
  isLogisticsPoolAiDraftPreviewEnabled,
  LOGISTICS_POOL_AI_DRAFT_WORKER_ACTOR,
  LogisticsPoolAiDraftError,
} from "./logisticsPoolAiDraft";

const INTERVAL_MS = 120_000;
const MAX_MATCHES_TO_CHECK = 100;

async function generateOneTestDraft(): Promise<void> {
  const candidates = await db.select().from(matches)
    .where(eq(matches.status, "pending"))
    .orderBy(desc(matches.updatedAt))
    .limit(MAX_MATCHES_TO_CHECK);

  for (const match of candidates) {
    if (match.entryIds.length !== 2) continue;
    const participants = await db.select().from(entries)
      .where(inArray(entries.id, match.entryIds));
    if (participants.length !== 2 ||
        participants.some((entry) => !entry.active || !entry.payload.isTest) ||
        participants[0]!.payload.isTest !== participants[1]!.payload.isTest ||
        !participants.some((entry) => entry.payload.role === "load") ||
        !participants.some((entry) => entry.payload.role === "carrier")) {
      continue;
    }

    const [existing] = await db.select().from(drafts).where(and(
      eq(drafts.matchId, match.id),
      eq(drafts.matchVersion, match.version),
    )).limit(1);
    if (existing?.snapshotHash === match.snapshotHash && existing.status === "pending_review") {
      continue;
    }

    try {
      await createLogisticsPoolMatchAiDraft(
        { matchId: match.id, expectedVersion: match.version },
        LOGISTICS_POOL_AI_DRAFT_WORKER_ACTOR,
      );
      logger.info("Gemini sentetik TEST taslağı kurucu inceleme kuyruğuna alındı.");
      return;
    } catch (error) {
      if (error instanceof LogisticsPoolAiDraftError) {
        logger.warn({ status: error.status }, "Gemini TEST taslağı bu turda üretilemedi; eşleşme ve operasyon durumu değiştirilmedi.");
      } else {
        logger.warn("Gemini TEST taslak turu doğrulanamadı; eşleşme ve operasyon durumu değiştirilmedi.");
      }
      return;
    }
  }
}

export function startLogisticsPoolAiDraftWorker(): void {
  if (!isLogisticsPoolAiDraftPreviewEnabled()) return;

  let busy = false;
  const run = async () => {
    if (busy || !isLogisticsPoolAiDraftPreviewEnabled()) return;
    busy = true;
    try {
      await generateOneTestDraft();
    } catch {
      logger.warn("Gemini TEST taslak worker'ı doğrulanamadı; işlem başarı olarak kaydedilmedi.");
    } finally {
      busy = false;
    }
  };

  logger.info("Gemini TEST taslak worker'ı etkin; yalnız sentetik TEST eşleşmelerine taslak hazırlar.");
  const timer = setInterval(() => { void run(); }, INTERVAL_MS);
  timer.unref();
  void run();
}
