import {
  boolean,
  date,
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
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const logisticsTransportModeEnum = pgEnum("logistics_transport_mode", [
  "road",
  "sea",
  "air",
]);

export const logisticsShipmentStatusEnum = pgEnum("logistics_shipment_status", [
  "new_request",
  "planning",
  "quote_approval",
  "customer_approval",
  "loading",
  "in_transit",
  "delivered",
]);

export const logisticsCarrierStatusEnum = pgEnum("logistics_carrier_status", [
  "pending",
  "approved",
  "rejected",
]);

export const logisticsOfferStatusEnum = pgEnum("logistics_offer_status", [
  "pending_approval",
  "approved",
  "sent",
  "accepted",
  "rejected",
  "expired",
]);

export const logisticsCommunicationChannelEnum = pgEnum(
  "logistics_communication_channel",
  ["phone", "email", "whatsapp", "note"],
);

export const logisticsCommunicationDirectionEnum = pgEnum(
  "logistics_communication_direction",
  ["inbound", "outbound", "internal"],
);

export const logisticsRequestsTable = pgTable(
  "logistics_requests",
  {
    id: serial("id").primaryKey(),
    referenceCode: text("reference_code").notNull(),
    requesterClerkUserId: text("requester_clerk_user_id"),
    requesterName: text("requester_name").notNull(),
    organization: text("organization"),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    cargoType: text("cargo_type").notNull(),
    weightKg: numeric("weight_kg", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    volumeM3: numeric("volume_m3", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    transportMode: logisticsTransportModeEnum("transport_mode").notNull(),
    loadingDate: date("loading_date").notNull(),
    notes: text("notes"),
    capturedByClerkUserId: text("captured_by_clerk_user_id"),
    contactUseConfirmed: boolean("contact_use_confirmed").notNull().default(false),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("logistics_requests_reference_code_idx").on(
      table.referenceCode,
    ),
    index("logistics_requests_created_at_idx").on(table.createdAt),
    index("logistics_requests_origin_destination_idx").on(
      table.origin,
      table.destination,
    ),
  ],
);

export const logisticsCarriersTable = pgTable(
  "logistics_carriers",
  {
    id: serial("id").primaryKey(),
    referenceCode: text("reference_code").notNull(),
    applicantClerkUserId: text("applicant_clerk_user_id"),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    serviceRoutes: text("service_routes").notNull(),
    transportMode: logisticsTransportModeEnum("transport_mode").notNull(),
    capacity: text("capacity").notNull(),
    availability: text("availability").notNull(),
    notes: text("notes"),
    status: logisticsCarrierStatusEnum("status").notNull().default("pending"),
    capturedByClerkUserId: text("captured_by_clerk_user_id"),
    contactUseConfirmed: boolean("contact_use_confirmed").notNull().default(false),
    isTest: boolean("is_test").notNull().default(false),
    reviewedByClerkUserId: text("reviewed_by_clerk_user_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("logistics_carriers_reference_code_idx").on(
      table.referenceCode,
    ),
    index("logistics_carriers_status_idx").on(table.status),
    index("logistics_carriers_created_at_idx").on(table.createdAt),
  ],
);

export const logisticsShipmentsTable = pgTable(
  "logistics_shipments",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => logisticsRequestsTable.id, { onDelete: "cascade" }),
    referenceCode: text("reference_code").notNull(),
    status: logisticsShipmentStatusEnum("status").notNull().default("new_request"),
    assignedStaffClerkUserId: text("assigned_staff_clerk_user_id"),
    plannedLoadingAt: timestamp("planned_loading_at", { withTimezone: true }),
    actualLoadingAt: timestamp("actual_loading_at", { withTimezone: true }),
    plannedDeliveryAt: timestamp("planned_delivery_at", { withTimezone: true }),
    actualDeliveryAt: timestamp("actual_delivery_at", { withTimezone: true }),
    internalNote: text("internal_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("logistics_shipments_request_id_idx").on(table.requestId),
    uniqueIndex("logistics_shipments_reference_code_idx").on(table.referenceCode),
    index("logistics_shipments_status_idx").on(table.status),
    index("logistics_shipments_assigned_staff_idx").on(
      table.assignedStaffClerkUserId,
    ),
  ],
);

export const logisticsOffersTable = pgTable(
  "logistics_offers",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => logisticsRequestsTable.id, { onDelete: "cascade" }),
    carrierId: integer("carrier_id")
      .notNull()
      .references(() => logisticsCarriersTable.id, { onDelete: "restrict" }),
    carrierCostAmount: numeric("carrier_cost_amount", {
      precision: 15,
      scale: 2,
      mode: "number",
    }).notNull(),
    customerPriceAmount: numeric("customer_price_amount", {
      precision: 15,
      scale: 2,
      mode: "number",
    }).notNull(),
    currency: text("currency").notNull(),
    includedServices: text("included_services").notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    status: logisticsOfferStatusEnum("status")
      .notNull()
      .default("pending_approval"),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    approvedByClerkUserId: text("approved_by_clerk_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("logistics_offers_request_idx").on(table.requestId),
    index("logistics_offers_carrier_idx").on(table.carrierId),
    index("logistics_offers_status_idx").on(table.status),
  ],
);

export const logisticsCommunicationsTable = pgTable(
  "logistics_communications",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => logisticsRequestsTable.id, { onDelete: "cascade" }),
    channel: logisticsCommunicationChannelEnum("channel").notNull(),
    direction: logisticsCommunicationDirectionEnum("direction").notNull(),
    message: text("message").notNull(),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("logistics_communications_request_idx").on(table.requestId),
    index("logistics_communications_created_at_idx").on(table.createdAt),
  ],
);

export const insertLogisticsRequestSchema = createInsertSchema(
  logisticsRequestsTable,
).omit({
  id: true,
  referenceCode: true,
  requesterClerkUserId: true,
  isTest: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLogisticsCarrierSchema = createInsertSchema(
  logisticsCarriersTable,
).omit({
  id: true,
  referenceCode: true,
  applicantClerkUserId: true,
  status: true,
  isTest: true,
  reviewedByClerkUserId: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type LogisticsRequest = typeof logisticsRequestsTable.$inferSelect;
export type LogisticsCarrier = typeof logisticsCarriersTable.$inferSelect;
export type LogisticsShipment = typeof logisticsShipmentsTable.$inferSelect;
export type LogisticsOffer = typeof logisticsOffersTable.$inferSelect;
export type LogisticsCommunication =
  typeof logisticsCommunicationsTable.$inferSelect;
export type InsertLogisticsRequest = z.infer<
  typeof insertLogisticsRequestSchema
>;
export type InsertLogisticsCarrier = z.infer<
  typeof insertLogisticsCarrierSchema
>;