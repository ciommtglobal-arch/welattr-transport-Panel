import { useEffect, useState, FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Factory,
  Truck,
  CheckCircle2,
  Search,
  MapPin,
  Loader2,
  Info,
  CircleAlert
} from "lucide-react";
import {
  useGetB2BListings,
  useCreateB2BListing,
  type B2BListingRole,
  type B2BListing
} from "@workspace/api-client-react";

const roleLabels: Record<B2BListingRole, { label: string; icon: any }> = {
  producer: { label: "Üretici", icon: Factory },
  buyer: { label: "Alıcı", icon: Building2 },
  logistics: { label: "Lojistik / Hizmet", icon: Truck },
};

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

export default function FreeB2BNetworkPage() {
  const [activeTab, setActiveTab] = useState<"explore" | "submit">("explore");

  useEffect(() => {
    document.title = "Global B2B Ağı | MMT Global";
    const descriptionTag = document.querySelector('meta[name="description"]');
    descriptionTag?.setAttribute(
      "content",
      "MMT Global güvencesiyle üreticileri, alıcıları ve lojistik/hizmet sağlayıcıları buluşturan onaylı ticaret ağı. Keşfedin veya ilan verin."
    );
  }, []);

  return (
    <main className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-br-xl rounded-tl-xl bg-primary text-lg font-bold text-primary-foreground transition-transform group-hover:scale-95">
              M
            </span>
            <span className="text-lg font-semibold tracking-wider hidden sm:inline">
              MMT <span className="font-light opacity-80">GLOBAL</span>
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:text-primary"
          >
            <ArrowLeft size={15} />
            Ana sayfa
          </Link>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        <section className="border-b border-border/70 bg-secondary px-6 py-14 text-secondary-foreground md:px-12 md:py-20">
          <div className="mx-auto max-w-7xl">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Üret. Tanıt. Sat.
            </p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
              Global B2B
              <span className="block font-serif font-normal italic text-primary mt-2">ticaret ağı.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70">
              MMT Global güvencesiyle üreticileri, alıcıları ve lojistik/hizmet sağlayıcıları buluşturuyoruz. 
              Onaylı ilanlar ile güvenli bağlantılar kurun.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10 md:px-12 md:py-16 w-full flex-1">
          <div className="flex items-center gap-8 border-b border-border/70 mb-10 overflow-x-auto">
            <button
              onClick={() => setActiveTab("explore")}
              className={`whitespace-nowrap pb-3 text-sm font-semibold tracking-[0.15em] uppercase transition-colors border-b-2 ${
                activeTab === "explore"
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/50 hover:text-foreground"
              }`}
            >
              Ağı Keşfet
            </button>
            <button
              onClick={() => setActiveTab("submit")}
              className={`whitespace-nowrap pb-3 text-sm font-semibold tracking-[0.15em] uppercase transition-colors border-b-2 ${
                activeTab === "submit"
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/50 hover:text-foreground"
              }`}
            >
              Ücretsiz İlan Ver
            </button>
          </div>

          <div className="animate-slide-up-fade">
            {activeTab === "explore" ? <ExploreView /> : <SubmitView />}
          </div>
        </section>
      </div>
    </main>
  );
}

