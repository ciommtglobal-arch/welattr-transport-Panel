import { useEffect } from "react";
import { BriefcaseBusiness, CircleAlert, ClipboardList, Loader2, ShieldCheck, Truck, Users } from "lucide-react";
import { SignInButton, UserButton, useAuth } from "@clerk/react";
import { Link } from "wouter";
import {
  getGetStaffTrialTasksQueryKey,
  useGetStaffTrialTasks,
  useGetLogisticsOperations,
  getGetLogisticsOperationsQueryKey,
  useGetOperationsDesk,
  getGetOperationsDeskQueryKey,
  type LogisticsShipmentStatus,
  type OperationsDesk,
} from "@workspace/api-client-react";
import { TrialCandidateDesk } from "@/pages/staff-trial";

const statusLabels: Record<LogisticsShipmentStatus, string> = {
  new_request: "Yeni talep",
  planning: "Planlamada",
  quote_approval: "Teklif onayı",
  customer_approval: "Müşteri onayı",
  loading: "Yükleniyor",
  in_transit: "Yolda",
  delivered: "Teslim edildi",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function Header() {
  return (
    <header className="border-b border-border/70 bg-background/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 md:px-10">
        <Link href="/staff/sorumluluk-merkezi" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-br-2xl rounded-tl-2xl bg-primary text-lg font-bold text-primary-foreground">
            M
          </span>
          <span className="text-sm font-bold tracking-[0.18em]">
            MMT <span className="font-normal text-foreground/55">GLOBAL</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/staff/sorumluluk-merkezi"
            className="text-[11px] font-bold uppercase tracking-[0.13em] text-foreground/55 hover:text-primary"
          >
            Sorumluluk merkezi
          </Link>
          <UserButton />
        </div>
      </div>
    </header>
  );
}

function SignedOutState() {
  return (
    <section className="mx-auto flex min-h-[72dvh] max-w-xl flex-col items-center justify-center px-5 text-center">
      <BriefcaseBusiness className="h-12 w-12 text-primary" strokeWidth={1.5} />
      <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
        MMT Global / Operations
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Operasyon masası</h1>
      <p className="mt-5 max-w-md leading-7 text-foreground/60">
        Personel veya etkin deneme erişiminizle kendi çalışma alanınıza giriş yapın.
      </p>
      <SignInButton mode="modal">
        <button className="mt-8 bg-primary px-7 py-4 text-xs font-bold uppercase tracking-[0.16em] text-white">
          Personel girişi
        </button>
      </SignInButton>
    </section>
  );
}

function AccessError() {
  return (
    <section className="mx-auto flex min-h-[72dvh] max-w-xl flex-col items-center justify-center px-5 text-center">
      <ShieldCheck className="h-12 w-12 text-primary" strokeWidth={1.4} />
      <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
        Yetki sınırı
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Operasyon masası kapalı</h1>
      <p className="mt-5 leading-7 text-foreground/60">
        Bu ekran yalnızca operasyon veya yönetici rolündeki aktif personel
        hesaplarına açıktır. Hesabın görevlendirilmesi için sistem yöneticisiyle
        görüşün.
      </p>
      <Link
        href="/staff/sorumluluk-merkezi"
        className="mt-8 border border-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-primary"
      >
        Sorumluluk merkezine dön
      </Link>
    </section>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof ClipboardList;
}) {
  return (
    <article className="border border-border bg-card p-5">
      <Icon className="text-primary" size={19} strokeWidth={1.7} />
      <p className="mt-7 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/45">
        {label}
      </p>
    </article>
  );
}

function isForbidden(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && error.status === 403;
}

function OperationsDeskView() {
  const desk = useGetOperationsDesk({ query: { queryKey: getGetOperationsDeskQueryKey(), retry: false } });
  const trial = useGetStaffTrialTasks({ page: 1, pageSize: 25 }, {
    query: {
      queryKey: getGetStaffTrialTasksQueryKey({ page: 1, pageSize: 25 }),
      enabled: import.meta.env.DEV && desk.isError && isForbidden(desk.error),
      retry: false,
    },
  });

  if (desk.isPending) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center gap-3 text-foreground/60">
        <Loader2 className="animate-spin text-primary" />
        Erişim doğrulanıyor
      </div>
    );
  }

  if (desk.isError && isForbidden(desk.error)) {
    if (!import.meta.env.DEV) return <AccessError />;
    if (trial.isPending) {
      return <div className="flex min-h-[65vh] items-center justify-center gap-3 text-foreground/60" role="status"><Loader2 className="animate-spin text-primary" />Deneme erişimi doğrulanıyor</div>;
    }
    if (trial.isSuccess) return <TrialCandidateDesk />;
    if (trial.isError && isForbidden(trial.error)) return <AccessError />;
    return (
      <section className="mx-auto max-w-xl px-5 py-24 text-center">
        <CircleAlert className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-5 text-3xl font-semibold">Deneme erişimi doğrulanamadı</h1>
        <p className="mt-4 leading-7 text-foreground/60">Bağlantı hatası, erişiminiz olmadığı anlamına gelmez. Yeniden deneyin.</p>
        <button type="button" onClick={() => void trial.refetch()} className="mt-6 inline-flex items-center gap-2 border border-primary px-5 py-3 text-sm font-bold text-primary"><Loader2 size={15} />Yeniden dene</button>
      </section>
    );
  }
  if (desk.isError) {
    return (
      <section className="mx-auto max-w-xl px-5 py-24 text-center">
        <CircleAlert className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-5 text-3xl font-semibold">Erişim kontrolü tamamlanamadı</h1>
        <p className="mt-4 leading-7 text-foreground/60">Oturum veya bağlantı şu anda doğrulanamadı. Bu, erişiminiz olmadığı anlamına gelmez.</p>
        <button type="button" onClick={() => void desk.refetch()} className="mt-6 border border-primary px-5 py-3 text-sm font-bold text-primary">Yeniden dene</button>
      </section>
    );
  }

  if (!desk.data) return null;
  return <StaffOperationsDeskView desk={desk.data} />;
}

