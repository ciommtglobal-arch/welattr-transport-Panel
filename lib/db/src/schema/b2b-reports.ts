import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { b2bBusinessProfilesTable } from "./b2b-business-profiles";
import { b2bListingsTable } from "./b2b-listings";

export const b2bReportCategoryEnum = pgEnum("b2b_report_category", [
  "misleading_information",
  "fraud_or_scam",
  "inappropriate_content",
  "spam",
  "contact_issue",
  "other",
]);

export const b2bReportStatusEnum = pgEnum("b2b_report_status", [
  "pending",
  "reviewing",
  "resolved",
  "dismissed",
]);

export const b2bReportsTable = pgTable(
  "b2b_reports",
  {
    id: serial("id").primaryKey(),
    referenceCode: text("reference_code").notNull(),
    reporterClerkUserId: text("reporter_clerk_user_id"),
    listingId: integer("listing_id").references(() => b2bListingsTable.id, {
      onDelete: "set null",
    }),
    businessProfileId: integer("business_profile_id").references(
      () => b2bBusinessProfilesTable.id,
      { onDelete: "set null" },
    ),
    listingReferenceCode: text("listing_reference_code").notNull(),
    listingTitle: text("listing_title").notNull(),
    organization: text("organization").notNull(),
    category: b2bReportCategoryEnum("category").notNull(),
    details: text("details").notNull(),
    status: b2bReportStatusEnum("status").notNull().default("pending"),
    internalNote: text("internal_note"),
    reviewerClerkUserId: text("reviewer_clerk_user_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("b2b_reports_reference_code_idx").on(table.referenceCode),
    index("b2b_reports_status_idx").on(table.status),
    index("b2b_reports_listing_idx").on(table.listingId),
    index("b2b_reports_business_profile_idx").on(table.businessProfileId),
    index("b2b_reports_created_at_idx").on(table.createdAt),
  ],
);

export const insertB2BReportSchema = createInsertSchema(b2bReportsTable).omit({
  id: true,
  referenceCode: true,
  reporterClerkUserId: true,
  listingReferenceCode: true,
  listingTitle: true,
  organization: true,
  status: true,
  internalNote: true,
  reviewerClerkUserId: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type B2BReport = typeof b2bReportsTable.$inferSelect;
export type InsertB2BReport = z.infer<typeof insertB2BReportSchema>;