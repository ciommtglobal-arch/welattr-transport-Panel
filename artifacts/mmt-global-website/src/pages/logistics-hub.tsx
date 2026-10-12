import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Truck,
  MapPin,
  Search,
  Loader2,
  Info,
  Calendar,
  ExternalLink,
  MessageSquareText,
  FileText,
  ArrowRight
} from "lucide-react";
import {
  useGetB2BListings,
  useGetPublicLogisticsMedia,
  type B2BListing,
  type PublicLogisticsMedia,
} from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import logisticsHero from "@assets/generated_images/logistics_hero.png";
import PublicNexusSection from "@/components/nexus-publications";

function formatDate(dateStr: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

export default function LogisticsHubPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"listings" | "media">("listings");

  useEffect(() => {
    document.title = `${t("logistics_hub_title")} | MMT Global`;
    const descriptionTag = document.querySelector('meta[name="description"]');
    descriptionTag?.setAttribute(
      "content",
       t("logistics_hub_desc"),
    );
  }, [t]);

  return (
    <main className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans">
      <header className="border-b border-white/5 bg-background sticky top-0 z-50">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 pr-24 md:px-8 md:pr-28">
          <Link href="/" className="group flex items-center gap-3" data-testid="link-home">
            <span className="flex h-8 w-8 items-center justify-center rounded-br-xl rounded-tl-xl bg-primary text-lg font-bold text-primary-foreground transition-transform group-hover:scale-95">
              M
            </span>
            <span className="text-sm font-semibold tracking-widest hidden sm:inline">
              MMT <span className="font-light opacity-70">GLOBAL</span>
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/b2b-agi"
              data-testid="link-b2b"
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/70 transition-colors hover:text-primary hidden sm:block"
            >
              {t("b2b_title")}
            </Link>
            <Link
              href="/"
              data-testid="link-back-home"
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/70 transition-colors hover:text-primary"
            >
              <ArrowLeft size={14} />
              {t("home")}
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        {/* Dark Hero Section */}
        <section className="bg-background pt-12 md:pt-20 px-5 md:px-8 w-full max-w-[1200px] mx-auto">
          <p className="mb-4 text-[13px] font-medium text-foreground/60 uppercase tracking-widest">
            {t("logistics_hub_kicker")}
          </p>
          <h1 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl text-foreground">
            {t("logistics_hub_title")}
          </h1>
          
          <div className="mt-10 md:mt-14 w-full relative">
            <img
              src={logisticsHero}
              alt="MMT Global Logistics"
              data-testid="img-hero"
              className="w-full h-[40vh] md:h-[65vh] object-cover rounded-t-[32px] block shadow-2xl shadow-black/50"
            />
          </div>
        </section>

        {/* Light Content Section */}
        <section className="flex-1 bg-secondary text-secondary-foreground rounded-t-[32px] -mt-6 relative z-10 px-5 md:px-8 py-12 md:py-20 w-full shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
          <div className="max-w-[1200px] mx-auto">
            <h2 className="text-2xl md:text-4xl font-bold leading-tight max-w-3xl mb-6">
              {t("logistics_hub_desc")}
            </h2>
            <p className="text-secondary-foreground/70 text-lg max-w-2xl font-medium leading-relaxed mb-10">
              {t("logistics_hub_emphasis")}
            </p>

            <div className="flex flex-wrap gap-4 mb-16">
              <Link
                href="/b2b-agi/talep"
                data-testid="button-share-need"
                className="inline-flex items-center gap-2 bg-primary px-8 py-4 text-[13px] font-bold tracking-wide text-white transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] rounded-full shadow-lg shadow-primary/25"
              >
                <MessageSquareText size={18} />
                {t("share_logistics_need")}
              </Link>
              <Link
                href="/b2b-agi"
                data-testid="button-explore"
                className="inline-flex items-center gap-2 border-2 border-secondary-foreground/10 bg-transparent px-8 py-4 text-[13px] font-bold tracking-wide text-secondary-foreground transition-all hover:border-secondary-foreground hover:bg-secondary-foreground/5 rounded-full"
              >
                <Search size={18} />
                {t("tab_explore")}
              </Link>
            </div>

            <div className="flex items-center gap-8 border-b border-secondary-foreground/10 mb-12 overflow-x-auto">
              <button
                onClick={() => setActiveTab("listings")}
                data-testid="tab-listings"
                className={`whitespace-nowrap pb-4 text-[13px] font-bold tracking-[0.1em] uppercase transition-colors border-b-2 ${
                  activeTab === "listings"
                    ? "border-primary text-secondary-foreground"
                    : "border-transparent text-secondary-foreground/40 hover:text-secondary-foreground/80"
                }`}
              >
                {t("logistics_tab_listings")}
              </button>
              <button
                onClick={() => setActiveTab("media")}
                data-testid="tab-media"
                className={`whitespace-nowrap pb-4 text-[13px] font-bold tracking-[0.1em] uppercase transition-colors border-b-2 ${
                  activeTab === "media"
                    ? "border-primary text-secondary-foreground"
                    : "border-transparent text-secondary-foreground/40 hover:text-secondary-foreground/80"
                }`}
              >
                {t("logistics_tab_media")}
              </button>
            </div>

            <div className="animate-slide-up-fade flex-1 min-h-[40vh]">
              {activeTab === "listings" ? <ListingsView /> : <MediaView />}
            </div>
            <PublicNexusSection />
          </div>
        </section>
      </div>
    </main>
  );
}

