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

export const b2bBusinessProfileStatusEnum = pgEnum(
  "b2b_business_profile_status",
  ["pending", "verified", "rejected", "suspended"],
);

export const b2bBusinessProfilesTable = pgTable(
  "b2b_business_profiles",
  {
    id: serial("id").primaryKey(),
    ownerClerkUserId: text("owner_clerk_user_id").notNull(),
    legalName: text("legal_name").notNull(),
    publicName: text("public_name").notNull(),
    country: text("country").notNull(),
    registrationNumber: text("registration_number").notNull(),
    businessType: text("business_type").notNull(),
    field: text("field").notNull(),
    website: text("website"),
    contact: text("contact").notNull(),
    verificationDocumentObjectPath: text(
      "verification_document_object_path",
    ).notNull(),
    verificationDocumentFileName: text(
      "verification_document_file_name",
    ).notNull(),
    verificationDocumentContentType: text(
      "verification_document_content_type",
    ).notNull(),
    verificationDocumentSize: integer(
      "verification_document_size",
    ).notNull(),
    status: b2bBusinessProfileStatusEnum("status")
      .notNull()
      .default("pending"),
    internalNote: text("internal_note"),
    reviewerClerkUserId: text("reviewer_clerk_user_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("b2b_business_profiles_owner_idx").on(table.ownerClerkUserId),
    index("b2b_business_profiles_status_idx").on(table.status),
    index("b2b_business_profiles_country_idx").on(table.country),
    index("b2b_business_profiles_created_at_idx").on(table.createdAt),
  ],
);

export const insertB2BBusinessProfileSchema = createInsertSchema(
  b2bBusinessProfilesTable,
).omit({
  id: true,
  status: true,
  internalNote: true,
  reviewerClerkUserId: true,
  reviewedAt: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type B2BBusinessProfile = typeof b2bBusinessProfilesTable.$inferSelect;
export type InsertB2BBusinessProfile = z.infer<
  typeof insertB2BBusinessProfileSchema
>;