import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffUsersTable } from "./limit-applications";

export const staffRewardPlanStatusEnum = pgEnum("staff_reward_plan_status", [
  "draft",
  "active",
  "paused",
]);

export const staffRewardTransactionKindEnum = pgEnum(
  "staff_reward_transaction_kind",
  ["points", "cash", "holiday_package", "international_trip"],
);

export const staffRewardTransactionStatusEnum = pgEnum(
  "staff_reward_transaction_status",
  ["approved", "pending_approval", "rejected"],
);

export const staffRewardPlansTable = pgTable(
  "staff_reward_plans",
  {
    id: serial("id").primaryKey(),
    staffUserId: integer("staff_user_id")
      .notNull()
      .references(() => staffUsersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    monthlyPoints: integer("monthly_points").notNull().default(0),
    monthlyCashAmount: numeric("monthly_cash_amount", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    currency: text("currency").notNull().default("TRY"),
    holidayPackageBudget: numeric("holiday_package_budget", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    internationalTravelBudget: numeric("international_travel_budget", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    customBenefits: text("custom_benefits").array().notNull().default([]),
    status: staffRewardPlanStatusEnum("status").notNull().default("active"),
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
    index("staff_reward_plans_staff_idx").on(table.staffUserId),
    index("staff_reward_plans_status_idx").on(table.status),
  ],
);

export const staffRewardTransactionsTable = pgTable(
  "staff_reward_transactions",
  {
    id: serial("id").primaryKey(),
    staffUserId: integer("staff_user_id")
      .notNull()
      .references(() => staffUsersTable.id, { onDelete: "cascade" }),
    planId: integer("plan_id").references(() => staffRewardPlansTable.id, {
      onDelete: "set null",
    }),
    kind: staffRewardTransactionKindEnum("kind").notNull(),
    pointsDelta: integer("points_delta").notNull().default(0),
    cashAmount: numeric("cash_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    currency: text("currency").notNull().default("TRY"),
    title: text("title").notNull(),
    reason: text("reason").notNull().default(""),
    status: staffRewardTransactionStatusEnum("status")
      .notNull()
      .default("pending_approval"),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    approvedByClerkUserId: text("approved_by_clerk_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("staff_reward_transactions_staff_idx").on(table.staffUserId),
    index("staff_reward_transactions_status_idx").on(table.status),
  ],
);

export const insertStaffRewardPlanSchema = createInsertSchema(
  staffRewardPlansTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffRewardTransactionSchema = createInsertSchema(
  staffRewardTransactionsTable,
).omit({
  id: true,
  createdAt: true,
});

export type StaffRewardPlan = typeof staffRewardPlansTable.$inferSelect;
export type InsertStaffRewardPlan = z.infer<typeof insertStaffRewardPlanSchema>;
export type StaffRewardTransaction =
  typeof staffRewardTransactionsTable.$inferSelect;
export type InsertStaffRewardTransaction = z.infer<
  typeof insertStaffRewardTransactionSchema
>;