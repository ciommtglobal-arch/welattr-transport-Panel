import { useAuth, UserButton } from "@clerk/react";
import { getGetStaffAccessQueryKey, useGetStaffAccess } from "@workspace/api-client-react";
import { ClipboardCheck, FileText, MapPinned, UsersRound } from "lucide-react";
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

export function StaffWorkspaceRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  const access = useGetStaffAccess({ query: { queryKey: getGetStaffAccessQueryKey(), enabled: isLoaded && Boolean(isSignedIn), retry: false } });
  if (!isLoaded) return <AccessLoading />;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  if (access.isPending) return <AccessLoading />;
  if (access.isError || !access.data) return <AccessDenied />;
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
    text: "Canlı iş ve görev kuyruğu kurucu allowlist erişimiyle kullanılamıyor; bu sayfada görev kaydı veya sayı gösterilmez.",
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
  const access = useGetStaffAccess({ query: { queryKey: getGetStaffAccessQueryKey(), enabled: isLoaded && Boolean(isSignedIn), retry: false } });
  if (!isLoaded) return <AccessLoading />;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  if (access.isPending) return <AccessLoading />;
  // The server's founder allowlist is the source of founder access.
  if (access.isError || access.data?.role !== "founder") return <AccessDenied />;

  return (
    <main className="mmt-management-page">
      <div className="mmt-management-shell">
        <header className="mmt-management-topbar">
          <Link href="/" className="mmt-brand">MMT <span>GLOBAL</span></Link>
          <nav className="mmt-management-nav" aria-label="Kurucu çalışma alanı">
            <Link href="/staff/yonetim-paneli" aria-current="page">Genel bakış</Link>
            <Link href="/staff/b2b-dogrulamalar">Firma doğrulaması</Link>
            <Link href="/staff/medya-merkezi">Medya Merkezi</Link>
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
        <p className="mmt-note">Erişim, mevcut personel rolü ve kapsamıyla sınırlıdır. Bu sayfa yeni yetki sağlamaz.</p>
      </div>
    </main>
  );
}