import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { b2bBusinessProfilesTable } from "./b2b-business-profiles";

export const workflowEntityTypeEnum = pgEnum("workflow_entity_type", [
  "company_task",
  "company_request",
  "business_profile",
  "limit_application",
  "b2b_listing",
  "b2b_request",
  "b2b_report",
  "media_item",
  "media_delivery",
  "logistics_offer",
]);

export const workflowRiskCategoryEnum = pgEnum("workflow_risk_category", [
  "none",
  "financial",
  "legal",
  "external",
  "delete",
  "permission",
]);

export const workflowApprovalStatusEnum = pgEnum("workflow_approval_status", [
  "pending_reviewer",
  "pending_owner",
  "auto_approved",
  "approved",
  "rejected",
  "expired",
]);

export const workflowNotificationTypeEnum = pgEnum(
  "workflow_notification_type",
  ["approval", "risk", "deadline", "rating"],
);

export const workflowApprovalsTable = pgTable(
  "workflow_approvals",
  {
    id: serial("id").primaryKey(),
    businessProfileId: integer("business_profile_id").references(
      () => b2bBusinessProfilesTable.id,
      { onDelete: "cascade" },
    ),
    entityType: workflowEntityTypeEnum("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    submittedByClerkUserId: text("submitted_by_clerk_user_id"),
    ownerClerkUserId: text("owner_clerk_user_id"),
    reviewerClerkUserId: text("reviewer_clerk_user_id"),
    ownerDecisionByClerkUserId: text("owner_decision_by_clerk_user_id"),
    riskCategory: workflowRiskCategoryEnum("risk_category")
      .notNull()
      .default("none"),
    riskReason: text("risk_reason"),
    status: workflowApprovalStatusEnum("status")
      .notNull()
      .default("pending_reviewer"),
    reviewerDecisionAt: timestamp("reviewer_decision_at", {
      withTimezone: true,
    }),
    ownerDecisionAt: timestamp("owner_decision_at", { withTimezone: true }),
    decisionDueAt: timestamp("decision_due_at", { withTimezone: true }),
    autoDecisionAt: timestamp("auto_decision_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("workflow_approvals_profile_idx").on(table.businessProfileId),
    index("workflow_approvals_entity_idx").on(table.entityType, table.entityId),
    index("workflow_approvals_status_idx").on(table.status),
    index("workflow_approvals_due_idx").on(table.decisionDueAt),
  ],
);

export const workflowNotificationsTable = pgTable(
  "workflow_notifications",
  {
    id: serial("id").primaryKey(),
    recipientClerkUserId: text("recipient_clerk_user_id").notNull(),
    type: workflowNotificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    approvalId: integer("approval_id").references(
      () => workflowApprovalsTable.id,
      { onDelete: "cascade" },
    ),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workflow_notifications_recipient_idx").on(
      table.recipientClerkUserId,
    ),
    index("workflow_notifications_unread_idx").on(
      table.recipientClerkUserId,
      table.readAt,
    ),
  ],
);

export const insertWorkflowApprovalSchema = createInsertSchema(
  workflowApprovalsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowNotificationSchema = createInsertSchema(
  workflowNotificationsTable,
).omit({
  id: true,
  createdAt: true,
});

export type WorkflowApproval = typeof workflowApprovalsTable.$inferSelect;
export type InsertWorkflowApproval = z.infer<
  typeof insertWorkflowApprovalSchema
>;
export type WorkflowNotification = typeof workflowNotificationsTable.$inferSelect;
export type InsertWorkflowNotification = z.infer<
  typeof insertWorkflowNotificationSchema
>;