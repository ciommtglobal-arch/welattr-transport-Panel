import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export type PoolPayload = {
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
export const insertLogisticsPoolSourceSchema = createInsertSchema(logisticsPoolSourcesTable);
export const insertLogisticsPoolEntrySchema = createInsertSchema(logisticsPoolEntriesTable);
export const insertLogisticsPoolMatchSchema = createInsertSchema(logisticsPoolMatchesTable);
