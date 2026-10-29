import { parseMarketText } from "./marketTextParser";
import { ingestTelegramMarketItem } from "./logisticsPool";
import { logisticsPoolSourcesTable } from "@workspace/db";
import { isQuarantinedMarketPayload } from "./marketSourcePolicy";

/** Shared internal pipeline: HTTP feed and Telegram use the same parser/persistence.
 * No loopback HTTP request or bypass of source-secret checks is required.
 */
export async function processMarketFeedText(
  source: typeof logisticsPoolSourcesTable.$inferSelect, eventId: string, text: string, occurredAt = new Date(),
) {
  const extraction = parseMarketText(text, eventId, occurredAt);
  if (!extraction) return { status: "ignored" as const, reason: "unclassified_text", messagesSent: false as const };
  const metadata = {...extraction.metadata, marketOccurredAt:occurredAt.toISOString()};
  const inserted = await ingestTelegramMarketItem(source, eventId, extraction.item, metadata);
  return {
    status: !inserted ? "duplicate" as const : !isQuarantinedMarketPayload({...extraction.item,sourceUrl:source.url,marketOccurredAt:metadata.marketOccurredAt}) && extraction.metadata.eligible ? "accepted" as const : "needs_review" as const,
    missing: extraction.metadata.parserMissing, messagesSent: false as const,
  };
}
