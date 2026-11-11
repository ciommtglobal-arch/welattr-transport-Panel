import { parseMarketTexts } from "./marketTextParser";
import { ingestTelegramMarketItem } from "./logisticsPool";
import { logisticsPoolSourcesTable } from "@workspace/db";
import { isQuarantinedMarketPayload } from "./marketSourcePolicy";

/** Shared internal pipeline: HTTP feed and Telegram use the same parser/persistence.
 * No loopback HTTP request or bypass of source-secret checks is required.
 */
export async function processMarketFeedText(
  source: typeof logisticsPoolSourcesTable.$inferSelect, eventId: string, text: string, occurredAt = new Date(),
) {
  const extractions = parseMarketTexts(text, eventId, occurredAt);
  if (!extractions.length) return { status: "ignored" as const, reason: "unclassified_text", messagesSent: false as const };
  const results = [];
  for (const extraction of extractions) {
  const metadata = {...extraction.metadata, marketOccurredAt:occurredAt.toISOString()};
  const inserted = await ingestTelegramMarketItem(source, extraction.item.id, extraction.item, metadata);
  results.push({
    status: !inserted ? "duplicate" as const : !isQuarantinedMarketPayload({...extraction.item,sourceUrl:source.url,marketOccurredAt:metadata.marketOccurredAt}) && extraction.metadata.eligible ? "accepted" as const : "needs_review" as const,
    missing: extraction.metadata.parserMissing, messagesSent: false as const,
  });
  }
  if (results.length === 1) return results[0];
  return {
    status: results.every(r => r.status === "duplicate") ? "duplicate" as const :
      results.some(r => r.status === "needs_review") ? "needs_review" as const : "accepted" as const,
    parsedCount: results.length, results, messagesSent: false as const,
  };
}
