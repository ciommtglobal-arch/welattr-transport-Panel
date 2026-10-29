import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Founder-owned preview conversations; never used as a commercial approval queue.
export const geminiWorkspaceTurnsTable = pgTable("gemini_workspace_turns", {
  id: uuid("id").primaryKey(),
  ownerClerkUserId: text("owner_clerk_user_id").notNull(),
  instruction: text("instruction").notNull(),
  reply: text("reply"),
  status: text("status").$type<"pending" | "answered" | "failed">().notNull().default("pending"),
  failureMessage: text("failure_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("gemini_workspace_owner_created_idx").on(t.ownerClerkUserId, t.createdAt),
  uniqueIndex("gemini_workspace_one_pending_idx").on(t.ownerClerkUserId).where(sql`${t.status} = 'pending'`),
  check("gemini_workspace_status_check", sql`${t.status} IN ('pending','answered','failed')`),
]);

export const insertGeminiWorkspaceTurnSchema = createInsertSchema(geminiWorkspaceTurnsTable);
export type GeminiWorkspaceTurn = typeof geminiWorkspaceTurnsTable.$inferSelect;
