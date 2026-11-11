import { describe, it, expect } from "vitest";
import { marketItemSchema, marketPricingNote, telegramMarketUpdateSchema, webhookSecretMatches } from "./marketIngestion";

describe("market ingestion boundaries", () => {
  it("fails closed on missing/short/wrong secrets", () => {
    expect(webhookSecretMatches(undefined, undefined)).toBe(false);
    expect(webhookSecretMatches("x", "x")).toBe(false);
    expect(webhookSecretMatches("a".repeat(32), "b".repeat(32))).toBe(false);
    expect(webhookSecretMatches("a".repeat(32), "a".repeat(32))).toBe(true);
  });
  it("rejects private chats and edited updates", () => {
    expect(telegramMarketUpdateSchema.safeParse({ update_id: 1, edited_message: {} }).success).toBe(false);
    expect(telegramMarketUpdateSchema.safeParse({ update_id: 1, message: {
      message_id: 1, date: 123, text: "{}", chat: { id: 1, type: "private" },
    } }).success).toBe(false);
  });
  it("requires route, capacity/date, disallows claimed approval and test flags", () => {
    const item = { role: "load", name: "Market load", origin: "Mersin", destination: "Adana",
      requiredKg: 2000, requiredDate: "2026-12-01", transportMode: "road" };
    expect(marketItemSchema.safeParse(item).success).toBe(true);
    for (const extra of [{ verified: true }, { isTest: false }, { approved: true }, { requiredKg: undefined }]) {
      expect(marketItemSchema.safeParse({ ...item, ...extra }).success).toBe(false);
    }
  });
  it("calculates spread separately from commission and refuses missing/cross-currency prices", () => {
    expect(marketPricingNote({}, {})).toContain("bekliyor");
    expect(marketPricingNote({ quotedPriceMinor: 10000, currency: "USD", commissionBps: 500 },
      { quotedPriceMinor: 8000, currency: "EUR" })).toContain("bekliyor");
    const note = marketPricingNote({ quotedPriceMinor: 10000, currency: "USD", commissionBps: 500 },
      { quotedPriceMinor: 8000, currency: "USD" });
    expect(note).toContain("20.00 USD");
    expect(note).toContain("5.00 USD");
    expect(note).toContain("kurucu teyidi");
  });
});
