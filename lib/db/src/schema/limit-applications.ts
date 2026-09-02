import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const limitApplicationStatusEnum = pgEnum(
  "limit_application_status",
  ["new", "reviewing", "approved", "rejected"],
);

export const limitApplicationTypeEnum = pgEnum("limit_application_type", [
  "individual",
  "commercial",
  "housing",
  "vehicle",
]);

export const staffRoleEnum = pgEnum("staff_role", [
  "admin",
  "operations",
  "reviewer",
]);

export const staffUsersTable = pgTable(
  "staff_users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    role: staffRoleEnum("role").notNull().default("reviewer"),
    active: integer("active").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("staff_users_clerk_user_id_idx").on(table.clerkUserId),
    uniqueIndex("staff_users_email_idx").on(table.email),
  ],
);

export const limitApplicationsTable = pgTable(
  "limit_applications",
  {
    id: serial("id").primaryKey(),
    referenceCode: text("reference_code").notNull(),
    applicantClerkUserId: text("applicant_clerk_user_id"),
    applicationType: limitApplicationTypeEnum("application_type")
      .notNull()
      .default("commercial"),
    fullName: text("full_name").notNull(),
    company: text("company").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    requestType: text("request_type").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    note: text("note"),
    status: limitApplicationStatusEnum("status").notNull().default("new"),
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
    uniqueIndex("limit_applications_reference_code_idx").on(
      table.referenceCode,
    ),
    index("limit_applications_status_idx").on(table.status),
    index("limit_applications_email_idx").on(table.email),
    index("limit_applications_created_at_idx").on(table.createdAt),
  ],
);

export const limitApplicationAuditLogsTable = pgTable(
  "limit_application_audit_logs",
  {
    id: serial("id").primaryKey(),
    applicationId: integer("application_id")
      .notNull()
      .references(() => limitApplicationsTable.id, { onDelete: "cascade" }),
    actorClerkUserId: text("actor_clerk_user_id"),
    action: text("action").notNull(),
    previousStatus: limitApplicationStatusEnum("previous_status"),
    nextStatus: limitApplicationStatusEnum("next_status"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("limit_application_audit_application_idx").on(table.applicationId),
    index("limit_application_audit_created_at_idx").on(table.createdAt),
  ],
);

export const insertLimitApplicationSchema = createInsertSchema(
  limitApplicationsTable,
).omit({
  id: true,
  referenceCode: true,
  status: true,
  internalNote: true,
  reviewerClerkUserId: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffUserSchema = createInsertSchema(staffUsersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LimitApplication = typeof limitApplicationsTable.$inferSelect;
export type InsertLimitApplication = z.infer<
  typeof insertLimitApplicationSchema
>;
export type StaffUser = typeof staffUsersTable.$inferSelect;
export type InsertStaffUser = z.infer<typeof insertStaffUserSchema>;