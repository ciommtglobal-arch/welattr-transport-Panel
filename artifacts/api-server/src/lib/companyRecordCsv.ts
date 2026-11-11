export const EXPORT_MAX_ROWS = 10_000;
export const EXPORT_MAX_BYTES = 20 * 1024 * 1024;
export const EXPORT_PAGE_SIZE = 250;
const DAY = 86_400_000;
export const INTERNAL_RECORD_NOTICE = "Yalnızca şirket içi arşiv kaydıdır. Resmi banka belgesi, mühür, kredi onayı, finansal güvence veya para hareketi değildir.";

// Both dates are inclusive calendar days in Turkey, not browser-local instants.
export function exportDateRange(start: string, end: string) {
  const calendar = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
    const value = Date.parse(`${s}T00:00:00Z`);
    return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === s ? value : NaN;
  };
  const a = calendar(start), b = calendar(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a || b - a >= 92 * DAY) return null;
  return { start: new Date(a - 3 * 3_600_000), endExclusive: new Date(b + DAY - 3 * 3_600_000) };
}

export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  // Excel can ignore leading whitespace/control characters before a formula.
  if (/^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  text = text.replace(/\u0000/g, "");
  return `"${text.replace(/"/g, '""')}"`;
}
export function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(";") + "\r\n";
}
export class ExportTooLarge extends Error {}

// Build only a bounded file, then send it atomically. A failed page must never
// look like a successful, silently truncated CSV to the person archiving it.
export async function boundedCsv<T extends { id: number }>(
  headers: string[],
  loadPage: (afterId: number) => Promise<T[]>,
  cells: (row: T) => unknown[],
): Promise<Buffer> {
  const chunks = [Buffer.from("\uFEFF" + csvLine(headers), "utf8")];
  let bytes = chunks[0].length, count = 0, cursor = 0;
  while (true) {
    const page = await loadPage(cursor);
    if (!page.length) break;
    for (const row of page) {
      if (++count > EXPORT_MAX_ROWS) throw new ExportTooLarge();
      const chunk = Buffer.from(csvLine(cells(row)), "utf8");
      bytes += chunk.length;
      if (bytes > EXPORT_MAX_BYTES) throw new ExportTooLarge();
      chunks.push(chunk);
    }
    const next = page[page.length - 1].id;
    if (next <= cursor) throw new Error("Invalid export cursor");
    cursor = next;
  }
  return Buffer.concat(chunks, bytes);
}