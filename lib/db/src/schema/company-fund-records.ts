import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, numeric, uuid, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { b2bBusinessProfilesTable } from "./b2b-business-profiles";
import { b2bCompanyMembersTable } from "./b2b-company-management";

// An immutable internal record, NOT a loan, payment, guarantee or approval.
export const companyFundRecordsTable = pgTable("company_fund_records", {
  id: serial("id").primaryKey(),
  businessProfileId: integer("business_profile_id").notNull()
    .references(() => b2bBusinessProfilesTable.id, { onDelete: "restrict" }),
  institution: text("institution").notNull(),
  operationType: text("operation_type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  description: text("description").notNull().default(""),
  requestKey: uuid("request_key").notNull(),
  authorMemberId: integer("author_member_id").notNull()
    .references(() => b2bCompanyMembersTable.id, { onDelete: "restrict" }),
  authorName: text("author_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("company_fund_records_request_idx").on(table.businessProfileId, table.requestKey),
  index("company_fund_records_profile_created_idx").on(table.businessProfileId, table.createdAt, table.id),
  check("company_fund_records_positive_amount", sql`${table.amount} > 0 AND ${table.amount} <= 999999999999.99`),
  check("company_fund_records_currency", sql`${table.currency} IN ('TRY', 'EUR', 'USD')`),
]);
export const insertCompanyFundRecordSchema = createInsertSchema(companyFundRecordsTable).omit({ id: true, createdAt: true });
export type InsertCompanyFundRecord = z.infer<typeof insertCompanyFundRecordSchema>;
export type CompanyFundRecord = typeof companyFundRecordsTable.$inferSelect;