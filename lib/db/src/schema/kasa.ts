import { boolean, check, index, integer, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Separate product namespace; no staff, company or existing payment grants.
export const kasaBranchesTable = pgTable("kasa_branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
}, (t) => [
  uniqueIndex("kasa_branch_name_unique").on(t.name),
  check("kasa_branch_name_nonempty", sql`length(trim(${t.name})) between 1 and 100`),
]);

export const kasaUsersTable = pgTable("kasa_users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").$type<"admin" | "cashier">().notNull(),
  branchId: integer("branch_id").references(() => kasaBranchesTable.id),
  active: boolean("active").notNull().default(true),
  owner: boolean("owner").notNull().default(false),
}, (t) => [
  check("kasa_role_valid", sql`${t.role} in ('admin','cashier')`),
  check("kasa_cashier_has_branch", sql`${t.role} <> 'cashier' or ${t.branchId} is not null`),
  check("kasa_owner_is_active_admin", sql`not ${t.owner} or (${t.active} and ${t.role} = 'admin')`),
  uniqueIndex("kasa_single_owner").on(t.owner).where(sql`${t.owner} = true`),
]);

export const kasaRequestsTable = pgTable("kasa_requests", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  cashierId: integer("cashier_id").notNull().references(() => kasaUsersTable.id),
  branchId: integer("branch_id").notNull().references(() => kasaBranchesTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").$type<"TRY" | "EUR" | "USD">().notNull(),
  status: text("status").$type<"PENDING" | "COMPLETED" | "CANCELLED">().notNull().default("PENDING"),
  note: text("note").notNull().default(""),
  providerReference: text("provider_reference"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: integer("cancelled_by").references(() => kasaUsersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("kasa_request_cashier").on(t.cashierId),
  index("kasa_request_branch_date").on(t.branchId, t.createdAt),
  check("kasa_amount_positive", sql`${t.amount} > 0`),
  check("kasa_currency_valid", sql`${t.currency} in ('TRY','EUR','USD')`),
  check("kasa_status_valid", sql`${t.status} in ('PENDING','COMPLETED','CANCELLED')`),
  check("kasa_completed_requires_evidence", sql`${t.status} <> 'COMPLETED' or (length(trim(${t.providerReference})) > 0 and ${t.providerReference} is not null and ${t.verifiedAt} is not null and ${t.completedAt} is not null)`),
  check("kasa_cancelled_requires_evidence", sql`(${t.status} = 'CANCELLED' and ${t.cancelledAt} is not null and ${t.cancelledBy} is not null and ${t.providerReference} is null and ${t.verifiedAt} is null and ${t.completedAt} is null) or (${t.status} <> 'CANCELLED' and ${t.cancelledAt} is null and ${t.cancelledBy} is null)`),
]);

export const kasaAuditTable = pgTable("kasa_audit", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").notNull().references(() => kasaUsersTable.id),
  action: text("action").notNull(),
  entityId: integer("entity_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertKasaBranchSchema = createInsertSchema(kasaBranchesTable).omit({ id: true });
export const insertKasaUserSchema = createInsertSchema(kasaUsersTable).omit({ id: true });
export const insertKasaRequestSchema = createInsertSchema(kasaRequestsTable).omit({ id: true, createdAt: true });
export type KasaMember = typeof kasaUsersTable.$inferSelect;