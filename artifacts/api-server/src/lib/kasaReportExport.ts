import type { KasaSummary } from "@workspace/api-zod";

export const REPORT_WARNING = "Mali Z raporu değildir. Kasa bakiyesi değildir. Resmi kapanış belgesi yerine geçmez.";
const DATE_RULE = "Doğrulanmış tahsilat: tahsilat gününe göre; bekleyen (gelir değil): talep oluşturma gününe göre. Para birimleri birbirine eklenmez.";

export interface KasaReportSnapshot {
  summary: KasaSummary;
  branchId?: number;
  branchName: string;
  date?: string;
  generatedAt: string;
}

// Quote every cell, and neutralize spreadsheet formulas even after whitespace/control characters.
export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
const csvRow = (values: (string | number)[]) => values.map(csvCell).join(",");
export function reportCsv(report: KasaReportSnapshot): string {
  return "\uFEFF" + [
    ["MMT Kasa gelir özeti"],
    ["Uyarı", REPORT_WARNING],
    ["Şube ID", report.branchId ?? "Tüm şubeler"],
    ["Şube", report.branchName],
    ["Gün", report.date ?? "Tüm günler"],
    ["Rapor saat dilimi", report.summary.timezone],
    ["Oluşturulma zamanı (UTC)", report.generatedAt],
    ["Hesaplama", DATE_RULE],
    ["Canlı ödeme", "Kapalı"],
    [],
    ["Para birimi", "Doğrulanmış tahsilat", "Tahsilat adedi", "Bekleyen (gelir değil)", "Bekleyen adedi"],
    ...report.summary.totals.map(t => [t.currency, t.revenue, t.completedCount, t.pendingAmount, t.pendingCount]),
  ].map(csvRow).join("\r\n") + "\r\n";
}
export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
export function reportHtml(report: KasaReportSnapshot): string {
  const e = escapeHtml;
  const generatedLocal = new Intl.DateTimeFormat("tr-TR", {
    timeZone: report.summary.timezone, dateStyle: "short", timeStyle: "medium",
  }).format(new Date(report.generatedAt));
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>MMT Kasa gelir özeti — ${e(report.date ?? "Tüm günler")}</title>
<style>body{font:15px system-ui,sans-serif;color:#111;margin:32px auto;padding:0 20px;max-width:960px}h1{font-size:24px}.warning{border:2px solid #555;padding:12px;font-weight:bold}dt{font-weight:bold}dd{margin:0 0 10px;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{border:1px solid #777;padding:10px;text-align:right;font-variant-numeric:tabular-nums}th:first-child,td:first-child{text-align:left}.help{color:#444}@page{size:A4 landscape;margin:15mm}@media print{body{margin:0;padding:0;max-width:none;font-size:11px}.help{display:none}thead{display:table-header-group}tr{break-inside:avoid}}</style></head>
<body><h1>MMT Kasa gelir özeti</h1><p class="warning">${e(REPORT_WARNING)}</p>
<p class="help">Bu dosyayı arşivinizde saklayabilirsiniz. Tarayıcının Yazdır menüsü (Ctrl+P / ⌘P) ile yazdırın veya PDF olarak kaydedin.</p>
<dl><dt>Şube</dt><dd>${e(report.branchName)}${report.branchId ? ` (ID: ${report.branchId})` : ""}</dd>
<dt>Gün</dt><dd>${e(report.date ?? "Tüm günler")}</dd>
<dt>Rapor saat dilimi</dt><dd>${e(report.summary.timezone)}</dd>
<dt>Oluşturulma zamanı</dt><dd>${e(generatedLocal)} (${e(report.summary.timezone)}) · UTC: ${e(report.generatedAt)}</dd></dl>
<p>${e(DATE_RULE)}</p><table><thead><tr><th>Para birimi</th><th>Doğrulanmış tahsilat</th><th>Tahsilat adedi</th><th>Bekleyen (gelir değil)</th><th>Bekleyen adedi</th></tr></thead>
<tbody>${report.summary.totals.map(t => `<tr><td>${e(t.currency)}</td><td>${e(t.revenue)}</td><td>${e(t.completedCount)}</td><td>${e(t.pendingAmount)}</td><td>${e(t.pendingCount)}</td></tr>`).join("")}</tbody></table>
<p>Canlı ödeme kapalıdır. Bu dosya oluşturulma anındaki kayıtların özetidir; sonraki değişiklikleri içermez.</p></body></html>`;
}
export function reportFilename(format: "csv" | "html", branchId: number | undefined, date: string | undefined, generatedAt: string) {
  return `mmt-kasa-${branchId ? `sube-${branchId}` : "tum-subeler"}-${date ?? "tum-gunler"}-${generatedAt.replace(/[-:.]/g, "")}.${format}`;
}