import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { UserButton, useAuth } from "@clerk/react";
import { Link, Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetLogisticsPoolQueryKey,
  getGetStaffAccessQueryKey,
  useActLogisticsPool,
  useGetLogisticsPool,
  useGetStaffAccess,
  type LogisticsPoolAction,
  type LogisticsPoolMatch,
  type LogisticsPoolWorkspace,
} from "@workspace/api-client-react";
import { AlertTriangle, ChevronLeft, ClipboardPlus, GitMerge, Globe, Layers, Lock, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import { btnGhost, btnPrimary, classifyError, describeError, inputCls } from "@/components/logistics-ops/shared";
import { EntryRow, Freshness, MatchDetail, MatchListItem, SourcesPanel, roleLabels } from "@/components/logistics-pool/pool-panels";
import { FieldCapture } from "@/components/logistics-pool/field-capture";
import { LogisticsEvidenceTable } from "@/components/logistics-pool/evidence-table";

const noAuthRetry = (count: number, error: unknown) => {
  const kind = classifyError(error);
  return kind === "unauthenticated" || kind === "forbidden" ? false : count < 2;
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/staff/lojistik-operasyon" className="flex shrink-0 items-center gap-1 text-xs text-foreground/55 hover:text-primary" data-testid="link-operations"><ChevronLeft size={14} />Operasyon</Link>
            <span className="text-sm font-bold tracking-[0.18em]">MMT <span className="font-normal text-foreground/50">GLOBAL</span></span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-primary sm:inline">Fırsat havuzu</span>
          </div>
          <UserButton />
        </div>
      </header>
      {children}
    </main>
  );
}

function Centered({ icon: Icon, title, text, action }: { icon: typeof Lock; title: string; text: string; action?: ReactNode }) {
  return (
    <section className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center px-5 text-center" role="alert">
      <Icon className="h-10 w-10 text-primary" strokeWidth={1.5} />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-7 text-foreground/60">{text}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-8 md:px-8" role="status" aria-label="Yükleniyor">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse bg-card" />)}</div>
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]"><div className="h-[60vh] animate-pulse bg-card" /><div className="h-[60vh] animate-pulse bg-card" /></div>
    </div>
  );
}

function QueryErrorView({ error, retry }: { error: unknown; retry: () => void }) {
  const kind = classifyError(error);
  const btn = <button type="button" className={btnPrimary} onClick={retry} data-testid="button-retry"><RefreshCw size={14} />Yeniden dene</button>;
  if (kind === "unauthenticated") return <Centered icon={Lock} title="Oturum doğrulanamadı (401)" text="Oturumunuz sona ermiş olabilir. Mevcut giriş ekranından yeniden giriş yapın." action={<Link href="/staff/giris" className={btnPrimary} data-testid="link-signin">Girişe git</Link>} />;
  if (kind === "forbidden") return <Centered icon={ShieldAlert} title="Erişim reddedildi (403)" text="Oturumunuz geçerli, ancak sunucu bu havuz için kurucu veya operasyon yetkisi tanımıyor." />;
  if (kind === "schema") return <Centered icon={AlertTriangle} title="Beklenmeyen sunucu yanıtı" text="Yanıt beklenen veri biçiminde değil. Sürüm uyuşmazlığı olabilir." action={btn} />;
  return <Centered icon={WifiOff} title="Havuz alınamadı" text="Bağlantı veya sunucu hatası. Bu, havuzun boş olduğu anlamına gelmez." action={btn} />;
}

export default function StaffLogisticsPool() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const access = useGetStaffAccess({ query: { queryKey: [...getGetStaffAccessQueryKey(), userId], enabled: isLoaded && Boolean(isSignedIn), staleTime: 60_000, retry: noAuthRetry } });
  const canOperate = access.data?.role === "founder" || access.data?.role === "operations";
  const poolKey = useMemo(() => [...getGetLogisticsPoolQueryKey(), userId] as const, [userId]);
  const pool = useGetLogisticsPool({
    query: { queryKey: poolKey, enabled: isLoaded && Boolean(isSignedIn) && canOperate, staleTime: 15_000, refetchInterval: 30_000, retry: noAuthRetry },
  });

  useEffect(() => { document.title = "Lojistik Fırsat Havuzu | MMT Global"; }, []);

  if (!isLoaded) return <Shell><Skeleton /></Shell>;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  if (access.isPending) return <Shell><Skeleton /></Shell>;
  if (access.isError) return <Shell><QueryErrorView error={access.error} retry={() => void access.refetch()} /></Shell>;
  if (!canOperate) return <Shell><Centered icon={ShieldAlert} title="Operasyon yetkisi gerekiyor" text="Bu havuz mevcut kurucu ve operasyon personeline açıktır. Bu sayfa yeni yetki vermez." action={<Link href="/staff/yonlendir" className={btnGhost}>Çalışma alanıma dön</Link>} /></Shell>;
  if (pool.isPending) return <Shell><Skeleton /></Shell>;
  if (pool.isError || !pool.data) return <Shell><QueryErrorView error={pool.error} retry={() => void pool.refetch()} /></Shell>;
  return <Shell><Workspace data={pool.data} poolKey={poolKey} fetching={pool.isFetching} updatedAt={pool.dataUpdatedAt} pollError={pool.error} refetch={() => void pool.refetch()} /></Shell>;
}

