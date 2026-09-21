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

export const mediaItemStatusEnum = pgEnum("media_item_status", [
  "draft",
  "published",
  "archived",
]);

export const mediaItemsTable = pgTable(
  "media_items",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    category: text("category").notNull().default("haber"),
    sourceUrl: text("source_url"),
    objectPath: text("object_path"),
    fileName: text("file_name"),
    contentType: text("content_type"),
    size: integer("size"),
    status: mediaItemStatusEnum("status").notNull().default("draft"),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("media_items_status_idx").on(table.status),
    index("media_items_category_idx").on(table.category),
    index("media_items_created_at_idx").on(table.createdAt),
    index("media_items_object_path_idx").on(table.objectPath),
  ],
);

export const insertMediaItemSchema = createInsertSchema(mediaItemsTable).omit({
  id: true,
  status: true,
  createdByClerkUserId: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
});

export type MediaItem = typeof mediaItemsTable.$inferSelect;
export type InsertMediaItem = z.infer<typeof insertMediaItemSchema>;