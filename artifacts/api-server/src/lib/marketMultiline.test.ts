import { describe, it, expect } from "vitest";
import { parseMarketTexts, parseMarketText } from "./marketTextParser";
const at = new Date("2026-10-30T09:30:00Z");
describe("real market formats", () => {
  it("splits five Kiziltepe routes and holds missing data", () => {
    const destinations = ["URFA HALFETİ","HATAY MERKEZ","ANKARA ÇUBUK","KARAMAN AYRANCILAR","NİĞDE ULUKIŞLA"];
    const text = destinations.map(d => `KIZILTEPE'DEN 📶 ${d}`).join("\n");
    const items = parseMarketTexts(text, "ad1", at);
    expect(items).toHaveLength(5);
    expect(items.map(r => r.item.destination)).toEqual(destinations);
    for (const r of items) {
      expect(r.item.origin).toBe("KIZILTEPE");
      expect(r.item.isTest).toBe(false);
      expect(r.metadata.eligible).toBe(false);
      expect(r.item.requiredKg).toBeUndefined();
    }
    expect(new Set(items.map(r=>r.item.id)).size).toBe(5);
    expect(parseMarketTexts(text,"ad1",at)).toEqual(items);
  });
  it.each(["Zaho","Erbil","Bağdat"])("extracts Iraq destination %s with weight and contact", dest => {
    const r = parseMarketText(`Kızıltepe ${dest} 026 ton paletli yük tenteli bugün 0530-841-75-39`, "i", at)!;
    expect(r.item).toMatchObject({origin:"Kızıltepe",destination:dest,requiredKg:26000,contact:"05308417539"});
  });
  it("preserves TEST while removing prefix only for route parsing", () => {
    const r = parseMarketText("TEST — İstanbul Tuzla'dan Ankara Ostim'e 20 ton paletli kuru yük, tenteli tır, bugün yükleme.", "t",at)!;
    expect(r.item).toMatchObject({origin:"İstanbul Tuzla",destination:"Ankara Ostim",isTest:true});
  });
  it("does not turn return cargo into a vehicle or infer routes from phones",()=>{
    expect(parseMarketText("Dönüş yükü var\nMersin -> Adana\n20 ton paletli tenteli bugün","r",at)?.item.role).toBe("load");
    expect(parseMarketText("0530-841-75-39", "p",at)).toBeNull();
    const r = parseMarketTexts("TEST\nKIZILTEPE'DEN 📶 URFA HALFETİ\nKIZILTEPE'DEN 📶 HATAY MERKEZ","t",at);
    expect(r.every(x=>x.item.isTest)).toBe(true);
  });
});
