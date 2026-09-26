import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { cleanupOrphanUploads } from "./routes/storage";
import { startOrphanUploadCleanupScheduler } from "./lib/orphanUploadCleanupScheduler";

const rawPort = process.env["PORT"];
const ORPHAN_UPLOAD_CLEANUP_LOCK_ID = 4811021014;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startOrphanUploadCleanupScheduler({
    logger,
    runCleanup: async () => {
      const client = await pool.connect();
      let locked = false;

      try {
        const lockResult = await client.query<{ locked: boolean }>(
          "SELECT pg_try_advisory_lock($1) AS locked",
          [ORPHAN_UPLOAD_CLEANUP_LOCK_ID],
        );
        locked = lockResult.rows[0]?.locked === true;

        if (!locked) {
          logger.info(
            "Sahipsiz yükleme temizliği başka bir sunucu örneğinde çalışıyor; bu çalışma atlandı",
          );
          return;
        }

        const result = await cleanupOrphanUploads(true, logger);
        if (result.failedObjects.length > 0) {
          throw new Error(
            `${result.failedObjects.length} sahipsiz yükleme silinemedi.`,
          );
        }
      } finally {
        try {
          if (locked) {
            await client.query("SELECT pg_advisory_unlock($1)", [
              ORPHAN_UPLOAD_CLEANUP_LOCK_ID,
            ]);
          }
        } finally {
          client.release();
        }
      }
    },
  });
});