type Tab = "matches" | "pool" | "field" | "sources";

function Workspace({ data, poolKey, fetching, updatedAt, pollError, refetch }: {
  data: LogisticsPoolWorkspace; poolKey: readonly unknown[]; fetching: boolean; updatedAt: number; pollError: unknown; refetch: () => void;
}) {
  const qc = useQueryClient();
  const mutation = useActLogisticsPool();
  const mutateRef = useRef(mutation.mutateAsync);
  mutateRef.current = mutation.mutateAsync;

  const act = useCallback(async (body: LogisticsPoolAction) => {
    try {
      const ws = await mutateRef.current({ data: body });
      qc.setQueryData(poolKey, ws);
      return ws;
    } finally {
      void qc.invalidateQueries({ queryKey: poolKey });
    }
  }, [qc, poolKey]);

  const [refreshState, setRefreshState] = useState<{ running: boolean; at: number; error: string | null }>({ running: false, at: 0, error: null });
  const runningRef = useRef(false);
  const runRefresh = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRefreshState((s) => ({ ...s, running: true }));
    try {
      await act({ action: "refresh_internal" });
      setRefreshState({ running: false, at: Date.now(), error: null });
    } catch (err) {
      setRefreshState((s) => ({ running: false, at: s.at, error: describeError(err) }));
    } finally { runningRef.current = false; }
  }, [act]);

  const [tab, setTab] = useState<Tab>("matches");
  const [pinned, setPinned] = useState<LogisticsPoolMatch | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "stale" | "all">("pending");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [showTest, setShowTest] = useState<"real" | "test">("real");

  const entries = useMemo(() => new Map(data.entries.map((e) => [e.id, e])), [data.entries]);
  const latest = pinned ? data.matches.find((m) => m.id === pinned.id) : undefined;
  const isTestMatch = useCallback((m: LogisticsPoolMatch) => m.entryIds.some((id) => entries.get(id)?.isTest), [entries]);

  const matches = useMemo(() => data.matches
    .filter((m) => (showTest === "test") === isTestMatch(m))
    .filter((m) => statusFilter === "all" || m.status === statusFilter)
    .sort((a, b) => b.score - a.score), [data.matches, statusFilter, showTest, isTestMatch]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return data.entries
      .filter((e) => (showTest === "test") === e.isTest)
      .filter((e) => roleFilter === "all" || e.role === roleFilter)
      .filter((e) => !q || [e.name, e.location, e.origin, e.destination, e.reference, ...e.products].some((f) => f.toLocaleLowerCase("tr-TR").includes(q)))
      .sort((a, b) => Number(b.active) - Number(a.active) || b.lastSeenAt.localeCompare(a.lastSeenAt));
  }, [data.entries, roleFilter, query, showTest]);

  const realEntries = data.entries.filter((e) => !e.isTest);
  const metrics = [
    { label: "Aktif kayıt", value: realEntries.filter((e) => e.active).length },
    { label: "Alıcı / satıcı", value: realEntries.filter((e) => e.active && (e.role === "buyer" || e.role === "seller")).length },
    { label: "Taşıyıcı / yük", value: realEntries.filter((e) => e.active && (e.role === "carrier" || e.role === "load")).length },
    { label: "İnceleme bekleyen", value: data.matches.filter((m) => m.status === "pending" && !isTestMatch(m)).length, hot: true },
    { label: "Hatalı kaynak", value: data.sources.filter((s) => s.lastError).length, warn: true },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Lojistik fırsat havuzu</h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">Alıcı, satıcı, taşıyıcı ve yük kayıtlarını tek havuzda toplar, açıklanabilir eşleşme adayları önerir. Onay yalnız tanıştırma taslağını kabul eder.</p>
        </div>
        <div className="flex flex-col items-start gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/45 md:items-end">
          <button type="button" onClick={() => void runRefresh()} disabled={refreshState.running} className="flex items-center gap-2 hover:text-primary" data-testid="button-refresh-pool">
            <RefreshCw size={12} className={refreshState.running ? "animate-spin" : ""} />{refreshState.running ? "İzinli kayıtlar eşleştiriliyor" : "İç kayıtları bir kez eşleştir"}
          </button>
          {data.canApprove ? <Link href="/staff/gemini" className="flex items-center gap-2 hover:text-primary" data-testid="link-gemini">Gemini talimat defteri (önizleme)</Link> : null}
          <span>Son tarama <Freshness at={refreshState.at} /> · görünüm <Freshness at={updatedAt} />{fetching ? " · yenileniyor" : ""}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="border-l-2 border-border bg-card px-3 py-2 text-xs leading-5 text-foreground/60" data-testid="text-schedule">
          {data.automaticSchedule} Panel görünümü 30 saniyede bir yenilenir. Sayfanın açık olması bağımsız worker veya kesintisiz çalışma kanıtı değildir.
        </p>
        {!data.externalDiscoveryConfigured ? (
          <p className="flex items-start gap-2 border-l-2 border-primary bg-primary/10 px-3 py-2 text-xs leading-5" role="status" data-testid="text-no-external">
            <Globe size={14} className="mt-0.5 shrink-0 text-primary" />Etkin ve izinli bir dış kaynak yapılandırılmadı. Havuz şu an yalnız mevcut iç kayıtlardan oluşuyor; internet genelinde müşteri araması yapılmıyor. Kaynak eklemek için Kaynaklar sekmesine gidin.
          </p>
        ) : null}
        {refreshState.error ? <p className="flex items-start gap-2 border-l-2 border-red-400 bg-red-400/10 px-3 py-2 text-xs text-red-200" role="alert"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Tarama başarısız: {refreshState.error}. Gösterilen veriler son başarılı yanıttır.</p> : null}
        {pollError ? <p className="flex items-start gap-2 border-l-2 border-red-400 bg-red-400/10 px-3 py-2 text-xs text-red-200" role="alert"><WifiOff size={14} className="mt-0.5 shrink-0" />Son yenileme başarısız: {describeError(pollError)}. Gösterilen veriler eskimiş olabilir.</p> : null}
      </div>

      <LogisticsEvidenceTable data={data} />
      <section className="mt-5 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-5" aria-label="Havuz özeti">
        {metrics.map((m) => (
          <div key={m.label} className="bg-card px-4 py-3" data-testid={`metric-${m.label}`}>
            <p className={`font-mono text-2xl ${m.warn && m.value ? "text-[#f08a8a]" : m.hot && m.value ? "text-primary" : ""}`}>{m.value}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/45">{m.label}</p>
          </div>
        ))}
      </section>

      <div className="mt-6 flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between">
        <nav className="flex flex-wrap gap-1" role="tablist">
          {([["matches", "Eşleşmeler", GitMerge], ["pool", "Havuz", Layers], ["field", "Sahadan topla", ClipboardPlus], ["sources", "Kaynaklar", Globe]] as const).map(([k, l, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] ${tab === k ? "text-foreground" : "text-foreground/45 hover:text-foreground/75"}`}>
              <Icon size={14} />{l}
              <span className={`absolute inset-x-0 -bottom-px h-0.5 origin-left bg-primary transition-transform duration-300 ${tab === k ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </nav>
        {tab !== "sources" ? (
          <div className="mb-2 flex gap-1" role="group" aria-label="Kayıt türü">
            {(["real", "test"] as const).map((v) => (
              <button key={v} type="button" onClick={() => { setShowTest(v); setPinned(null); }} aria-pressed={showTest === v} data-testid={`filter-dataset-${v}`}
                className={`border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${showTest === v ? "border-primary bg-primary/15" : "border-border text-foreground/50"}`}>
                {v === "real" ? "Gerçek kayıtlar" : "TEST kayıtları"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {tab === "matches" ? (
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
          <aside className={`${pinned ? "hidden lg:block" : ""} min-w-0 space-y-3`}>
            <div className="flex flex-wrap gap-1">
              {(["pending", "approved", "rejected", "stale", "all"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStatusFilter(s)} aria-pressed={statusFilter === s} data-testid={`filter-match-${s}`}
                  className={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusFilter === s ? "border-primary bg-primary/15" : "border-border text-foreground/50 hover:text-foreground"}`}>
                  {{ pending: "Bekleyen", approved: "Onaylı", rejected: "Reddedilen", stale: "Eskimiş", all: "Tümü" }[s]}
                </button>
              ))}
            </div>
            <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto border border-border">
              {matches.length === 0 ? (
                <li className="p-6 text-center text-sm text-foreground/50">
                  {data.matches.length === 0 ? "Şu an eşleşme adayı yok. Uyumlu yük ile taşıyıcı ya da alıcı ile satıcı kaydı oluştuğunda burada görünür." : "Bu filtrede eşleşme yok."}
                </li>
              ) : matches.map((m) => (
                <MatchListItem key={m.id} match={m} entries={entries} selected={pinned?.id === m.id} onSelect={() => setPinned(m)} />
              ))}
            </ul>
          </aside>
          <section className={`${pinned ? "" : "hidden lg:block"} min-w-0 border border-border bg-card/60 p-4 md:p-6`}>
            {pinned ? (
              <MatchDetail key={`${pinned.id}-${pinned.version}`} match={pinned} latest={latest} entries={entries} canApprove={data.canApprove}
                canGenerateAiDraft={data.aiDraftEnabled}
                note={notes[pinned.id] ?? ""} setNote={(v) => setNotes((n) => ({ ...n, [pinned.id]: v }))} act={act}
                onReload={() => {
                  const fresh = qc.getQueryData<LogisticsPoolWorkspace>(poolKey)?.matches.find((m) => m.id === pinned.id);
                  if (fresh) setPinned(fresh); else refetch();
                }}
                onClose={() => setPinned(null)} />
            ) : (
              <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
                <GitMerge className="h-9 w-9 text-foreground/25" strokeWidth={1.4} />
                <p className="mt-3 text-sm text-foreground/50">Gerekçe, eksik bilgi ve tanıştırma taslağı için soldan bir eşleşme seçin.</p>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === "pool" ? (
        <div className="mt-5 min-w-0 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input className={`${inputCls} sm:flex-1`} placeholder="Ad, konum, ürün, referans" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Havuzda ara" data-testid="input-search-pool" />
            <div className="flex flex-wrap gap-1">
              {["all", "buyer", "seller", "carrier", "load"].map((r) => (
                <button key={r} type="button" onClick={() => setRoleFilter(r)} aria-pressed={roleFilter === r} data-testid={`filter-role-${r}`}
                  className={`border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${roleFilter === r ? "border-primary bg-primary/15" : "border-border text-foreground/50"}`}>
                  {r === "all" ? "Tümü" : roleLabels[r]}
                </button>
              ))}
            </div>
          </div>
          {filteredEntries.length === 0 ? (
            <p className="border border-dashed border-border p-8 text-center text-sm text-foreground/50">{data.entries.length === 0 ? "Havuzda henüz kayıt yok. Onaylı iç kayıtlar veya izinli dış kaynaklar eklendikçe burada görünür." : "Bu filtrede kayıt yok."}</p>
          ) : <ul className="divide-y divide-border border border-border">{filteredEntries.map((e) => <EntryRow key={e.id} entry={e} />)}</ul>}
        </div>
      ) : null}

      {tab === "field" ? <FieldCapture refresh={runRefresh} /> : null}

      <div className={tab === "sources" ? "mt-5" : "hidden"}><SourcesPanel data={data} act={act} /></div>

      <footer className="mt-10 grid gap-4 border-t border-border pt-6 text-xs leading-6 text-foreground/50 md:grid-cols-2">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/65">Sınırlar</p>
          <ul className="list-disc space-y-1 pl-4">
            {data.limits.map((l, i) => <li key={i}>{l}</li>)}
            <li>Eşleşme onayı mesaj göndermez, ödeme yapmaz, teklif, sözleşme veya sevkiyat oluşturmaz. Nihai operasyon yetkileri <Link href="/staff/lojistik-operasyon" className="text-primary hover:underline">mevcut operasyon sürecinde</Link> kalır.</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/65">Gizlilik</p>
          İletişim bilgileri yalnız iç kullanım içindir. TEST ve gerçek kayıtlar hiçbir zaman birleştirilmez. Veri işleme dayanağınızı ayrıca değerlendirin.
        </div>
      </footer>
    </div>
  );
}
