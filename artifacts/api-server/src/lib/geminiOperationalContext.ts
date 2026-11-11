import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Founder-only workspace context. Aggregate operational facts only:
 * never send contacts, plates, customer text or credentials to the model.
 * One statement provides a consistent snapshot; failure must not look empty.
 */
export async function getGeminiOperationalContext(): Promise<string> {
  const result = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM logistics_requests WHERE NOT is_test) AS real_loads,
      (SELECT count(*) FROM logistics_requests WHERE NOT is_test AND loading_date < CURRENT_DATE) AS past_date_loads,
      (SELECT count(*) FROM logistics_requests WHERE NOT is_test AND NOT contact_use_confirmed) AS loads_without_contact_permission,
      (SELECT count(*) FROM logistics_carriers WHERE NOT is_test) AS real_carriers,
      (SELECT count(*) FROM logistics_carriers WHERE NOT is_test AND contact_use_confirmed AND status = 'approved') AS approved_consented_carriers,
      (SELECT count(*) FROM logistics_pool_sources WHERE enabled AND consent_at IS NOT NULL) AS enabled_consented_sources,
      (SELECT count(*) FROM logistics_pool_entries WHERE active AND payload->>'isTest' = 'false' AND payload->>'eligible' = 'true') AS eligible_real_pool_entries
  `);
  const row = result.rows[0];
  const keys = [
    "real_loads", "past_date_loads", "loads_without_contact_permission",
    "real_carriers", "approved_consented_carriers", "enabled_consented_sources",
    "eligible_real_pool_entries",
  ] as const;
  if (!row) throw new Error("Operational snapshot unavailable");
  const counts: Record<string, number> = {};
  for (const key of keys) {
    const raw = row[key];
    if (raw === null || raw === undefined || !/^\d+$/.test(String(raw))) {
      throw new Error("Invalid operational count");
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) throw new Error("Invalid operational count");
    counts[key] = value;
  }
  return JSON.stringify({
    observedAt: new Date().toISOString(),
    environment: "development_preview",
    scope: "Bu ortamın TEST dışı kayıt sayıları; üretim veritabanı veya araç müsaitliği kanıtı değildir.",
    counts,
  });
}
