import { parseMarketText } from "./marketTextParser";
import { ingestTelegramMarketItem } from "./logisticsPool";
import { logisticsPoolSourcesTable } from "@workspace/db";

/** Shared internal pipeline: HTTP feed and Telegram use the same parser/persistence.
 * No loopback HTTP request or bypass of source-secret checks is required.
 */
export async function processMarketFeedText(
  source: typeof logisticsPoolSourcesTable.$inferSelect, eventId: string, text: string,
) {
  const extraction = parseMarketText(text, eventId);
  if (!extraction) return { status: "ignored" as const, reason: "unclassified_text", messagesSent: false as const };
  const inserted = await ingestTelegramMarketItem(source, eventId, extraction.item, extraction.metadata);
  return {
    status: !inserted ? "duplicate" as const : extraction.metadata.eligible ? "accepted" as const : "needs_review" as const,
    missing: extraction.metadata.parserMissing, messagesSent: false as const,
  };
}
