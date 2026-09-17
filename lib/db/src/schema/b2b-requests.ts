import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const b2bRequestCategoryEnum = pgEnum("b2b_request_category", [
  "product",
  "service",
  "logistics",
  "partnership",
  "other",
]);

export const b2bRequestStatusEnum = pgEnum("b2b_request_status", [
  "pending",
  "approved",
  "rejected",
  "closed",
]);

export const b2bRequestsTable = pgTable(
  "b2b_requests",
  {
    id: serial("id").primaryKey(),
    referenceCode: text("reference_code").notNull(),
    requesterClerkUserId: text("requester_clerk_user_id"),
    category: b2bRequestCategoryEnum("category").notNull(),
    title: text("title").notNull(),
    requesterName: text("requester_name").notNull(),
    organization: text("organization"),
    location: text("location").notNull(),
    contact: text("contact").notNull(),
    description: text("description").notNull(),
    status: b2bRequestStatusEnum("status").notNull().default("pending"),
    internalNote: text("internal_note"),
    reviewerClerkUserId: text("reviewer_clerk_user_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("b2b_requests_reference_code_idx").on(table.referenceCode),
    index("b2b_requests_status_idx").on(table.status),
    index("b2b_requests_category_idx").on(table.category),
    index("b2b_requests_created_at_idx").on(table.createdAt),
  ],
);

export const insertB2BRequestSchema = createInsertSchema(b2bRequestsTable).omit({
  id: true,
  referenceCode: true,
  requesterClerkUserId: true,
  status: true,
  internalNote: true,
  reviewerClerkUserId: true,
  reviewedAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type B2BRequest = typeof b2bRequestsTable.$inferSelect;
export type InsertB2BRequest = z.infer<typeof insertB2BRequestSchema>;