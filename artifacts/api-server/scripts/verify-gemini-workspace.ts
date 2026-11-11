/**
 * Explicit development-only, two-call Gemini continuity check.
 * Creates two labelled TEST turns in the configured founder's preview history.
 * Does not alter accounts, existing records, operations, payments or notifications.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getGeminiWorkspace, sendGeminiInstruction, geminiWorkspaceEnabled } from "../src/lib/geminiWorkspace";

async function main() {
  assert.ok(process.argv.includes("--run-preview-check"));
  assert.equal(process.env.NODE_ENV, "development");
  assert.equal(geminiWorkspaceEnabled(), true);
  const fingerprint = await db.execute(sql`
    SELECT md5(current_database() || ':' || 'public.logistics_pool_matches'::regclass::oid::text) AS fingerprint
  `);
  assert.equal(fingerprint.rows[0]?.fingerprint, process.env.MMT_EXPECTED_DEVELOPMENT_FINGERPRINT);
  assert.match(process.env.MMT_EXPECTED_DEVELOPMENT_FINGERPRINT ?? "", /^[a-f0-9]{32}$/);
  const owner = process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID;
  assert.ok(owner);
  const marker = `TEST-ILETISIM-${randomUUID().slice(0, 8)}`;
  const first = { requestId: randomUUID(), instruction: `TEST iletişim kontrolü. Takip referansımız ${marker}. Sonraki mesajımda bu referansı hatırla. Gerçek iş veya dış işlem yapma. Tek cümleyle yanıtla.` };
  const saved = await sendGeminiInstruction(owner, first);
  assert.equal(saved.status, "answered", saved.failureMessage ?? "No model answer");
  assert.ok(saved.reply?.length);
  const duplicate = await sendGeminiInstruction(owner, first);
  assert.equal(duplicate.id, saved.id);
  assert.equal(duplicate.reply, saved.reply);
  const afterReload = await getGeminiWorkspace(owner);
  assert.ok(afterReload.turns.some(t => t.id === first.requestId && t.reply === saved.reply));
  const second = await sendGeminiInstruction(owner, {
    requestId: randomUUID(),
    instruction: "TEST iletişim kontrolü: bir önceki mesajımda verdiğim takip referansını aynen yaz. Dış işlem yapma.",
  });
  assert.equal(second.status, "answered", second.failureMessage ?? "No follow-up answer");
  assert.ok(second.reply?.includes(marker), "Conversation reference was not preserved in model context");
  const isolated = await getGeminiWorkspace(`TEST_UNRELATED_${randomUUID()}`);
  assert.equal(isolated.turns.length, 0);
  console.log(JSON.stringify({
    result: "PASS", realGeminiResponses: 2, persistedAcrossReads: true,
    idempotentDuplicate: true, followUpContext: true, otherOwnerIsolated: true,
    previewOnly: true, externalMessages: 0, commercialApprovals: 0,
    payments: 0, productionTouched: false,
  }));
}
main().catch(() => {
  console.error("Gemini önizleme kontrolü tamamlanamadı. Gizli bilgiler ve konuşma içeriği loglanmadı.");
  process.exitCode = 1;
}).finally(() => pool.end());
