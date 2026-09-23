import { useEffect } from "react";
import { UserButton, useAuth } from "@clerk/react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  FileCheck2,
  Globe2,
  GraduationCap,
  Languages,
  LayoutDashboard,
  Mail,
  Megaphone,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";
import {
  useGetStaffProfiles,
  type StaffProfile,
} from "@workspace/api-client-react";

type Responsibility = {
  id: string;
  team: string;
  title: string;
  description: string;
  icon: typeof Banknote;
  links: { href: string; label: string; id: string }[];
};

const responsibilities: Responsibility[] = [
  {
    id: "finance",
    team: "Finans ekibi",
    title: "Finance & POS / ödeme takibi",
    description:
      "Ödeme taleplerini, POS akışlarını ve finans başvurularını doğru işlem adımına taşıyın.",
    icon: Banknote,
    links: [
      { href: "/odeme", label: "Ödeme ekranını aç", id: "payment" },
      { href: "/staff/applications", label: "Finans başvuruları", id: "applications" },
    ],
  },
  {
    id: "media",
    team: "Medya & reklam ekibi",
    title: "Media & brand / içerik yayınlama",
    description:
      "Marka, duyuru ve içerik akışını tek merkezden hazırlayın; yayın sorumluluğunu net tutun.",
    icon: Megaphone,
    links: [
      { href: "/staff/medya-merkezi", label: "Medya merkezine git", id: "media-center" },
      { href: "/staff/ilanlar", label: "İlanları görüntüle", id: "listings" },
    ],
  },
  {
    id: "logistics",
    team: "Lojistik operasyon",
    title: "Logistics / saha ve bağlantı",
    description:
      "Rota, kapasite ve lojistik ihtiyaçlarını görünür kılarak doğru hizmet bağlantısını kurun.",
    icon: Truck,
    links: [
      { href: "/lojistik", label: "Lojistik merkezini aç", id: "logistics" },
      {
        href: "/staff/operasyon-masasi",
        label: "Abdurrahman Bey’in operasyon masası",
        id: "operations-desk",
      },
    ],
  },
  {
    id: "b2b",
    team: "B2B doğrulama",
    title: "B2B / doğrulama ve talepler",
    description:
      "İşletme doğrulamalarını, yeni talepleri ve ağdaki bildirimleri güvenilir bir sırayla yönetin.",
    icon: BadgeCheck,
    links: [
      { href: "/staff/b2b-dogrulamalar", label: "Doğrulamaları incele", id: "verifications" },
      { href: "/staff/b2b-talepler", label: "B2B taleplerini aç", id: "requests" },
      { href: "/staff/b2b-sikayetler", label: "Şikâyetleri görüntüle", id: "reports" },
    ],
  },
];

function useStaffMeta() {
  useEffect(() => {
    document.title = "Sorumluluk Merkezi | MMT Global";
    let descriptionTag = document.querySelector('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute("content", "MMT Global personel sorumluluk ve operasyon merkezi.");
  }, []);
}

function BrandMark() {
  return (
    <Link href="/" data-testid="link-staff-home" className="group flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-br-2xl rounded-tl-2xl bg-primary text-lg font-bold text-primary-foreground transition-transform group-hover:scale-95">
        M
      </span>
      <span className="text-sm font-bold tracking-[0.18em]">
        MMT <span className="font-normal text-foreground/55">GLOBAL</span>
      </span>
    </Link>
  );
}

function StaffHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 md:px-10">
        <BrandMark />
        <div className="flex items-center gap-4">
          <Link href="/birimler" data-testid="link-staff-departments" className="hidden text-[11px] font-bold uppercase tracking-[0.13em] text-foreground/55 transition-colors hover:text-primary sm:inline">
            Birimler
          </Link>
          {signedIn ? <UserButton /> : null}
        </div>
      </div>
    </header>
  );
}

