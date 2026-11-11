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

export const mediaDeliveryTargetEnum = pgEnum("media_delivery_target", [
  "telegram",
  "instagram",
  "tiktok",
  "webhook",
]);

export const mediaDeliveryStatusEnum = pgEnum("media_delivery_status", [
  "pending",
  "sending",
  "sent",
  "failed",
]);

export const mediaDeliveriesTable = pgTable(
  "media_deliveries",
  {
    id: serial("id").primaryKey(),
    mediaItemId: integer("media_item_id").notNull(),
    target: mediaDeliveryTargetEnum("target").notNull(),
    status: mediaDeliveryStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    externalId: text("external_id"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("media_deliveries_item_target_idx").on(
      table.mediaItemId,
      table.target,
    ),
    index("media_deliveries_status_idx").on(table.status),
    index("media_deliveries_created_at_idx").on(table.createdAt),
  ],
);

export type MediaDelivery = typeof mediaDeliveriesTable.$inferSelect;