import { pool } from "@workspace/db";
import { logger } from "./lib/logger";
import { checkLogisticsSchema } from "./lib/logisticsLaunchReadiness";
import { logisticsDraftMode } from "./lib/logisticsPoolDraftPolicy";
import { runLogisticsPoolAiDraftWorkerOnce } from "./lib/logisticsPoolAiDraftWorker";
import { refreshPool } from "./lib/logisticsPool";
import { writeWorkerEvidence } from "./lib/logisticsWorkerEvidence";

/** Standalone, no HTTP listener; no Telegram sender is imported or invoked. */
async function main() {
  let stopping = false;
  let wake: (() => void) | undefined;
  const stop = () => { stopping = true; wake?.(); };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  try {
    const mode = logisticsDraftMode();
    if (mode === "disabled" ||
        (mode === "production_drafts" && process.env.MMT_LOGISTICS_POOL_WORKER_ROLE !== "dedicated")) {
      logger.warn("Lojistik taslak worker etkinleştirilmedi; hiçbir iş veya mesaj oluşturulmadı.");
      process.exitCode = 2;
      return;
    }
    const schema = await checkLogisticsSchema();
    if (schema.missing.length) {
      logger.error({ missing: schema.missing }, "Gerekli lojistik şeması eksik; worker başlatılmadı.");
      process.exitCode = 2;
      return;
    }
    if (mode === "production_drafts" && !process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID?.trim()) {
      logger.error("Kurucu inceleme kimliği yapılandırılmamış; üretim taslak worker başlatılmadı.");
      process.exitCode = 2;
      return;
    }
    await writeWorkerEvidence({ at: new Date().toISOString(), mode, result: "starting" });
    while (!stopping) {
      try {
        // Only after separately approved production activation: refresh existing
        // internal records/explicitly authorized feeds, never arbitrary scraping.
        if (mode === "production_drafts") await refreshPool();
        if (stopping) break;
        const result = await runLogisticsPoolAiDraftWorkerOnce();
        if (result === "disabled") throw new Error("Worker activation was lost.");
        await writeWorkerEvidence({ at: new Date().toISOString(), mode, result });
        logger.info({ result, mode, messagesSent: false }, "Lojistik taslak worker turu.");
        if (process.argv.includes("--once") && ["error", "blocked", "busy", "disabled"].includes(result)) {
          process.exitCode = result === "error" || result === "blocked" ? 1 : 2;
        }
      } catch {
        await writeWorkerEvidence({ at: new Date().toISOString(), mode, result: "error" });
        logger.warn("Lojistik worker turu başarısız; başarı veya gönderim kaydedilmedi.");
        if (process.argv.includes("--once")) process.exitCode = 1;
      }
      if (process.argv.includes("--once")) break;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 120_000);
        wake = () => { clearTimeout(timer); resolve(); };
        if (stopping) wake();
      });
      wake = undefined;
    }
  } catch {
    logger.error("Lojistik worker başlatılamadı; gizli bilgiler loglanmadı.");
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
    await pool.end();
  }
}
void main();