function ExploreView() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<B2BListingRole | "all">("all");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, roleFilter]);

  const { data, isLoading, isError } = useGetB2BListings({
    role: roleFilter === "all" ? undefined : roleFilter,
    query: debouncedQuery || undefined,
    page,
    pageSize: 12,
  });

  const hasNextPage = data && data.page * data.pageSize < data.total;
  const hasPrevPage = page > 1;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" size={18} />
          <input
            type="text"
            placeholder="İlan başlığı, şirket veya şehir ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-12 bg-card border border-border/70 pl-12 pr-4 outline-none focus:border-primary transition-colors text-sm"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <FilterButton
            active={roleFilter === "all"}
            onClick={() => setRoleFilter("all")}
            label="Tümü"
          />
          {(Object.entries(roleLabels) as [B2BListingRole, { label: string; icon: any }][]).map(
            ([role, info]) => (
              <FilterButton
                key={role}
                active={roleFilter === role}
                onClick={() => setRoleFilter(role)}
                label={info.label}
                icon={info.icon}
              />
            )
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : isError ? (
        <div className="py-20 text-center border border-border/70 bg-card">
          <p className="text-foreground/60">İlanlar yüklenirken bir hata oluştu.</p>
        </div>
      ) : data?.items.length === 0 ? (
        <div className="py-24 text-center border border-border/70 bg-card">
          <Info className="mx-auto h-10 w-10 text-primary/50 mb-4" />
          <h3 className="text-lg font-semibold">Kayıt Bulunamadı</h3>
          <p className="mt-2 text-sm text-foreground/60 max-w-sm mx-auto">
            Arama kriterlerinize uygun ilan bulunmuyor. Farklı kelimeler veya roller seçerek tekrar deneyin.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data?.items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          {(hasPrevPage || hasNextPage) && (
            <div className="flex items-center justify-center gap-6 mt-16 border-t border-border/70 pt-10">
              <button
                disabled={!hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs font-semibold uppercase tracking-[0.2em] transition-colors hover:text-primary disabled:opacity-30 disabled:hover:text-foreground"
              >
                Önceki
              </button>
              <span className="text-xs font-mono text-foreground/50">
                Sayfa {page} / {Math.ceil((data?.total || 1) / (data?.pageSize || 12))}
              </span>
              <button
                disabled={!hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs font-semibold uppercase tracking-[0.2em] transition-colors hover:text-primary disabled:opacity-30 disabled:hover:text-foreground"
              >
                Sonraki
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: any;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/70 bg-card text-foreground/60 hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
}

function ListingCard({ listing }: { listing: B2BListing }) {
  const roleInfo = roleLabels[listing.role];
  const RoleIcon = roleInfo.icon;

  return (
    <Link
      href={`/b2b-agi/ilan/${listing.id}`}
      className="group flex flex-col border border-border/70 bg-card p-6 transition-all hover:border-primary"
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <span className="inline-flex items-center gap-1.5 border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          <RoleIcon size={12} />
          {roleInfo.label}
        </span>
        {listing.publishedAt && (
          <span className="text-[10px] font-mono text-foreground/40">
            {formatDate(listing.publishedAt)}
          </span>
        )}
      </div>

      <h3 className="text-xl font-semibold leading-snug line-clamp-2 font-serif group-hover:text-primary transition-colors">
        {listing.title}
      </h3>
      <p className="mt-2 text-sm text-foreground/70 font-medium">
        {listing.organization}
      </p>

      <p className="mt-4 text-sm leading-relaxed text-foreground/60 line-clamp-3 flex-1">
        {listing.description}
      </p>

      <div className="mt-6 pt-5 border-t border-border/70 flex items-center gap-2 text-xs text-foreground/50">
        <MapPin size={14} className="text-primary/70" />
        {listing.location}
      </div>
    </Link>
  );
}

function SubmitView() {
  const [role, setRole] = useState<B2BListingRole>("producer");
  const [title, setTitle] = useState("");
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [socials, setSocials] = useState({
    instagram: "",
    facebook: "",
    linkedin: "",
    telegram: "",
    tiktok: "",
  });
  
  const [submittedListing, setSubmittedListing] = useState<B2BListing | null>(null);

  const createListing = useCreateB2BListing({
    mutation: {
      onSuccess: (data) => {
        setSubmittedListing(data);
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const cleanSocials = {
      instagram: socials.instagram.trim() || undefined,
      facebook: socials.facebook.trim() || undefined,
      linkedin: socials.linkedin.trim() || undefined,
      telegram: socials.telegram.trim() || undefined,
      tiktok: socials.tiktok.trim() || undefined,
    };
    const hasSocials = Object.values(cleanSocials).some((v) => v !== undefined);

    createListing.mutate({
      data: {
        role,
        title: title.trim(),
        fullName: fullName.trim(),
        organization: organization.trim(),
        location: location.trim(),
        contact: contact.trim(),
        description: description.trim(),
        website: website.trim() || undefined,
        socialLinks: hasSocials ? cleanSocials : undefined,
      },
    });
  }

  if (submittedListing) {
    return (
      <div className="max-w-2xl mx-auto border border-primary/30 bg-primary/5 p-10 text-center animate-slide-up-fade">
        <CheckCircle2 className="mx-auto h-16 w-16 text-primary mb-6" />
        <h2 className="text-3xl font-semibold mb-4">Başvurunuz Alındı</h2>
        <p className="text-foreground/70 leading-relaxed mb-8">
          İlanınız inceleme sırasına alınmıştır. MMT Global moderasyon ekibi 
          tarafından onaylandıktan sonra ağda herkese açık olarak yayınlanacaktır.
        </p>
        <div className="inline-block border border-border/70 bg-card px-6 py-4 mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">
            Referans Kodu
          </p>
          <p className="text-xl font-mono font-bold tracking-widest">
            {submittedListing.referenceCode}
          </p>
        </div>
        <div>
          <button
            onClick={() => {
              setSubmittedListing(null);
              setTitle("");
              setDescription("");
            }}
            className="inline-flex items-center gap-2 border border-border/70 px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:border-primary hover:text-primary transition-colors"
          >
            Yeni İlan Ekle
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
      <div>
        <h2 className="text-2xl font-semibold mb-4 font-serif">Güvenli Ticaret Ağı</h2>
        <div className="space-y-6 text-sm leading-relaxed text-foreground/70">
          <p>
            MMT Global B2B Ağı, gerçek ve güvenilir ticari aktörleri bir araya getirmeyi amaçlar.
          </p>
          <p>
            Gönderdiğiniz tüm ilanlar uzman ekibimiz tarafından incelenir. İçeriği uygun bulunmayan,
            yanıltıcı veya eksik bilgili başvurular reddedilebilir.
          </p>
          <div className="border-l-2 border-primary pl-4 py-1">
            <strong className="block text-foreground mb-1">Onay Süreci</strong>
            Kayıtlar manuel kontrolden geçer. İlanınız onaylandığında B2B ağ sayfamızda görünür olacaktır.
            Otomatik yayın vaadi bulunmamaktadır.
          </div>
        </div>
      </div>

      <div className="border border-border/70 bg-card p-6 md:p-10">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-sm font-semibold mb-3">Rolünüz</label>
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.entries(roleLabels) as [B2BListingRole, { label: string; icon: any }][]).map(
                ([key, info]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRole(key)}
                    className={`flex flex-col items-center justify-center gap-2 border p-4 transition-colors ${
                      role === key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/70 hover:border-primary/50 text-foreground/60"
                    }`}
                  >
                    <info.icon size={24} />
                    <span className="text-xs font-semibold uppercase tracking-wider">{info.label}</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Field label="İlan Başlığı" value={title} onChange={setTitle} required placeholder="Örn: Pamuk ipliği tedariki arıyorum" />
            <Field label="Ad / Yetkili" value={fullName} onChange={setFullName} required />
            <Field label="Firma / Oluşum" value={organization} onChange={setOrganization} required />
            <Field label="Şehir / Ülke" value={location} onChange={setLocation} required />
            <Field label="İletişim Bilgisi" value={contact} onChange={setContact} required placeholder="E-posta veya Telefon" />
            <Field label="Web Sitesi (Opsiyonel)" value={website} onChange={setWebsite} placeholder="https://" />
          </div>

          <div>
            <label className="block text-sm mb-2 text-foreground/70">Açıklama (Zorunlu)</label>
            <textarea
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ürününüzü, arayışınızı veya hizmet detaylarınızı yazın..."
              className="w-full border border-border/70 bg-background px-4 py-3 outline-none transition-colors focus:border-primary text-sm resize-y"
            />
          </div>

          <div className="border-t border-border/70 pt-8">
            <h3 className="text-sm font-semibold mb-4">Sosyal Medya (Opsiyonel)</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="LinkedIn" value={socials.linkedin} onChange={(v) => setSocials({ ...socials, linkedin: v })} placeholder="Profil URL'si" />
              <Field label="Instagram" value={socials.instagram} onChange={(v) => setSocials({ ...socials, instagram: v })} placeholder="Profil URL'si" />
              <Field label="Facebook" value={socials.facebook} onChange={(v) => setSocials({ ...socials, facebook: v })} placeholder="Profil URL'si" />
              <Field label="Telegram" value={socials.telegram} onChange={(v) => setSocials({ ...socials, telegram: v })} placeholder="t.me/kullaniciadi" />
              <Field label="TikTok" value={socials.tiktok} onChange={(v) => setSocials({ ...socials, tiktok: v })} placeholder="Profil URL'si" />
            </div>
          </div>

          {createListing.isError && (
            <div className="flex gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              İlan gönderilirken bir hata oluştu. Lütfen bilgilerinizi kontrol edip tekrar deneyin.
            </div>
          )}

          <button
            type="submit"
            disabled={createListing.isPending}
            className="flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90 disabled:opacity-70"
          >
            {createListing.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            İlanı Gönder ve Onaya Sun
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block text-foreground/70">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full border border-border/70 bg-background px-4 py-3 outline-none transition-colors focus:border-primary text-sm"
      />
    </label>
  );
}
