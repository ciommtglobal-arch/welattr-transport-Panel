import { useAuth, UserButton } from "@clerk/react";
import { getGetLogisticsListingAccessQueryKey, getGetStaffAccessQueryKey, useGetLogisticsListingAccess, useGetStaffAccess } from "@workspace/api-client-react";
import { BriefcaseBusiness, CircleHelp, ListChecks, RefreshCw } from "lucide-react";
import { Link, Redirect } from "wouter";
import { isStaffAccessDenied, StaffAccessUnavailable } from "./staff-workspace";
import "@/styles/mmt-corporate.css";

const workspaces = {
  admin: {
    label: "Yönetici",
    primary: [
      { href: "/staff/sorumluluk-merkezi", label: "Sorumluluk merkezi", description: "Yetkiniz kapsamındaki personel araçlarına erişin." },
      { href: "/staff/b2b-dogrulamalar", label: "Firma doğrulamaları", description: "Firma inceleme aracını açın." },
      { href: "/staff/b2b-talepler", label: "B2B talepleri", description: "Talep yönetimi aracını açın." },
      { href: "/staff/b2b-sikayetler", label: "Şikâyet incelemeleri", description: "Şikâyet inceleme aracını açın." },
      { href: "/staff/operasyon-masasi", label: "Operasyon masası", description: "Operasyon çalışma aracını açın." },
      { href: "/staff/applications", label: "Başvurular", description: "Finans başvuru aracını açın." },
      { href: "/staff/lojistik-ilanlari", label: "Lojistik İlanları", description: "Taslakları ve lojistik ilan yetkilerini yönetin." },
    ],
  },
  operations: {
    label: "Operasyon",
    primary: [
      { href: "/staff/operasyon-masasi", label: "Operasyon masası", description: "Mevcut operasyon çalışma aracınıza gidin." },
    ],
  },
  finance: {
    label: "Finans",
    primary: [
      { href: "/staff/applications", label: "Başvurular", description: "Mevcut başvuru değerlendirme aracını açın." },
    ],
  },
  reviewer: {
    label: "İnceleme",
    primary: [
      { href: "/staff/b2b-dogrulamalar", label: "Firma doğrulamaları", description: "Mevcut firma inceleme aracını açın." },
    ],
  },
} as const;

function AccessLoading() {
  return <main className="mmt-management-page"><p className="mmt-note">Yetki kontrol ediliyor…</p></main>;
}

function AccessDenied() {
  return (
    <main className="mmt-management-page">
      <section className="mmt-panel">
        <h1 className="mmt-management-title">Personel çalışma alanına erişilemiyor</h1>
        <p className="mmt-management-sub">Bu hesapta etkin personel rolü bulunamadı. Yetki verilmesi için sistem yöneticisiyle görüşün.</p>
        <Link href="/b2b-agi/panel" className="mmt-action-link">Şirket paneline dön</Link>
        <UserButton />
      </section>
    </main>
  );
}

const previews = [
  { title: "Bugünün görevleri", icon: ListChecks, text: "Bu bölümde henüz canlı görev verisi gösterilmiyor." },
  { title: "Atanmış dosyalar", icon: BriefcaseBusiness, text: "Bu bölümde henüz canlı atanmış dosya verisi gösterilmiyor." },
  { title: "Bekleyen iş ve destek", icon: CircleHelp, text: "Bu bölümde henüz canlı iş veya destek verisi gösterilmiyor." },
  { title: "Son güncellemeler", icon: RefreshCw, text: "Bu bölümde henüz canlı güncelleme veya bildirim verisi gösterilmiyor." },
];

export function ExpertDashboard() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const enabled = isLoaded && Boolean(isSignedIn);
  const access = useGetStaffAccess({ query: { queryKey: [...getGetStaffAccessQueryKey(), userId], enabled } });
  const logisticsAccess = useGetLogisticsListingAccess({ query: {
    queryKey: [...getGetLogisticsListingAccessQueryKey(), userId], enabled, retry: false, refetchOnMount: "always",
  } });
  if (!isLoaded) return <AccessLoading />;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  if (access.isPending) return <AccessLoading />;
  if (access.isError && isStaffAccessDenied(access.error)) return <AccessDenied />;
  if (access.isError || !access.data) return <StaffAccessUnavailable retry={() => void access.refetch()} />;
  if (access.data.role === "founder") return <AccessDenied />;
  if (access.data.role === "logistics_listings") return <Redirect to="/staff/lojistik-ilanlari" />;

  const workspace = workspaces[access.data.role];
  const links = [...workspace.primary, ...(access.data.role !== "admin" && logisticsAccess.data?.canDraft ? [
    { href: "/staff/lojistik-ilanlari", label: "Lojistik İlanları", description: "Ayrı taslak yetkinizle lojistik ilanı hazırlayın; mevcut rolünüz değişmez." },
  ] : [])];

  return (
    <main className="mmt-management-page">
      <div className="mmt-management-shell">
        <header className="mmt-management-topbar">
          <Link href="/" className="mmt-brand">MMT <span>GLOBAL</span></Link>
          <nav className="mmt-management-nav" aria-label="Personel çalışma alanı">
            <Link href="/staff/calisma-alani" aria-current="page">Genel bakış</Link>
            {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          </nav>
          <UserButton />
        </header>
        <div className="mmt-management-header">
          <div>
            <p className="mmt-kicker">Personel çalışma alanı</p>
            <h1 className="mmt-management-title">Çalışma alanınız</h1>
            <p className="mmt-management-sub">Rolünüze tanımlı mevcut araçlara buradan erişin. Bu sayfa görev atamaz veya erişim kapsamınızı değiştirmez.</p>
          </div>
          <span className="mmt-user">{workspace.label}</span>
        </div>
        <section className="mmt-panel mmt-tools-panel">
          <h2>Rolünüze açık araçlar</h2>
          <div className="mmt-tool-links">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="mmt-tool-link">
                <span><strong>{link.label}</strong><small>{link.description}</small></span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
        <div className="mmt-dashboard-grid">
          {previews.map(({ title, icon: Icon, text }) => (
            <section className="mmt-panel" key={title}>
              <h2><Icon size={18} aria-hidden="true" />{title}</h2>
              <p className="mmt-empty-state">{text}</p>
            </section>
          ))}
        </div>
        <p className="mmt-note">Görev, dosya ve bildirim bölümleri henüz canlı veri göstermiyor. Personel erişimi sunucudaki mevcut rol kurallarına tabidir.</p>
      </div>
    </main>
  );
}

export const StaffExpertWorkspace = ExpertDashboard;