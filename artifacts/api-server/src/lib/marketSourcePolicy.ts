/** Founder-designated TEST source. Changing its status requires a separate decision.
 * Match by immutable Telegram ID, never a mutable group title.
 */
export const WELATTR_TEST_SOURCE = "telegram://group/-5377858473";
export function isTestMarketSource(url: string | null | undefined) {
  return url === WELATTR_TEST_SOURCE;
}
export function isolateTestMarketPayload<T extends { sourceUrl?: string | null; isTest?: boolean; eligible?: boolean }>(payload: T): T {
  return isTestMarketSource(payload.sourceUrl)
    ? { ...payload, isTest: true, eligible: false }
    : payload;
}
