import { integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const nexusApprovalStatus = pgEnum("nexus_approval_status", [
  "PENDING_FOUNDER_APPROVAL", "FOUNDER_APPROVED", "FOUNDER_REJECTED",
]);
export const nexusShopifyEventsTable = pgTable("nexus_shopify_events", {
  id: serial("id").primaryKey(),
  shopDomain: text("shop_domain").notNull(),
  webhookId: text("webhook_id").notNull(),
  topic: text("topic").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("nexus_shopify_event_unique").on(t.shopDomain, t.webhookId)]);

// Separate intake records: existing orders, finance applications and fund ledgers are not changed.
export const nexusShopifyIntakesTable = pgTable("nexus_shopify_intakes", {
  id: serial("id").primaryKey(),
  shopDomain: text("shop_domain").notNull(),
  orderId: text("order_id").notNull(),
  orderName: text("order_name").notNull(),
  lineId: text("line_id").notNull(),
  variantId: text("variant_id").notNull(),
  kind: text("kind").$type<"reservation" | "financing_interest">().notNull(),
  productTitle: text("product_title").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: text("unit_price").notNull(),
  currency: text("currency").notNull(),
  financialStatus: text("financial_status").notNull(),
  cancelled: integer("cancelled").notNull().default(0),
  warning: text("warning"),
  corridor: text("corridor"),
  status: nexusApprovalStatus("status").notNull().default("PENDING_FOUNDER_APPROVAL"),
  reviewedSourceHash: text("reviewed_source_hash"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
  publishedSourceHash: text("published_source_hash"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: text("published_by"),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("nexus_shopify_intake_unique").on(t.shopDomain, t.orderId, t.lineId)]);
