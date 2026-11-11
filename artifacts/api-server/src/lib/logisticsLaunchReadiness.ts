import { sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import {
  db, logisticsPoolSourcesTable, logisticsPoolEntriesTable, logisticsPoolMatchesTable,
  logisticsPoolAiDraftsTable, logisticsPoolDraftNotificationsTable,
  geminiWorkspaceTurnsTable,
} from "@workspace/db";

const tables = [
  logisticsPoolSourcesTable, logisticsPoolEntriesTable, logisticsPoolMatchesTable,
  logisticsPoolAiDraftsTable, logisticsPoolDraftNotificationsTable,
  geminiWorkspaceTurnsTable,
];
const indexes = [
  "logistics_pool_source_url_unique", "logistics_pool_origin_unique",
  "logistics_pool_match_unique", "logistics_pool_ai_draft_match_version_unique",
  "logistics_pool_draft_notification_unique",
  "gemini_workspace_owner_created_idx", "gemini_workspace_one_pending_idx",
];

/** Catalog reads only; never creates tables, roles, users, or operational data. */
export async function checkLogisticsSchema() {
  return db.transaction(async (tx) => {
    const columns = await tx.execute(sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('logistics_pool_sources','logistics_pool_entries','logistics_pool_matches',
          'logistics_pool_ai_drafts','logistics_pool_draft_notifications','gemini_workspace_turns','logistics_requests','logistics_carriers')
    `);
    const found = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
    const required = tables.flatMap((table) => {
      const config = getTableConfig(table);
      return config.columns.map((column) => `${config.name}.${column.name}`);
    });
    for (const table of ["logistics_requests", "logistics_carriers"]) {
      required.push(`${table}.captured_by_clerk_user_id`, `${table}.contact_use_confirmed`);
    }
    const indexRows = await tx.execute(sql`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
        AND (tablename LIKE 'logistics_pool_%' OR tablename = 'gemini_workspace_turns')
    `);
    const foundIndexes = new Set(indexRows.rows.map((row) => String(row.indexname)));
    const constraints = await tx.execute(sql`
      SELECT conname FROM pg_constraint
      WHERE conrelid IN (
        to_regclass('public.logistics_pool_draft_notifications'),
        to_regclass('public.gemini_workspace_turns')
      ) AND contype = 'c'
    `);
    const foundConstraints = new Set(constraints.rows.map((row) => String(row.conname)));
    const fingerprint = await tx.execute(sql`
      SELECT md5(current_database() || ':' ||
        COALESCE(to_regclass('public.logistics_pool_matches')::oid::text, 'missing')) AS fingerprint
    `);
    return {
      missing: [
        ...required.filter((column) => !found.has(column)),
        ...indexes.filter((index) => !foundIndexes.has(index)).map((index) => `index:${index}`),
        ...["logistics_pool_draft_notifications_dry_run_only", "logistics_pool_draft_notifications_telegram_only",
          "gemini_workspace_status_check"]
          .filter((name) => !foundConstraints.has(name)).map((name) => `constraint:${name}`),
      ],
      fingerprint: String(fingerprint.rows[0]?.fingerprint),
      scope: "Expected column names, unique-index names and sendless constraint names; not a complete type/definition comparison.",
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

const telegramResult = z.object({
  ok: z.literal(true),
  result: z.object({ id: z.number(), username: z.string().optional(), type: z.string().optional() }),
});

/** Only getMe/getChat are permitted. No updates, webhook changes or send methods. */
export async function probeLogisticsTelegram(
  send: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
) {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const result: {
    bot: "not_configured" | "unavailable" | "wrong_bot" | "verified_bot";
    botUsername: string | null;
    privateChat: "not_configured" | "not_checked" | "not_private" | "reachable_unbound" | "unavailable";
    groupConfigured: boolean; sendingEnabled: false;
  } = {
    bot: token ? "unavailable" : "not_configured", botUsername: null,
    privateChat: env.FOUNDER_CHAT_ID?.trim() ? "not_checked" : "not_configured",
    groupConfigured: Boolean(env.TELEGRAM_GROUP_ID?.trim()), sendingEnabled: false,
  };
  if (!token) return result;
  async function read(method: "getMe" | "getChat", body?: { chat_id: string }) {
    const response = await send(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(8000), redirect: "error",
    });
    if (!response.ok) throw new Error("Telegram read-only check failed.");
    return telegramResult.parse(await response.json()).result;
  }
  try {
    const me = await read("getMe");
    result.botUsername = me.username ?? null;
    if (me.username?.toLowerCase() !== "mmtgloballogistics_bot") {
      result.bot = "wrong_bot";
      return result;
    }
    result.bot = "verified_bot";
  } catch {
    return result; // Never expose provider errors containing token-bearing URLs.
  }
  const chatId = env.FOUNDER_CHAT_ID?.trim();
  if (chatId) {
    try {
      const chat = await read("getChat", { chat_id: chatId });
      result.privateChat = chat.type === "private" ? "reachable_unbound" : "not_private";
    } catch {
      result.privateChat = "unavailable";
    }
  }
  // Reachability is NOT proof of founder ownership or permission to send.
  return result;
}