function StaffOperationsDeskView({ desk }: { desk: OperationsDesk }) {
  const operations = useGetLogisticsOperations(undefined, {
    query: { queryKey: getGetLogisticsOperationsQueryKey(), retry: false },
  });

  if (operations.isPending) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center gap-3 text-foreground/60">
        <Loader2 className="animate-spin text-primary" />
        Operasyon kayıtları hazırlanıyor
      </div>
    );
  }
  if (operations.isError && isForbidden(operations.error)) {
    return (
      <section className="mx-auto max-w-xl px-5 py-24 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-5 text-3xl font-semibold">Operasyon verilerine erişim reddedildi</h1>
        <p className="mt-4 leading-7 text-foreground/60">Personel oturumunuz doğrulandı ancak bu kayıtlar için gerekli kapsam bulunmuyor.</p>
      </section>
    );
  }
  if (operations.isError || !operations.data) {
    return (
      <section className="mx-auto max-w-xl px-5 py-24 text-center">
        <CircleAlert className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-5 text-3xl font-semibold">Operasyon verileri alınamadı</h1>
        <p className="mt-4 leading-7 text-foreground/60">
          Personel yetkiniz doğrulandı ancak kayıtlar bağlantı nedeniyle alınamadı.
          Erişim reddiyle ağ hatası birbirinden ayrıdır; bağlantıyı yeniden deneyin.
        </p>
        <button type="button" onClick={() => void operations.refetch()} className="mt-6 border border-primary px-5 py-3 text-sm font-bold text-primary">Yeniden dene</button>
      </section>
    );
  }

  const { requests, shipments, offers, carriers } = operations.data;
  const activeShipments = shipments.filter((shipment) => shipment.status !== "delivered");
  const pendingOffers = offers.filter((offer) => offer.status === "pending_approval");
  const approvedCarriers = carriers.filter((carrier) => carrier.status === "approved");

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <section className="mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-16">
        <div className="flex flex-col justify-between gap-8 border-b border-border/70 pb-10 md:flex-row md:items-end">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
              <BriefcaseBusiness size={15} />
              {desk.deskCode} / İç operasyon
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[0.98] tracking-tight md:text-6xl">
              {desk.deskTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/60">
              Yetkili personel için masa başı koordinasyon, lojistik görünürlük ve saha takip ekranı.
            </p>
          </div>
          <div className="border border-primary/25 bg-primary/10 px-4 py-3 text-xs font-semibold text-primary">
            Aktif rol: {desk.role === "admin" ? "Yönetici" : "Operasyon"}
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Operasyon özeti">
          <Metric label="Açık yük talebi" value={requests.length} icon={ClipboardList} />
          <Metric label="Aktif sevkiyat" value={activeShipments.length} icon={Truck} />
          <Metric label="Teklif onayı bekleyen" value={pendingOffers.length} icon={CircleAlert} />
          <Metric label="Onaylı taşıyıcı" value={approvedCarriers.length} icon={Users} />
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="border border-border bg-card p-6 md:p-8">
            <div className="flex flex-col justify-between gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-end">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                  Güncel iş sırası
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Operasyon kayıtları</h2>
              </div>
              <Link href="/lojistik" className="text-xs font-bold uppercase tracking-[0.14em] text-primary hover:text-primary/70">
                Lojistik merkezini aç
              </Link>
            </div>
            {requests.length === 0 ? (
              <div className="py-14 text-center text-sm leading-7 text-foreground/55">
                Henüz açık lojistik talebi bulunmuyor.
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {requests.slice(0, 8).map((request) => {
                  const shipment = shipments.find((item) => item.requestId === request.id);
                  const status = shipment?.status ?? request.status;
                  return (
                    <article key={request.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-mono text-[10px] tracking-[0.16em] text-primary">{request.referenceCode}</p>
                        <h3 className="mt-2 font-semibold">{request.origin} → {request.destination}</h3>
                        <p className="mt-1 text-xs text-foreground/50">
                          {request.cargoType} · {request.weightKg.toLocaleString("tr-TR")} kg · yükleme {formatDate(request.loadingDate)}
                        </p>
                      </div>
                      <span className="w-fit border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/60">
                        {statusLabels[status]}
                      </span>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="border border-primary/30 bg-primary/10 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Pilot dosyası</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">UKR-MERSİN-NARENCİYE-001</h2>
              <p className="mt-4 text-sm leading-7 text-foreground/65">
                Ukrayna–Mersin hattında görev sahiplerini, riskleri ve sonraki
                adımı tek kayıtta takip edin.
              </p>
            </section>

            <section className="border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-primary" size={18} />
                <h2 className="font-semibold">Yetki çerçevesi</h2>
              </div>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-foreground/65">
                {desk.boundaries.map((boundary) => (
                  <li key={boundary} className="border-l-2 border-primary/50 pl-3">{boundary}</li>
                ))}
              </ul>
            </section>
          </aside>
        </div>

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <article className="border border-border bg-secondary p-6 text-secondary-foreground md:p-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Günlük sorumluluk</p>
            <h2 className="mt-3 text-2xl font-semibold">Masadan sahaya net takip</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-secondary-foreground/70">
              {desk.responsibilities.map((responsibility) => (
                <li key={responsibility} className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {responsibility}
                </li>
              ))}
            </ul>
          </article>
          <article className="border border-border bg-card p-6 md:p-8">
            <div className="flex items-center gap-2 text-primary">
              <Users size={18} />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em]">Koordinasyon kaydı</p>
            </div>
            <h2 className="mt-3 text-2xl font-semibold">Ekipten beklenen günlük bilgi</h2>
            <p className="mt-4 text-sm leading-7 text-foreground/60">
              Her sorumlu kişi kendi alanında <strong className="text-foreground">hazır olan</strong>,
              <strong className="text-foreground"> eksik bilgi</strong>, <strong className="text-foreground">risk</strong> ve
              <strong className="text-foreground"> sonraki adım</strong> bilgisini paylaşır.
            </p>
            <p className="mt-5 border-l-2 border-primary/60 pl-4 text-xs leading-6 text-foreground/50">
              Finansal karar, ödeme, sözleşme ve şirket adına kesin taahhüt
              proje sahibi onayı olmadan verilemez.
            </p>
          </article>
        </section>
      </section>
    </main>
  );
}

export default function StaffOperationsDesk() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    document.title = "Operasyon Masası | MMT Global";
    let descriptionTag = document.querySelector('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute("content", "MMT Global genel operasyon ve koordinasyon masası.");
  }, []);

  if (!isLoaded) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background text-foreground">
        <Loader2 className="animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <Header />
      {isSignedIn ? <OperationsDeskView /> : <SignedOutState />}
    </main>
  );
}