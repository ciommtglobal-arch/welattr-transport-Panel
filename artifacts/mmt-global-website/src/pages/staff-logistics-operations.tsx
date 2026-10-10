import { useEffect, useMemo, useState, type ReactNode } from "react";
import { UserButton, useAuth } from "@clerk/react";
import { Link, Redirect } from "wouter";
import {
  getGetLogisticsOperationsQueryKey,
  getGetStaffAccessQueryKey,
  useGetLogisticsOperations,
  useGetStaffAccess,
  type LogisticsOperationsResponse,
  type LogisticsShipmentStatus,
} from "@workspace/api-client-react";
import { AlertTriangle, ChevronLeft, ClipboardList, Lock, RefreshCw, Search, ShieldAlert, Truck, WifiOff } from "lucide-react";
import {
  Pill, STATUS_FLOW, btnGhost, btnPrimary, carrierLabels, classifyError, inputCls, isExpired, statusLabels, statusTone,
} from "@/components/logistics-ops/shared";
import { CarrierForm, RequestForm } from "@/components/logistics-ops/forms";
import { CarrierCard, RequestDetail } from "@/components/logistics-ops/panels";

const noAuthRetry = (count: number, error: unknown) => {
  const kind = classifyError(error);
  return kind === "unauthenticated" || kind === "forbidden" ? false : count < 2;
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-4">
            <Link href="/staff/yonetim-paneli" className="flex items-center gap-1 text-xs text-foreground/55 hover:text-primary" data-testid="link-founder-dashboard"><ChevronLeft size={14} />Yönetim</Link>
            <span className="text-sm font-bold tracking-[0.18em]">MMT <span className="font-normal text-foreground/50">GLOBAL</span></span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-primary sm:inline">Lojistik operasyon</span>
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
  if (kind === "unauthenticated") return <Centered icon={Lock} title="Oturum doğrulanamadı (401)" text="Oturumunuz sona ermiş olabilir. Mevcut giriş ekranından yeniden giriş yapın; yeni hesap oluşturmanız gerekmez." action={<Link href="/staff/giris" className={btnPrimary} data-testid="link-signin">Girişe git</Link>} />;
  if (kind === "forbidden") return <Centered icon={ShieldAlert} title="Erişim reddedildi (403)" text="Oturumunuz geçerli, ancak sunucu bu lojistik kayıtları için kurucu yetkisi tanımıyor." />;
  if (kind === "schema") return <Centered icon={AlertTriangle} title="Beklenmeyen sunucu yanıtı" text="Yanıt beklenen veri biçiminde değil. Bu bir yetki sorunu değildir; sürüm uyuşmazlığı olabilir." action={btn} />;
  return <Centered icon={WifiOff} title="Kayıtlar alınamadı" text="Bağlantı veya sunucu hatası. Bu durum yetkinizin olmadığı anlamına gelmez." action={btn} />;
}

export default function StaffLogisticsOperations() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const access = useGetStaffAccess({ query: { queryKey: [...getGetStaffAccessQueryKey(), userId], enabled: isLoaded && Boolean(isSignedIn), staleTime: 60_000, retry: noAuthRetry } });
  const isFounder = access.data?.role === "founder";
  const ops = useGetLogisticsOperations(undefined, {
    query: {
      queryKey: [...getGetLogisticsOperationsQueryKey(), userId],
      enabled: isLoaded && Boolean(isSignedIn) && isFounder,
      staleTime: 15_000,
      refetchInterval: 30_000,
      retry: noAuthRetry,
    },
  });

  useEffect(() => { document.title = "Lojistik Operasyon | MMT Global"; }, []);

  if (!isLoaded) return <Shell><Skeleton /></Shell>;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  if (access.isPending) return <Shell><Skeleton /></Shell>;
  if (access.isError) return <Shell><QueryErrorView error={access.error} retry={() => void access.refetch()} /></Shell>;
  if (!isFounder) return <Shell><Centered icon={ShieldAlert} title="Bu ekran kurucuya özeldir" text="Hesabınızın personel rolü kurucu değil. Bu sayfa yeni yetki vermez." action={<Link href="/staff/yonlendir" className={btnGhost}>Çalışma alanıma dön</Link>} /></Shell>;
  if (ops.isPending) return <Shell><Skeleton /></Shell>;
  if (ops.isError || !ops.data) return <Shell><QueryErrorView error={ops.error} retry={() => void ops.refetch()} /></Shell>;
  return <Shell><Workspace data={ops.data} fetching={ops.isFetching} updatedAt={ops.dataUpdatedAt} refetch={() => void ops.refetch()} /></Shell>;
}

type Tab = "requests" | "carriers" | "capture";

