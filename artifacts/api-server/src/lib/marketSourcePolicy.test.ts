import { describe, it, expect } from "vitest";
import { WELATTR_TEST_SOURCE, isolateTestMarketPayload } from "./marketSourcePolicy";
import { suggestPoolMatches } from "./logisticsPoolEngine";
import type { PoolPayload } from "@workspace/db";

describe("founder-designated Telegram TEST source", () => {
  it("overrides a false TEST flag and eligibility without mutating other fields", () => {
    const old = {sourceUrl:WELATTR_TEST_SOURCE,isTest:false,eligible:true,origin:"İstanbul Tuzla"};
    expect(isolateTestMarketPayload(old)).toEqual({...old,isTest:true,eligible:false});
    expect(old.isTest).toBe(false);
    expect(isolateTestMarketPayload(isolateTestMarketPayload(old))).toEqual(isolateTestMarketPayload(old));
  });
  it("does not quarantine unrelated sources or match group titles", () => {
    const unrelated = {sourceUrl:"telegram://group/-123",isTest:false,eligible:true};
    expect(isolateTestMarketPayload(unrelated)).toBe(unrelated);
  });
  it("blocks legacy live-flagged rows before database reconciliation", () => {
    const payload = (role: "load" | "carrier", sourceUrl: string | null): PoolPayload => ({
      role, sourceUrl, isTest:false,eligible:true,verified:false,name:role,location:"İstanbul Tuzla",
      origin:"İstanbul Tuzla",destination:"Ankara Ostim",products:[],transportMode:"road",
      capacityKg:24000,requiredKg:20000,volumeM3:null,availableDate:null,requiredDate:null,
      contact:"",reference:role,
    });
    const row = (id:string, p:PoolPayload) => ({id,payload:p,fingerprint:id,active:true,lastSeenAt:new Date()});
    const carrier = row("c",payload("carrier",null));
    expect(suggestPoolMatches([row("l",payload("load",null)),carrier])).toHaveLength(1);
    expect(suggestPoolMatches([row("l",payload("load",WELATTR_TEST_SOURCE)),carrier])).toHaveLength(0);
  });
});
