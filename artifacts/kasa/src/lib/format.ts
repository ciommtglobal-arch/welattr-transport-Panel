export function money(amount: string, currency: string): string {
  const [i = '0', f = ''] = String(amount).split('.');
  const dec = (f + '00').slice(0, 2);
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${int},${dec} ${currency}`;
}
export function normalizeAmountInput(v: string): string {
  return v.trim().replace(',', '.');
}
export const AMOUNT_RE = /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/;
export function validAmount(v: string): boolean {
  return AMOUNT_RE.test(v) && /[1-9]/.test(v);
}
export function errMsg(e: unknown): string {
  const x = e as { data?: { error?: string }; message?: string } | null;
  return x?.data?.error ?? x?.message ?? 'Beklenmeyen bir hata oluştu.';
}
export function errStatus(e: unknown): number | undefined {
  return (e as { status?: number } | null)?.status;
}
export function todayIstanbul(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}
export function validReportDate(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01') return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function dateTime(s: string): string {
  return new Date(s).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'medium', timeStyle: 'short' });
}
export const STATUS_LABEL = { PENDING: 'Bekliyor', COMPLETED: 'Tahsil edildi' } as const;
