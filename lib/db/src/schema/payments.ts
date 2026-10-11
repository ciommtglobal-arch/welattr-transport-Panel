import {
  check,
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
import { sql } from "drizzle-orm";
import { kasaUsersTable } from "./kasa";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "success",
  "failed",
  "cancelled",
]);

export const serviceInvoiceStatus = [
  "issued",
  "paid",
  "partially_refunded",
  "refunded",
  "cancelled",
] as const;

export const serviceInvoicesTable = pgTable(
  "service_invoices",
  {
    id: serial("id").primaryKey(),
    // A referenced key must be available at CREATE TABLE time, before foreign keys.
    reference: text("reference").notNull().unique("service_invoices_reference_key"),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    currency: text("currency").$type<"TRY" | "USD" | "EUR">().notNull(),
    description: text("description").notNull(),
    status: text("status")
      .$type<(typeof serviceInvoiceStatus)[number]>()
      .notNull()
      .default("issued"),
    refundedAmount: numeric("refunded_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    issuedByKasaUserId: integer("issued_by_kasa_user_id")
      .notNull()
      .references(() => kasaUsersTable.id, { onDelete: "restrict" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("service_invoices_reference_idx").on(table.reference),
    index("service_invoices_status_issued_at_idx").on(table.status, table.issuedAt),
    check("service_invoices_amount_positive", sql`${table.amount} > 0`),
    check("service_invoices_refunded_nonnegative", sql`${table.refundedAmount} >= 0`),
    check("service_invoices_currency_valid", sql`${table.currency} in ('TRY', 'USD', 'EUR')`),
    check(
      "service_invoices_status_valid",
      sql`${table.status} in ('issued', 'paid', 'partially_refunded', 'refunded', 'cancelled')`,
    ),
    check(
      "service_invoices_paid_has_timestamp",
      sql`${table.status} not in ('paid', 'partially_refunded', 'refunded') or ${table.paidAt} is not null`,
    ),
  ],
);

export const paymentSessionsTable = pgTable(
  "payment_sessions",
  {
    id: serial("id").primaryKey(),
    // Keep a declared key as well as the legacy index used by existing releases.
    orderId: text("order_id").notNull().unique("payment_sessions_order_id_key"),
    provider: text("provider").notNull().default("tami"),
    invoiceReference: text("invoice_reference").references(
      () => serviceInvoicesTable.reference,
      { onDelete: "restrict" },
    ),
    idempotencyKey: text("idempotency_key"),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("TRY"),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    description: text("description").notNull(),
    checkoutUrl: text("checkout_url"),
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
    uniqueIndex("payment_sessions_idempotency_key_idx").on(table.idempotencyKey),
    uniqueIndex("payment_sessions_one_pending_invoice_idx")
      .on(table.invoiceReference)
      .where(sql`${table.invoiceReference} is not null and ${table.status} = 'pending'`),
    index("payment_sessions_status_idx").on(table.status),
    index("payment_sessions_created_at_idx").on(table.createdAt),
  ],
);

export const paymentRefundsTable = pgTable(
  "payment_refunds",
  {
    id: serial("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => paymentSessionsTable.orderId, { onDelete: "restrict" }),
    invoiceReference: text("invoice_reference")
      .notNull()
      .references(() => serviceInvoicesTable.reference, { onDelete: "restrict" }),
    idempotencyKey: text("idempotency_key").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    reason: text("reason").notNull(),
    status: text("status").$type<"pending" | "success" | "failed">().notNull().default("pending"),
    providerReference: text("provider_reference"),
    providerCorrelationId: text("provider_correlation_id"),
    errorMessage: text("error_message"),
    createdByKasaUserId: integer("created_by_kasa_user_id")
      .notNull()
      .references(() => kasaUsersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("payment_refunds_idempotency_key_idx").on(table.idempotencyKey),
    index("payment_refunds_order_id_created_at_idx").on(table.orderId, table.createdAt),
    check("payment_refunds_amount_positive", sql`${table.amount} > 0`),
    check(
      "payment_refunds_status_valid",
      sql`${table.status} in ('pending', 'success', 'failed')`,
    ),
  ],
);

export const paymentAuditEventsTable = pgTable(
  "payment_audit_events",
  {
    id: serial("id").primaryKey(),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    provider: text("provider").notNull(),
    invoiceReference: text("invoice_reference"),
    orderId: text("order_id"),
    amount: numeric("amount", { precision: 15, scale: 2 }),
    currency: text("currency"),
    providerStatus: text("provider_status"),
    correlationId: text("correlation_id"),
    actorKasaUserId: integer("actor_kasa_user_id").references(
      () => kasaUsersTable.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_audit_events_event_key_idx").on(table.eventKey),
    index("payment_audit_events_order_id_created_at_idx").on(
      table.orderId,
      table.createdAt,
    ),
    index("payment_audit_events_invoice_reference_created_at_idx").on(
      table.invoiceReference,
      table.createdAt,
    ),
  ],
);

export type PaymentSession = typeof paymentSessionsTable.$inferSelect;
export type ServiceInvoice = typeof serviceInvoicesTable.$inferSelect;
export type PaymentRefund = typeof paymentRefundsTable.$inferSelect;