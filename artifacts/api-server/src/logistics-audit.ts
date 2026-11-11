import { pool } from "@workspace/db";
import { checkLogisticsSchema, probeLogisticsTelegram } from "./lib/logisticsLaunchReadiness";
import { logisticsDraftMode } from "./lib/logisticsPoolDraftPolicy";

async function main() {
  try {
    const schema = await checkLogisticsSchema();
    const expected = process.argv.find((arg) => arg.startsWith("--expected-db-fingerprint="))?.split("=")[1];
    const targetVerified = Boolean(expected && expected === schema.fingerprint);
    if (expected && !targetVerified) throw new Error("Database target mismatch.");
    const telegram = process.argv.includes("--telegram-readonly")
      ? await probeLogisticsTelegram() : { status: "NOT_TESTED", sendingEnabled: false };
    console.log(JSON.stringify({
      schema, targetVerified, mode: logisticsDraftMode(),
      founderIdentityConfigured: Boolean(process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID?.trim()),
      dedicatedRoleConfigured: process.env.MMT_LOGISTICS_POOL_WORKER_ROLE === "dedicated",
      telegram, productionFounderSession: "NOT_TESTED", workerUptime: "NOT_TESTED",
      sendsPerformed: false, approvalsPerformed: false, databaseWritesPerformed: false,
    }, null, 2));
    if (schema.missing.length || !targetVerified) process.exitCode = 2;
  } catch {
    console.error("Read-only readiness audit failed; no provider error, credentials or connection string was logged.");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
void main();
