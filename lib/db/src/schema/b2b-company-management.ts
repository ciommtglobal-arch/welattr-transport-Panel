import {
  date,
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

export const b2bCompanyMemberRoleEnum = pgEnum("b2b_company_member_role", [
  "owner",
  "admin",
  "manager",
  "member",
]);

export const b2bCompanyMemberStatusEnum = pgEnum("b2b_company_member_status", [
  "invited",
  "active",
  "revoked",
]);

export const b2bCompanyTaskStatusEnum = pgEnum("b2b_company_task_status", [
  "pending",
  "in_progress",
  "completed",
]);

export const b2bCompanyRequestStatusEnum = pgEnum("b2b_company_request_status", [
  "pending",
  "in_progress",
  "resolved",
  "rejected",
]);

export const b2bCompanyRequestPriorityEnum = pgEnum(
  "b2b_company_request_priority",
  ["normal", "urgent"],
);

export const b2bCompanyMembersTable = pgTable(
  "b2b_company_members",
  {
    id: serial("id").primaryKey(),
    businessProfileId: integer("business_profile_id")
      .notNull()
      .references(() => b2bBusinessProfilesTable.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id"),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    department: text("department"),
    jobTitle: text("job_title"),
    areas: text("areas").array().notNull().default([]),
    role: b2bCompanyMemberRoleEnum("role").notNull().default("member"),
    status: b2bCompanyMemberStatusEnum("status").notNull().default("invited"),
    inviteTokenHash: text("invite_token_hash"),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("b2b_company_members_profile_email_idx").on(
      table.businessProfileId,
      table.email,
    ),
    uniqueIndex("b2b_company_members_invite_token_idx").on(
      table.inviteTokenHash,
    ),
    index("b2b_company_members_profile_idx").on(table.businessProfileId),
    index("b2b_company_members_clerk_user_idx").on(table.clerkUserId),
  ],
);

export const b2bCompanyTasksTable = pgTable(
  "b2b_company_tasks",
  {
    id: serial("id").primaryKey(),
    businessProfileId: integer("business_profile_id")
      .notNull()
      .references(() => b2bBusinessProfilesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    area: text("area").notNull(),
    dueDate: date("due_date", { mode: "string" }),
    status: b2bCompanyTaskStatusEnum("status").notNull().default("pending"),
    assigneeMemberId: integer("assignee_member_id").references(
      () => b2bCompanyMembersTable.id,
      { onDelete: "set null" },
    ),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("b2b_company_tasks_profile_idx").on(table.businessProfileId),
    index("b2b_company_tasks_assignee_idx").on(table.assigneeMemberId),
    index("b2b_company_tasks_status_idx").on(table.status),
    index("b2b_company_tasks_due_date_idx").on(table.dueDate),
  ],
);

export const b2bCompanyRequestsTable = pgTable(
  "b2b_company_requests",
  {
    id: serial("id").primaryKey(),
    businessProfileId: integer("business_profile_id")
      .notNull()
      .references(() => b2bBusinessProfilesTable.id, { onDelete: "cascade" }),
    requesterMemberId: integer("requester_member_id")
      .notNull()
      .references(() => b2bCompanyMembersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    area: text("area").notNull(),
    priority: b2bCompanyRequestPriorityEnum("priority")
      .notNull()
      .default("normal"),
    status: b2bCompanyRequestStatusEnum("status")
      .notNull()
      .default("pending"),
    managerNote: text("manager_note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("b2b_company_requests_profile_idx").on(table.businessProfileId),
    index("b2b_company_requests_requester_idx").on(table.requesterMemberId),
    index("b2b_company_requests_status_idx").on(table.status),
  ],
);

export const insertB2BCompanyMemberSchema = createInsertSchema(
  b2bCompanyMembersTable,
).omit({
  id: true,
  invitedAt: true,
  acceptedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertB2BCompanyTaskSchema = createInsertSchema(
  b2bCompanyTasksTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertB2BCompanyRequestSchema = createInsertSchema(
  b2bCompanyRequestsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type B2BCompanyMember = typeof b2bCompanyMembersTable.$inferSelect;
export type InsertB2BCompanyMember = z.infer<
  typeof insertB2BCompanyMemberSchema
>;
export type B2BCompanyTask = typeof b2bCompanyTasksTable.$inferSelect;
export type InsertB2BCompanyTask = z.infer<typeof insertB2BCompanyTaskSchema>;
export type B2BCompanyRequest = typeof b2bCompanyRequestsTable.$inferSelect;
export type InsertB2BCompanyRequest = z.infer<
  typeof insertB2BCompanyRequestSchema
>;