import { pgEnum, pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const constructionQuoteStatusEnum = pgEnum("construction_quote_status", ["new", "reviewing", "quoted", "closed"]);
export const constructionQuotesTable = pgTable("construction_quotes", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull(),
  quantity: integer("quantity").notNull(),
  dimensions: text("dimensions").notNull(),
  deliveryLocation: text("delivery_location").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  productId: text("product_id"),
  variantId: text("variant_id"),
  notes: text("notes"),
  status: constructionQuoteStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [uniqueIndex("construction_quotes_reference_idx").on(table.reference)]);

export const insertConstructionQuoteSchema = createInsertSchema(constructionQuotesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertConstructionQuote = z.infer<typeof insertConstructionQuoteSchema>;
export type ConstructionQuote = typeof constructionQuotesTable.$inferSelect;