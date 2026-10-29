import { pool } from "@workspace/db";
import { LogisticsPoolAiDraftError } from "./logisticsPoolAiDraft";

/** Cross-instance, session-scoped lock; no new schema or connection pool. */
export async function withManualDraftLock<T>(matchId: string, work: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  const key = `mmt-manual-draft:${matchId}`;
  let locked = false;
  let destroy = false;
  try {
    const result = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(4135533, hashtext($1)) AS locked", [key],
    );
    locked = result.rows[0]?.locked === true;
    if (!locked) throw new LogisticsPoolAiDraftError(409, "Bu eşleşmenin taslağı hazırlanıyor; tekrar tetiklemeyin.");
    return await work();
  } finally {
    if (locked) {
      try { await client.query("SELECT pg_advisory_unlock(4135533, hashtext($1))", [key]); }
      catch { destroy = true; }
    }
    client.release(destroy);
  }
}
