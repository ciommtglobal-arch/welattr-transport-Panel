import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request } from "node:https";
import { z } from "zod/v4";
const blocked = new BlockList();
const blockedV6 = new BlockList();
for (const [ip, bits] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]] as const) blocked.addSubnet(ip,bits,"ipv4");
for (const [ip,bits] of [["::",96],["::ffff:0:0",96],["64:ff9b::",96],["100::",64],["2001::",23],["2001:db8::",32],["2002::",16],["fc00::",7],["fe80::",10],["fec0::",10],["ff00::",8]] as const) blockedV6.addSubnet(ip,bits,"ipv6");
const globalV6 = new BlockList(); globalV6.addSubnet("2000::",3,"ipv6");
export function publicAddress(ip: string) {
  const family = isIP(ip);
  return family === 4 ? !blocked.check(ip,"ipv4") : family === 6 && globalV6.check(ip,"ipv6") && !blockedV6.check(ip,"ipv6");
}
export function safeFeedUrl(value: string) {
  const u = new URL(value);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || (u.port && u.port !== "443") ||
      !host.includes(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host) ||
      (isIP(host) && !publicAddress(host))) throw new Error("Yalnız kimlik bilgisi ve sorgu parametresi içermeyen genel HTTPS JSON kaynağı kullanılabilir.");
  return u.toString();
}
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === s;
});
export const feedItemSchema = z.object({
  quotedPriceMinor: z.number().int().positive().max(1e12).optional(),
  currency: z.enum(["TRY", "USD", "EUR"]).optional(),
  commissionBps: z.number().int().min(0).max(9500).optional(),
  id: z.string().trim().min(1).max(160), role: z.enum(["buyer","seller","carrier","load"]),
  name: z.string().trim().min(2).max(200),
  location: z.string().max(200).default(""), origin: z.string().max(200).default(""),
  destination: z.string().max(200).default(""), products: z.array(z.string().trim().min(2).max(100)).max(24).default([]),
  transportMode: z.enum(["road","sea","air","rail"]).optional(),
  capacityKg: z.number().positive().max(1e9).optional(), requiredKg: z.number().positive().max(1e9).optional(),
  volumeM3: z.number().positive().max(1e9).optional(),
  availableDate: day.optional(), requiredDate: day.optional(),
  contact: z.string().max(300).default(""), reference: z.string().max(200).optional(),
  sourceUrl: z.string().refine(s => { try { safeFeedUrl(s); return true; } catch { return false; } }).optional(),
  isTest: z.boolean().default(false),
}).strict();
export const feedSchema = z.object({ items: z.array(feedItemSchema).max(1000) }).strict().refine(f => new Set(f.items.map(i => i.id)).size === f.items.length, "Tekrarlanan kaynak kimliği");
export type FeedItem = z.infer<typeof feedItemSchema>;
export async function readPublicFeed(url: string): Promise<FeedItem[]> {
  const u = new URL(safeFeedUrl(url));
  const addresses = await lookup(u.hostname, {all:true,verbatim:true});
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error("Kaynak adresi genel ağa ait değil.");
  const pinned = addresses[0];
  // Pin validated DNS for this connection; redirects, proxies and compression
  // are not followed. TLS still verifies the original hostname.
  const raw = await new Promise<string>((resolve,reject) => {
    let count = 0; const chunks: Buffer[] = [];
    const req = request(u, {
      method:"GET", headers: {Accept:"application/json","Accept-Encoding":"identity"},
      lookup: (_hostname, options, cb) => {
        if (options?.all) cb(null,[pinned]); else cb(null,pinned.address,pinned.family);
      },
    }, res => {
      if (res.statusCode !== 200 || !/^application\/(?:json|[\w.+-]+\+json)(?:;|$)/i.test(res.headers["content-type"] ?? "") ||
          (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity")) {
        res.destroy(); req.destroy(new Error("Kaynak 200 JSON yanıtı vermedi.")); return;
      }
      res.on("data", (chunk:Buffer) => { count += chunk.length; if (count > 2*1024*1024) req.destroy(new Error("Kaynak boyut sınırı aşıldı.")); else chunks.push(chunk); });
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    const deadline = setTimeout(() => req.destroy(new Error("Kaynak zaman aşımı.")),10000);
    req.once("close", () => clearTimeout(deadline)); req.on("error",reject); req.end();
  });
  return feedSchema.parse(JSON.parse(raw)).items;
}
