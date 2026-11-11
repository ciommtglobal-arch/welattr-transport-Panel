import { afterAll, expect, it } from "vitest";
import { pool } from "@workspace/db";
import { cleanupOrphanUploads } from "./storage";

// Opt-in read-only report against this workspace's development storage/DB.
// Run with RUN_STORAGE_DRY_RUN=true; this never calls the deletion path.
afterAll(async () => {
  await pool.end();
});

it.skipIf(process.env.RUN_STORAGE_DRY_RUN !== "true")(
  "reports orphan upload candidates without deleting anything",
  async () => {
    const report = await cleanupOrphanUploads(true);
    expect(report.dryRun).toBe(true);
    expect(report.deletedObjectPaths).toEqual([]);
    console.log("ORPHAN_DRY_RUN_SUMMARY", JSON.stringify({
      retentionHours: report.retentionHours,
      cutoffAt: report.cutoffAt,
      scannedObjects: report.scannedObjects,
      referencedObjects: report.referencedObjects,
      orphanedObjects: report.orphanedObjects,
      eligibleObjects: report.eligibleObjects,
      deletedObjects: report.deletedObjectPaths.length,
    }));
  },
  120_000,
);