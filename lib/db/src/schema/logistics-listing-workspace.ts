import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { b2bListingsTable } from "./b2b-listings";

// Independent capability: never creates or changes a staff/company/Kasa role.
export const logisticsListingGrantsTable = pgTable("logistics_listing_grants", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  verifiedEmail: text("verified_email").notNull(),
  displayName: text("display_name").notNull(),
  active: integer("active").notNull().default(1),
  assignedBy: text("assigned_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("logistics_listing_grants_user_idx").on(table.clerkUserId)]);

export const logisticsListingDraftsTable = pgTable("logistics_listing_drafts", {
  id: serial("id").primaryKey(),
  authorClerkUserId: text("author_clerk_user_id").notNull(),
  title: text("title").notNull(),
  fullName: text("full_name").notNull().default(""),
  organization: text("organization").notNull().default(""),
  location: text("location").notNull().default(""),
  contact: text("contact").notNull().default(""),
  description: text("description").notNull().default(""),
  revision: integer("revision").notNull().default(1),
  publishedListingId: integer("published_listing_id").references(() => b2bListingsTable.id),
  publishedBy: text("published_by"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("logistics_listing_drafts_author_idx").on(table.authorClerkUserId),
  uniqueIndex("logistics_listing_drafts_published_idx").on(table.publishedListingId),
]);

export const insertLogisticsListingGrantSchema = createInsertSchema(logisticsListingGrantsTable).omit({ id: true });
export const insertLogisticsListingDraftSchema = createInsertSchema(logisticsListingDraftsTable).omit({ id: true, revision: true, publishedListingId: true, publishedBy: true, publishedAt: true, createdAt: true, updatedAt: true });
