import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Factory,
  Truck,
  BriefcaseBusiness,
  CheckCircle2,
  Search,
  MapPin,
  Loader2,
  Info,
  MessageSquareText,
} from "lucide-react";
import {
  useGetB2BRequests,
  useGetB2BListings,
  type B2BListingRole,
  type B2BListing,
  type B2BRequestCategory,
} from "@workspace/api-client-react";

const roleLabels: Record<B2BListingRole, { label: string; icon: any }> = {
  producer: { label: "Üretici", icon: Factory },
  buyer: { label: "Alıcı", icon: Building2 },
  logistics: { label: "Lojistik / Hizmet", icon: Truck },
  employer: { label: "İşveren", icon: BriefcaseBusiness },
};

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

export default function FreeB2BNetworkPage() {
  const [activeTab, setActiveTab] = useState<
    "explore" | "requests" | "submit"
  >("explore");

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
              onClick={() => setActiveTab("requests")}
              className={`whitespace-nowrap pb-3 text-sm font-semibold tracking-[0.15em] uppercase transition-colors border-b-2 ${
                activeTab === "requests"
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/50 hover:text-foreground"
              }`}
            >
              Alıcı talepleri
            </button>
            <button
              onClick={() => setActiveTab("submit")}
              className={`whitespace-nowrap pb-3 text-sm font-semibold tracking-[0.15em] uppercase transition-colors border-b-2 ${
                activeTab === "submit"
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/50 hover:text-foreground"
              }`}
            >
              İşletme Olarak Katıl
            </button>
          </div>

          <div className="animate-slide-up-fade">
            {activeTab === "explore" ? (
              <ExploreView />
            ) : activeTab === "requests" ? (
              <RequestsView />
            ) : (
              <SubmitView />
            )}
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

const requestCategoryLabels: Record<B2BRequestCategory, string> = {
  product: "Ürün",
  service: "Hizmet",
  logistics: "Lojistik",
  partnership: "İş ortaklığı",
  employment: "İş arayanlar",
  other: "Diğer",
};
const employmentTypeLabels: Record<string, string> = {
  full_time: "Tam zamanlı",
  part_time: "Yarı zamanlı",
  contract: "Sözleşmeli",
  seasonal: "Sezonluk",
  internship: "Staj",
  remote: "Uzaktan",
};

function RequestsView() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<B2BRequestCategory | "all">("all");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useGetB2BRequests({
    query: query.trim() || undefined,
    category: category === "all" ? undefined : category,
    page,
    pageSize: 12,
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            İhtiyacınızı görünür kılın
          </p>
          <h2 className="mt-3 text-3xl font-semibold font-serif">
            Alıcıların ve halkın talepleri
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/60">
            Onaylanmış talepleri inceleyin. Aradığınız ürün, hizmet veya iş
            ortağı sizde olabilir.
          </p>
        </div>
        <Link
          href="/b2b-agi/talep"
          className="inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white"
        >
          <MessageSquareText size={15} />
          Talep paylaş
        </Link>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative max-w-md flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40"
            size={18}
          />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Ürün, hizmet veya şehir ara..."
            className="h-12 w-full border border-border/70 bg-card pl-12 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value as B2BRequestCategory | "all");
            setPage(1);
          }}
          className="h-12 border border-border/70 bg-card px-4 text-sm outline-none focus:border-primary"
        >
          <option value="all">Tüm talepler</option>
          {Object.entries(requestCategoryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex min-h-[35vh] items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={30} />
        </div>
      ) : isError ? (
        <div className="border border-border/70 bg-card py-20 text-center text-foreground/60">
          Talepler yüklenirken bir hata oluştu.
        </div>
      ) : data?.items.length === 0 ? (
        <div className="border border-border/70 bg-card py-20 text-center">
          <Info className="mx-auto mb-4 h-10 w-10 text-primary/50" />
          <h3 className="text-lg font-semibold">Henüz talep bulunmuyor</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-foreground/60">
            Aradığınız ihtiyacı siz de paylaşabilir, ilk bağlantıyı
            başlatabilirsiniz.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data?.items.map((request) => (
              <article
                key={request.id}
                className="flex flex-col border border-border/70 bg-card p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                    <MessageSquareText size={12} />
                    {requestCategoryLabels[request.category]}
                  </span>
                  <span className="font-mono text-[10px] text-foreground/40">
                    {request.referenceCode}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-semibold leading-snug font-serif">
                  {request.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground/60 line-clamp-4">
                  {request.description}
                </p>
                <div className="mt-5 border-t border-border/70 pt-4 text-xs text-foreground/55">
                  <p className="font-medium text-foreground/75">
                    {request.organization || request.requesterName}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5">
                    <MapPin size={13} className="text-primary/70" />
                    {request.location}
                  </p>
                   {request.category === "employment" ? (
                     <p className="mt-3 text-foreground/60">
                       {request.employmentType
                         ? employmentTypeLabels[request.employmentType]
                         : null}
                       {request.salary ? ` · ${request.salary}` : ""}
                     </p>
                   ) : null}
                  <p className="mt-3 text-primary">{request.contact}</p>
                </div>
              </article>
            ))}
          </div>
          {data && data.page * data.pageSize < data.total ? (
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              className="w-full border border-border/70 py-3 text-xs font-semibold uppercase tracking-wider text-primary hover:bg-primary/5"
            >
              Daha fazla talep
            </button>
          ) : null}
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
      {listing.imageUrl ? (
        <img
          src={listing.imageUrl}
          alt={`${listing.organization} — ${listing.title}`}
          className="-mx-6 -mt-6 mb-6 aspect-[16/9] w-[calc(100%+3rem)] object-cover"
        />
      ) : null}
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
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
      <div>
        <h2 className="text-2xl font-semibold mb-4 font-serif">MMT Connect’e katılın</h2>
        <div className="space-y-6 text-sm leading-relaxed text-foreground/70">
          <p>
            Esnaf, fabrika, üretici, alıcı, lojistik ve hizmet sağlayıcılar
            kendi alanlarında görünürlük kazanabilir.
          </p>
          <p>
            Firma bilgilerinizi bir kez doğruladıktan sonra yeni ilanlarınızı
            MMT Global’in web sitesi ve medya kanalları üzerinden paylaşabilirsiniz.
          </p>
          <div className="border-l-2 border-primary pl-4 py-1">
            <strong className="block text-foreground mb-1">Tek seferlik doğrulama</strong>
            Her ilan için yeniden izin beklemezsiniz. Yalnızca işletme profiliniz
            ve resmi belgeniz MMT Global tarafından kontrol edilir.
          </div>
        </div>
      </div>
      <div className="flex items-center border border-border/70 bg-card p-8 md:p-12">
        <div>
          <h3 className="text-3xl font-semibold leading-tight">
            Bir kez doğrulanın,
            <span className="block font-serif font-normal italic text-primary">
              kendi ilanlarınızı yayınlayın.
            </span>
          </h3>
          <p className="mt-5 max-w-xl leading-relaxed text-foreground/65">
            MMT Connect ücretsizdir. Profiliniz onaylandıktan sonra web
            sitenize, sosyal hesaplarınıza ve medya kanallarımıza bağlantı
            veren ilanlar oluşturabilirsiniz.
          </p>
          <Link
            href="/b2b-agi/katil"
            className="mt-8 inline-flex items-center gap-3 bg-primary px-6 py-4 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
          >
            İşletme profilini oluştur
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
