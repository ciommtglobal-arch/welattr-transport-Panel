import {
  boolean,
  index,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffProfileStatusEnum = pgEnum("staff_profile_status", [
  "draft",
  "verified",
  "archived",
]);

export const staffProfilesTable = pgTable(
  "staff_profiles",
  {
    id: serial("id").primaryKey(),
    internalId: text("internal_id").notNull(),
    fullName: text("full_name").notNull(),
    contactEmail: text("contact_email"),
    proposedRole: text("proposed_role").notNull(),
    profileStatus: staffProfileStatusEnum("profile_status")
      .notNull()
      .default("draft"),
    languages: text("languages").array().notNull(),
    educationSummary: text("education_summary").notNull(),
    businessSummary: text("business_summary").notNull(),
    additionalResponsibility: text("additional_responsibility"),
    approvalRequired: boolean("approval_required").notNull().default(true),
    supportRequested: boolean("support_requested").notNull().default(false),
    supportNote: text("support_note"),
    publicVisibility: boolean("public_visibility").notNull().default(false),
    verificationNote: text("verification_note"),
    createdByClerkUserId: text("created_by_clerk_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("staff_profiles_internal_id_idx").on(table.internalId),
    index("staff_profiles_status_idx").on(table.profileStatus),
  ],
);

export const insertStaffProfileSchema = createInsertSchema(
  staffProfilesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type StaffProfile = typeof staffProfilesTable.$inferSelect;
export type InsertStaffProfile = z.infer<typeof insertStaffProfileSchema>;