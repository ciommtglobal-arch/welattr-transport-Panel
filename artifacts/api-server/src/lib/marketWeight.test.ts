import { describe, expect, it } from "vitest";
import { marketWeightKg } from "./marketWeight";
import { parseMarketText } from "./marketTextParser";

describe("zero-prefixed logistics ton shorthand", () => {
  it.each([
    ["025 pazartesi", 25000], ["026 ton", 26000], ["020", 20000],
    ["015 TON", 15000], ["010", 10000], ["035", 35000],
    ["025\n25 ton", 25000], ["26,5 ton", 26500], ["25000 kg", 25000],
  ])("extracts %s", (text, kg) => expect(marketWeightKg(text)).toBe(kg));

  it.each([
    "009", "036", "25", "0025", "2025", "0250", "025.10.2026",
    "2026-10-025", "05:025", "0,025", "-025", "+025", "ABC025",
    "0532 025 20 15", "+90 532 025 20 15", "025 TL", "Fiyat: 025",
    "Sipariş no: 025", "34 ABC 025", "025 palet", "025 metre",
    "025 veya 026", "025 ve 20 ton",
  ])("does not infer a unique tonnage from %s", text => expect(marketWeightKg(text)).toBeUndefined());

  it("makes a complete real load candidate eligible without granting approval", () => {
    const result = parseMarketText("Çatalca → Zaho\nPaletli yük tenteli\n025 bugün", "new-ad", new Date("2026-10-30T08:00:00Z"))!;
    expect(result.item).toMatchObject({ requiredKg: 25000, origin: "Çatalca", destination: "Zaho", isTest: false });
    expect(result.metadata.eligible).toBe(true);
    expect(result.metadata.parserMissing).toEqual([]);
  });

  it("does not bypass missing date or other eligibility checks", () => {
    const result = parseMarketText("Çatalca → Zaho\nPaletli yük tenteli\n025 pazartesi", "new-ad")!;
    expect(result.item.requiredKg).toBe(25000);
    expect(result.metadata.eligible).toBe(false);
    expect(result.metadata.parserMissing).toContain("Açık ve çelişkisiz taşıma tarihi");
  });
});
