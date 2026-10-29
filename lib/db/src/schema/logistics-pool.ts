import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

export type PoolPayload = {
  is_market_feed?: boolean; vehicleType?: string; vehicleTypes?: string[]; cargoType?: string; parserMissing?: string[]; marketOccurredAt?: string;
  quotedPriceMinor?: number; currency?: string; commissionBps?: number;
  role: "buyer" | "seller" | "carrier" | "load";
  name: string; location: string; origin: string; destination: string;
  products: string[]; transportMode: string; capacityKg: number | null;
  requiredKg: number | null; volumeM3: number | null;
  availableDate: string | null; requiredDate: string | null;
  contact: string; reference: string; sourceUrl: string | null;
  isTest: boolean; verified: boolean; eligible: boolean;
};
export const logisticsPoolSourcesTable = pgTable("logistics_pool_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(), url: text("url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  consentBy: text("consent_by").notNull(),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("logistics_pool_source_url_unique").on(t.url)]);
export const logisticsPoolEntriesTable = pgTable("logistics_pool_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  originKey: text("origin_key").notNull(),
  sourceId: uuid("source_id").references(() => logisticsPoolSourcesTable.id),
  sourceKind: text("source_kind").notNull(),
  payload: jsonb("payload").$type<PoolPayload>().notNull(),
  fingerprint: text("fingerprint").notNull(),
  active: boolean("active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("logistics_pool_origin_unique").on(t.originKey)]);
export type PoolReviewEvent = { at: string; action: string; actorUserId: string | null; note: string };
export const logisticsPoolMatchesTable = pgTable("logistics_pool_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchKey: text("match_key").notNull(),
  entryIds: uuid("entry_ids").array().notNull(),
  snapshotHash: text("snapshot_hash").notNull(),
  status: text("status").notNull().default("pending"),
  version: integer("version").notNull().default(1),
  score: integer("score").notNull(),
  reasons: text("reasons").array().notNull(),
  missing: text("missing").array().notNull(),
  introduction: text("introduction").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  events: jsonb("events").$type<PoolReviewEvent[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("logistics_pool_match_unique").on(t.matchKey)]);
export const logisticsPoolAiDraftsTable = pgTable("logistics_pool_ai_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").notNull().references(() => logisticsPoolMatchesTable.id, { onDelete: "cascade" }),
  matchVersion: integer("match_version").notNull(),
  snapshotHash: text("snapshot_hash").notNull(),
  summary: text("summary").notNull(),
  introductionDraft: text("introduction_draft").notNull(),
  missingChecks: text("missing_checks").array().notNull().default([]),
  origin: text("origin").notNull().default("background_worker"),
  status: text("status").notNull().default("pending_review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("logistics_pool_ai_draft_match_version_unique").on(t.matchId, t.matchVersion)]);
export const logisticsPoolDraftNotificationsTable = pgTable("logistics_pool_draft_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  draftId: uuid("draft_id").notNull().references(() => logisticsPoolAiDraftsTable.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("telegram"),
  status: text("status").notNull().default("dry_run"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("logistics_pool_draft_notification_unique").on(t.draftId, t.channel),
  check("logistics_pool_draft_notifications_telegram_only", sql`${t.channel} = 'telegram'`),
  check("logistics_pool_draft_notifications_dry_run_only", sql`${t.status} = 'dry_run'`),
]);
export const insertLogisticsPoolSourceSchema = createInsertSchema(logisticsPoolSourcesTable);
export const insertLogisticsPoolEntrySchema = createInsertSchema(logisticsPoolEntriesTable);
export const insertLogisticsPoolMatchSchema = createInsertSchema(logisticsPoolMatchesTable);
export const insertLogisticsPoolAiDraftSchema = createInsertSchema(logisticsPoolAiDraftsTable);
export const insertLogisticsPoolDraftNotificationSchema = createInsertSchema(logisticsPoolDraftNotificationsTable);
