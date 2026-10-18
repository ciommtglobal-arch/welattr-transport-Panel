import {
  db, logisticsPoolSourcesTable as sources, logisticsPoolEntriesTable as entries,
  logisticsPoolMatchesTable as matches, logisticsRequestsTable as requests,
  logisticsShipmentsTable as shipments, logisticsCarriersTable as carriers,
  b2bListingsTable as listings, b2bBusinessProfilesTable as profiles,
  type PoolPayload,
} from "@workspace/db";
import { and, eq, inArray, sql, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { ActLogisticsPoolBody } from "@workspace/api-zod";
import { digest, productWords, explicitKg, suggestPoolMatches, type PoolRow } from "./logisticsPoolEngine";
import { readPublicFeed, safeFeedUrl, feedSchema, type FeedItem } from "./logisticsPoolFeed";
import type { LogisticsActor } from "./logisticsWorkflowAuth";
import { isLogisticsFounder } from "./logisticsListingAuth";
import { AutomationError } from "./logisticsAutomation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Action = z.infer<typeof ActLogisticsPoolBody>;
function fail(status: number, text: string): never { throw new AutomationError(status,text); }
const event = (action: string, note: string, actor?: LogisticsActor) => ({at:new Date().toISOString(),action,note,actorUserId:actor?.userId ?? null});
const empty = (): PoolPayload => ({role:"load",name:"",location:"",origin:"",destination:"",products:[],transportMode:"",capacityKg:null,requiredKg:null,volumeM3:null,availableDate:null,requiredDate:null,contact:"",reference:"",sourceUrl:null,isTest:false,verified:false,eligible:true});
async function lock(tx: Tx) { await tx.execute(sql`SELECT pg_advisory_xact_lock(4135531)`); }
async function upsert(tx: Tx, originKey: string, sourceKind: string, payload: PoolPayload, sourceId: string | null = null) {
  const data = {originKey,sourceKind,sourceId,payload,fingerprint:digest(payload),active:true,lastSeenAt:new Date()};
  await tx.insert(entries).values(data).onConflictDoUpdate({target:entries.originKey,set:data});
}
async function rebuild(tx: Tx) {
  const rows = await tx.select().from(entries).orderBy(entries.originKey);
  if (rows.length > 10000) fail(413,"Havuz 10.000 kayıt sınırında; kaynak kapsamını daraltın.");
  const eligible = rows.filter(r => r.lastSeenAt.getTime() >= Date.now()-7*86400000);
  const generated = suggestPoolMatches(eligible);
  const existing = await tx.select().from(matches);
  const byKey = new Map(existing.map(m => [m.matchKey,m]));
  const generatedKeys = new Set(generated.map(m => m.matchKey));
  for (const m of existing) if (!generatedKeys.has(m.matchKey) && m.status !== "stale") {
    await tx.update(matches).set({status:"stale",version:m.version+1,reviewedBy:null,reviewedAt:null,updatedAt:new Date(),
      events:[...m.events,event("stale","Kaynak değişti, kapandı, eskidi veya eşleşme kapsamından çıktı; önceki karar geçersiz.")]}).where(eq(matches.id,m.id));
  }
  for (const candidate of generated) {
    const previous = byKey.get(candidate.matchKey);
    if (previous && previous.snapshotHash === candidate.snapshotHash && previous.status !== "stale") continue;
    const changed = {...candidate,status:"pending",reviewedBy:null,reviewedAt:null,updatedAt:new Date(),
      version:previous ? previous.version+1 : 1,
      events:[...(previous?.events ?? []),event("suggested","Gerçek kaynaklardan öneri oluşturuldu; ticari karar veya dış gönderim yapılmadı.")]};
    if (previous) await tx.update(matches).set(changed).where(eq(matches.id,previous.id));
    else await tx.insert(matches).values(changed);
  }
}
export async function syncInternalPool() {
  await db.transaction(async tx => {
    await lock(tx);
    const loads = await tx.select({r:requests,s:shipments.status}).from(requests).leftJoin(shipments,eq(shipments.requestId,requests.id)).limit(1001);
    const fleet = await tx.select().from(carriers).limit(1001);
    const offers = await tx.select({l:listings,p:profiles.status}).from(listings).leftJoin(profiles,eq(listings.businessProfileId,profiles.id)).limit(1001);
    if ([loads,fleet,offers].some(rows => rows.length > 1000)) fail(413,"İç kaynak başına 1.000 kayıt sınırı aşıldı; tarama kapsamını daraltın.");
    await tx.update(entries).set({active:false}).where(sql`${entries.sourceId} IS NULL`);
    for (const {r,s} of loads) await upsert(tx,`load:${r.id}`,"mmt_load",{
      ...empty(),role:"load",name:r.organization || r.requesterName,origin:r.origin,destination:r.destination,
      location:r.origin,products:productWords(r.cargoType),transportMode:r.transportMode,requiredKg:r.weightKg,volumeM3:r.volumeM3 > 0 ? r.volumeM3 : null,
      requiredDate:r.loadingDate,contact:[r.email,r.phone].filter(Boolean).join(" · "),reference:r.referenceCode,
      isTest:r.isTest,eligible:s !== "delivered",
    });
    for (const c of fleet) {
      // Free text is not GPS or capacity verification. Only one explicitly
      // directed route and an unambiguous unit can support a route suggestion.
      const route = c.serviceRoutes.split(/\s*(?:→|->)\s*/);
      await upsert(tx,`carrier:${c.id}`,"mmt_carrier",{...empty(),role:"carrier",name:c.companyName,
        origin:route.length === 2 ? route[0] : "",destination:route.length === 2 ? route[1] : "",
        location:c.serviceRoutes,transportMode:c.transportMode,capacityKg:explicitKg(c.capacity),
        contact:[c.email,c.phone].filter(Boolean).join(" · "),reference:c.referenceCode,
        isTest:c.isTest,verified:c.status === "approved",eligible:c.status === "approved",
        availableDate:/^\d{4}-\d{2}-\d{2}$/.test(c.availability) ? c.availability : null,
      });
    }
    for (const {l,p} of offers) {
      if (!["buyer","producer"].includes(l.role) || l.status !== "approved" || (l.businessProfileId !== null && p !== "verified")) continue;
      await upsert(tx,`listing:${l.id}`,"mmt_b2b",{...empty(),role:l.role === "buyer" ? "buyer" : "seller",
        name:l.organization,location:l.location,products:productWords(l.title),contact:l.contact,reference:l.referenceCode,
        verified:p === "verified",
      });
    }
    await rebuild(tx);
  });
}
function payload(item: FeedItem, sourceUrl: string): PoolPayload {
  return {...empty(),...item,transportMode:item.transportMode ?? "",capacityKg:item.capacityKg ?? null,
    volumeM3:item.volumeM3 ?? null,
    requiredKg:item.requiredKg ?? null,availableDate:item.availableDate ?? null,requiredDate:item.requiredDate ?? null,
    reference:item.reference ?? item.id,sourceUrl:item.sourceUrl ?? sourceUrl,verified:false,eligible:true};
}
export async function syncPoolSource(id: string, read: typeof readPublicFeed = readPublicFeed) {
  const capture = await db.transaction(async tx => {
    await lock(tx);
    const [s] = await tx.select().from(sources).where(eq(sources.id,id)).for("update");
    if (!s || !s.enabled) fail(409,"Kaynak kapalı veya bulunamadı.");
    if (s.lastAttemptAt && Date.now()-s.lastAttemptAt.getTime() < 30000) fail(409,"Kaynak kısa süre önce tarandı; tarama bitince yenileyin.");
    const attempt = new Date();
    await tx.update(sources).set({lastAttemptAt:attempt}).where(eq(sources.id,id));
    return {...s,attempt};
  });
  let items: FeedItem[];
  try { items = feedSchema.parse({items:await read(capture.url)}).items; }
  catch {
    await db.transaction(async tx => {
      await lock(tx);
      const [s] = await tx.select().from(sources).where(eq(sources.id,id));
      if (!s || s.version !== capture.version || s.lastAttemptAt?.getTime() !== capture.attempt.getTime()) return;
      await tx.update(sources).set({lastError:"Kaynak alınamadı veya JSON biçimi doğrulanamadı. Eski kayıtlar eşleştirmeden çıkarıldı."}).where(eq(sources.id,id));
      await tx.update(entries).set({active:false}).where(eq(entries.sourceId,id));
      await rebuild(tx);
    });
    fail(502,"Kaynak doğrulanamadı; eski kaynak kayıtları güvenli biçimde askıya alındı.");
  }
  await db.transaction(async tx => {
    await lock(tx);
    const [s] = await tx.select().from(sources).where(eq(sources.id,id)).for("update");
    if (!s?.enabled || s.version !== capture.version || s.lastAttemptAt?.getTime() !== capture.attempt.getTime()) fail(409,"Tarama sırasında kaynak değişti; eski sonuç uygulanmadı.");
    await tx.update(entries).set({active:false}).where(eq(entries.sourceId,id));
    for (const item of items) await upsert(tx,`feed:${id}:${item.id}`,"authorized_feed",payload(item,capture.url),id);
    await tx.update(sources).set({lastSuccessAt:new Date(),lastError:null}).where(eq(sources.id,id));
    await rebuild(tx);
  });
}
export async function refreshPool(includeSources = true) {
  await syncInternalPool();
  if (includeSources) {
    const configured = await db.select().from(sources).where(eq(sources.enabled,true));
    for (const source of configured) {
      if (source.lastAttemptAt && Date.now()-source.lastAttemptAt.getTime() < 15*60000) continue;
      try { await syncPoolSource(source.id); } catch (error) { if (!(error instanceof AutomationError)) throw error; }
    }
  }
}
export async function getPoolWorkspace(actor: LogisticsActor) {
  const [pool, suggestions, feeds] = await db.transaction(async tx => {
    const pool = await tx.select().from(entries).orderBy(desc(entries.lastSeenAt)).limit(10001);
    const suggestions = await tx.select().from(matches).orderBy(desc(matches.updatedAt)).limit(1001);
    const feeds = await tx.select().from(sources).orderBy(sources.createdAt);
    return [pool,suggestions,feeds] as const;
  },{isolationLevel:"repeatable read",accessMode:"read only"});
  return {
    canApprove:isLogisticsFounder(actor.userId),externalDiscoveryConfigured:feeds.some(s => s.enabled),
    automaticSchedule:"Canlı sunucu aktifken iç havuz 2 dakikada, izinli dış kaynaklar en erken 15 dakikada taranır. Panel açıkken de yenilenir; kesintisiz 7/24 worker garantisi değildir.",
    limits:["Her iç kaynakta en çok 1.000, dış beslemede 1.000 kayıt; havuzda 10.000 kayıt.", "Rol başına en çok 200 taraf, 300 alıcı–satıcı çifti ve 1.000 güncel öneri değerlendirilir; benzerlik puanı garanti değildir.",
      ...(suggestions.length > 1000 ? ["Geçmiş dahil sonuçlar ilk 1.000 kayıtla sınırlı."] : []),
      ...(!feeds.some(s => s.enabled) ? ["Dış kaynak bağlı değil: internetten yeni müşteri bulunduğu iddia edilmez."] : [])],
    entries:pool.slice(0,10000).map(e => ({...e.payload,id:e.id,sourceId:e.sourceId,sourceKind:e.sourceKind,active:e.active && e.lastSeenAt.getTime() >= Date.now()-7*86400000,lastSeenAt:e.lastSeenAt.toISOString()})),
    matches:suggestions.slice(0,1000).map(m => ({...m,updatedAt:m.updatedAt.toISOString(),reviewedAt:m.reviewedAt?.toISOString() ?? null})),
    sources:feeds.map(s => ({id:s.id,name:s.name,url:s.url,enabled:s.enabled,version:s.version,lastAttemptAt:s.lastAttemptAt?.toISOString() ?? null,lastSuccessAt:s.lastSuccessAt?.toISOString() ?? null,lastError:s.lastError})),
  };
}
export async function actOnPool(input: Action, actor: LogisticsActor) {
  if (input.action === "refresh") { await refreshPool(); return getPoolWorkspace(actor); }
  if (input.action === "source_sync") { if (!input.id) fail(400,"Kaynak kimliği gerekli."); await syncPoolSource(input.id); return getPoolWorkspace(actor); }
  if (!isLogisticsFounder(actor.userId)) fail(403,"Kaynak izni ve son eşleştirme kararı yalnız kurucuya aittir.");
  if (input.action === "source_create") {
    if (!input.name || input.name.trim().length < 2 || !input.url || input.consentConfirmed !== true) fail(400,"Gerçek kaynak adı/adresi ve veriyi kullanma yetkisi teyidi gerekli.");
    const name = input.name.trim();
    let url: string; try { url = safeFeedUrl(input.url); } catch { fail(400,"Kaynak genel HTTPS JSON adresi olmalı; gizli anahtar/sorgu parametresi kullanmayın."); }
    await db.transaction(async tx => {
      await lock(tx);
      const all = await tx.select().from(sources);
      if (all.length >= 10) fail(409,"En fazla 10 izinli kaynak eklenebilir.");
      if (all.some(s => s.url === url)) fail(409,"Bu kaynak zaten kayıtlı.");
      await tx.insert(sources).values({name,url,consentBy:actor.userId});
    });
  } else if (input.action === "source_update") {
    if (!input.id || !input.expectedVersion || input.enabled === undefined) fail(400,"Kaynak kimliği, sürümü ve açık/kapalı seçimi gerekli.");
    await db.transaction(async tx => {
      await lock(tx);
      const [s] = await tx.select().from(sources).where(eq(sources.id,input.id!)).for("update");
      if (!s) fail(404,"Kaynak bulunamadı.");
      if (s.version !== input.expectedVersion) fail(409,"Kaynak sürümü değişti; yenileyin.");
      await tx.update(sources).set({enabled:input.enabled,version:s.version+1,lastAttemptAt:null}).where(eq(sources.id,s.id));
      // Re-enable does not resurrect old snapshots; successful scan required.
      await tx.update(entries).set({active:false}).where(eq(entries.sourceId,s.id));
      await rebuild(tx);
    });
  } else if (input.action === "review") {
    if (!input.id || !input.expectedVersion || !input.decision || !input.note || input.note.trim().length < 3) fail(400,"Öneri kimliği, sürümü, karar ve gerekçe gerekli.");
    if (input.decision === "approved" && input.informationConfirmed !== true) fail(400,"Tarafların ve güncel bilgilerin incelendiğini teyit edin.");
    const [before] = await db.select().from(matches).where(eq(matches.id,input.id));
    if (!before) fail(404,"Öneri bulunamadı.");
    const parties = await db.select().from(entries).where(inArray(entries.id,before.entryIds));
    for (const sourceId of new Set(parties.map(p => p.sourceId).filter((s):s is string => Boolean(s)))) {
      const [source] = await db.select().from(sources).where(eq(sources.id,sourceId));
      if (!source?.enabled || !source.lastSuccessAt || source.lastError || source.lastSuccessAt.getTime() < Date.now()-15*60000) fail(409,"Dış kaynağı yeniden tarayıp önerinin güncel sürümünü inceleyin.");
    }
    await syncInternalPool();
    await db.transaction(async tx => {
      await lock(tx);
      const [m] = await tx.select().from(matches).where(eq(matches.id,input.id!)).for("update");
      if (!m || m.version !== input.expectedVersion || m.status !== "pending") fail(409,"Öneri değişmiş, karara bağlanmış veya geçersiz. Yeni sürümü inceleyin.");
      const p = await tx.select().from(entries).where(inArray(entries.id,m.entryIds));
      if (p.length !== m.entryIds.length || p.some(e => !e.active || !e.payload.eligible || e.payload.isTest !== p[0].payload.isTest || e.lastSeenAt.getTime()<Date.now()-7*86400000) ||
          digest(m.entryIds.map(id => {const e = p.find(r => r.id === id)!; return [id,e.fingerprint];})) !== m.snapshotHash) fail(409,"Taraflar değişti; eski sürüm onaylanamaz.");
      await tx.update(matches).set({status:input.decision,version:m.version+1,reviewedBy:actor.userId,reviewedAt:new Date(),updatedAt:new Date(),
        events:[...m.events,event(input.decision!,input.note!,actor)]}).where(eq(matches.id,m.id));
    });
  } else fail(400,"Desteklenmeyen işlem.");
  return getPoolWorkspace(actor);
}
