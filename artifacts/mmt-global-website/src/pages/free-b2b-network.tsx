import { useEffect, useRef, useState } from "react";
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
  LogIn,
  LayoutDashboard,
} from "lucide-react";
import {
  useGetB2BRequests,
  useGetB2BListings,
  type B2BListingRole,
  type B2BListing,
  type B2BRequestCategory,
} from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";

const roleIcons: Record<B2BListingRole, any> = {
  producer: Factory,
  buyer: Building2,
  logistics: Truck,
  employer: BriefcaseBusiness,
};

function formatDate(dateStr: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

export default function FreeB2BNetworkPage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<
    "explore" | "requests" | "submit"
  >("explore");
  const tabContentRef = useRef<HTMLDivElement>(null);

  function selectTab(tab: "explore" | "requests" | "submit") {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      tabContentRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  useEffect(() => {
    document.title = `${t("b2b_title")} | MMT Global`;
    const descriptionTag = document.querySelector('meta[name="description"]');
    descriptionTag?.setAttribute(
      "content",
       t("b2b_description"),
    );
  }, [t]);

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
            {t("home")}
          </Link>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        <section className="border-b border-border/70 bg-secondary px-6 py-14 text-secondary-foreground md:px-12 md:py-20">
          <div className="mx-auto max-w-7xl">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t("b2b_kicker")}
            </p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
              {t("b2b_title")}
              <span className="block font-serif font-normal italic text-primary mt-2">{t("b2b_title_emphasis")}</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70">
              {t("b2b_description")}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10 md:px-12 md:py-16 w-full flex-1">
          <div className="mb-8 grid gap-3 border-b border-border/70 pb-8 sm:grid-cols-3">
            <Link
              href="/b2b-agi/katil"
              className="flex min-h-14 items-center justify-center gap-3 bg-primary px-5 py-4 text-center text-xs font-bold uppercase tracking-[0.13em] text-primary-foreground transition-colors hover:bg-primary/85"
              data-testid="link-business-registration"
            >
              <Building2 size={17} />
              Firma Kaydı
            </Link>
            <Link
              href="/sign-in"
              className="flex min-h-14 items-center justify-center gap-3 border border-border/70 bg-card px-5 py-4 text-center text-xs font-bold uppercase tracking-[0.13em] transition-colors hover:border-primary hover:text-primary"
              data-testid="link-business-sign-in"
            >
              <LogIn size={17} />
              Giriş Yap
            </Link>
            <Link
              href="/b2b-agi/panel"
              className="flex min-h-14 items-center justify-center gap-3 border border-primary/40 bg-primary/5 px-5 py-4 text-center text-xs font-bold uppercase tracking-[0.13em] text-primary transition-colors hover:bg-primary/10"
              data-testid="link-company-panel"
            >
              <LayoutDashboard size={17} />
              Firma Panelim
            </Link>
          </div>

          <div className="grid gap-3 border-b border-border/70 mb-10 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => selectTab("explore")}
              className={`min-h-12 px-3 py-3 text-xs font-semibold tracking-[0.15em] uppercase transition-colors border-b-2 ${
                activeTab === "explore"
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/50 hover:text-foreground"
              }`}
            >
              {t("tab_explore")}
            </button>
            <button
              type="button"
              onClick={() => selectTab("requests")}
              className={`min-h-12 px-3 py-3 text-xs font-semibold tracking-[0.15em] uppercase transition-colors border-b-2 ${
                activeTab === "requests"
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/50 hover:text-foreground"
              }`}
            >
              {t("tab_requests")}
            </button>
            <button
              type="button"
              onClick={() => selectTab("submit")}
              className={`min-h-12 px-3 py-3 text-xs font-semibold tracking-[0.15em] uppercase transition-colors border-b-2 ${
                activeTab === "submit"
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/50 hover:text-foreground"
              }`}
            >
              {t("tab_join")}
            </button>
          </div>

          <div
            ref={tabContentRef}
            className="scroll-mt-6 animate-slide-up-fade"
          >
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
  const { t } = useI18n();
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
            placeholder={t("search_listing")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-12 bg-card border border-border/70 pl-12 pr-4 outline-none focus:border-primary transition-colors text-sm"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <FilterButton
            active={roleFilter === "all"}
            onClick={() => setRoleFilter("all")}
            label={t("role_all")}
          />
          {(Object.keys(roleIcons) as B2BListingRole[]).map((role) => (
              <FilterButton
                key={role}
                active={roleFilter === role}
                onClick={() => setRoleFilter(role)}
                label={t(`role_${role}`)}
                icon={roleIcons[role]}
              />
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : isError ? (
        <div className="py-20 text-center border border-border/70 bg-card">
          <p className="text-foreground/60">{t("listing_error")}</p>
        </div>
      ) : data?.items.length === 0 ? (
        <div className="py-24 text-center border border-border/70 bg-card">
          <Info className="mx-auto h-10 w-10 text-primary/50 mb-4" />
          <h3 className="text-lg font-semibold">{t("no_records_title")}</h3>
          <p className="mt-2 text-sm text-foreground/60 max-w-sm mx-auto">
            {t("no_records_desc")}
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
                {t("previous")}
              </button>
              <span className="text-xs font-mono text-foreground/50">
                {t("page")} {page} / {Math.ceil((data?.total || 1) / (data?.pageSize || 12))}
              </span>
              <button
                disabled={!hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs font-semibold uppercase tracking-[0.2em] transition-colors hover:text-primary disabled:opacity-30 disabled:hover:text-foreground"
              >
                {t("next")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getRequestCategoryLabel(category: B2BRequestCategory, t: (key: string) => string) {
  return t(
    {
      product: "product_request",
      service: "service_request",
      logistics: "logistics_request",
      partnership: "partnership_request",
      employment: "job_request",
      other: "other",
    }[category],
  );
}

function getEmploymentTypeLabel(type: string, t: (key: string) => string) {
  return t(
    {
      full_time: "employment_full_time",
      part_time: "employment_part_time",
      contract: "employment_contract",
      seasonal: "employment_seasonal",
      internship: "employment_internship",
      remote: "employment_remote",
    }[type] ?? type,
  );
}

function RequestsView() {
  const { t } = useI18n();
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
            {t("request_kicker")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold font-serif">
            {t("request_title")}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/60">
            {t("request_description")}
          </p>
        </div>
        <Link
          href="/b2b-agi/talep"
          className="inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white"
        >
          <MessageSquareText size={15} />
          {t("share_request")}
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
            placeholder={t("search_request")}
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
          <option value="all">{t("all_requests")}</option>
          {(Object.keys({
            product: true,
            service: true,
            logistics: true,
            partnership: true,
            employment: true,
            other: true,
          }) as B2BRequestCategory[]).map((value) => (
            <option key={value} value={value}>
              {getRequestCategoryLabel(value, t)}
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
          {t("request_error")}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="border border-border/70 bg-card py-20 text-center">
          <Info className="mx-auto mb-4 h-10 w-10 text-primary/50" />
          <h3 className="text-lg font-semibold">{t("no_requests_title")}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-foreground/60">
            {t("no_requests_desc")}
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
                    {getRequestCategoryLabel(request.category, t)}
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
                          ? getEmploymentTypeLabel(request.employmentType, t)
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
              {t("more_requests")}
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
  const { t, locale } = useI18n();
  const RoleIcon = roleIcons[listing.role];

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
          {t(`role_${listing.role}`)}
        </span>
        {listing.publishedAt && (
          <span className="text-[10px] font-mono text-foreground/40">
            {formatDate(listing.publishedAt, locale)}
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
  const { t } = useI18n();
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
      <div>
        <h2 className="text-2xl font-semibold mb-4 font-serif">{t("join_title")}</h2>
        <div className="space-y-6 text-sm leading-relaxed text-foreground/70">
          <p>
            {t("join_description")}
          </p>
          <p>
            {t("join_description")}
          </p>
          <div className="border-l-2 border-primary pl-4 py-1">
            <strong className="block text-foreground mb-1">{t("join_verify")}</strong>
            {t("join_verify_description")}
          </div>
        </div>
      </div>
      <div className="flex items-center border border-border/70 bg-card p-8 md:p-12">
        <div>
          <h3 className="text-3xl font-semibold leading-tight">
             {t("join_verify")},
            <span className="block font-serif font-normal italic text-primary">
              {t("tab_join")}.
            </span>
          </h3>
          <p className="mt-5 max-w-xl leading-relaxed text-foreground/65">
            {t("join_description")}
          </p>
          <Link
            href="/b2b-agi/katil"
            className="mt-8 inline-flex items-center gap-3 bg-primary px-6 py-4 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
          >
            {t("create_business_profile")}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
