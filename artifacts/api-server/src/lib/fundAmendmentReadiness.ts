import { sql } from "drizzle-orm";
import type { db } from "@workspace/db";

// Check semantics, not just names. NOT VALID, deferrable, wrong-column,
// wrong-parent and non-restrict relationships must never open writes.
export const fundAmendmentReadinessQuery = sql`
  WITH expected(name, columns) AS (
    VALUES
      ('company_fund_amendments_original_fk',
       ARRAY['business_profile_id', 'original_record_id']::text[]),
      ('company_fund_amendments_replacement_fk',
       ARRAY['business_profile_id', 'replacement_record_id']::text[])
  )
  SELECT count(*) = 2 AND NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint fence
    WHERE fence.conrelid = to_regclass('public.company_fund_amendments')
      AND fence.conname = 'company_fund_amendments_release_closed'
  ) AS ready
  FROM expected e
  JOIN pg_catalog.pg_constraint c ON c.conname = e.name
  WHERE c.contype = 'f' AND c.convalidated AND NOT c.condeferrable
    AND c.conrelid = to_regclass('public.company_fund_amendments')
    AND c.confrelid = to_regclass('public.company_fund_records')
    AND c.confdeltype = 'r' AND c.confupdtype = 'a'
    AND c.confmatchtype = 's'
    AND ARRAY(
      SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n, pos)
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n
      ORDER BY k.pos
    ) = e.columns
    AND ARRAY(
      SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n, pos)
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.n
      ORDER BY k.pos
    ) = ARRAY['business_profile_id', 'id']::text[]
`;

export class FundAmendmentSchemaPending extends Error {
  constructor() {
    super("Fund amendment relationships are not verified");
    this.name = "FundAmendmentSchemaPending";
  }
}

export async function requireFundAmendmentRelationships(
  tx: Pick<typeof db, "execute">,
): Promise<void> {
  // Keep the catalog check and write in one transaction. DDL cannot remove
  // either required relationship between the check and the subsequent insert.
  await tx.execute(sql`LOCK TABLE public.company_fund_records, public.company_fund_amendments IN ROW EXCLUSIVE MODE`);
  const result = await tx.execute<{ ready: boolean }>(fundAmendmentReadinessQuery);
  if (result.rows[0]?.ready !== true) throw new FundAmendmentSchemaPending();
}
