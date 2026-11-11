import { it, expect, vi } from "vitest";
const state = vi.hoisted(()=>({seen:new Set<string>(),items:[] as any[]}));
vi.mock("./logisticsPool",()=>({ingestTelegramMarketItem:vi.fn(async (_source,id,item,metadata)=>{
  if(state.seen.has(id)) return false;
  state.seen.add(id); state.items.push({item,metadata}); return true;
})}));
vi.mock("@workspace/db",()=>({logisticsPoolSourcesTable:{}}));
import { processMarketFeedText } from "./marketFeedService";
it("stores separate incomplete candidates and deduplicates a redelivery",async()=>{
  const source={url:"market://source/consented",id:"source"} as any;
  const text="KIZILTEPE'DEN 📶 URFA HALFETİ\nKIZILTEPE'DEN 📶 HATAY MERKEZ";
  const a=await processMarketFeedText(source,"event",text);
  expect(a.status).toBe("needs_review");
  expect(state.items).toHaveLength(2);
  expect(state.items.every(r=>r.metadata.eligible===false)).toBe(true);
  expect((await processMarketFeedText(source,"event",text)).status).toBe("duplicate");
  expect(state.items).toHaveLength(2);
});
