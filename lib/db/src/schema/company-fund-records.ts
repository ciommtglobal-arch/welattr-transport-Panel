import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, numeric, uuid, timestamp, index, uniqueIndex, unique, check, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { b2bBusinessProfilesTable } from "./b2b-business-profiles";
import { b2bCompanyMembersTable } from "./b2b-company-management";
import { fundAmendmentReleasePlan } from "./fund-release-stage";

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
  uniqueIndex("company_fund_records_company_id_idx").on(table.businessProfileId, table.id),
  unique("company_fund_records_company_id_key").on(table.businessProfileId, table.id),
  index("company_fund_records_profile_created_idx").on(table.businessProfileId, table.createdAt, table.id),
  check("company_fund_records_positive_amount", sql`${table.amount} > 0 AND ${table.amount} <= 999999999999.99`),
  check("company_fund_records_currency", sql`${table.currency} IN ('TRY', 'EUR', 'USD')`),
]);
export const insertCompanyFundRecordSchema = createInsertSchema(companyFundRecordsTable).omit({ id: true, createdAt: true });
export type InsertCompanyFundRecord = z.infer<typeof insertCompanyFundRecordSchema>;
export type CompanyFundRecord = typeof companyFundRecordsTable.$inferSelect;

// Append-only audit edge. A record can have only one successor (or cancellation).
// The write API checks real, validated composite FKs inside its transaction.
// Keys-first release defers ONLY these two new relationships; all other
// restrictions remain. Phase 2 provides cross-company protection at DB level.
export const companyFundAmendmentsTable = pgTable("company_fund_amendments", {
  id: serial("id").primaryKey(),
  businessProfileId: integer("business_profile_id").notNull()
    .references(() => b2bBusinessProfilesTable.id, { onDelete: "restrict" }),
  originalRecordId: integer("original_record_id").notNull(),
  replacementRecordId: integer("replacement_record_id"),
  kind: text("kind").notNull(),
  reason: text("reason").notNull(),
  requestKey: uuid("request_key").notNull(),
  authorMemberId: integer("author_member_id").notNull()
    .references(() => b2bCompanyMembersTable.id, { onDelete: "restrict" }),
  authorName: text("author_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("company_fund_amendments_request_idx").on(table.businessProfileId, table.requestKey),
  uniqueIndex("company_fund_amendments_original_idx").on(table.originalRecordId),
  uniqueIndex("company_fund_amendments_replacement_idx").on(table.replacementRecordId),
  index("company_fund_amendments_company_idx").on(table.businessProfileId),
  ...(fundAmendmentReleasePlan.stage === "relationships" ? [
  foreignKey({ columns: [table.businessProfileId, table.originalRecordId],
    foreignColumns: [companyFundRecordsTable.businessProfileId, companyFundRecordsTable.id],
    name: "company_fund_amendments_original_fk" }).onDelete("restrict"),
  foreignKey({ columns: [table.businessProfileId, table.replacementRecordId],
    foreignColumns: [companyFundRecordsTable.businessProfileId, companyFundRecordsTable.id],
    name: "company_fund_amendments_replacement_fk" }).onDelete("restrict"),
  ] : []),
  // Also blocks inserts from the OLD application during the first Publish.
  // A non-null primary key cannot differ from itself. Avoid a literal false:
  // the managed diff renderer double-wraps that simple CHECK incorrectly.
  ...(fundAmendmentReleasePlan.stage === "keys-first" ? [
    check("company_fund_amendments_release_closed", sql`${table.id} <> ${table.id}`),
  ] : []),
  check("company_fund_amendments_kind", sql`(${table.kind} = 'duzeltme' AND ${table.replacementRecordId} IS NOT NULL AND ${table.replacementRecordId} > ${table.originalRecordId}) OR (${table.kind} = 'iptal' AND ${table.replacementRecordId} IS NULL)`),
  check("company_fund_amendments_reason", sql`length(trim(${table.reason})) BETWEEN 5 AND 2000`),
]);
export const insertCompanyFundAmendmentSchema = createInsertSchema(companyFundAmendmentsTable).omit({ id: true, createdAt: true });
export type CompanyFundAmendment = typeof companyFundAmendmentsTable.$inferSelect;