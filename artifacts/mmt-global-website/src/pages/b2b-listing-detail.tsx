import { useEffect, useState, FormEvent } from "react";
import { useRoute, Link } from "wouter";
import { SignInButton, useAuth } from "@clerk/react";
import {
  ArrowLeft,
  Building2,
  Factory,
  Truck,
  MapPin,
  Globe,
  Calendar,
  Loader2,
  ExternalLink,
  ChevronRight,
  Info
  , ShieldAlert
} from "lucide-react";
import {
  useCreateB2BReport,
  useGetB2BListing,
  getGetB2BListingQueryKey,
  type B2BReportCategory,
  type B2BListingRole,
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

export default function B2BListingDetail() {
  const [match, params] = useRoute("/b2b-agi/ilan/:id");
  const id = match && params?.id ? Number(params.id) : 0;

  const { data: listing, isLoading, isError } = useGetB2BListing(id, {
    query: {
      enabled: id > 0,
      queryKey: getGetB2BListingQueryKey(id),
    },
  });

  useEffect(() => {
    if (listing) {
      document.title = `${listing.title} | MMT Global B2B`;
      const descriptionTag = document.querySelector('meta[name="description"]');
      descriptionTag?.setAttribute(
        "content",
        `${listing.organization} — ${listing.title}. MMT Global onaylı B2B ilanı.`,
      );
    }
  }, [listing]);

  if (isLoading) {
    return (
      <main className="min-h-[100dvh] bg-background text-foreground">
        <header className="border-b border-border/70 bg-background/95">
          <div className="mx-auto flex max-w-7xl items-center px-6 py-5 md:px-12">
            <Link
              href="/b2b-agi"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:text-primary"
            >
              <ArrowLeft size={15} />
              Ağa Dön
            </Link>
          </div>
        </header>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </main>
    );
  }

  if (isError || !listing) {
    return (
      <main className="min-h-[100dvh] bg-background text-foreground">
        <header className="border-b border-border/70 bg-background/95">
          <div className="mx-auto flex max-w-7xl items-center px-6 py-5 md:px-12">
            <Link
              href="/b2b-agi"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:text-primary"
            >
              <ArrowLeft size={15} />
              Ağa Dön
            </Link>
          </div>
        </header>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <Info className="mb-4 h-12 w-12 text-primary/50" />
          <h1 className="text-3xl font-semibold">İlan Bulunamadı</h1>
          <p className="mt-4 text-foreground/60">
            Aradığınız ilan yayından kaldırılmış veya henüz onaylanmamış olabilir.
          </p>
          <Link
            href="/b2b-agi"
            className="mt-8 inline-flex items-center gap-2 bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
          >
            Ağa Dön
          </Link>
        </div>
      </main>
    );
  }

  const roleInfo = roleLabels[listing.role];
  const RoleIcon = roleInfo.icon;

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
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
            href="/b2b-agi"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:text-primary"
          >
            <ArrowLeft size={15} />
            Ağa Dön
          </Link>
        </div>
      </header>

      <article className="animate-slide-up-fade">
        <section className="border-b border-border/70 bg-secondary px-6 py-14 text-secondary-foreground md:px-12 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                <RoleIcon size={12} />
                {roleInfo.label}
              </span>
              <span className="text-xs font-mono tracking-wider text-secondary-foreground/40">
                REF: {listing.referenceCode}
              </span>
            </div>

            <h1 className="mt-8 max-w-4xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl font-serif">
              {listing.title}
            </h1>
            
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-secondary-foreground/75">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-primary" />
                <span className="font-semibold">{listing.organization}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-primary" />
                <span>{listing.location}</span>
              </div>
              {listing.publishedAt && (
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-primary" />
                  <span>{formatDate(listing.publishedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-14 md:px-12 md:py-20">
          <div className="grid gap-16 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-10">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  İlan Detayı
                </h2>
                <div className="mt-6 prose prose-invert prose-p:text-foreground/80 prose-p:leading-relaxed max-w-none">
                  {listing.description.split("\n").map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="border border-border/70 bg-card p-6 md:p-8 sticky top-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  İletişim Bilgileri
                </h3>
                <p className="mt-2 text-xs text-foreground/50">
                  Bu ilanla ilgileniyorsanız, doğrudan yetkili kişiyle iletişime geçebilirsiniz.
                </p>

                <dl className="mt-8 space-y-6">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Yetkili
                    </dt>
                    <dd className="mt-1 font-medium">{listing.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      İletişim
                    </dt>
                    <dd className="mt-1 text-sm font-mono break-all">{listing.contact}</dd>
                  </div>
                  
                  {listing.website && (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
                        Web Sitesi
                      </dt>
                      <dd>
                        <a
                          href={listing.website.startsWith('http') ? listing.website : `https://${listing.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-primary transition-colors"
                        >
                          <Globe size={14} />
                          {listing.website.replace(/^https?:\/\//, '')}
                        </a>
                      </dd>
                    </div>
                  )}

                  {listing.socialLinks && Object.values(listing.socialLinks).some(v => v) && (
                    <div className="pt-6 border-t border-border/70">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-4">
                        Sosyal Ağlar
                      </dt>
                      <dd className="flex flex-col gap-3">
                        {Object.entries(listing.socialLinks).map(([platform, link]) => {
                          if (!link) return null;
                          return (
                            <a
                              key={platform}
                              href={link.startsWith('http') ? link : `https://${link}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-primary transition-colors capitalize"
                            >
                              <ExternalLink size={14} />
                              {platform}
                            </a>
                          );
                        })}
                      </dd>
                    </div>
                  )}
                </dl>
                  <ReportBox listingId={listing.id} />
              </div>
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}

const reportCategories: Array<[B2BReportCategory, string]> = [
  ["misleading_information", "Yanıltıcı işletme bilgisi"],
  ["fraud_or_scam", "Dolandırıcılık / sahte teklif"],
  ["inappropriate_content", "Uygunsuz içerik"],
  ["spam", "Spam / tekrarlı ilan"],
  ["contact_issue", "İletişim bilgisi çalışmıyor"],
  ["other", "Diğer"],
];

function ReportBox({ listingId }: { listingId: number }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] =
    useState<B2BReportCategory>("misleading_information");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const report = useCreateB2BReport({
    mutation: {
      onSuccess: () => {
        setSubmitted(true);
        setIsOpen(false);
        setDetails("");
      },
    },
  });

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <div className="mt-8 border-t border-border/70 pt-6">
        <p className="flex items-center gap-2 text-xs text-foreground/55">
          <ShieldAlert size={14} className="text-primary" />
          Bu ilanla ilgili sorun mu var?
        </p>
        <SignInButton mode="modal">
          <button className="mt-3 text-xs font-semibold uppercase tracking-wider text-primary hover:underline">
            Giriş yaparak MMT’ye bildir
          </button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-border/70 pt-6">
      <p className="flex items-center gap-2 text-xs text-foreground/55">
        <ShieldAlert size={14} className="text-primary" />
        İlanı MMT Global incelemesine gönderin.
      </p>
      {submitted ? (
        <p className="mt-3 text-xs leading-relaxed text-primary">
          Bildiriminiz MMT Global ekibine iletildi. Teşekkür ederiz.
        </p>
      ) : !isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-3 text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
        >
          Şikâyet / bildirim gönder
        </button>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            report.mutate({
              id: listingId,
              data: { category, details: details.trim() },
            });
          }}
          className="mt-4 space-y-3"
        >
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as B2BReportCategory)
            }
            className="h-10 w-full border border-border bg-background px-3 text-xs outline-none focus:border-primary"
          >
            {reportCategories.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Sorunu ve mümkünse kanıtı kısaca açıklayın."
            className="w-full resize-y border border-border bg-background p-3 text-xs outline-none focus:border-primary"
          />
          {report.isError ? (
            <p className="text-xs text-red-600">
              Bildirim gönderilemedi. Lütfen tekrar deneyin.
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={report.isPending}
              className="bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60"
            >
              {report.isPending ? "Gönderiliyor..." : "MMT’ye gönder"}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider"
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
