import {
  index,
  integer,
  jsonb,
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

export const b2bListingStatusEnum = pgEnum("b2b_listing_status", [
  "pending",
  "approved",
  "rejected",
]);

export const b2bListingRoleEnum = pgEnum("b2b_listing_role", [
  "producer",
  "buyer",
  "logistics",
]);

export type B2BListingSocialLinks = {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  telegram?: string;
  tiktok?: string;
};

export const b2bListingsTable = pgTable(
  "b2b_listings",
  {
    id: serial("id").primaryKey(),
    referenceCode: text("reference_code").notNull(),
    submitterClerkUserId: text("submitter_clerk_user_id"),
    businessProfileId: integer("business_profile_id").references(
      () => b2bBusinessProfilesTable.id,
      { onDelete: "set null" },
    ),
    role: b2bListingRoleEnum("role").notNull(),
    title: text("title").notNull(),
    fullName: text("full_name").notNull(),
    organization: text("organization").notNull(),
    location: text("location").notNull(),
    contact: text("contact").notNull(),
    description: text("description").notNull(),
    website: text("website"),
    socialLinks: jsonb("social_links").$type<B2BListingSocialLinks>(),
    status: b2bListingStatusEnum("status").notNull().default("pending"),
    internalNote: text("internal_note"),
    reviewerClerkUserId: text("reviewer_clerk_user_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("b2b_listings_reference_code_idx").on(table.referenceCode),
    index("b2b_listings_business_profile_idx").on(table.businessProfileId),
    index("b2b_listings_status_idx").on(table.status),
    index("b2b_listings_role_idx").on(table.role),
    index("b2b_listings_created_at_idx").on(table.createdAt),
  ],
);

export const insertB2BListingSchema = createInsertSchema(b2bListingsTable).omit({
  id: true,
  referenceCode: true,
  status: true,
  internalNote: true,
  reviewerClerkUserId: true,
  reviewedAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type B2BListing = typeof b2bListingsTable.$inferSelect;
export type InsertB2BListing = z.infer<typeof insertB2BListingSchema>;