function Workspace({ data, fetching, updatedAt, refetch }: { data: LogisticsOperationsResponse; fetching: boolean; updatedAt: number; refetch: () => void }) {
  const [tab, setTab] = useState<Tab>("requests");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LogisticsShipmentStatus | "all">("all");
  const [carrierFilter, setCarrierFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [carrierQuery, setCarrierQuery] = useState("");

  const statusOf = useMemo(() => {
    const m = new Map<number, LogisticsShipmentStatus>();
    data.requests.forEach((r) => m.set(r.id, data.shipments.find((s) => s.requestId === r.id)?.status ?? r.status));
    return m;
  }, [data]);

  const now = Date.now();
  const staleOffers = data.offers.filter((o) => ["pending_approval", "approved", "sent"].includes(o.status) && isExpired(o, now));
  const pendingOffers = data.offers.filter((o) => o.status === "pending_approval" && !isExpired(o, now));
  const pendingCarriers = data.carriers.filter((c) => c.status === "pending");
  const active = data.requests.filter((r) => statusOf.get(r.id) !== "delivered");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return [...data.requests]
      .filter((r) => statusFilter === "all" || statusOf.get(r.id) === statusFilter)
      .filter((r) => !q || [r.referenceCode, r.requesterName, r.organization ?? "", r.origin, r.destination, r.cargoType, r.email, r.phone]
        .some((f) => f.toLocaleLowerCase("tr-TR").includes(q)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data.requests, query, statusFilter, statusOf]);

  const carriersFiltered = useMemo(() => {
    const q = carrierQuery.trim().toLocaleLowerCase("tr-TR");
    return data.carriers
      .filter((c) => carrierFilter === "all" || c.status === carrierFilter)
      .filter((c) => !q || [c.companyName, c.contactName, c.serviceRoutes, c.referenceCode].some((f) => f.toLocaleLowerCase("tr-TR").includes(q)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data.carriers, carrierFilter, carrierQuery]);

  const selected = data.requests.find((r) => r.id === selectedId);

  const metrics = [
    { label: "Açık talep", value: active.length },
    { label: "Toplam talep", value: data.requests.length },
    { label: "Onay bekleyen teklif", value: pendingOffers.length, hot: pendingOffers.length > 0 },
    { label: "İncelemedeki taşıyıcı", value: pendingCarriers.length, hot: pendingCarriers.length > 0 },
    { label: "Süresi geçmiş açık teklif", value: staleOffers.length, warn: staleOffers.length > 0 },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Yük, taşıyıcı ve teklif masası</h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">Kendi müşterilerinizden aldığınız talepleri ve taşıyıcı başvurularını elle kaydedin, değerlendirin ve sevkiyatı adım adım izleyin.</p>
        </div>
        <button type="button" onClick={refetch} className="flex items-center gap-2 self-start font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/45 hover:text-primary md:self-auto" data-testid="button-refresh">
          <RefreshCw size={12} className={fetching ? "animate-spin" : ""} />{fetching ? "Yenileniyor" : `Son güncelleme ${new Date(updatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
        </button>
      </div>

      <section className="mt-5 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-5" aria-label="Kayıt özeti">
        {metrics.map((m) => (
          <div key={m.label} className="bg-card px-4 py-3" data-testid={`metric-${m.label}`}>
            <p className={`font-mono text-2xl ${m.warn ? "text-[#f08a8a]" : m.hot ? "text-primary" : ""}`}>{m.value}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/45">{m.label}</p>
          </div>
        ))}
      </section>

      {staleOffers.length ? (
        <p className="mt-3 flex items-start gap-2 border-l-2 border-[#ef4444] bg-[#ef4444]/10 px-3 py-2 text-xs text-[#f5b0b0]" role="alert">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />{staleOffers.length} açık teklifin geçerlilik süresi doldu. Bu teklifler onaylanamaz, iletilemez veya kabul edilemez; gerekirse yeni teklif oluşturun ya da reddedin.
        </p>
      ) : null}

      <nav className="mt-6 flex gap-1 border-b border-border" role="tablist">
        {([["requests", "Talepler", ClipboardList], ["carriers", "Taşıyıcılar", Truck], ["capture", "Manuel kayıt", ClipboardList]] as const).map(([k, l, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] transition-colors ${tab === k ? "text-foreground" : "text-foreground/45 hover:text-foreground/75"}`}>
            <Icon size={14} />{l}
            {k === "carriers" && pendingCarriers.length ? <span className="bg-primary px-1.5 text-[10px] text-primary-foreground">{pendingCarriers.length}</span> : null}
            <span className={`absolute inset-x-0 -bottom-px h-0.5 origin-left bg-primary transition-transform duration-300 ${tab === k ? "scale-x-100" : "scale-x-0"}`} />
          </button>
        ))}
      </nav>

      {tab === "requests" ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[400px_1fr]">
          <aside className={`${selected ? "hidden lg:block" : ""} space-y-3`}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/35" />
              <input className={`${inputCls} pl-9`} placeholder="Referans, kişi, güzergâh, yük…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="input-search-requests" />
            </div>
            <div className="flex flex-wrap gap-1">
              {(["all", ...STATUS_FLOW] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStatusFilter(s)} data-testid={`filter-status-${s}`}
                  className={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${statusFilter === s ? "border-primary bg-primary/15 text-foreground" : "border-border text-foreground/50 hover:text-foreground"}`}>
                  {s === "all" ? "Tümü" : statusLabels[s]}
                </button>
              ))}
            </div>
            <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto border border-border">
              {data.requests.length === 0 ? (
                <li className="p-6 text-center text-sm text-foreground/50">Henüz talep kaydı yok.<button type="button" onClick={() => setTab("capture")} className="mt-3 block w-full text-xs font-bold uppercase tracking-[0.12em] text-primary">İlk talebi kaydet</button></li>
              ) : filtered.length === 0 ? (
                <li className="p-6 text-center text-sm text-foreground/50">Filtreyle eşleşen talep yok.</li>
              ) : filtered.map((r) => {
                const st = statusOf.get(r.id) ?? r.status;
                const stale = data.offers.some((o) => o.requestId === r.id && ["pending_approval", "approved", "sent"].includes(o.status) && isExpired(o, now));
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => setSelectedId(r.id)} data-testid={`row-request-${r.id}`}
                      className={`group w-full px-4 py-3 text-left transition-colors ${selectedId === r.id ? "bg-primary/10 shadow-[inset_2px_0_0_hsl(var(--primary))]" : "hover:bg-card"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] tracking-[0.12em] text-primary">{r.referenceCode}{r.isTest ? " · TEST" : ""}</span>
                        <Pill className={statusTone[st]}>{statusLabels[st]}</Pill>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold">{r.origin} → {r.destination}</p>
                      <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-foreground/45">
                        {r.requesterName} · {r.cargoType}{stale ? <AlertTriangle size={12} className="shrink-0 text-[#f08a8a]" aria-label="Süresi geçmiş teklif" /> : null}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
          <section className={`${selected ? "" : "hidden lg:block"} min-w-0 border border-border bg-card/60 p-5 md:p-6`}>
            {selected ? (
              <RequestDetail key={selected.id} request={selected} shipment={data.shipments.find((s) => s.requestId === selected.id)}
                offers={data.offers.filter((o) => o.requestId === selected.id)} carriers={data.carriers}
                communications={data.communications.filter((c) => c.requestId === selected.id)} canApprove={data.canApprove}
                onClose={() => setSelectedId(null)} />
            ) : (
              <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
                <ClipboardList className="h-9 w-9 text-foreground/25" strokeWidth={1.4} />
                <p className="mt-3 text-sm text-foreground/50">Ayrıntı, teklif ve görüşme geçmişi için soldan bir talep seçin.</p>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === "carriers" ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/35" />
              <input className={`${inputCls} pl-9`} placeholder="Firma, kişi, güzergâh…" value={carrierQuery} onChange={(e) => setCarrierQuery(e.target.value)} data-testid="input-search-carriers" />
            </div>
            <div className="flex gap-1">
              {(["pending", "approved", "rejected", "all"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setCarrierFilter(s)} data-testid={`filter-carrier-${s}`}
                  className={`border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${carrierFilter === s ? "border-primary bg-primary/15" : "border-border text-foreground/50 hover:text-foreground"}`}>
                  {s === "all" ? "Tümü" : carrierLabels[s]}
                </button>
              ))}
            </div>
          </div>
          {carriersFiltered.length === 0 ? (
            <p className="border border-dashed border-border p-8 text-center text-sm text-foreground/50">{data.carriers.length === 0 ? "Henüz taşıyıcı başvurusu yok. Manuel kayıt sekmesinden ekleyebilirsiniz." : "Bu filtrede taşıyıcı yok."}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{carriersFiltered.map((c) => <CarrierCard key={c.id} carrier={c} />)}</div>
          )}
        </div>
      ) : null}

      {/* Capture forms stay mounted while hidden so unsaved input survives tab switches and polling. */}
      <div className={tab === "capture" ? "mt-5 grid gap-5 lg:grid-cols-2" : "hidden"}>
        <section className="border border-border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Yük talebi</p>
          <h2 className="mb-4 mt-1 text-lg font-semibold">Müşteriden gelen talebi kaydet</h2>
          <RequestForm onCreated={(id) => { setSelectedId(id); }} />
        </section>
        <section className="border border-border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Taşıyıcı başvurusu</p>
          <h2 className="mb-4 mt-1 text-lg font-semibold">Taşıyıcı bilgisini kaydet</h2>
          <CarrierForm />
        </section>
      </div>

      <footer className="mt-10 grid gap-4 border-t border-border pt-6 text-xs leading-6 text-foreground/50 md:grid-cols-2">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/65">Gizlilik</p>
          Bu kayıtlar müşteri ve taşıyıcı kişisel verilerini içerir. Yalnızca iş ilişkisi için gereken bilgiyi girin, ekran görüntüsü veya dışa aktarım paylaşmayın. Veri işleme dayanağınızı ve aydınlatma yükümlülüğünüzü ayrıca değerlendirin; bu ekran tek başına yasal uyum sağlamaz.
        </div>
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/65">Manuel kayıt sınırı</p>
          Bu ekran hiçbir mesaj göndermez, sözleşme imzalamaz, ödeme veya para aktarımı yapmaz ve yayın oluşturmaz. "İletildi" ve "kabul" kayıtları yalnızca sizin dışarıda yaptığınız işlemin notudur. Brüt ticari satış farkı net kâr veya platform komisyonu değildir.
        </div>
      </footer>
    </div>
  );
}
