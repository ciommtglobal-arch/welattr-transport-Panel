import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql, eq } from "drizzle-orm";
import type { PoolPayload } from "@workspace/db";
import { digest, explicitKg, normalized, suggestPoolMatches, type PoolRow } from "./logisticsPoolEngine";
import { feedSchema, safeFeedUrl, publicAddress } from "./logisticsPoolFeed";
const state = vi.hoisted(() => ({tx:null as any}));
vi.mock("./logisticsListingAuth", () => ({isLogisticsFounder:(id:string) => id === "pool-TEST-founder"}));
vi.mock("@workspace/db", async original => {
  const actual = await original<typeof import("@workspace/db")>();
  return {...actual,db:new Proxy(actual.db,{get(_target,key) {
    if (key === "transaction") return (fn:any) => {if(!state.tx) throw Error("Isolated TEST transaction required");return state.tx.transaction(fn);};
    if (!state.tx) return () => {throw Error("Isolated TEST transaction required");};
    const value = state.tx[key]; return typeof value === "function" ? value.bind(state.tx) : value;
  }})};
});
import {
  logisticsPoolSourcesTable as sources, logisticsPoolEntriesTable as entries,
  logisticsPoolMatchesTable as matches, logisticsRequestsTable as requests,
  logisticsPoolAiDraftsTable as aiDrafts, logisticsPoolDraftNotificationsTable as draftNotifications,
  logisticsCarriersTable as carriers, logisticsShipmentsTable as shipments,
} from "@workspace/db";
import { actOnPool, getPoolWorkspace, syncInternalPool, syncPoolSource } from "./logisticsPool";
const founder = {userId:"pool-TEST-founder",isFounder:true}, operator = {userId:"pool-TEST-operator",isFounder:false};
const future = () => new Date(Date.now()+7*86400000).toISOString().slice(0,10);
function person(role: PoolPayload["role"], extra: Partial<PoolPayload> = {}): PoolPayload {
  return {role,name:`TEST ${role}`,location:role === "seller" ? "Mersin" : "Irak",origin:"Mersin",destination:"Irak",products:["narenciye"],transportMode:"road",
    capacityKg:24000,requiredKg:1000,volumeM3:null,availableDate:future(),requiredDate:future(),contact:`${role}@example.invalid`,reference:`TEST-${role}`,sourceUrl:null,isTest:true,verified:true,eligible:true,...extra};
}
function row(id:string, p: PoolPayload): PoolRow {return {id,payload:p,active:true,fingerprint:digest(p),lastSeenAt:new Date()};}
afterEach(() => {state.tx=null;vi.unstubAllEnvs();});
describe("Real matching logic and source boundary", () => {
  it("builds buyer/seller/carrier and load/carrier suggestions with reasons, not transactions", () => {
    const result = suggestPoolMatches([row("b",person("buyer")),row("s",person("seller")),row("c",person("carrier")),row("l",person("load"))]);
    expect(result.some(m => m.entryIds.join(",") === "b,s,c")).toBe(true);
    expect(result.some(m => m.entryIds.join(",") === "l,c")).toBe(true);
    expect(result.every(m => m.introduction.includes("mesaj gönderilmedi"))).toBe(true);
  });
  it("does not mix TEST and real parties or guess routes or insufficient capacities", () => {
    for (const extra of [{isTest:false},{origin:"İstanbul"},{capacityKg:500}]) {
      expect(suggestPoolMatches([row("l",person("load")),row("c",person("carrier",extra))])).toHaveLength(0);
    }
  });
  it("preserves unknown capacity/date as missing and rejects incompatible mode/date", () => {
    const load = row("l",person("load"));
    const unknown = suggestPoolMatches([load,row("c",person("carrier",{capacityKg:null,availableDate:null}))]);
    expect(unknown[0].missing).toContain("Yük miktarı / taşıyıcı kapasitesi teyidi");
    expect(suggestPoolMatches([load,row("c",person("carrier",{transportMode:"sea"}))])).toHaveLength(0);
    expect(suggestPoolMatches([load,row("c",person("carrier",{availableDate:"2099-01-01"}))])).toHaveLength(0);
  });
  it("rejects old/inactive/ineligible loads and self-trades", () => {
    expect(suggestPoolMatches([row("l",person("load",{requiredDate:"2000-01-01"})),row("c",person("carrier"))])).toHaveLength(0);
    expect(suggestPoolMatches([row("b",person("buyer",{name:"SAME"})),row("s",person("seller",{name:"SAME"}))])).toHaveLength(0);
    expect(suggestPoolMatches([{...row("l",person("load")),active:false},row("c",person("carrier"))])).toHaveLength(0);
  });
  it("normalizes Turkish/corridor words but does not invent units", () => {
    expect(normalized("TÜRKİYE")).toBe(normalized("Turkey"));
    expect(explicitKg("24 ton")).toBe(24000);
    for (const x of ["24","24 araç","24 ton / 80 m3","uygun kapasite"]) expect(explicitKg(x)).toBeNull();
  });
  it("deduplicates explicit matching contacts without merging different parties by fuzzy name", () => {
    const c = person("carrier");
    const result = suggestPoolMatches([row("l",person("load")),row("c",c),row("duplicate",c)]);
    expect(result).toHaveLength(1);
  });
  it("blocks private, metadata, mapped IPv6 and credentialed source addresses", () => {
    for(const ip of ["127.0.0.1","10.1.2.3","169.254.169.254","100.64.0.1","192.168.0.1","::1","::ffff:127.0.0.1","fc00::1","fec0::1","64:ff9b::a00:1"]) expect(publicAddress(ip)).toBe(false);
    expect(publicAddress("8.8.8.8")).toBe(true);expect(publicAddress("2606:4700:4700::1111")).toBe(true);
    for(const url of ["http://feed.tld/a","https://localhost/a","https://127.0.0.1/a","https://user:pass@feed.tld/a","https://feed.tld/a?token=x","https://feed.tld:8443/a","https://feed.invalid/a"]) expect(()=>safeFeedUrl(url)).toThrow();
  });
  it("requires explicit real feed structure, bounded IDs and valid dates, never fake defaults", () => {
    expect(feedSchema.parse({items:[{id:"x",role:"buyer",name:"TEST ONLY"}]}).items[0].name).toBe("TEST ONLY");
    for(const data of [{items:[{id:"x",role:"buyer"}]},{items:[{id:"x",role:"buyer",name:"TEST",requiredDate:"2026-02-31"}]},
      {items:[{id:"x",role:"buyer",name:"TEST"},{id:"x",role:"seller",name:"TEST"}]}]) expect(feedSchema.safeParse(data).success).toBe(false);
  });
  it("rejects nonfounder source configuration and reviews before touching any database", async () => {
    for(const action of ["source_create","source_update","review"] as const) await expect(actOnPool({action},operator)).rejects.toMatchObject({status:403});
  });
});
const dbDescribe = process.env.LOGISTICS_POOL_DB_TEST === "1" ? describe : describe.skip;
dbDescribe("Isolated PostgreSQL pool persistence", () => {
  let real: typeof import("@workspace/db");
  beforeAll(async () => {
    if(process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Production forbidden");
    real = await vi.importActual("@workspace/db");
    const result = await real.db.execute(sql`SELECT current_database() AS name, oid FROM pg_database WHERE datname=current_database()`);
    expect(result.rows).toMatchObject([{name:"heliumdb",oid:16384}]);
  });
  beforeEach(() => {vi.stubEnv("NODE_ENV","test");});
  async function isolated(fn:()=>Promise<void>) {
    const rollback = new Error("ROLLBACK ONLY TEST");
    try {await real.db.transaction(async tx => {
      for(const name of ["logistics_pool_sources","logistics_pool_entries","logistics_pool_matches","logistics_pool_ai_drafts","logistics_pool_draft_notifications","logistics_requests","logistics_shipments","logistics_carriers","b2b_listings","b2b_business_profiles"]) {
        await tx.execute(sql.raw(`CREATE TEMP TABLE "${name}" (LIKE public."${name}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP`));
      }
      state.tx=tx; await fn(); throw rollback;
    });} catch(error) {if(error !== rollback) throw error;} finally {state.tx=null;}
  }
  async function seed() {
    await state.tx.insert(requests).values({id:901,referenceCode:"POOL-TEST-901",requesterName:"TEST ONLY",email:"load@example.invalid",phone:"+900000000000",
      origin:"Mersin",destination:"Irak",cargoType:"Narenciye",weightKg:1000,volumeM3:10,transportMode:"road",loadingDate:future(),isTest:true});
    await state.tx.insert(shipments).values({id:901,requestId:901,referenceCode:"POOL-TEST-901",status:"new_request"});
    await state.tx.insert(carriers).values({id:902,referenceCode:"POOL-TEST-902",companyName:"TEST Carrier",contactName:"TEST ONLY",email:"carrier@example.invalid",phone:"+900000000000",
      serviceRoutes:"Mersin → Irak",transportMode:"road",capacity:"24 ton",availability:future(),status:"approved",isTest:true});
    await syncInternalPool();
  }
  it("automatically persists a real source projection and idempotent matches without altering originals", async () => isolated(async () => {
    await seed(); const first = await getPoolWorkspace(founder); await syncInternalPool(); const next = await getPoolWorkspace(founder);
    expect(first.entries).toHaveLength(2); expect(next.matches).toHaveLength(1);
    expect(next.matches[0]).toMatchObject({id:first.matches[0].id,version:1,status:"pending"});
    const [r] = await state.tx.select().from(requests); expect(r).toMatchObject({isTest:true,referenceCode:"POOL-TEST-901"});
  }));
  it("shows the no-send Telegram TEST record only to the founder", async () => isolated(async () => {
    await seed();
    const [match] = await state.tx.select().from(matches);
    await state.tx.insert(aiDrafts).values({
      matchId:match.id,matchVersion:match.version,snapshotHash:match.snapshotHash,
      summary:"TEST draft summary",introductionDraft:"TEST introduction",missingChecks:[],
    });
    const [draft] = await state.tx.select().from(aiDrafts);
    await state.tx.insert(draftNotifications).values({draftId:draft.id,channel:"telegram",status:"dry_run"});

    const founderView = await getPoolWorkspace(founder);
    const operatorView = await getPoolWorkspace(operator);
    expect(founderView.matches[0]?.aiDraft?.telegramNotificationStatus).toBe("dry_run");
    expect(operatorView.matches[0]?.aiDraft).toBeNull();
    const [notification] = await state.tx.select().from(draftNotifications);
    expect(notification.status).toBe("dry_run");
  }));
  it("binds actual founder review to the version, persists it and rejects stale repeat decisions", async () => isolated(async () => {
    await seed(); const m = (await getPoolWorkspace(founder)).matches[0];
    await expect(actOnPool({action:"review",id:m.id,expectedVersion:1,decision:"approved",note:"TEST inspection"},founder)).rejects.toMatchObject({status:400});
    const approved = await actOnPool({action:"review",id:m.id,expectedVersion:1,decision:"approved",note:"TEST explicit information inspection",informationConfirmed:true},founder);
    expect(approved.matches[0]).toMatchObject({status:"approved",reviewedBy:founder.userId,version:2});
    expect(approved.matches[0].events.at(-1)?.actorUserId).toBe(founder.userId);
    await expect(actOnPool({action:"review",id:m.id,expectedVersion:1,decision:"approved",note:"TEST retry",informationConfirmed:true},founder)).rejects.toMatchObject({status:409});
    await syncInternalPool(); expect((await getPoolWorkspace(founder)).matches[0].status).toBe("approved");
  }));
  it("withdraws changed/rejected/deleted source parties instead of keeping previous approval", async () => isolated(async () => {
    await seed(); const m = (await getPoolWorkspace(founder)).matches[0];
    await actOnPool({action:"review",id:m.id,expectedVersion:1,decision:"approved",note:"TEST inspection",informationConfirmed:true},founder);
    await state.tx.update(carriers).set({status:"rejected"}).where(eq(carriers.id,902)); await syncInternalPool();
    expect((await getPoolWorkspace(founder)).matches[0]).toMatchObject({status:"stale",reviewedBy:null});
    await state.tx.delete(requests).where(eq(requests.id,901)); await syncInternalPool();
    expect((await getPoolWorkspace(founder)).entries.find(e=>e.role==="load")?.active).toBe(false);
  }));
  it("imports every feed item, handles removals and keeps source failures visible without stale matches", async () => isolated(async () => {
    await actOnPool({action:"source_create",name:"TEST source",url:"https://feeds.vendor.tld/pool.json",consentConfirmed:true},founder);
    const s = (await getPoolWorkspace(founder)).sources[0];
    const read = async () => feedSchema.parse({items:[{id:"b",role:"buyer",name:"TEST BUYER",location:"Irak",products:["narenciye"],isTest:true},
      {id:"s",role:"seller",name:"TEST SELLER",location:"Mersin",products:["narenciye"],isTest:true}]}).items;
    await syncPoolSource(s.id,read);
    expect((await getPoolWorkspace(founder)).matches).toHaveLength(1);
    await state.tx.update(sources).set({lastAttemptAt:new Date(0)}).where(eq(sources.id,s.id));
    await syncPoolSource(s.id,async()=>[]);
    expect((await getPoolWorkspace(founder)).matches[0].status).toBe("stale");
    await state.tx.update(sources).set({lastAttemptAt:new Date(0)}).where(eq(sources.id,s.id));
    await expect(syncPoolSource(s.id,async()=>{throw Error("UNTRUSTED PRIVATE URL MUST NOT LEAK");})).rejects.toMatchObject({status:502});
    const failed = await getPoolWorkspace(founder);
    expect(failed.sources[0].lastError).toContain("Kaynak alınamadı");
    expect(JSON.stringify(failed)).not.toContain("UNTRUSTED");
  }));
  it("requires source consent, unique source URL and pinned configuration versions", async () => isolated(async () => {
    await expect(actOnPool({action:"source_create",name:"TEST",url:"https://feeds.vendor.tld/pool.json"},founder)).rejects.toMatchObject({status:400});
    const w = await actOnPool({action:"source_create",name:"TEST",url:"https://feeds.vendor.tld/pool.json",consentConfirmed:true},founder);
    await expect(actOnPool({action:"source_create",name:"TEST",url:w.sources[0].url,consentConfirmed:true},founder)).rejects.toMatchObject({status:409});
    const disabled = await actOnPool({action:"source_update",id:w.sources[0].id,expectedVersion:1,enabled:false},founder);
    expect(disabled.externalDiscoveryConfigured).toBe(false);
    await expect(actOnPool({action:"source_update",id:w.sources[0].id,expectedVersion:1,enabled:true},founder)).rejects.toMatchObject({status:409});
  }));
});
