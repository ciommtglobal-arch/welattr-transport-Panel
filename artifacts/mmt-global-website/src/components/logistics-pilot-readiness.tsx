import { useState } from "react";
import { useAuth } from "@clerk/react";
import { ChevronDown, CircleAlert, CircleCheck, CircleDashed, CircleX, Loader2, RefreshCw } from "lucide-react";
import {
  getGetLogisticsTestPilotReadinessQueryKey,
  useGetLogisticsTestPilotReadiness,
} from "@workspace/api-client-react";

const PILOT_CODE = "UKR-MERSİN-NARENCİYE-001";

type CheckStatus = "PASS" | "FAIL" | "NOT_TESTED";

const statusMeta: Record<CheckStatus, { label: string; className: string; Icon: typeof CircleCheck }> = {
  PASS: { label: "Geçti", className: "border-primary/40 text-primary", Icon: CircleCheck },
  FAIL: { label: "Başarısız", className: "border-destructive/50 text-destructive", Icon: CircleX },
  NOT_TESTED: { label: "Test edilmedi", className: "border-border text-foreground/55", Icon: CircleDashed },
};

function errorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error ? (error as { status?: number }).status : undefined;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function LogisticsPilotReadiness() {
  const { userId } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const readiness = useGetLogisticsTestPilotReadiness({
    query: {
      queryKey: [...getGetLogisticsTestPilotReadinessQueryKey(), userId ?? "anonymous"],
      enabled: Boolean(userId),
      retry: false,
      staleTime: 0,
      refetchOnMount: "always",
    },
  });

  const refreshing = readiness.isFetching;
  const data = readiness.data;
  const checks = data?.checks ?? [];
  const counts = checks.reduce(
    (acc, check) => {
      const key = check.status as CheckStatus;
      if (key in acc) acc[key] += 1;
      return acc;
    },
    { PASS: 0, FAIL: 0, NOT_TESTED: 0 } as Record<CheckStatus, number>,
  );

  return (
    <section className="border border-primary/30 bg-primary/10 p-6" aria-labelledby="pilot-readiness-title" data-testid="card-pilot-readiness">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">TEST hazırlık kontrolü</p>
          <h2 id="pilot-readiness-title" className="mt-3 break-words text-xl font-semibold tracking-tight">
            {data?.fileCode ?? PILOT_CODE}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void readiness.refetch()}
          disabled={refreshing || !userId}
          aria-label="Hazırlık kontrolünü yenile"
          data-testid="button-refresh-readiness"
          className="shrink-0 border border-primary/40 p-2 text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : undefined} />
        </button>
      </div>
      <p className="mt-3 text-xs leading-6 text-foreground/60">
        Salt okunur TEST görünümü. Canlı operasyon, onay veya sevkiyat işlemi yapılmaz.
      </p>

      <div aria-live="polite" className="mt-5">
        {readiness.isPending ? (
          <div className="space-y-2" role="status" aria-label="Hazırlık kontrolü yükleniyor">
            <div className="h-10 animate-pulse bg-primary/15" />
            <div className="h-4 w-2/3 animate-pulse bg-primary/15" />
          </div>
        ) : readiness.isError ? (
          <div className="border-l-2 border-primary/60 pl-3 text-sm leading-6 text-foreground/70" data-testid="status-readiness-error">
            <p className="flex items-center gap-2 font-semibold">
              <CircleAlert size={15} className="text-primary" />
              {errorStatus(readiness.error) === 404
                ? "TEST kontrolü kapalı veya dosyaya erişilemiyor"
                : errorStatus(readiness.error) === 403
                  ? "Bu kontrol için yetkiniz yok"
                  : "Hazırlık kontrolü alınamadı"}
            </p>
            <p className="mt-1 text-xs text-foreground/55">
              {errorStatus(readiness.error) === 404
                ? "Kontrol yalnız geliştirme/TEST ortamında açıktır ve dosya erişimi gerektirir. Bu durum hazır olduğu anlamına gelmez."
                : "Sonuç doğrulanamadı; hazırlık durumu bilinmiyor."}
            </p>
            <button
              type="button"
              onClick={() => void readiness.refetch()}
              disabled={refreshing}
              data-testid="button-retry-readiness"
              className="mt-3 inline-flex items-center gap-2 border border-primary px-4 py-2 text-xs font-bold text-primary disabled:opacity-50"
            >
              {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Yeniden dene
            </button>
          </div>
        ) : data ? (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center" data-testid="summary-readiness">
              {(["PASS", "FAIL", "NOT_TESTED"] as CheckStatus[]).map((key) => (
                <div key={key} className="border border-border bg-card px-2 py-3">
                  <dd className="text-xl font-semibold" data-testid={`count-${key.toLowerCase()}`}>{counts[key]}</dd>
                  <dt className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-foreground/50">{statusMeta[key].label}</dt>
                </div>
              ))}
            </dl>
            <ul className="mt-4 space-y-1 text-xs leading-5 text-foreground/65">
              <li>Kayıt: <strong className="text-foreground">{data.recordFound ? "Bulundu" : "Bulunamadı"}</strong></li>
              <li>Canlıya hazır: <strong className="text-foreground">{data.readyForLive ? "Evet" : "Hayır"}</strong></li>
              <li>Sevkiyat onayı: <strong className="text-foreground">{data.shipmentApproved ? "Var" : "Yok"}</strong></li>
              <li>Kontrol zamanı: <time dateTime={data.checkedAt} className="font-mono text-foreground">{formatDateTime(data.checkedAt)}</time></li>
            </ul>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls="pilot-readiness-details"
              data-testid="button-toggle-readiness-details"
              className="mt-4 flex w-full items-center justify-between border-t border-primary/20 pt-3 text-[11px] font-bold uppercase tracking-[0.13em] text-primary"
            >
              Kontrol ayrıntıları ({checks.length})
              <ChevronDown size={15} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>

            {expanded && (
              <div id="pilot-readiness-details" className="mt-3 space-y-4">
                {checks.length === 0 ? (
                  <p className="text-xs text-foreground/55">Sunucu kontrol kalemi döndürmedi.</p>
                ) : (
                  <ul className="divide-y divide-border/70 border border-border bg-card">
                    {checks.map((check) => {
                      const meta = statusMeta[check.status as CheckStatus] ?? statusMeta.NOT_TESTED;
                      return (
                        <li key={check.key} className="p-3" data-testid={`row-check-${check.key}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-5">{check.label}</p>
                            <span className={`inline-flex shrink-0 items-center gap-1 border px-2 py-0.5 text-[10px] font-bold ${meta.className}`}>
                              <meta.Icon size={11} aria-hidden="true" />
                              {meta.label}
                            </span>
                          </div>
                          {check.detail && <p className="mt-1 text-xs leading-5 text-foreground/55">{check.detail}</p>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {data.nextActions.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Sonraki adımlar</p>
                    <ol className="mt-2 space-y-2 text-xs leading-5 text-foreground/65">
                      {data.nextActions.map((action, i) => (
                        <li key={`${i}-${action}`} className="border-l-2 border-primary/50 pl-3">{action}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
