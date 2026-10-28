import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { GetLogisticsPoolResponse } from "@workspace/api-zod";

// Explicit opt-in only: this test makes a real, potentially billable Gemini call.
// All fixture writes use one rolled-back DEVELOPMENT transaction.
const state = vi.hoisted(() => ({ tx: null as any }));
vi.mock("@workspace/db", async (original) => {
  const actual = await original<typeof import("@workspace/db")>();
  return {
    ...actual,
    db: new Proxy(actual.db, {
      get(_target, key) {
        if (!state.tx) throw new Error("Isolated TEST transaction required.");
        if (key === "transaction") return (fn: any) => state.tx.transaction(fn);
        const value = state.tx[key];
        return typeof value === "function" ? value.bind(state.tx) : value;
      },
    }),
  };
});
import {
  logisticsPoolEntriesTable as entries,
  logisticsPoolMatchesTable as matches,
  logisticsPoolAiDraftsTable as drafts,
  logisticsPoolDraftNotificationsTable as notifications,
} from "@workspace/db";
import { digest, suggestPoolMatches } from "./logisticsPoolEngine";
import { createLogisticsPoolMatchAiDraft, LOGISTICS_POOL_AI_DRAFT_WORKER_ACTOR } from "./logisticsPoolAiDraft";
import { getPoolWorkspace } from "./logisticsPool";

const enabled = process.env.MMT_GEMINI_SENDLESS_SMOKE === "1";

describe.skipIf(!enabled)("real Gemini sendless DEVELOPMENT smoke", () => {
  it("generates, saves, reuses and serializes a TEST draft without Telegram or lasting writes", async () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(process.env.REPLIT_DEPLOYMENT).toBeFalsy();
    const expectedTarget = process.env.MMT_EXPECTED_DEVELOPMENT_FINGERPRINT;
    expect(expectedTarget).toMatch(/^[a-f0-9]{32}$/);
    const actual = await vi.importActual<typeof import("@workspace/db")>("@workspace/db");
    const fingerprint = await actual.db.execute(sql`
      SELECT md5(current_database() || ':' || 'public.logistics_pool_matches'::regclass::oid::text) AS fingerprint
    `);
    expect(fingerprint.rows[0]?.fingerprint).toBe(expectedTarget);

    const originalFetch = globalThis.fetch;
    const allowedOrigin = new URL(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!).origin;
    let providerCalls = 0;
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.origin !== allowedOrigin) throw new Error("Non-Gemini outbound HTTP is forbidden in this test.");
      providerCalls++;
      return originalFetch(input, init);
    };
    const ids = [randomUUID(), randomUUID()];
    const matchId = randomUUID();
    const rollback = new Error("ROLLBACK_SENDLESS_TEST");
    let completed = false;
    try {
      await actual.db.transaction(async (tx) => {
        state.tx = tx;
        const [source] = await tx.select().from(matches)
          .where(eq(matches.id, "f9b817a9-d84b-44e2-b0e6-c28479de541e")).limit(1);
        expect(source?.entryIds).toHaveLength(2);
        const originalEntries = await tx.select().from(entries).where(inArray(entries.id, source.entryIds));
        expect(originalEntries).toHaveLength(2);
        expect(originalEntries.every((e) => e.payload.isTest)).toBe(true);
        const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
        const fixtures = originalEntries.map((entry, index) => {
          const payload = {
            ...entry.payload, name: `TEST ${entry.payload.role}`, contact: "",
            reference: "TEST-SENDLESS-SMOKE", sourceUrl: null,
            requiredDate: date, availableDate: date, isTest: true, eligible: true,
          };
          return {
            id: ids[index]!, originKey: `test-smoke:${ids[index]}`, sourceKind: "isolated_test",
            payload, fingerprint: digest(payload), active: true, lastSeenAt: new Date(),
          };
        });
        await tx.insert(entries).values(fixtures);
        const [suggestion] = suggestPoolMatches(fixtures);
        expect(suggestion).toBeDefined();
        await tx.insert(matches).values({ ...suggestion!, id: matchId });
        const first = await createLogisticsPoolMatchAiDraft(
          { matchId, expectedVersion: 1 }, LOGISTICS_POOL_AI_DRAFT_WORKER_ACTOR,
        );
        expect(providerCalls).toBeGreaterThan(0);
        expect(first).toMatchObject({ saved: true, sent: false, decisionMade: false });
        const callsAfterGeneration = providerCalls;
        const reused = await createLogisticsPoolMatchAiDraft(
          { matchId, expectedVersion: 1 }, LOGISTICS_POOL_AI_DRAFT_WORKER_ACTOR,
        );
        expect(reused).toEqual(first);
        expect(providerCalls).toBe(callsAfterGeneration);
        const saved = await tx.select().from(drafts).where(eq(drafts.matchId, matchId));
        expect(saved).toHaveLength(1);
        expect(saved[0]!.status).toBe("pending_review");
        // Verify the existing queue contract; this is NOT a worker/Telegram-send test.
        await tx.insert(notifications).values({ draftId: saved[0]!.id }).onConflictDoNothing();
        await tx.insert(notifications).values({ draftId: saved[0]!.id }).onConflictDoNothing();
        expect(await tx.select().from(notifications).where(eq(notifications.draftId, saved[0]!.id))).toHaveLength(1);
        // Service-level serialization only, not an authenticated founder session.
        const workspace = GetLogisticsPoolResponse.parse(await getPoolWorkspace({
          userId: "TEST-SERIALIZATION-ONLY", isFounder: true,
        }));
        expect(workspace.matches.find((m) => m.id === matchId)?.aiDraft).toMatchObject({
          saved: true, sent: false, decisionMade: false, telegramNotificationStatus: "dry_run",
        });
        const [unchanged] = await tx.select().from(matches).where(eq(matches.id, matchId));
        expect(unchanged!.status).toBe("pending");
        completed = true;
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      state.tx = null;
      globalThis.fetch = originalFetch;
    }
    expect(completed).toBe(true);
    expect(await actual.db.select().from(matches).where(eq(matches.id, matchId))).toHaveLength(0);
    expect(await actual.db.select().from(entries).where(inArray(entries.id, ids))).toHaveLength(0);
    expect(await actual.db.select().from(drafts).where(eq(drafts.matchId, matchId))).toHaveLength(0);
  }, 90_000);
});
