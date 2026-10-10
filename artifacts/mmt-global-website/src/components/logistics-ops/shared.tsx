import { useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetLogisticsOperationsQueryKey,
  type LogisticsCarrierStatus,
  type LogisticsOfferRecord,
  type LogisticsOfferStatus,
  type LogisticsShipmentStatus,
  type LogisticsTransportMode,
} from "@workspace/api-client-react";
import { CircleAlert, CircleCheck } from "lucide-react";

export const STATUS_FLOW: LogisticsShipmentStatus[] = [
  "new_request", "planning", "quote_approval", "customer_approval", "loading", "in_transit", "delivered",
];

export const statusLabels: Record<LogisticsShipmentStatus, string> = {
  new_request: "Yeni talep",
  planning: "Planlama",
  quote_approval: "Teklif onayı",
  customer_approval: "Müşteri onayı",
  loading: "Yükleme",
  in_transit: "Yolda",
  delivered: "Teslim edildi",
};

// Domain-derived tones: intake (cream), planning (steel), approvals (amber/orange), movement (teal), done (sage).
export const statusTone: Record<LogisticsShipmentStatus, string> = {
  new_request: "border-[#f8f6f3]/30 text-[#f8f6f3]/80 bg-[#f8f6f3]/5",
  planning: "border-[#7aa2c8]/40 text-[#9fc0de] bg-[#7aa2c8]/10",
  quote_approval: "border-[#e0a43a]/45 text-[#f0c06a] bg-[#e0a43a]/10",
  customer_approval: "border-[#ea580c]/50 text-[#fb8a4c] bg-[#ea580c]/10",
  loading: "border-[#c9a26b]/45 text-[#dcbb8a] bg-[#c9a26b]/10",
  in_transit: "border-[#3fa59a]/45 text-[#6fcabe] bg-[#3fa59a]/10",
  delivered: "border-[#7fae6e]/45 text-[#a3cf93] bg-[#7fae6e]/10",
};

export const offerLabels: Record<LogisticsOfferStatus, string> = {
  pending_approval: "Kurucu onayı bekliyor",
  approved: "Onaylandı, iletilmedi",
  sent: "Müşteriye iletildi (manuel)",
  accepted: "Müşteri kabulü kaydedildi",
  rejected: "Reddedildi",
  expired: "Süresi doldu",
};

export const offerTone: Record<LogisticsOfferStatus, string> = {
  pending_approval: "border-[#e0a43a]/45 text-[#f0c06a]",
  approved: "border-[#7aa2c8]/45 text-[#9fc0de]",
  sent: "border-[#ea580c]/50 text-[#fb8a4c]",
  accepted: "border-[#7fae6e]/50 text-[#a3cf93]",
  rejected: "border-[#ef4444]/40 text-[#f08a8a]",
  expired: "border-foreground/20 text-foreground/45",
};

export const carrierLabels: Record<LogisticsCarrierStatus, string> = {
  pending: "İncelemede",
  approved: "Onaylı",
  rejected: "Reddedildi",
};

export const carrierTone: Record<LogisticsCarrierStatus, string> = {
  pending: "border-[#e0a43a]/45 text-[#f0c06a]",
  approved: "border-[#7fae6e]/50 text-[#a3cf93]",
  rejected: "border-[#ef4444]/40 text-[#f08a8a]",
};

export const modeLabels: Record<LogisticsTransportMode, string> = {
  road: "Karayolu",
  sea: "Denizyolu",
  air: "Havayolu",
};

export function errorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const s = (error as { status: unknown }).status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

export type ErrorKind = "unauthenticated" | "forbidden" | "conflict" | "validation" | "schema" | "network" | "server";

export function classifyError(error: unknown): ErrorKind {
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
  if (name === "ResponseParseError") return "schema";
  const status = errorStatus(error);
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status === undefined) return "network";
  return "server";
}

function serverMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string") {
      return (data as { error: string }).error;
    }
  }
  return null;
}

export function describeError(error: unknown): string {
  const kind = classifyError(error);
  const detail = serverMessage(error);
  switch (kind) {
    case "unauthenticated": return "Oturum doğrulanamadı (401). Yeniden giriş yapın; kayıt gönderilmedi.";
    case "forbidden": return "Bu işlem için yetkiniz yok (403). Sunucu işlemi reddetti.";
    case "conflict": return `Kayıt bu arada değişti veya adım artık uygun değil (409).${detail ? ` ${detail}` : ""} Liste yenilendi.`;
    case "validation": return `Sunucu girdiyi kabul etmedi.${detail ? ` ${detail}` : " Alanları kontrol edin."}`;
    case "schema": return "Sunucu yanıtı beklenen biçimde değil. İşlem sonucu belirsiz; listeyi yenileyip kontrol edin.";
    case "network": return "Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip yeniden deneyin.";
    default: return `Sunucu hatası.${detail ? ` ${detail}` : ""} Daha sonra yeniden deneyin.`;
  }
}

export function useInvalidateOperations() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: getGetLogisticsOperationsQueryKey() }), [queryClient]);
}

export function isExpired(offer: Pick<LogisticsOfferRecord, "validUntil">, now = Date.now()) {
  return new Date(offer.validUntil).getTime() <= now;
}

export function expiresSoon(offer: Pick<LogisticsOfferRecord, "validUntil">, now = Date.now()) {
  const t = new Date(offer.validUntil).getTime();
  return t > now && t - now < 24 * 3600 * 1000;
}

export function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function fmtMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${currency}`;
  }
}

export function isValidAmount(value: string) {
  return /^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(value.trim()) && Number(value) > 0;
}

export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const inputCls =
  "w-full border border-border bg-[#0d131c] px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:border-primary focus:bg-[#0f1621] disabled:opacity-50";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground transition-[transform,opacity] hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 border border-border px-3 py-2 text-xs font-semibold text-foreground/75 transition-colors hover:border-primary/60 hover:text-foreground active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";

export function Field({ label, hint, error, children, className = "" }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/55">{label}</span>
      {children}
      {error ? <span className="block text-xs text-[#f08a8a]">{error}</span> : hint ? <span className="block text-[11px] text-foreground/40">{hint}</span> : null}
    </label>
  );
}

export function Feedback({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const Icon = kind === "error" ? CircleAlert : CircleCheck;
  return (
    <p role={kind === "error" ? "alert" : "status"} data-testid={`feedback-${kind}`}
      className={`flex items-start gap-2 border-l-2 px-3 py-2 text-xs leading-5 animate-in fade-in slide-in-from-top-1 ${kind === "error" ? "border-[#ef4444] bg-[#ef4444]/10 text-[#f5b0b0]" : "border-[#7fae6e] bg-[#7fae6e]/10 text-[#c2e0b6]"}`}>
      <Icon size={14} className="mt-0.5 shrink-0" />{children}
    </p>
  );
}

export function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex w-fit items-center whitespace-nowrap border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${className}`}>{children}</span>;
}
