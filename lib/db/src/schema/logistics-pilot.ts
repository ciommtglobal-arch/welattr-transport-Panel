import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, integer, uniqueIndex, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Separate TEST-only aggregates: no writes/FKs to customers, shipments or staff grants.
export const logisticsPilotFilesTable = pgTable("logistics_pilot_files", {
  reference: text("reference").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  reviewState: text("review_state").notNull().default("draft"),
  decisionNote: text("decision_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  check("pilot_exact_test_reference", sql`${t.reference} = 'UKR-MERSİN-NARENCİYE-001'`),
  check("pilot_review_state", sql`${t.reviewState} IN ('draft','review_requested','changes_requested','approved_test')`),
]);

export const logisticsPilotInvitesTable = pgTable("logistics_pilot_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: text("reference").notNull().references(() => logisticsPilotFilesTable.reference),
  targetUserId: text("target_user_id").notNull(),
  role: text("role").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("pilot_invite_token_unique").on(t.tokenHash),
  check("pilot_invite_role", sql`${t.role} IN ('worker','reviewer')`),
]);

export const logisticsPilotTasksTable = pgTable("logistics_pilot_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: text("reference").notNull().references(() => logisticsPilotFilesTable.reference),
  title: text("title").notNull(),
  assignedTo: text("assigned_to").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("assigned"),
  revisionNote: text("revision_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [check("pilot_task_status", sql`${t.status} IN ('assigned','submitted','revision_requested','accepted')`)]);

export const logisticsPilotSubmissionsTable = pgTable("logistics_pilot_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => logisticsPilotTasksTable.id),
  revision: integer("revision").notNull(),
  content: text("content").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("pilot_task_revision_unique").on(t.taskId, t.revision)]);

export const logisticsPilotEventsTable = pgTable("logistics_pilot_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: text("reference").notNull().references(() => logisticsPilotFilesTable.reference),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLogisticsPilotFileSchema = createInsertSchema(logisticsPilotFilesTable);
export const insertLogisticsPilotInviteSchema = createInsertSchema(logisticsPilotInvitesTable);
export const insertLogisticsPilotTaskSchema = createInsertSchema(logisticsPilotTasksTable);
export const insertLogisticsPilotSubmissionSchema = createInsertSchema(logisticsPilotSubmissionsTable);
export const insertLogisticsPilotEventSchema = createInsertSchema(logisticsPilotEventsTable);
export type LogisticsPilotFile = typeof logisticsPilotFilesTable.$inferSelect;
export type LogisticsPilotInvite = typeof logisticsPilotInvitesTable.$inferSelect;
export type LogisticsPilotTask = typeof logisticsPilotTasksTable.$inferSelect;
export type LogisticsPilotSubmission = typeof logisticsPilotSubmissionsTable.$inferSelect;
export type LogisticsPilotEvent = typeof logisticsPilotEventsTable.$inferSelect;