function ListingsView() {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const { data, isLoading, isError } = useGetB2BListings({
    role: "logistics",
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
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary-foreground/40" size={18} />
          <input
            type="text"
            data-testid="input-search"
            placeholder={t("search_listing")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-14 bg-white/60 border border-secondary-foreground/15 rounded-full pl-12 pr-6 outline-none focus:border-primary focus:bg-white transition-all text-[15px] font-medium text-secondary-foreground placeholder:text-secondary-foreground/40 shadow-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : isError ? (
        <div className="py-20 text-center rounded-3xl border border-secondary-foreground/10 bg-white/50">
          <p className="text-secondary-foreground/60 font-medium">{t("listing_error")}</p>
        </div>
      ) : data?.items.length === 0 ? (
        <div className="py-24 text-center rounded-3xl border border-secondary-foreground/10 bg-white/50">
          <Info className="mx-auto h-12 w-12 text-primary/50 mb-4" />
          <h3 className="text-xl font-bold text-secondary-foreground mb-2">{t("no_records_title")}</h3>
          <p className="text-[15px] font-medium text-secondary-foreground/60 max-w-md mx-auto">
            {t("no_records_desc")}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data?.items.map((listing) => (
              <LogisticsListingCard key={listing.id} listing={listing} locale={locale} />
            ))}
          </div>

          {(hasPrevPage || hasNextPage) && (
            <div className="flex items-center justify-center gap-8 mt-16 border-t border-secondary-foreground/10 pt-10">
              <button
                disabled={!hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
                data-testid="button-prev-page"
                className="text-[13px] font-bold uppercase tracking-[0.15em] transition-colors text-secondary-foreground hover:text-primary disabled:opacity-20 disabled:hover:text-secondary-foreground"
              >
                {t("previous")}
              </button>
              <span className="text-[13px] font-mono font-bold text-secondary-foreground/50 bg-secondary-foreground/5 px-4 py-1.5 rounded-full">
                {page} / {Math.ceil((data?.total || 1) / (data?.pageSize || 12))}
              </span>
              <button
                disabled={!hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                data-testid="button-next-page"
                className="text-[13px] font-bold uppercase tracking-[0.15em] transition-colors text-secondary-foreground hover:text-primary disabled:opacity-20 disabled:hover:text-secondary-foreground"
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

function LogisticsListingCard({ listing, locale }: { listing: B2BListing, locale: string }) {
  const { t } = useI18n();

  return (
    <Link
      href={`/b2b-agi/ilan/${listing.id}`}
      data-testid={`card-listing-${listing.id}`}
      className="group flex flex-col rounded-[24px] border border-secondary-foreground/10 bg-white/60 p-6 md:p-8 transition-all hover:border-primary/50 hover:bg-white hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
    >
      {listing.imageUrl ? (
        <div className="relative -mx-6 -mt-6 mb-6 md:-mx-8 md:-mt-8 md:mb-8 overflow-hidden rounded-t-[24px]">
          <img
            src={listing.imageUrl}
            alt={`${listing.organization} — ${listing.title}`}
            className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-4 mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          <Truck size={12} />
          {t("role_logistics")}
        </span>
        {listing.publishedAt && (
          <span className="text-[11px] font-mono font-medium text-secondary-foreground/40">
            {formatDate(listing.publishedAt, locale)}
          </span>
        )}
      </div>

      <h3 className="text-xl font-bold leading-snug line-clamp-2 text-secondary-foreground group-hover:text-primary transition-colors">
        {listing.title}
      </h3>
      <p className="mt-2 text-[15px] text-secondary-foreground/80 font-semibold">
        {listing.organization}
      </p>

      <p className="mt-4 text-[15px] leading-relaxed text-secondary-foreground/60 line-clamp-3 flex-1 font-medium">
        {listing.description}
      </p>

      <div className="mt-8 pt-5 border-t border-secondary-foreground/10 flex items-center justify-between text-[13px] font-semibold text-secondary-foreground/60">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-primary" />
          <span className="line-clamp-1">{listing.location}</span>
        </div>
        <ArrowRight size={16} className="text-primary/50 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
      </div>
    </Link>
  );
}

function MediaView() {
  const { t, locale } = useI18n();
  const { data: media, isLoading, isError } = useGetPublicLogisticsMedia();

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-20 text-center rounded-[24px] border border-secondary-foreground/10 bg-white/60">
        <p className="text-secondary-foreground/60 font-medium">Medya içerikleri yüklenemedi.</p>
      </div>
    );
  }

  if (!media || media.length === 0) {
    return (
      <div className="py-24 text-center rounded-[24px] border border-secondary-foreground/10 bg-white/60">
        <Info className="mx-auto h-12 w-12 text-primary/50 mb-4" />
        <h3 className="text-xl font-bold text-secondary-foreground mb-2">{t("no_logistics_media_title")}</h3>
        <p className="text-[15px] font-medium text-secondary-foreground/60 max-w-md mx-auto">
          {t("no_logistics_media_desc")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {media.map((item) => (
        <MediaCard key={item.id} media={item} locale={locale} />
      ))}
    </div>
  );
}

function MediaCard({
  media,
  locale,
}: {
  media: PublicLogisticsMedia;
  locale: string;
}) {
  const { t } = useI18n();
  const isDocument = media.contentType?.includes('pdf') || media.contentType?.includes('document');
  const isImage = media.contentType?.includes('image');

  const content = (
    <div
      className="flex flex-col h-full rounded-[24px] border border-secondary-foreground/10 bg-white/60 p-6 md:p-8 transition-all hover:border-primary/50 hover:bg-white hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 group cursor-pointer"
      data-testid={`card-media-${media.id}`}
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          {media.category}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-secondary-foreground/40">
          <Calendar size={12} />
          {formatDate(media.publishedAt, locale)}
        </span>
      </div>

      <h3 className="text-xl font-bold leading-snug text-secondary-foreground group-hover:text-primary transition-colors">
        {media.title}
      </h3>
      
      {media.summary && (
        <p className="mt-4 text-[15px] leading-relaxed text-secondary-foreground/60 line-clamp-3 flex-1 font-medium">
          {media.summary}
        </p>
      )}

      <div className="mt-8 pt-5 border-t border-secondary-foreground/10 flex items-center justify-between text-[12px] font-bold uppercase tracking-widest text-primary/80 group-hover:text-primary transition-colors">
        <span className="flex items-center gap-2">
          {isDocument ? <FileText size={16} /> : isImage ? <FileText size={16} /> : <ExternalLink size={16} />}
          {t("view_details")}
        </span>
        <ArrowRight size={16} className="-rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
      </div>
    </div>
  );

  const href = media.sourceUrl || media.fileUrl || "#";

  if (href === "#") {
    return content;
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
      {content}
    </a>
  );
}
