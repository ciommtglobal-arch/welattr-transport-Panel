import { useMemo, useState } from "react";
import { UserButton, useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Redirect } from "wouter";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import {
  useListConstructionQuotes,
  getListConstructionQuotesQueryKey,
  useUpdateConstructionQuoteStatus,
  type ConstructionQuote,
  type ConstructionQuoteStatus,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const statuses: ConstructionQuoteStatus[] = ["new", "reviewing", "quoted", "closed"];
const labels: Record<ConstructionQuoteStatus, string> = { new: "Yeni", reviewing: "İnceleniyor", quoted: "Teklif verildi", closed: "Kapatıldı" };

function fmt(v: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
}

export default function StaffConstructionQuotes() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <main className="min-h-[100dvh] bg-background" aria-busy="true" />;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  return <QuoteInbox />;
}

function QuoteInbox() {
  const qc = useQueryClient();
  const list = useListConstructionQuotes({ query: { queryKey: getListConstructionQuotesQueryKey(), retry: false } });
  const update = useUpdateConstructionQuoteStatus();
  const [filter, setFilter] = useState<ConstructionQuoteStatus | "all">("all");
  const [failedId, setFailedId] = useState<number | null>(null);
  const quotes = useMemo(() => [...(list.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [list.data]);
  const shown = filter === "all" ? quotes : quotes.filter((q) => q.status === filter);
  const status = (list.error as { status?: number } | null)?.status;

  const change = (q: ConstructionQuote, next: ConstructionQuoteStatus) => {
    setFailedId(null);
    update.mutate({ id: q.id, data: { status: next } }, {
      onSuccess: (saved) => qc.setQueryData<ConstructionQuote[]>(getListConstructionQuotesQueryKey(), (old) => old?.map((x) => (x.id === saved.id ? saved : x))),
      onError: () => setFailedId(q.id),
    });
  };

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 md:px-6 h-16 flex items-center gap-4">
          <Link href="/staff/yonlendir" className="font-semibold tracking-wider" data-testid="link-staff-home">MMT <span className="text-primary">GLOBAL</span></Link>
          <nav className="hidden md:flex gap-4 text-sm text-muted-foreground" aria-label="Personel">
            <Link href="/staff/b2b-talepler" className="hover:text-foreground">Alıcı talepleri</Link>
            <Link href="/staff/insaat-teklifleri" aria-current="page" className="text-foreground">İnşaat teklifleri</Link>
            <Link href="/insaat-magaza" className="hover:text-foreground">Mağaza</Link>
          </nav>
          <div className="ms-auto"><UserButton /></div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 md:px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Mezopotamya Build</p>
        <h1 className="text-3xl md:text-4xl font-semibold mt-2">İnşaat teklif gelen kutusu</h1>
        <div className="flex flex-wrap gap-2 mt-6" role="group" aria-label="Durum filtresi">
          {(["all", ...statuses] as const).map((s) => (
            <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)} data-testid={`button-filter-${s}`}
              className={cn("min-h-10 px-4 text-sm border", filter === s ? "border-primary bg-primary/10" : "border-border/60 text-muted-foreground hover:text-foreground")}>
              {s === "all" ? `Tümü (${quotes.length})` : `${labels[s]} (${quotes.filter((q) => q.status === s).length})`}
            </button>
          ))}
          <button type="button" onClick={() => list.refetch()} className="min-h-10 px-3 border border-border/60 ms-auto" aria-label="Yenile" data-testid="button-refresh-quotes"><RefreshCw className={cn("h-4 w-4", list.isFetching && "animate-spin")} /></button>
        </div>

        <div className="mt-6">
          {list.isLoading ? (
            <div className="space-y-3 animate-pulse" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-28 bg-secondary/30" />)}</div>
          ) : list.isError ? (
            <div className="py-16 text-center border border-dashed border-border/50">
              <AlertTriangle className="h-10 w-10 mx-auto text-primary mb-3" />
              <p data-testid="text-quotes-error">{status === 403 || status === 401 ? "Bu gelen kutusuna erişim yetkiniz yok." : "Teklifler yüklenemedi."}</p>
              {status !== 403 && status !== 401 && <button type="button" onClick={() => list.refetch()} className="mt-4 min-h-11 px-5 border border-border/60 text-sm">Tekrar dene</button>}
            </div>
          ) : shown.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border/50 text-muted-foreground"><Inbox className="h-10 w-10 mx-auto mb-3" /><p data-testid="text-quotes-empty">Bu görünümde teklif talebi yok.</p></div>
          ) : (
            <ul className="space-y-3">
              {shown.map((q) => (
                <li key={q.id} className="border border-border/40 bg-card p-5 grid md:grid-cols-[1fr_220px] gap-4" data-testid={`card-quote-${q.id}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono font-semibold" data-testid={`text-quote-ref-${q.id}`}>{q.reference}</span>
                      <span className="text-xs text-muted-foreground">{fmt(q.createdAt)}</span>
                    </div>
                    <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      <div><dt className="inline text-muted-foreground">Miktar: </dt><dd className="inline">{q.quantity}</dd></div>
                      <div><dt className="inline text-muted-foreground">Teslimat: </dt><dd className="inline break-words">{q.deliveryLocation}</dd></div>
                      <div className="sm:col-span-2"><dt className="inline text-muted-foreground">Ölçüler: </dt><dd className="inline break-words">{q.dimensions}</dd></div>
                      <div><dt className="inline text-muted-foreground">İletişim: </dt><dd className="inline">{q.contactName}</dd></div>
                      <div className="break-all"><a className="text-primary underline" href={`mailto:${q.contactEmail}`}>{q.contactEmail}</a> · <a className="underline" href={`tel:${q.contactPhone}`}>{q.contactPhone}</a></div>
                      {(q.productId || q.variantId) && <div className="sm:col-span-2 text-xs text-muted-foreground break-all">Ürün: {q.productId ?? "-"}{q.variantId ? ` / ${q.variantId}` : ""}</div>}
                      {q.notes && <div className="sm:col-span-2 text-muted-foreground whitespace-pre-line">{q.notes}</div>}
                    </dl>
                  </div>
                  <label className="block">
                    <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Durum</span>
                    <select value={q.status} disabled={update.isPending && update.variables?.id === q.id} onChange={(e) => change(q, e.target.value as ConstructionQuoteStatus)} data-testid={`select-quote-status-${q.id}`}
                      className="w-full min-h-11 bg-background border border-border/60 px-3 text-sm focus:outline-none focus:border-primary">
                      {statuses.map((s) => <option key={s} value={s}>{labels[s]}</option>)}
                    </select>
                    {failedId === q.id && <span className="block mt-2 text-xs text-destructive" role="alert">Durum güncellenemedi.</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
