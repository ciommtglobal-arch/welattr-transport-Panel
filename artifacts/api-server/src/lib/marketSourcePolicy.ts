/** Founder authorized future real intake; historical TEST ads stay quarantined.
 * Match immutable Telegram identity and original message time, never retry time.
 */
export const WELATTR_TEST_SOURCE = "telegram://group/-5377858473";
export const WELATTR_LIVE_FROM = "2026-10-29T23:21:43Z";
type SourcePayload = { sourceUrl?: string | null; isTest?: boolean; eligible?: boolean; marketOccurredAt?: string };
export function isQuarantinedMarketPayload(payload: SourcePayload) {
  return payload.sourceUrl === WELATTR_TEST_SOURCE &&
    (payload.isTest === true || !payload.marketOccurredAt ||
      !Number.isFinite(Date.parse(payload.marketOccurredAt)) ||
      Date.parse(payload.marketOccurredAt) < Date.parse(WELATTR_LIVE_FROM));
}
export function isolateTestMarketPayload<T extends SourcePayload>(payload: T): T {
  return isQuarantinedMarketPayload(payload)
    ? { ...payload, isTest: true, eligible: false }
    : payload;
}
