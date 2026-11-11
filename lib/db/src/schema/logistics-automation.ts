import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, boolean, timestamp, jsonb, uuid, uniqueIndex, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { logisticsRequestsTable } from "./logistics-operations";

export type AutomationEvent = { at: string; actorKind: "system" | "user"; actorUserId: string | null; action: string; detail: string };
export const logisticsAutomationJobsTable = pgTable("logistics_automation_jobs", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => logisticsRequestsTable.id),
  isTest: boolean("is_test").notNull(),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  sourceHash: text("source_hash").notNull(),
  publicMessage: text("public_message").notNull(),
  requiredDocuments: text("required_documents").array().notNull(),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  providerMessageId: text("provider_message_id"),
  lastError: text("last_error"),
  events: jsonb("events").$type<AutomationEvent[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("logistics_automation_request_unique").on(t.requestId),
  check("logistics_automation_status_check", sql`${t.status} IN ('draft','verified','approved','sending','sent','failed','uncertain')`),
]);
export const logisticsAutomationDocumentsTable = pgTable("logistics_automation_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: integer("job_id").notNull().references(() => logisticsAutomationJobsTable.id),
  kind: text("kind").notNull(),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  generation: text("generation"),
  checksum: text("checksum"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("logistics_automation_object_unique").on(t.objectPath)]);
export const insertLogisticsAutomationJobSchema = createInsertSchema(logisticsAutomationJobsTable);
export const insertLogisticsAutomationDocumentSchema = createInsertSchema(logisticsAutomationDocumentsTable);
export type LogisticsAutomationJob = typeof logisticsAutomationJobsTable.$inferSelect;
export type LogisticsAutomationDocument = typeof logisticsAutomationDocumentsTable.$inferSelect;
