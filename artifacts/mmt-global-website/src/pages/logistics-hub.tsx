import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  type B2BListing,
} from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";

interface LogisticsMedia {
  id: number;
  title: string;
  summary: string | null;
  category: string;
  sourceUrl: string | null;
  fileUrl: string | null;
  contentType: string | null;
  publishedAt: string;
}

function useGetPublicLogisticsMedia() {
  return useQuery({
    queryKey: ["public-logistics-media"],
    queryFn: async () => {
      const res = await fetch("/api/public/logistics/media");
      if (!res.ok) {
        throw new Error("Failed to fetch logistics media");
      }
      return res.json() as Promise<LogisticsMedia[]>;
    },
  });
}

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
    <main className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="border-b border-border/70 bg-background/95 sticky top-0 z-10 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-br-xl rounded-tl-xl bg-primary text-lg font-bold text-primary-foreground transition-transform group-hover:scale-95">
              M
            </span>
            <span className="text-lg font-semibold tracking-wider hidden sm:inline">
              MMT <span className="font-light opacity-80">GLOBAL</span>
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/b2b-agi"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:text-primary hidden sm:block"
            >
              {t("b2b_title")}
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:text-primary"
            >
              <ArrowLeft size={15} />
              {t("home")}
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        <section className="border-b border-border/70 bg-secondary px-6 py-14 text-secondary-foreground md:px-12 md:py-20 relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute right-0 top-0 w-1/3 h-full opacity-5 pointer-events-none">
            <Truck className="w-full h-full object-cover transform translate-x-1/4 -translate-y-1/4 scale-150" />
          </div>
          
          <div className="mx-auto max-w-7xl relative z-10">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t("logistics_hub_kicker")}
            </p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
              {t("logistics_hub_title")}
              <span className="block font-serif font-normal italic text-primary mt-2">{t("logistics_hub_emphasis")}</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70">
              {t("logistics_hub_desc")}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/b2b-agi/talep"
                className="inline-flex items-center gap-2 bg-primary px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
              >
                <MessageSquareText size={16} />
                {t("share_logistics_need")}
              </Link>
              <Link
                href="/b2b-agi"
                className="inline-flex items-center gap-2 border border-border/70 bg-card px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-foreground/80 transition-colors hover:border-primary hover:text-primary"
              >
                <Search size={16} />
                {t("tab_explore")}
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10 md:px-12 md:py-16 w-full flex-1 flex flex-col">
          <div className="flex items-center gap-8 border-b border-border/70 mb-10 overflow-x-auto">
            <button
              onClick={() => setActiveTab("listings")}
              className={`whitespace-nowrap pb-3 text-sm font-semibold tracking-[0.15em] uppercase transition-colors border-b-2 ${
                activeTab === "listings"
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/50 hover:text-foreground"
              }`}
            >
              {t("logistics_tab_listings")}
            </button>
            <button
              onClick={() => setActiveTab("media")}
              className={`whitespace-nowrap pb-3 text-sm font-semibold tracking-[0.15em] uppercase transition-colors border-b-2 ${
                activeTab === "media"
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/50 hover:text-foreground"
              }`}
            >
              {t("logistics_tab_media")}
            </button>
          </div>

          <div className="animate-slide-up-fade flex-1">
            {activeTab === "listings" ? <ListingsView /> : <MediaView />}
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
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" size={18} />
          <input
            type="text"
            placeholder={t("search_listing")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-12 bg-card border border-border/70 pl-12 pr-4 outline-none focus:border-primary transition-colors text-sm"
          />
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
              <LogisticsListingCard key={listing.id} listing={listing} locale={locale} />
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

function LogisticsListingCard({ listing, locale }: { listing: B2BListing, locale: string }) {
  const { t } = useI18n();

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
          <Truck size={12} />
          {t("role_logistics")}
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

function MediaView() {
  const { t, locale } = useI18n();
  const { data: media, isLoading, isError } = useGetPublicLogisticsMedia();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-20 text-center border border-border/70 bg-card">
        <p className="text-foreground/60">Medya içerikleri yüklenemedi.</p>
      </div>
    );
  }

  if (!media || media.length === 0) {
    return (
      <div className="py-24 text-center border border-border/70 bg-card">
        <Info className="mx-auto h-10 w-10 text-primary/50 mb-4" />
        <h3 className="text-lg font-semibold">{t("no_logistics_media_title")}</h3>
        <p className="mt-2 text-sm text-foreground/60 max-w-sm mx-auto">
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

function MediaCard({ media, locale }: { media: LogisticsMedia, locale: string }) {
  const { t } = useI18n();
  const isDocument = media.contentType?.includes('pdf') || media.contentType?.includes('document');
  const isImage = media.contentType?.includes('image');

  const content = (
    <div className="flex flex-col h-full border border-border/70 bg-card p-6 transition-all hover:border-primary group cursor-pointer">
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          {media.category}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-foreground/40">
          <Calendar size={12} />
          {formatDate(media.publishedAt, locale)}
        </span>
      </div>

      <h3 className="text-lg font-semibold leading-snug font-serif group-hover:text-primary transition-colors">
        {media.title}
      </h3>
      
      {media.summary && (
        <p className="mt-3 text-sm leading-relaxed text-foreground/60 line-clamp-3 flex-1">
          {media.summary}
        </p>
      )}

      <div className="mt-6 pt-5 border-t border-border/70 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-primary/80 group-hover:text-primary transition-colors">
        <span className="flex items-center gap-2">
          {isDocument ? <FileText size={14} /> : isImage ? <FileText size={14} /> : <ExternalLink size={14} />}
          {t("view_details")}
        </span>
        <ArrowRight size={14} className="-rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
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
