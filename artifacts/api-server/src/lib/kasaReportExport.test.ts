import { describe, expect, it } from "vitest";
import { csvCell, reportCsv, reportHtml, reportFilename, type KasaReportSnapshot } from "./kasaReportExport";

const report: KasaReportSnapshot = {
  branchId: 7,
  branchName: '=HYPERLINK("https://invalid.test","Şube")',
  date: "2026-10-03",
  generatedAt: "2026-10-03T09:15:30.000Z",
  summary: {
    timezone: "Europe/Istanbul", fiscalReport: false, liveEnabled: false,
    totals: [
      { currency: "TRY", revenue: "9007199254740993.01", pendingAmount: "0.10", completedCount: 2, pendingCount: 1 },
      { currency: "EUR", revenue: "0.00", pendingAmount: "12.30", completedCount: 0, pendingCount: 1 },
      { currency: "USD", revenue: "0.00", pendingAmount: "0.00", completedCount: 0, pendingCount: 0 },
    ],
  },
};
describe("Kasa downloadable summary rendering", () => {
  it("neutralizes formulas including leading controls and escapes quotes, commas and multiline values", () => {
    for (const text of ["=1+1", "+cmd", "-1+2", "@SUM(1)", " \t=1", "\n@cmd", "\u0001=1", "\tordinary"]) {
      expect(csvCell(text)).toMatch(/^"'/);
    }
    expect(csvCell('şube, "merkez"\r\nsatır')).toBe('"şube, ""merkez""\r\nsatır"');
    expect(csvCell("9007199254740993.01")).toBe('"9007199254740993.01"');
  });
  it("preserves exact decimals, filters, timestamps, warnings and separate currencies in CSV", () => {
    const csv = reportCsv(report);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"TRY","9007199254740993.01","2","0.10","1"\r\n');
    expect(csv).toContain('"EUR","0.00","0","12.30","1"');
    expect(csv).toContain('"USD","0.00","0","0.00","0"');
    expect(csv).toContain(csvCell(report.branchName));
    for (const text of ["Europe/Istanbul", report.date!, report.generatedAt, "Mali Z raporu değildir", "Kasa bakiyesi değildir", "Bekleyen (gelir değil)", '"Şube ID","7"']) {
      expect(csv).toContain(text);
    }
  });
  it("produces standalone printable HTML without executing stored branch text", () => {
    const html = reportHtml({ ...report, branchName: '<img src=x onerror="alert(1)"> & şube' });
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; şube');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("@media print");
    expect(html).toContain("9007199254740993.01");
    for (const text of ["Europe/Istanbul", report.date!, report.generatedAt, "Mali Z raporu değildir", "Kasa bakiyesi değildir", "Bekleyen (gelir değil)", "PDF"]) {
      expect(html).toContain(text);
    }
  });
  it("labels unrestricted filters explicitly and keeps untrusted names out of filenames", () => {
    const all = { ...report, branchId: undefined, branchName: "Tüm şubeler", date: undefined };
    expect(reportCsv(all)).toContain('"Gün","Tüm günler"');
    expect(reportHtml(all)).toContain("Tüm şubeler");
    expect(reportFilename("html", undefined, undefined, report.generatedAt)).toBe("mmt-kasa-tum-subeler-tum-gunler-20261003T091530000Z.html");
    expect(reportFilename("csv", 7, report.date, report.generatedAt)).toBe("mmt-kasa-sube-7-2026-10-03-20261003T091530000Z.csv");
  });
});