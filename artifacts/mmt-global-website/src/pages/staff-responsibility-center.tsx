import { FormEvent, useEffect, useState } from "react";
import { UserButton, useAuth } from "@clerk/react";
import { Link, Redirect } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  FileCheck2,
  Gift,
  Globe2,
  GraduationCap,
  Languages,
  LayoutDashboard,
  Mail,
  Megaphone,
  Plane,
  Trophy,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";
import {
  useGetStaffProfiles,
  getGetStaffRewardsQueryKey,
  useCreateStaffRewardPlan,
  useCreateStaffRewardTransaction,
  useDecideStaffRewardTransaction,
  useGetOperationsDesk,
  useGetStaffAccess,
  getGetStaffAccessQueryKey,
  useGetStaffRewards,
  type StaffProfile,
  type StaffRewardSummary,
  type StaffRewardTransactionKind,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const {
    data: profiles = [],
    isLoading: profilesLoading,
    isError: profilesError,
  } = useGetStaffProfiles();
  const rewardsQuery = useGetStaffRewards();
  const operationsDeskQuery = useGetOperationsDesk();
  const isRewardsAdmin = operationsDeskQuery.data?.role === "admin";

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
      <section
        className="mt-8 border border-primary/30 bg-primary/10 p-6 md:p-8"
        aria-labelledby="staff-welcome-title"
        data-testid="banner-staff-welcome"
      >
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          MMT Global / personel erişimi
        </p>
        <h2 id="staff-welcome-title" className="mt-3 text-3xl font-semibold tracking-tight">
          Hoş geldiniz.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground/65">
          Sorumluluk alanınız, açık operasyon adımları ve ekip bağlantıları bu
          merkezden takip edilir. Kesin finansal işlem ve ticari kararlar
          yalnızca proje sahibi onayıyla ilerler.
        </p>
      </section>
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
      <StaffRewardsSection
        items={rewardsQuery.data?.items ?? []}
        isLoading={rewardsQuery.isLoading}
        isAdmin={isRewardsAdmin}
      />
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

function StaffRewardsSection({
  items,
  isLoading,
  isAdmin,
}: {
  items: StaffRewardSummary[];
  isLoading: boolean;
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState({
    staffEmail: "",
    name: "",
    monthlyPoints: "100",
    monthlyCashAmount: "0",
    holidayPackageBudget: "0",
    internationalTravelBudget: "0",
    customBenefits: "",
  });
  const [transaction, setTransaction] = useState({
    staffEmail: "",
    kind: "points" as StaffRewardTransactionKind,
    pointsDelta: "50",
    cashAmount: "0",
    title: "",
    reason: "",
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: getGetStaffRewardsQueryKey() });
  const createPlan = useCreateStaffRewardPlan({
    mutation: { onSuccess: refresh },
  });
  const createTransaction = useCreateStaffRewardTransaction({
    mutation: { onSuccess: refresh },
  });
  const decide = useDecideStaffRewardTransaction({
    mutation: { onSuccess: refresh },
  });

  function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createPlan.mutate({
      data: {
        staffEmail: plan.staffEmail.trim(),
        name: plan.name.trim(),
        monthlyPoints: Number(plan.monthlyPoints) || 0,
        monthlyCashAmount: Number(plan.monthlyCashAmount) || 0,
        holidayPackageBudget: Number(plan.holidayPackageBudget) || 0,
        internationalTravelBudget: Number(plan.internationalTravelBudget) || 0,
        customBenefits: plan.customBenefits
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      },
    });
  }

  function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTransaction.mutate({
      data: {
        staffEmail: transaction.staffEmail.trim(),
        kind: transaction.kind,
        pointsDelta: Number(transaction.pointsDelta) || 0,
        cashAmount: Number(transaction.cashAmount) || 0,
        title: transaction.title.trim(),
        reason: transaction.reason.trim() || undefined,
      },
    });
  }

  return (
    <section className="mt-10 border border-primary/30 bg-card p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            <Gift size={15} />
            Personel değer ve ödül merkezi
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Kişiye özel kazanç paketleri</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-foreground/60">
            Puan, prim, tatil paketi, izin ve yurt dışı seyahat bütçeleri her
            personel için ayrı tanımlanabilir. Nakit ve seyahat işlemleri ödeme
            yapılmış sayılmaz; yönetici kararını bekler.
          </p>
        </div>
        <Trophy className="text-primary" size={28} />
      </div>

      {isLoading ? (
        <div className="mt-8 h-40 animate-pulse border border-border bg-background" />
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.staffUserId} className="border border-border/70 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{item.staffEmail}</p>
                  <h3 className="mt-2 text-xl font-semibold">{item.pointsBalance.toLocaleString("tr-TR")} puan</h3>
                </div>
                <span className="text-xs text-foreground/50">{item.plans.length} paket</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                <Metric label="Nakit" value={`${item.cashBalance.toLocaleString("tr-TR")} ₺`} />
                <Metric label="Tatil" value={`${item.holidayBalance.toLocaleString("tr-TR")} ₺`} />
                <Metric label="Yurt dışı" value={`${item.internationalTravelBalance.toLocaleString("tr-TR")} ₺`} />
              </div>
              <div className="mt-5 space-y-2 border-t border-border/70 pt-4">
                {item.plans.slice(0, 2).map((rewardPlan) => (
                  <p key={rewardPlan.id} className="text-xs text-foreground/60">
                    <span className="font-semibold text-foreground">{rewardPlan.name}</span>
                    {" · "}
                    {rewardPlan.monthlyPoints.toLocaleString("tr-TR")} puan/ay
                  </p>
                ))}
                {item.transactions.filter((entry) => entry.status === "pending_approval").map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 border border-primary/20 bg-primary/5 p-3 text-xs">
                    <span>{entry.title} · yönetici kararı bekliyor</span>
                    {isAdmin ? (
                      <span className="flex gap-2">
                        <button type="button" onClick={() => decide.mutate({ id: entry.id, data: { decision: "approve" } })} className="font-bold text-primary">Onayla</button>
                        <button type="button" onClick={() => decide.mutate({ id: entry.id, data: { decision: "reject" } })} className="font-bold text-destructive">Reddet</button>
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {isAdmin ? (
        <div className="mt-8 grid gap-6 border-t border-border/70 pt-8 lg:grid-cols-2">
          <form onSubmit={submitPlan} className="space-y-3">
            <h3 className="text-xl font-semibold">Özel paket tanımla</h3>
            <RewardInput label="Personel e-postası" value={plan.staffEmail} onChange={(value) => setPlan((current) => ({ ...current, staffEmail: value }))} type="email" required />
            <RewardInput label="Paket adı" value={plan.name} onChange={(value) => setPlan((current) => ({ ...current, name: value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <RewardInput label="Aylık puan" value={plan.monthlyPoints} onChange={(value) => setPlan((current) => ({ ...current, monthlyPoints: value }))} type="number" />
              <RewardInput label="Aylık nakit karşılığı" value={plan.monthlyCashAmount} onChange={(value) => setPlan((current) => ({ ...current, monthlyCashAmount: value }))} type="number" />
              <RewardInput label="Tatil bütçesi" value={plan.holidayPackageBudget} onChange={(value) => setPlan((current) => ({ ...current, holidayPackageBudget: value }))} type="number" />
              <RewardInput label="Yurt dışı bütçesi" value={plan.internationalTravelBudget} onChange={(value) => setPlan((current) => ({ ...current, internationalTravelBudget: value }))} type="number" />
            </div>
            <RewardInput label="Özel jestler (virgülle ayırın)" value={plan.customBenefits} onChange={(value) => setPlan((current) => ({ ...current, customBenefits: value }))} />
            <button disabled={createPlan.isPending} className="bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-60">
              Paketi kaydet
            </button>
          </form>
          <form onSubmit={submitTransaction} className="space-y-3">
            <h3 className="text-xl font-semibold">Puan veya ödül ekle</h3>
            <RewardInput label="Personel e-postası" value={transaction.staffEmail} onChange={(value) => setTransaction((current) => ({ ...current, staffEmail: value }))} type="email" required />
            <RewardInput label="Kazanım başlığı" value={transaction.title} onChange={(value) => setTransaction((current) => ({ ...current, title: value }))} required />
            <select value={transaction.kind} onChange={(event) => setTransaction((current) => ({ ...current, kind: event.target.value as StaffRewardTransactionKind }))} className="w-full border border-border bg-background px-3 py-3 text-sm">
              <option value="points">Puan</option>
              <option value="cash">Nakit kazanç</option>
              <option value="holiday_package">Tatil paketi</option>
              <option value="international_trip">Yurt dışı gezisi</option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <RewardInput label="Puan miktarı" value={transaction.pointsDelta} onChange={(value) => setTransaction((current) => ({ ...current, pointsDelta: value }))} type="number" />
              <RewardInput label="Bütçe tutarı" value={transaction.cashAmount} onChange={(value) => setTransaction((current) => ({ ...current, cashAmount: value }))} type="number" />
            </div>
            <RewardInput label="Gerekçe" value={transaction.reason} onChange={(value) => setTransaction((current) => ({ ...current, reason: value }))} />
            <button disabled={createTransaction.isPending} className="bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-60">
              Kazanımı kaydet
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-border/60 p-3"><p className="text-[10px] uppercase tracking-wider text-foreground/40">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function RewardInput({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="block text-sm"><span className="mb-1 block text-foreground/65">{label}</span><input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-border bg-background px-3 py-3 outline-none focus:border-primary" /></label>;
}

export default function StaffResponsibilityCenter() {
  useStaffMeta();
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <StaffHeader signedIn={Boolean(isSignedIn)} />
      {!isLoaded ? <LoadingState /> : !isSignedIn ? <SignedOutState /> : <AuthorizedCenter />}
    </main>
  );
}

function AuthorizedCenter() {
  const access = useGetStaffAccess({ query: { queryKey: getGetStaffAccessQueryKey(), retry: false } });
  if (access.isPending) return <LoadingState />;
  if (access.isError) return (
    <section className="mx-auto max-w-xl px-5 py-20 text-center">
      <h1 className="text-2xl font-semibold">Personel yetkiniz bulunamadı</h1>
      <p className="mt-4 text-foreground/60">Bu alan için mevcut hesabınıza tanımlı bir yetki gerekiyor.</p>
      <Link href="/b2b-agi/panel" className="mt-6 inline-block text-primary underline">Şirket paneline dön</Link>
    </section>
  );
  if (access.data.role === "founder") return <Redirect to="/staff/yonetim-paneli" />;
  return <SignedInCenter />;
}