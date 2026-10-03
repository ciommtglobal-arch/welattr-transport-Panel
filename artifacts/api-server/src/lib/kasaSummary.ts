import { and, eq, sql, type SQL } from "drizzle-orm";
import { db, kasaRequestsTable as requests } from "@workspace/db";
import { GetKasaSummaryResponse } from "@workspace/api-zod";
import { KASA_CURRENCIES, KASA_TIMEZONE } from "./kasa";

// Shared by the screen and downloads: never convert decimal money to Number.
export async function kasaSummary(filters: { branchId?: number; date?: string }) {
  const evidence = sql`${requests.status} = 'COMPLETED' and ${requests.verifiedAt} is not null and ${requests.providerReference} is not null and ${requests.completedAt} is not null`;
  const conditions: SQL[] = [];
  if (filters.branchId) conditions.push(eq(requests.branchId, filters.branchId));
  if (filters.date) conditions.push(sql`(case when ${requests.status} = 'COMPLETED' then ${requests.completedAt} else ${requests.createdAt} end at time zone ${KASA_TIMEZONE})::date = ${filters.date}::date`);
  const rows = await db.select({
    currency: requests.currency,
    revenue: sql<string>`coalesce(sum(${requests.amount}) filter (where ${evidence}), 0)::numeric(20,2)::text`,
    pendingAmount: sql<string>`coalesce(sum(${requests.amount}) filter (where ${requests.status} = 'PENDING'), 0)::numeric(20,2)::text`,
    pendingCount: sql<number>`count(*) filter (where ${requests.status} = 'PENDING')::int`,
    completedCount: sql<number>`count(*) filter (where ${evidence})::int`,
  }).from(requests).where(and(...conditions)).groupBy(requests.currency);
  const totals = KASA_CURRENCIES.map(currency => rows.find(r => r.currency === currency) ?? {
    currency, revenue: "0.00", pendingAmount: "0.00", pendingCount: 0, completedCount: 0,
  });
  return GetKasaSummaryResponse.parse({ totals, timezone: KASA_TIMEZONE, fiscalReport: false, liveEnabled: false });
}