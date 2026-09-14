import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "success",
  "failed",
]);

export const paymentSessionsTable = pgTable(
  "payment_sessions",
  {
    id: serial("id").primaryKey(),
    orderId: text("order_id").notNull(),
    provider: text("provider").notNull().default("tami"),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("TRY"),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    description: text("description").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    providerPaymentStatus: text("provider_payment_status"),
    providerOrderStatus: text("provider_order_status"),
    errorMessage: text("error_message"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("payment_sessions_order_id_idx").on(table.orderId),
    index("payment_sessions_status_idx").on(table.status),
    index("payment_sessions_created_at_idx").on(table.createdAt),
  ],
);

export type PaymentSession = typeof paymentSessionsTable.$inferSelect;