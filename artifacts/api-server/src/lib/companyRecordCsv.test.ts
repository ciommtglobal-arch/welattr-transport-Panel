import { describe, expect, it } from "vitest";
import { boundedCsv, csvCell, csvLine, exportDateRange, ExportTooLarge, EXPORT_MAX_ROWS, EXPORT_PAGE_SIZE } from "./companyRecordCsv";

describe("private archive CSV", () => {
  it("neutralizes formulas, including whitespace/control prefixes, quotes and multiline text", () => {
    for (const value of ["=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", " \t=HYPERLINK(\"bad\")", "\u0001=1", "\tordinary", "\n=1"])
      expect(csvCell(value).startsWith('"\'')).toBe(true);
    expect(csvCell('Şirket; "Özel"\nÇelik')).toBe('"Şirket; ""Özel""\nÇelik"');
    expect(csvCell("999999999999,99")).toBe('"999999999999,99"');
    expect(csvLine(["0,01", "USD"])).toBe('"0,01";"USD"\r\n');
  });
  it("validates calendar dates, inclusive range limit and Turkish midnight", () => {
    for (const pair of [["2026-02-30", "2026-03-01"], ["2026-01-01", "2026-04-03"], ["2026-03-01", "2026-02-28"], ["2026-1-01", "2026-01-02"]])
      expect(exportDateRange(...pair as [string, string])).toBeNull();
    const range = exportDateRange("2026-01-01", "2026-04-02")!;
    expect(range.start.toISOString()).toBe("2025-12-31T21:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-04-02T21:00:00.000Z");
    expect(exportDateRange("2024-02-29", "2024-02-29")).not.toBeNull();
  });
  it("exports every batch once with UTF-8 BOM, including an empty result header", async () => {
    const rows = Array.from({ length: 531 }, (_, i) => ({ id: i + 1 }));
    const cursors: number[] = [];
    const file = await boundedCsv(["Kimlik"], async (after) => {
      cursors.push(after);
      return rows.filter((r) => r.id > after).slice(0, EXPORT_PAGE_SIZE);
    }, (r) => [r.id]);
    expect(file.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(file.toString("utf8").split("\r\n").filter(Boolean)).toHaveLength(532);
    expect(cursors).toEqual([0, 250, 500, 531]);
    expect((await boundedCsv<{ id: number }>(["Kimlik"], async () => [], (r) => [r.id])).toString("utf8")).toContain('"Kimlik"');
  });
  it("rejects excess rows, excess bytes and failure on a later batch without returning a partial file", async () => {
    await expect(boundedCsv(["ID"], async (after) =>
      Array.from({ length: Math.min(EXPORT_PAGE_SIZE, EXPORT_MAX_ROWS + 1 - after) }, (_, i) => ({ id: after + i + 1 })),
    (r) => [r.id])).rejects.toBeInstanceOf(ExportTooLarge);
    await expect(boundedCsv(["ID"], async () => [{ id: 1 }], () => ["x".repeat(20 * 1024 * 1024)])).rejects.toBeInstanceOf(ExportTooLarge);
    await expect(boundedCsv(["ID"], async (after) => {
      if (after) throw new Error("page failure");
      return [{ id: 1 }];
    }, (r) => [r.id])).rejects.toThrow("page failure");
  });
});