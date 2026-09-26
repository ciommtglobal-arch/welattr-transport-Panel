import { useState } from "react";
import { useAuth, UserButton } from "@clerk/react";
import {
  getGetStaffAccessQueryKey,
  getGetStaffB2BCompanyTaskReportsQueryKey,
  useGetStaffAccess,
  useGetStaffB2BCompanyTaskReports,
} from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, ClipboardCheck, FileText, MapPinned, RefreshCw, UsersRound } from "lucide-react";
import { Link, Redirect } from "wouter";
import "@/styles/mmt-corporate.css";

function AccessLoading() {
  return <main className="mmt-management-page"><p className="mmt-note">Yetki kontrol ediliyor…</p></main>;
}

function AccessDenied() {
  return (
    <main className="mmt-management-page">
      <section className="mmt-panel">
        <h1 className="mmt-management-title">Bu çalışma alanına erişim yetkiniz yok.</h1>
        <p className="mmt-management-sub">Mevcut hesabınıza personel veya kurucu yetkisi tanımlı değil. Yeni hesap oluşturmak yerine yetkili hesabınızla oturum açın.</p>
        <Link href="/b2b-agi/panel" className="mmt-action-link">Şirket paneline dön</Link>
        <UserButton />
      </section>
    </main>
  );
}

export function isStaffAccessDenied(error: unknown) {
  return typeof error === "object" && error !== null &&
    "status" in error && error.status === 403;
}

export function StaffAccessUnavailable({ retry }: { retry: () => void }) {
  return (
    <main className="mmt-management-page">
      <section className="mmt-panel">
        <h1 className="mmt-management-title">Erişim kontrolü tamamlanamadı</h1>
        <p className="mmt-management-sub">Oturum veya bağlantı şu anda doğrulanamadı. Bu durum tek başına yetkiniz olmadığı anlamına gelmez.</p>
        <button type="button" onClick={retry} className="mmt-action-link">Yeniden dene</button>
      </section>
    </main>
  );
}

export function StaffWorkspaceRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  const access = useGetStaffAccess({ query: { queryKey: getGetStaffAccessQueryKey(), enabled: isLoaded && Boolean(isSignedIn) } });
  if (!isLoaded) return <AccessLoading />;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  if (access.isPending) return <AccessLoading />;
  if (access.isError && isStaffAccessDenied(access.error)) return <AccessDenied />;
  if (access.isError || !access.data) return <StaffAccessUnavailable retry={() => void access.refetch()} />;
  return <Redirect to={access.data.workspace} />;
}

const founderPanels = [
  {
    title: "Bekleyen kararlar ve onaylar",
    icon: ClipboardCheck,
    text: "Bu görünümde canlı onay verisi sunulmuyor. Kurucu kapsamındaki gerçek doğrulama araçlarını açın.",
    href: "/staff/b2b-dogrulamalar",
    link: "Firma doğrulamalarını aç",
  },
  {
    title: "Devam eden ve geciken işler",
    icon: FileText,
    text: "Görev ilerleme raporları, kurucuya özel salt okunur uç noktadan sayfalanarak sunulur.",
    href: "/staff/yonetim-paneli",
    link: "Bu görünümde kal",
  },
  {
    title: "Ekip ve bölgeler",
    icon: UsersRound,
    text: "Şirket paneli ve ekip atama verileri kurucu allowlist erişimiyle doğrulanmış değildir; burada canlı ekip veya bölge bilgisi bulunmaz.",
    href: "/staff/yonetim-paneli",
    link: "Bu görünümde kal",
  },
  {
    title: "Son etkinlikler ve bildirimler",
    icon: MapPinned,
    text: "Bu bölüm henüz canlı etkinlik verisi göstermiyor; bildirim veya global kuyruk sunmuyor.",
    href: "/staff/medya-merkezi",
    link: "Medya Merkezi'ni aç",
  },
];

