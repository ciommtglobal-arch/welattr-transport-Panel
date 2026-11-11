import { sql } from "drizzle-orm";
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
import {
  logisticsRequestsTable,
  logisticsTransportModeEnum,
} from "./logistics-operations";

export const logisticsInboundDraftStatusEnum = pgEnum(
  "logistics_inbound_draft_status",
  ["collecting", "completed", "cancelled"],
);

export const logisticsInboundReplyStatusEnum = pgEnum(
  "logistics_inbound_reply_status",
  ["pending", "sent", "failed"],
);

export const logisticsInboundDraftsTable = pgTable(
  "logistics_inbound_drafts",
  {
    id: serial("id").primaryKey(),
    senderPhone: text("sender_phone").notNull(),
    requesterName: text("requester_name"),
    organization: text("organization"),
    email: text("email"),
    origin: text("origin"),
    destination: text("destination"),
    cargoType: text("cargo_type"),
    weightKg: numeric("weight_kg", {
      precision: 12,
      scale: 2,
      mode: "number",
    }),
    volumeM3: numeric("volume_m3", {
      precision: 12,
      scale: 2,
      mode: "number",
    }),
    transportMode: logisticsTransportModeEnum("transport_mode"),
    loadingDate: text("loading_date"),
    notes: text("notes"),
    status: logisticsInboundDraftStatusEnum("status")
      .notNull()
      .default("collecting"),
    requestId: integer("request_id").references(() => logisticsRequestsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("logistics_inbound_drafts_one_active_sender_idx")
      .on(table.senderPhone)
      .where(sql`${table.status} = 'collecting'`),
    index("logistics_inbound_drafts_status_updated_at_idx").on(
      table.status,
      table.updatedAt,
    ),
  ],
);

export const logisticsInboundMessagesTable = pgTable(
  "logistics_inbound_messages",
  {
    id: serial("id").primaryKey(),
    providerMessageId: text("provider_message_id").notNull(),
    senderPhone: text("sender_phone").notNull(),
    draftId: integer("draft_id").references(
      () => logisticsInboundDraftsTable.id,
      { onDelete: "set null" },
    ),
    replyText: text("reply_text").notNull().default(""),
    replyStatus: logisticsInboundReplyStatusEnum("reply_status")
      .notNull()
      .default("pending"),
    replyAttempts: integer("reply_attempts").notNull().default(0),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("logistics_inbound_messages_provider_message_id_idx").on(
      table.providerMessageId,
    ),
    index("logistics_inbound_messages_draft_received_at_idx").on(
      table.draftId,
      table.receivedAt,
    ),
  ],
);