function LoadingState() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20" aria-live="polite" data-testid="status-staff-loading">
      <div className="h-3 w-32 animate-pulse bg-muted" />
      <div className="mt-6 h-14 max-w-xl animate-pulse bg-muted" />
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <div className="h-56 animate-pulse border border-border bg-card" />
        <div className="h-56 animate-pulse border border-border bg-card" />
        <div className="h-56 animate-pulse border border-border bg-card" />
        <div className="h-56 animate-pulse border border-border bg-card" />
      </div>
    </section>
  );
}

function SignedOutState() {
  return (
    <section className="mx-auto flex min-h-[72dvh] max-w-xl flex-col items-center justify-center px-5 text-center md:px-10">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
        <BriefcaseBusiness size={28} strokeWidth={1.5} />
      </div>
      <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">MMT Global / Staff</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Sorumluluk merkezine giriş</h1>
      <p className="mt-5 max-w-md text-base leading-7 text-foreground/60">
        Finans, medya, lojistik ve B2B operasyonlarını görmek için personel hesabınızla giriş yapın.
      </p>
      <Link href="/staff/giris" data-testid="link-staff-sign-in" className="mt-8 inline-flex items-center gap-3 bg-primary px-7 py-4 text-xs font-bold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-primary/85">
        Personel girişi
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}

function ResponsibilityCard({ item }: { item: Responsibility }) {
  const Icon = item.icon;
  return (
    <article className="group flex flex-col justify-between border border-border bg-card p-6 transition-transform duration-300 hover:-translate-y-1 hover:border-primary/50 md:p-8" data-testid={`card-staff-responsibility-${item.id}`}>
      <div>
        <div className="flex items-start justify-between gap-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
            <Icon size={22} strokeWidth={1.7} />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/35">0{responsibilities.indexOf(item) + 1}</span>
        </div>
        <p className="mt-9 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{item.team}</p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight">{item.title}</h2>
        <p className="mt-4 text-sm leading-7 text-foreground/58">{item.description}</p>
      </div>
      <div className="mt-8 space-y-2 border-t border-border/70 pt-5">
        {item.links.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            data-testid={`link-staff-${link.id}`}
            className="flex items-center justify-between gap-4 py-2 text-sm font-semibold transition-colors hover:text-primary"
          >
            {link.label}
            <ArrowRight className="text-primary transition-transform group-hover:translate-x-1" size={16} />
          </Link>
        ))}
      </div>
    </article>
  );
}

