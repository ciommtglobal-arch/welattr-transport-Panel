/** Zero-prefixed ton shorthand is accepted only as a standalone token.
 * Never choose one quantity when the advertisement contains conflicting weights.
 */
export function marketWeightKg(text: string): number | undefined {
  const quantities: number[] = [];
  let remaining = text.replace(
    /(?<![\p{L}\p{N}.,/+:-])(\d+(?:[.,]\d{1,2})?)\s*(tonluk|ton|kg|t)\b/giu,
    (_match, value: string, unit: string) => {
      quantities.push(Number(value.replace(",", ".")) * (unit.toLowerCase() === "kg" ? 1 : 1000));
      return " ";
    },
  );
  // Exclude dates, phone numbers, prices, identifiers and licence plates before
  // recognizing unitless shorthand. These are not evidence of cargo capacity.
  remaining = remaining
    .replace(/\d+(?:[./:-]\d+)+/g, " ")
    .replace(/(?:\+?\d[\s().-]*){7,}/g, " ")
    .replace(/\b\d{2}\s+[A-ZÇĞİÖŞÜ]{1,3}\s+\d{2,4}\b/giu, " ")
    .replace(/(?:fiyat|navlun|ücret|ucret|tutar|sipariş|siparis|referans|ref|kod|no|telefon|tel|plaka)\s*(?:no)?\s*[:#=-]?\s*\d+/giu, " ")
    .replace(/\d+\s*(?:TL|TRY|USD|EUR|adet|palet|metre|m)\b/giu, " ");
  for (const match of remaining.matchAll(/(?<![\p{L}\p{N}.,/+:#-])0(1\d|2\d|3[0-5])(?![\p{L}\p{N}.,/+:#-])/gu)) {
    quantities.push(Number(match[1]) * 1000);
  }
  const unique = [...new Set(quantities)];
  return unique.length === 1 && unique[0] > 0 && unique[0] <= 1e9 ? unique[0] : undefined;
}
