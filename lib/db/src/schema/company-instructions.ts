import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { b2bBusinessProfilesTable } from "./b2b-business-profiles";
import { b2bCompanyMembersTable } from "./b2b-company-management";

export const companyInstructionsTable = pgTable("company_instructions", {
  id: serial("id").primaryKey(),
  businessProfileId: integer("business_profile_id").notNull()
    .references(() => b2bBusinessProfilesTable.id, { onDelete: "restrict" }),
  institution: text("institution").notNull(),
  content: text("content").notNull(),
  operationType: text("operation_type").notNull(),
  authorMemberId: integer("author_member_id").notNull()
    .references(() => b2bCompanyMembersTable.id, { onDelete: "restrict" }),
  authorName: text("author_name").notNull(),
  signatureLabel: text("signature_label").notNull().default("WelatTR"),
  ecosystemLabel: text("ecosystem_label").notNull().default("Çelik Kubbe"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("company_instructions_profile_created_idx").on(table.businessProfileId, table.createdAt, table.id),
]);

export const insertCompanyInstructionSchema = createInsertSchema(companyInstructionsTable).omit({
  id: true, createdAt: true,
});
export type InsertCompanyInstruction = z.infer<typeof insertCompanyInstructionSchema>;
export type CompanyInstruction = typeof companyInstructionsTable.$inferSelect;