function StaffProfileCard({ profile }: { profile: StaffProfile }) {
  return (
    <article
      className="border border-primary/30 bg-card p-6 md:p-8"
      data-testid={`card-staff-profile-${profile.internalId}`}
    >
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              {profile.internalId}
            </span>
            <span className="border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
              Taslak kayıt
            </span>
          </div>
          <h3 className="mt-4 text-3xl font-semibold tracking-tight">{profile.fullName}</h3>
          <p className="mt-2 text-base font-semibold text-primary">{profile.proposedRole}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground/55">
          <ShieldAlert size={16} className="text-primary" />
          Resmî doğrulama bekliyor
        </div>
      </div>

      <div className="mt-8 grid gap-5 border-t border-border/70 pt-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex gap-3">
            <Languages className="mt-0.5 shrink-0 text-primary" size={18} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">
                Dil bilgisi
              </p>
              <p className="mt-1 text-sm leading-6">{profile.languages.join(" · ")}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <GraduationCap className="mt-0.5 shrink-0 text-primary" size={18} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">
                Eğitim
              </p>
              <p className="mt-1 text-sm leading-6">{profile.educationSummary}</p>
            </div>
          </div>
          {profile.contactEmail ? (
            <div className="flex gap-3">
              <Mail className="mt-0.5 shrink-0 text-primary" size={18} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">
                  İç iletişim
                </p>
                <a
                  href={`mailto:${profile.contactEmail}`}
                  className="mt-1 block break-all text-sm leading-6 transition-colors hover:text-primary"
                >
                  {profile.contactEmail}
                </a>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <Globe2 className="mt-0.5 shrink-0 text-primary" size={18} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">
                Uluslararası iş
              </p>
              <p className="mt-1 text-sm leading-6">{profile.businessSummary}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Truck className="mt-0.5 shrink-0 text-primary" size={18} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">
                Operasyon odağı
              </p>
              <p className="mt-1 text-sm leading-6">{profile.proposedRole}</p>
            </div>
          </div>
          {profile.additionalResponsibility ? (
            <div className="border-l-2 border-primary/60 pl-4 text-sm leading-6 text-foreground/65">
              <span className="font-semibold text-foreground">Ek sorumluluk: </span>
              {profile.additionalResponsibility}
              {profile.approvalRequired ? (
                <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  İş sahibi onayı zorunlu
                </span>
              ) : null}
            </div>
          ) : null}
          {profile.supportRequested ? (
            <div className="border-l-2 border-primary/60 pl-4 text-sm leading-6 text-foreground/65">
              <span className="font-semibold text-foreground">Destek notu: </span>
              {profile.supportNote ?? "Destek ihtiyacı görüşmede netleştirilecek."}
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-6 border-t border-border/70 pt-5 text-xs leading-6 text-foreground/45">
        {profile.verificationNote ??
          "Bilgiler iç taslak olarak tutuluyor; resmî belgeler doğrulanmadan kamuya açık profilde kullanılmaz."}
      </p>
    </article>
  );
}

function SharedFinanceDesk({ profiles }: { profiles: StaffProfile[] }) {
  const participants = profiles.filter(
    (profile) =>
      profile.internalId === "MMT-FIN-001" ||
      profile.internalId === "MMT-FIN-002",
  );

  if (participants.length === 0) return null;

  return (
    <section
      className="mt-10 border border-primary/30 bg-primary/5 p-6 md:p-8"
      aria-labelledby="shared-finance-desk-title"
      data-testid="card-shared-finance-desk"
    >
      <div className="flex flex-col justify-between gap-5 border-b border-primary/20 pb-6 md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            <Users size={15} />
            Ortak çalışma alanı
          </p>
          <h2
            id="shared-finance-desk-title"
            className="mt-3 text-3xl font-semibold tracking-tight"
          >
            Finans ve müşteri değerlendirme masası
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-foreground/65">
            Selen Hanım ve Fırat Bey, müşteri taleplerini aynı dosya akışında
            takip eder; görevler ayrı, nihai onay sınırı ortaktır.
          </p>
        </div>
        <Link
          href="/staff/applications"
          data-testid="link-shared-finance-applications"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary hover:text-primary/70"
        >
          Finans başvuruları
          <ArrowRight size={15} />
        </Link>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {participants.map((profile) => {
          const isSelen = profile.internalId === "MMT-FIN-001";
          const responsibilities = isSelen
            ? [
                "Finans, risk ve limit ön değerlendirmesi",
                "Müşteriyle resmi şartların kontrolü",
                "Dosyanın yönetici onayına hazırlanması",
              ]
            : [
                "Müşteriyle masa başı iletişim",
                "Belge toplama ve eksik bilgi takibi",
                "Şube ve saha rehberliği ile dosya tamlık kontrolü",
              ];

          return (
            <article
              key={profile.internalId}
              className="border border-border bg-card p-5 md:p-6"
              data-testid={`card-shared-finance-${profile.internalId}`}
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                {isSelen ? "Finans değerlendirme odağı" : "Müşteri ve dosya odağı"}
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                {profile.fullName}
              </h3>
              <p className="mt-1 text-sm font-semibold text-foreground/60">
                {profile.proposedRole}
              </p>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-foreground/70">
                {responsibilities.map((responsibility) => (
                  <li key={responsibility} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {responsibility}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <div className="mt-6 grid gap-3 border-t border-primary/20 pt-6 text-sm md:grid-cols-3">
        <div>
          <p className="font-bold text-foreground">Dosya akışı</p>
          <p className="mt-1 leading-6 text-foreground/60">
            Eksik bilgi, belge, risk ve sonraki adım tek kayıtta tutulur.
          </p>
        </div>
        <div>
          <p className="font-bold text-foreground">Müşteri iletişimi</p>
          <p className="mt-1 leading-6 text-foreground/60">
            Şartlar açıklanır; kesin finansman veya onay vaadi verilmez.
          </p>
        </div>
        <div>
          <p className="font-bold text-foreground">Onay sınırı</p>
          <p className="mt-1 leading-6 text-foreground/60">
            Para transferi, sözleşme ve kesin işlem yalnızca sizin onayınızla
            ilerler.
          </p>
        </div>
      </div>
    </section>
  );
}

function SignedInCenter() {
  const {
    data: profiles = [],
    isLoading: profilesLoading,
    isError: profilesError,
  } = useGetStaffProfiles();

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-16">
      <div className="flex flex-col justify-between gap-8 border-b border-border/70 pb-10 md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            <LayoutDashboard size={15} />
            MMT Global / Operasyon
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[0.98] tracking-tight md:text-6xl">
            Sorumluluk merkezi
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/60">
            Her iş alanının sahibi ve bir sonraki operasyon adımı burada. İsimler değil, sorumluluklar görünür.
          </p>
        </div>
        <div className="flex items-center gap-3 border border-primary/25 bg-primary/10 px-4 py-3 text-xs font-semibold text-primary" data-testid="status-staff-access">
          <FileCheck2 size={17} />
          Yetkili personel alanı
        </div>
      </div>
      <section className="mt-10" aria-labelledby="staff-profiles-title">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              İç ekip / taslak kayıtlar
            </p>
            <h2 id="staff-profiles-title" className="mt-2 text-2xl font-semibold tracking-tight">
              Ekip profilleri
            </h2>
          </div>
          <p className="max-w-md text-xs leading-5 text-foreground/45">
            Bu bilgiler yalnızca yetkili personel API’sinden gelir; kamuya açık birim sayfalarına aktarılmaz.
          </p>
        </div>
        {profilesLoading ? (
          <div className="h-64 animate-pulse border border-border bg-card" data-testid="status-staff-profiles-loading" />
        ) : profilesError ? (
          <div className="border border-destructive/30 bg-destructive/5 p-5 text-sm leading-6 text-foreground/65" data-testid="status-staff-profiles-error">
            İç ekip profilleri şu anda alınamadı. Operasyon kartları kullanılmaya devam edebilir.
          </div>
        ) : profiles.length === 0 ? (
          <div className="border border-border bg-card p-5 text-sm leading-6 text-foreground/55" data-testid="status-staff-profiles-empty">
            Henüz taslak personel profili bulunmuyor.
          </div>
        ) : (
          <div className="space-y-5">
            {profiles.map((profile) => (
              <StaffProfileCard key={profile.internalId} profile={profile} />
            ))}
          </div>
        )}
      </section>
      {profiles.length > 0 ? <SharedFinanceDesk profiles={profiles} /> : null}
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {responsibilities.map((item) => <ResponsibilityCard key={item.id} item={item} />)}
      </div>
      <div className="mt-10 flex flex-col gap-5 border border-border bg-secondary p-6 text-secondary-foreground md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Çalışma ilkesi</p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-secondary-foreground/65">
            Her talep doğru ekibe, her yayın doğru bağlama, her bağlantı açık bir sonraki adıma ulaşır.
          </p>
        </div>
        <Link href="/birimler" data-testid="link-staff-public-departments" className="inline-flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-secondary-foreground transition-colors hover:text-primary">
          Genel birimleri gör
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

export default function StaffResponsibilityCenter() {
  useStaffMeta();
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <StaffHeader signedIn={Boolean(isSignedIn)} />
      {!isLoaded ? <LoadingState /> : !isSignedIn ? <SignedOutState /> : <SignedInCenter />}
    </main>
  );
}