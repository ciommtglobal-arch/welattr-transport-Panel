import { type FeedItem } from "./logisticsPoolFeed";
import { fold } from "./logisticsPoolEngine";

export type MarketExtraction = {
  item: FeedItem;
  metadata: { is_market_feed: true; vehicleType: string; cargoType: string; parserMissing: string[]; eligible: boolean };
};
/** Conservative Turkish ad parser. No model/tools, inferred prices or raw-message storage. */
export function parseMarketText(text: string, id: string): MarketExtraction | null {
  if (!text.trim() || text.length > 8192) return null;
  const plain = fold(text);
  const isLoad = /\b(yuk var|yukumuz var|yuk mevcut|arac araniyor|tir araniyor)\b/.test(plain);
  const isCarrier = /\b(bos arac|bos tir|arac bos|tirim bos|yuk araniyor|yuk ariyorum)\b/.test(plain);
  if (isLoad === isCarrier) return null;
  const missing: string[] = [];
  // Accept explicit direction only; unordered city mentions are not a route.
  const routes = [...text.matchAll(/(?:^|[;\n])\s*([\p{L} ]{2,60})\s*(?:→|->)\s*([\p{L} ]{2,60})(?=$|[;\n])/gu)];
  const origin = routes.length === 1 ? routes[0][1].trim() : "";
  const destination = routes.length === 1 ? routes[0][2].trim() : "";
  if (!origin || !destination) missing.push("Tek ve yönü açık çıkış → varış rotası");
  const weights = [...text.matchAll(/\b(\d+(?:[.,]\d{1,2})?)\s*(ton|kg)\b/gi)];
  const kg = weights.length === 1 ? Number(weights[0][1].replace(",", ".")) * (weights[0][2].toLowerCase() === "ton" ? 1000 : 1) : 0;
  if (!kg || kg > 1e9) missing.push("Tek ve geçerli tonaj/kapasite");
  const types = ["tenteli", "acik", "damper", "frigo", "sasi"].filter(t => new RegExp(`\\b${t}\\b`).test(plain));
  const vehicleType = types.length === 1 ? types[0] : "";
  if (!vehicleType) missing.push("Tek araç tipi");
  const cargoTypes = ["parsiyel", "komple", "dokme", "paletli", "konteyner"].filter(t => new RegExp(`\\b${t}\\b`).test(plain));
  const cargoType = cargoTypes.length === 1 ? cargoTypes[0] : "";
  if (isLoad && !cargoType) missing.push("Yük tipi");
  const dates = [...text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)];
  let date: string | undefined;
  if (dates.length === 1) {
    const d = new Date(dates[0][1]);
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dates[0][1]) date = dates[0][1];
  }
  if (!date) missing.push("Açık ISO taşıma tarihi");
  const phone = text.match(/(?:\+90|0)\s*5\d{2}[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b/)?.[0] ?? "";
  const item: FeedItem = {
    id, role: isLoad ? "load" : "carrier", name: isLoad ? "Piyasa yük adayı" : "Piyasa taşıyıcı adayı",
    origin, destination, location: origin, transportMode: "road", products: cargoType ? [cargoType] : [],
    contact: phone, reference: id, isTest: false,
    ...(kg > 0 && kg <= 1e9 ? (isLoad ? { requiredKg: kg } : { capacityKg: kg }) : {}),
    ...(date ? (isLoad ? { requiredDate: date } : { availableDate: date }) : {}),
  };
  // Only unambiguous labelled prices are accepted; never interpret arbitrary amounts.
  const prices = [...text.matchAll(/(?:fiyat|navlun)\s*:\s*(\d{1,9})(?:[.,](\d{2}))?\s*(TRY|TL|USD|EUR)\b/gi)];
  if (prices.length === 1) {
    item.quotedPriceMinor = Number(prices[0][1]) * 100 + Number(prices[0][2] ?? 0);
    item.currency = prices[0][3].toUpperCase() === "TL" ? "TRY" : prices[0][3].toUpperCase() as "USD" | "EUR" | "TRY";
  }
  return { item, metadata: { is_market_feed: true, vehicleType, cargoType, parserMissing: missing, eligible: missing.length === 0 } };
}
