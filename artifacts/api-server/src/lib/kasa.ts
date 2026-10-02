import type { KasaMember } from "@workspace/db";

export const KASA_TIMEZONE = "Europe/Istanbul";
export const KASA_CURRENCIES = ["TRY", "EUR", "USD"] as const;

export function ownerIdentity() {
  // Trusted server allowlist, explicit setup required; never first signup wins.
  return process.env.KASA_OWNER_CLERK_USER_ID?.trim() ||
    process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID?.trim() || null;
}
export function kasaUserView(user: KasaMember) {
  return { id: user.id, name: user.name, role: user.role, branchId: user.branchId, active: user.active };
}
export function normalizeKasaAmount(value: string): string | null {
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  return cents > 0n ? `${whole}.${fraction.padEnd(2, "0")}` : null;
}
export function validKasaDate(value?: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "2000-01-01" || value > "9999-12-31") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function canReadKasaRequest(user: KasaMember, cashierId: number) {
  return user.active && (user.role === "admin" || user.id === cashierId);
}