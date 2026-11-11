import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const staffTrialTaskStatusEnum = pgEnum("staff_trial_task_status", [
  "open",
  "in_progress",
  "blocked",
  "completed",
]);

export const staffTrialCandidatesTable = pgTable(
  "staff_trial_candidates",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    verifiedEmail: text("verified_email").notNull(),
    active: boolean("active").notNull().default(true),
    evaluationNote: text("evaluation_note"),
    grantedByClerkUserId: text("granted_by_clerk_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("staff_trial_candidates_clerk_user_id_idx").on(
      table.clerkUserId,
    ),
    index("staff_trial_candidates_active_idx").on(table.active),
  ],
);

export const staffTrialTasksTable = pgTable(
  "staff_trial_tasks",
  {
    id: serial("id").primaryKey(),
    candidateId: integer("candidate_id")
      .notNull()
      .references(() => staffTrialCandidatesTable.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    status: staffTrialTaskStatusEnum("status").notNull().default("open"),
    resultText: text("result_text"),
    supportReceived: boolean("support_received").notNull().default(false),
    supportDetails: text("support_details"),
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
    index("staff_trial_tasks_candidate_idx").on(table.candidateId),
    index("staff_trial_tasks_created_at_idx").on(table.createdAt),
  ],
);

export const staffTrialReportsTable = pgTable(
  "staff_trial_reports",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => staffTrialTasksTable.id, { onDelete: "restrict" }),
    authorClerkUserId: text("author_clerk_user_id").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("staff_trial_reports_task_idx").on(table.taskId),
    index("staff_trial_reports_author_idx").on(table.authorClerkUserId),
    index("staff_trial_reports_created_at_idx").on(table.createdAt),
  ],
);

export type StaffTrialCandidate =
  typeof staffTrialCandidatesTable.$inferSelect;
export type StaffTrialTask = typeof staffTrialTasksTable.$inferSelect;
export type StaffTrialReport = typeof staffTrialReportsTable.$inferSelect;