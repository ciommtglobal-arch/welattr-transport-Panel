import { type FeedItem } from "./logisticsPoolFeed";
import { fold } from "./logisticsPoolEngine";
import { marketRoute, marketDate, marketVehicleTypes } from "./marketTextFields";
import { marketWeightKg } from "./marketWeight";

export type MarketExtraction = {
  item: FeedItem;
  metadata: { is_market_feed: true; vehicleType: string; vehicleTypes: string[]; cargoType: string; parserMissing: string[]; eligible: boolean };
};
/** Conservative Turkish ad parser. No model/tools, inferred prices or raw-message storage. */
export function parseMarketText(text: string, id: string, occurredAt = new Date()): MarketExtraction | null {
  if (!text.trim() || text.length > 8192) return null;
  const plain = fold(text);
  const isCarrier = /\b(bos (?:arac|tir|kamyon)|(?:arac|tir|tirim|aracim|kamyon) bos|yuk araniyor|yuk ariyorum|bos donus|arac musait)\b/.test(plain);
  const explicitLoad = /\b(yuk var|yukumuz var|yuk mevcut|arac araniyor|tir araniyor|arac lazim|tir lazim)\b/.test(plain);
  const [origin, destination] = marketRoute(text);
  const routeOnly = !isCarrier && !explicitLoad && !!origin && !!destination;
  const isLoad = explicitLoad || routeOnly || (!isCarrier && /\b(yuk|yukumuz|yukleme|paletli|dokme|parsiyel)\b/.test(plain) && /\d+\s*(?:[.,]\d+)?\s*(?:ton|tonluk|kg|tonaj|t)\b/.test(plain));
  if (isLoad === isCarrier) return null;
  const missing: string[] = [];
  if (routeOnly && !/\b(yuk|yukumuz|yukleme|paletli|dokme|parsiyel)\b/.test(plain)) missing.push("Yük/araç ilan türü teyidi");
  if (!origin || !destination) missing.push("Tek ve yönü açık çıkış → varış rotası");
  const kg = marketWeightKg(text) ?? 0;
  if (!kg || kg > 1e9) missing.push("Tek ve geçerli tonaj/kapasite");
  const types = marketVehicleTypes(text);
  const vehicleType = types.length === 1 ? types[0] : types.join("/");
  // Loads can explicitly allow alternatives; a carrier cannot claim two bodies
  // without review. Unseparated multiple types and negated descriptions are held.
  if (!types.length || (types.length > 1 && (isCarrier || !/(\/|\bveya\b|\byada\b|\bya da\b)/iu.test(text))) ||
      /\b(degil|olmaz|istemiyoruz|haric)\b/.test(plain)) missing.push("Araç tipi/alternatifleri teyidi");
  const cargoTypes = ["parsiyel", "komple", "dokme", "paletli", "konteyner"].filter(t => new RegExp(`\\b${t}\\b`).test(plain));
  const cargoType = cargoTypes.join("/");
  if (isLoad && !cargoType) missing.push("Yük tipi");
  const date = marketDate(text, occurredAt);
  if (!date) missing.push("Açık ve çelişkisiz taşıma tarihi");
  const phone = text.match(/(?:\+90[\s.-]*|0)?5\d{2}[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b/)?.[0]?.replace(/[^\d+]/g, "") ?? "";
  const item: FeedItem = {
    id, role: isLoad ? "load" : "carrier", name: isLoad ? "Piyasa yük adayı" : "Piyasa taşıyıcı adayı",
    origin, destination, location: origin, transportMode: "road", products: cargoType ? [cargoType] : [],
    contact: phone, reference: id, isTest: /\b(test|deneme|ornek|sentetik)\b/.test(plain),
    ...(kg > 0 && kg <= 1e9 ? (isLoad ? { requiredKg: kg } : { capacityKg: kg }) : {}),
    ...(date ? (isLoad ? { requiredDate: date } : { availableDate: date }) : {}),
  };
  // Only unambiguous labelled prices are accepted; never interpret arbitrary amounts.
  const prices = [...text.matchAll(/(?:fiyat|navlun)\s*:\s*(\d{1,9})(?:[.,](\d{2}))?\s*(TRY|TL|USD|EUR)\b/gi)];
  if (prices.length === 1) {
    item.quotedPriceMinor = Number(prices[0][1]) * 100 + Number(prices[0][2] ?? 0);
    item.currency = prices[0][3].toUpperCase() === "TL" ? "TRY" : prices[0][3].toUpperCase() as "USD" | "EUR" | "TRY";
  }
  return { item, metadata: { is_market_feed: true, vehicleType, vehicleTypes:types, cargoType, parserMissing: missing, eligible: missing.length === 0 } };
}

/** Split only explicit route starts; details stay with their own advertisement.
 * Ambiguous shared footer/preamble information is not copied across loads.
 */
export function parseMarketTexts(text: string, id: string, occurredAt = new Date()): MarketExtraction[] {
  if (!text.trim() || text.length > 8192) return [];
  const lines = text.split(/\r?\n/);
  const starts = lines.flatMap((line, index) => marketRoute(line).every(Boolean) ? [index] : []);
  if (starts.length <= 1) {
    const result = parseMarketText(text, id, occurredAt);
    return result ? [result] : [];
  }
  const isTest = /\b(test|deneme|ornek|sentetik)\b/.test(fold(text));
  return starts.map((start, index) => {
    const part = lines.slice(start, starts[index + 1] ?? lines.length).join("\n");
    const result = parseMarketText(part, `${id}:part:${index + 1}`, occurredAt);
    if (result && isTest) result.item.isTest = true;
    return result;
  }).filter((result): result is MarketExtraction => result !== null);
}