export function FounderDashboard() {
  const { isLoaded, isSignedIn } = useAuth();
  const access = useGetStaffAccess({ query: { queryKey: getGetStaffAccessQueryKey(), enabled: isLoaded && Boolean(isSignedIn) } });
  if (!isLoaded) return <AccessLoading />;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  if (access.isPending) return <AccessLoading />;
  // The server's founder allowlist is the source of founder access.
  if (access.isError && isStaffAccessDenied(access.error)) return <AccessDenied />;
  if (access.isError || !access.data) return <StaffAccessUnavailable retry={() => void access.refetch()} />;
  if (access.data.role !== "founder") return <AccessDenied />;

  return (
    <main className="mmt-management-page">
      <div className="mmt-management-shell">
        <header className="mmt-management-topbar">
          <Link href="/" className="mmt-brand">MMT <span>GLOBAL</span></Link>
          <nav className="mmt-management-nav" aria-label="Kurucu çalışma alanı">
            <Link href="/staff/yonetim-paneli" aria-current="page">Genel bakış</Link>
            <Link href="/staff/b2b-dogrulamalar">Firma doğrulaması</Link>
            <Link href="/staff/medya-merkezi">Medya Merkezi</Link>
            <Link href="/staff/insaat-teklifleri">İnşaat teklifleri</Link>
          </nav>
          <UserButton />
        </header>
        <div className="mmt-management-header">
          <div>
            <p className="mmt-kicker">Kurucu çalışma alanı</p>
            <h1 className="mmt-management-title">Yönetim görünümü</h1>
            <p className="mmt-management-sub">Mevcut araçlara hızlı erişim. Bu özet canlı metrik veya küresel iş kuyruğu sunmaz.</p>
          </div>
          <span className="mmt-user">Kurucu</span>
        </div>
        <div className="mmt-dashboard-grid">
          {founderPanels.map(({ title, icon: Icon, text, href, link }) => (
            <section className="mmt-panel" key={title}>
              <h2><Icon size={18} aria-hidden="true" />{title}</h2>
              <p className="mmt-empty-state">{text}</p>
              <Link href={href} className="mmt-action-link">{link} <span aria-hidden="true">→</span></Link>
            </section>
          ))}
        </div>
        <FounderTaskReports />
        <p className="mmt-note">Erişim, mevcut personel rolü ve kapsamıyla sınırlıdır. Bu sayfa yeni yetki sağlamaz.</p>
      </div>
    </main>
  );
}

function FounderTaskReports() {
  const [page, setPage] = useState(1);
  const reports = useGetStaffB2BCompanyTaskReports(
    { page, pageSize: 25 },
    {
      query: {
        queryKey: getGetStaffB2BCompanyTaskReportsQueryKey({ page, pageSize: 25 }),
        retry: false,
      },
    },
  );

  return (
    <section className="mmt-panel" aria-labelledby="founder-task-reports-title">
      <h2 id="founder-task-reports-title"><FileText size={18} aria-hidden="true" />Firma görev ilerleme raporları</h2>
      <p className="mmt-management-sub">Kurucu allowlist erişimiyle sunulan salt okunur kayıtlar. Üye iletişim bilgileri gösterilmez.</p>
      {reports.isPending ? <p className="mmt-empty-state" role="status">Görev raporları yükleniyor…</p> : null}
      {reports.isError ? (
        <div className="mmt-empty-state" role="alert">
          <p>Görev raporları yüklenemedi. Erişim veya bağlantı doğrulanamadı.</p>
          <button type="button" onClick={() => void reports.refetch()} className="mmt-action-link"><RefreshCw size={15} /> Yeniden dene</button>
        </div>
      ) : null}
      {reports.isSuccess && reports.data.items.length === 0 ? (
        <p className="mmt-empty-state">Henüz görev ilerleme raporu bulunmuyor.</p>
      ) : null}
      {reports.data?.items.length ? (
        <>
          <div className="mt-5 grid gap-3">
            {reports.data.items.map((report) => (
              <article key={report.id} className="min-w-0 border border-[var(--line)] bg-[var(--paper)] p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row">
                  <div className="min-w-0">
                    <p className="mmt-kicker">{report.taskArea} · Firma #{report.businessProfileId}</p>
                    <h3 className="mt-2 break-words font-semibold">{report.taskTitle}</h3>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--muted)]">Görev #{report.taskId}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--ink)]">{report.content}</p>
                <p className="mt-3 text-xs text-[var(--muted)]">Üye #{report.authorMemberId} · {new Date(report.createdAt).toLocaleString("tr-TR")}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 text-sm">
            <button type="button" disabled={page <= 1 || reports.isFetching} onClick={() => setPage((current) => current - 1)} className="mmt-action-link disabled:opacity-40"><ChevronLeft size={16} /> Önceki</button>
            <span className="text-xs text-[var(--muted)]">{reports.data.page}. sayfa</span>
            <button type="button" disabled={!reports.data.hasMore || reports.isFetching} onClick={() => setPage((current) => current + 1)} className="mmt-action-link disabled:opacity-40">Sonraki <ChevronRight size={16} /></button>
          </div>
        </>
      ) : null}
    </section>
  );
}