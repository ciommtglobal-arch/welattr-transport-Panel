import { createHash } from "node:crypto";
import type { PoolPayload } from "@workspace/db";

export type PoolRow = { id: string; payload: PoolPayload; fingerprint: string; active: boolean; lastSeenAt: Date };
export type PoolSuggestion = { matchKey: string; entryIds: string[]; snapshotHash: string; score: number; reasons: string[]; missing: string[]; introduction: string };
export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").replace(/ı/g, "i").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const aliases: Record<string, string> = { citrus: "narenciye", turkiye: "turkey", ukrayna: "ukraine", rusya: "russia", irak: "iraq", gurcistan: "georgia" };
export const normalized = (s: string) => fold(s).split(" ").map(w => aliases[w] ?? w).join(" ");
export function productWords(text: string) {
  const stop = new Set(["ve", "the", "and", "of", "icin", "for", "satilik", "alim", "satim", "alici", "satici", "uretim", "ureticisi", "talebi", "mmt", "global"]);
  return [...new Set(normalized(text).split(" ").filter(w => w.length >= 3 && !stop.has(w)))].slice(0, 24);
}
export function explicitKg(text: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(kg|ton|tonne|tons|t)\s*$/i.exec(text);
  if (!m) return null;
  const kg = Number(m[1].replace(",", ".")) * (m[2].toLowerCase() === "kg" ? 1 : 1000);
  return Number.isFinite(kg) && kg > 0 ? kg : null;
}
export function samePlace(a: string, b: string) {
  return Boolean(a.trim() && b.trim() && normalized(a) === normalized(b));
}
function carrierFit(origin: string, destination: string, kg: number | null, volumeM3: number | null, date: string | null, mode: string, c: PoolPayload) {
  if (!origin || !destination || !samePlace(origin, c.origin) || !samePlace(destination, c.destination)) return null;
  if (mode && c.transportMode && mode !== c.transportMode) return null;
  if (kg !== null && c.capacityKg !== null && c.capacityKg < kg) return null;
  if (date && c.availableDate && c.availableDate > date) return null;
  return [
    ...(kg === null || c.capacityKg === null ? ["Yük miktarı / taşıyıcı kapasitesi teyidi"] : []),
    ...(volumeM3 === null ? ["Yük hacmi bilgisi teyidi"] : []),
    ...(!date || !c.availableDate ? ["Taşıma tarihi / müsaitlik teyidi"] : []),
    ...(!mode || !c.transportMode ? ["Taşıma türü teyidi"] : []),
  ];
}
export function suggestPoolMatches(rows: PoolRow[], today = new Date().toISOString().slice(0, 10)) {
  const dedup = new Set<string>();
  const active = rows.filter(r => {
    if (!r.active || !r.payload.eligible || (r.payload.requiredDate && r.payload.requiredDate < today)) return false;
    // Source IDs are durable; cross-source identity is only deduplicated with
    // a matching explicit contact, never guessed from a similar company name.
    const p = r.payload;
    const key = p.contact ? digest([p.role, normalized(p.name), normalized(p.contact), normalized(p.location), p.products.map(normalized).sort(), normalized(p.origin), normalized(p.destination), p.isTest]) : r.id;
    if (dedup.has(key)) return false;
    dedup.add(key); return true;
  });
  const byRole = (role: PoolPayload["role"]) => active.filter(r => r.payload.role === role).sort((a,b) => a.id.localeCompare(b.id)).slice(0, 200);
  const carriers = byRole("carrier"), suggestions: PoolSuggestion[] = [];
  function add(key: string, participants: PoolRow[], score: number, reasons: string[], missing: string[]) {
    if (participants.some(p => p.payload.isTest !== participants[0].payload.isTest)) return;
    const lack = [...new Set([...missing, ...participants.filter(p => !p.payload.verified).map(p => `${p.payload.name}: firma/bilgi doğrulaması`), "Fiyat, sözleşme ve ticari koşulların ayrıca kararı"])];
    suggestions.push({
      matchKey: key, entryIds: participants.map(p => p.id),
      snapshotHash: digest(participants.map(p => [p.id, p.fingerprint])),
      score, reasons, missing: lack,
      introduction: `MMT Global — Eşleştirme önerisi\n${participants.map(p => `${p.payload.role}: ${p.payload.name} (${p.payload.reference})`).join("\n")}\n${reasons.join("; ")}.\nBu yalnız tanıştırma taslağıdır; mesaj gönderilmedi, ödeme/sözleşme/sevkiyat oluşturulmadı.`,
    });
  }
  for (const load of byRole("load")) for (const carrier of carriers) {
    const l = load.payload, c = carrier.payload;
    const loadTypes = l.vehicleTypes ?? (l.vehicleType ? [l.vehicleType] : []);
    const carrierTypes = c.vehicleTypes ?? (c.vehicleType ? [c.vehicleType] : []);
    if ((l.is_market_feed || c.is_market_feed) &&
        (!loadTypes.length || carrierTypes.length !== 1 || !loadTypes.includes(carrierTypes[0]))) continue;
    if (l.isTest !== c.isTest) continue;
    const missing = carrierFit(l.origin, l.destination, l.requiredKg, l.volumeM3, l.requiredDate, l.transportMode, c);
    if (missing) add(`load:${load.id}:${carrier.id}`, [load, carrier], 80 - missing.length * 10, ["Çıkış ve varış eşleşiyor", ...(l.requiredKg !== null && c.capacityKg !== null ? ["Beyan edilen ağırlık kapasiteye uygun"] : [])], missing);
  }
  let commerceCount = 0;
  for (const buyer of byRole("buyer")) for (const seller of byRole("seller")) {
    const b = buyer.payload, s = seller.payload;
    if (b.isTest !== s.isTest || normalized(b.name) === normalized(s.name) || (b.contact && normalized(b.contact) === normalized(s.contact))) continue;
    const common = b.products.map(normalized).filter(p => s.products.map(normalized).includes(p));
    if (!common.length || commerceCount++ >= 300) continue;
    const origin = s.origin || s.location, destination = b.destination || b.location;
    const suitable = carriers.filter(c => c.payload.isTest === b.isTest && carrierFit(origin, destination, b.requiredKg, b.volumeM3, b.requiredDate, b.transportMode || s.transportMode, c.payload) !== null).slice(0, 3);
    if (!suitable.length) add(`trade:${buyer.id}:${seller.id}`, [buyer, seller], 40, [`Ortak ürün: ${common.join(", ")}`], ["Güzergâha uygun taşıyıcı", "Ürün niteliği ve miktar teyidi"]);
    for (const carrier of suitable) add(`trade:${buyer.id}:${seller.id}:${carrier.id}`, [buyer, seller, carrier], 75, [`Ortak ürün: ${common.join(", ")}`, "Satıcı → alıcı güzergâhına uygun taşıyıcı"], carrierFit(origin, destination, b.requiredKg, b.volumeM3, b.requiredDate, b.transportMode || s.transportMode, carrier.payload)!);
  }
  return suggestions.sort((a,b) => b.score - a.score || a.matchKey.localeCompare(b.matchKey)).slice(0, 1000);
}
