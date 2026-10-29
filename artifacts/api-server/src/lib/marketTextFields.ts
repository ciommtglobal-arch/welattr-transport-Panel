import { fold } from "./logisticsPoolEngine";

const place = "[\\p{L}][\\p{L} /-]{1,70}?";
export function marketRoute(text: string): [string, string] {
  // Mobile keyboards use several apostrophes and invisible formatting marks.
  text = text.normalize("NFC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/[’‘ʼ`´]/g, "'")
    .replace(/\s*'\s*/g, "'");
  const pairs: [string, string][] = [];
  const add = (a: string, b: string) => pairs.push([a.trim(), b.trim()]);
  for (const m of text.matchAll(new RegExp(`(?:^|[;\\n.!])\\s*(${place})\\s*(?:→|->)\\s*(${place})(?=$|[;\\n.!\\d])`, "gu"))) add(m[1], m[2]);
  // Explicit Turkish directional suffixes, with or without apostrophes.
  for (const m of text.matchAll(new RegExp(`(?:^|[:;\\n.!])\\s*(${place})'?(?:dan|den|tan|ten)\\s+(${place})'?(?:ya|ye|a|e)(?=\\s+(?:\\d|yük|yuk|boş|bos|araç|arac|tır|tir)|[,;\\n.!]|$)`, "giu"))) add(m[1], m[2]);
  const from = /(?:çıkış|cikis|yükleme yeri|yukleme yeri)\s*:\s*([^\n;]+)/iu.exec(text);
  const to = /(?:varış|varis|teslim yeri)\s*:\s*([^\n;]+)/iu.exec(text);
  if (from && to && /^[\p{L} /-]{2,70}$/u.test(from[1].trim()) && /^[\p{L} /-]{2,70}$/u.test(to[1].trim())) add(from[1], to[1]);
  const unique = new Map(pairs.map(p => [p.map(fold).join("|"), p]));
  return unique.size === 1 ? [...unique.values()][0] : ["", ""];
}

function validDay(day: string) {
  const d = new Date(day);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}
/** Relative dates refer to original message time in Turkey, not retry/processing time. */
export function marketDate(text: string, occurredAt: Date): string | undefined {
  if (Number.isNaN(occurredAt.getTime())) return;
  const explicit = [...text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(m => m[1]);
  for (const m of text.matchAll(/\b(\d{2})[./](\d{2})[./](\d{4})\b/g)) explicit.push(`${m[3]}-${m[2]}-${m[1]}`);
  if (explicit.some(d => !validDay(d))) return;
  const plain = fold(text);
  const today = new Date(occurredAt.getTime() + 3 * 3600000).toISOString().slice(0, 10);
  const tomorrow = new Date(new Date(`${today}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
  if (/\b(bugun|hemen yukleme|hemen musait|simdi yukleme)\b/.test(plain)) explicit.push(today);
  if (/\byarin\b/.test(plain)) explicit.push(tomorrow);
  const unique = [...new Set(explicit)];
  return unique.length === 1 ? unique[0] : undefined;
}

export function marketVehicleTypes(text: string): string[] {
  const plain = fold(text);
  const definitions: [string, RegExp][] = [
    ["tenteli", /\b(tenteli|tente)\b/],
    ["kapali_kasa", /\bkapali kasa\b/],
    ["acik", /\bacik(?: kasa)?\b/],
    ["damper", /\b(damper|damperli)\b/],
    ["frigo", /\b(frigo|frigorifik|sogutuculu)\b/],
    ["sasi", /\bsasi\b/],
  ];
  return definitions.filter(([, pattern]) => pattern.test(plain)).map(([type]) => type);
}
