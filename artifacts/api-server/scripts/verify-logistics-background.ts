/**
 * Opt-in development proof. Adds only synthetic TEST pool rows, then OBSERVES
 * the existing API timer. Never starts a worker, model request or notification.
 * Leaves the labelled TEST evidence available in the founder preview.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import {
  db, pool, type PoolPayload,
  logisticsPoolEntriesTable as entries,
  logisticsPoolMatchesTable as matches,
  logisticsPoolAiDraftsTable as drafts,
  logisticsPoolDraftNotificationsTable as notifications,
} from "@workspace/db";
import { digest, suggestPoolMatches } from "../src/lib/logisticsPoolEngine";
import { logisticsDraftMode } from "../src/lib/logisticsPoolDraftPolicy";

async function main() {
  assert.equal(process.argv.includes("--create-test-fixture"), true);
  assert.equal(process.env.NODE_ENV, "development");
  assert.ok(!process.env.REPLIT_DEPLOYMENT);
  assert.equal(logisticsDraftMode(), "test_drafts");
  const expected = process.env.MMT_EXPECTED_DEVELOPMENT_FINGERPRINT;
  assert.match(expected ?? "", /^[a-f0-9]{32}$/);
  const target = await db.execute(sql`
    SELECT md5(current_database() || ':' || 'public.logistics_pool_matches'::regclass::oid::text) AS fingerprint
  `);
  assert.equal(target.rows[0]?.fingerprint, expected);

  const matchId = randomUUID();
  const fixtureIds = [randomUUID(), randomUUID()];
  const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const base: PoolPayload = {
    role: "load", name: "TEST — Panelden bağımsız worker kontrolü",
    location: "Ukrayna", origin: "Ukrayna", destination: "Mersin",
    products: ["narenciye"], transportMode: "road",
    capacityKg: null, requiredKg: 20000, volumeM3: 40,
    availableDate: null, requiredDate: futureDate,
    contact: "", reference: "UKR-MERSİN-NARENCİYE-001", sourceUrl: null,
    isTest: true, verified: false, eligible: true,
  };
  const fixtures = fixtureIds.map((id, index) => {
    const payload: PoolPayload = index === 0 ? { ...base } : {
      ...base, role: "carrier",
      name: "TEST — Panelden bağımsız worker kontrolü (taşıyıcı)",
      capacityKg: 24000, requiredKg: null,
      availableDate: futureDate, requiredDate: null,
    };
    return {
      id, originKey: `test-background-proof:${matchId}:${index}`,
      sourceKind: "synthetic_worker_proof", payload,
      fingerprint: digest(payload), active: true, lastSeenAt: new Date(),
    };
  });
  const suggestions = suggestPoolMatches(fixtures);
  assert.equal(suggestions.length, 1);
  const startedAt = Date.now();
  await db.transaction(async (tx) => {
    await tx.insert(entries).values(fixtures);
    await tx.insert(matches).values({ ...suggestions[0]!, id: matchId });
  });
  console.log(JSON.stringify({
    stage: "TEST_FIXTURE_READY", matchId, fixtureIds,
    workerStartedByThisScript: false, browserRequestMade: false,
    existingRecordsModified: false,
  }));

  const deadline = Date.now() + 190000;
  do {
    const saved = await db.select().from(drafts).where(eq(drafts.matchId, matchId));
    if (saved.length) {
      assert.equal(saved.length, 1);
      const draft = saved[0]!;
      assert.equal(draft.status, "pending_review");
      assert.equal(draft.origin, "background_worker");
      assert.equal(draft.snapshotHash, suggestions[0]!.snapshotHash);
      assert.ok(draft.summary.trim());
      assert.ok(draft.introductionDraft.trim());
      const notices = await db.select().from(notifications)
        .where(eq(notifications.draftId, draft.id));
      if (!notices.length) { await delay(1000); continue; }
      assert.equal(notices.length, 1);
      assert.equal(notices[0]!.status, "dry_run");
      const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
      assert.equal(match?.status, "pending");
      assert.equal(match?.reviewedBy, null);
      assert.equal(match?.reviewedAt, null);
      assert.equal(match?.events.length, 0);
      console.log(JSON.stringify({
        result: "PASS", matchId, draftId: draft.id,
        generatedAt: draft.createdAt.toISOString(),
        elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
        origin: draft.origin, status: draft.status,
        notificationStatus: notices[0]!.status,
        commercialDecision: false, messagesSentByThisFlow: false,
        paymentCreated: false, productionTouched: false,
        scope: "Existing development API timer; not proof of continuous production uptime or mobile login.",
      }));
      return;
    }
    await delay(2000);
  } while (Date.now() < deadline);
  console.log(JSON.stringify({
    result: "NOT_TESTED", reason: "Automatic worker did not complete within the observation window.",
    matchId, fixtureIds, retainedForInvestigation: true,
  }));
  process.exitCode = 1;
}

main().catch(() => {
  // Do not dump SDK/SQL errors, credentials, connection strings or payloads.
  console.error("Worker proof failed; no success claimed. Inspect labelled TEST evidence and redacted server logs.");
  process.exitCode = 1;
}).finally(() => pool.end());
