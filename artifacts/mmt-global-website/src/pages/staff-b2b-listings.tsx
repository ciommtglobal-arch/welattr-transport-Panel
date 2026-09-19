import { FormEvent, useEffect, useState } from "react";
import { SignInButton, UserButton, useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Loader2,
  RefreshCw,
  ExternalLink,
  Building2,
  MapPin,
  Calendar,
  Globe
} from "lucide-react";
import {
  useGetB2BListingReviewQueue,
  useUpdateB2BListingStatus,
  getGetB2BListingReviewQueueQueryKey,
  getGetB2BListingsQueryKey,
  type B2BListingStatus,
  type B2BListingRole,
  type B2BListing
} from "@workspace/api-client-react";

const statusLabels: Record<B2BListingStatus, string> = {
  pending: "Beklemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

const roleLabels: Record<B2BListingRole, string> = {
  producer: "Üretici",
  buyer: "Alıcı",
  logistics: "Lojistik / Hizmet",
  employer: "İşveren / İş ilanı",
};

const statusOptions = ["pending", "approved", "rejected"] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function StaffB2BListings() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-br-xl rounded-tl-xl bg-primary text-lg font-bold text-primary-foreground">
              M
            </span>
            <span className="text-lg font-semibold tracking-wider">
              MMT <span className="font-light opacity-80">GLOBAL</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/60 hover:text-primary"
            >
              <ArrowLeft size={15} />
              Ana sayfa
            </Link>
            <Link
              href="/staff/b2b-dogrulamalar"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-primary hover:text-primary/80"
            >
              İşletme doğrulamaları
            </Link>
            {isSignedIn ? <UserButton /> : null}
          </div>
        </div>
      </header>

      {!isLoaded ? (
        <div className="flex min-h-[70vh] items-center justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : !isSignedIn ? (
        <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <BriefcaseBusiness className="mb-6 h-12 w-12 text-primary" />
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Yetkili personel
          </p>
          <h1 className="mt-4 text-4xl font-semibold">B2B Moderasyon</h1>
          <p className="mt-5 leading-relaxed text-foreground/60">
            Ağ ilanlarını incelemek ve onaylamak için personel hesabınızla giriş yapın.
          </p>
          <SignInButton mode="modal">
            <button className="mt-8 bg-primary px-8 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-white">
              Personel girişi
            </button>
          </SignInButton>
        </section>
      ) : (
        <ReviewInbox />
      )}
    </main>
  );
}

function ReviewInbox() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<B2BListingStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const params = {
    page,
    pageSize: 50,
    ...(statusFilter === "all" ? {} : { status: statusFilter }),
  };
  
  const applications = useGetB2BListingReviewQueue(params);
  
  const selectedApplication =
    applications.data?.items.find((item) => item.id === selectedId) ??
    applications.data?.items[0] ??
    null;

  const [reviewStatus, setReviewStatus] = useState<B2BListingStatus>("pending");
  const [internalNote, setInternalNote] = useState("");

  const updateStatus = useUpdateB2BListingStatus({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getGetB2BListingReviewQueueQueryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: getGetB2BListingsQueryKey(),
        });
      },
    },
  });

  useEffect(() => {
    if (!selectedApplication) return;
    setReviewStatus(selectedApplication.status);
    setInternalNote(selectedApplication.internalNote ?? "");
  }, [selectedApplication?.id, selectedApplication?.status]);

  const saveReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedApplication) return;
    updateStatus.mutate({
      id: selectedApplication.id,
      data: {
        status: reviewStatus,
        internalNote: internalNote.trim() || undefined,
      },
    });
  };

  if (applications.isLoading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center gap-3 text-foreground/60">
        <Loader2 className="animate-spin text-primary" />
        İlanlar yükleniyor
      </div>
    );
  }

  if (applications.isError) {
    return (
      <section className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold">İlanlar açılamadı</h1>
        <p className="mt-4 leading-relaxed text-foreground/60">
          Bu ekran yalnızca yetkili personel hesaplarına açıktır.
        </p>
        <button
          type="button"
          onClick={() => applications.refetch()}
          className="mt-8 inline-flex items-center gap-2 border border-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary"
        >
          <RefreshCw size={16} />
          Tekrar dene
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Moderasyon Merkezi
          </p>
          <h1 className="mt-3 text-4xl font-semibold md:text-5xl">
            B2B Ağ İlanları
          </h1>
          <p className="mt-4 text-foreground/55">
            İnceleme bekleyen ve onaylanan ağ kayıtları.
          </p>
        </div>
        <label className="flex min-w-52 flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Duruma göre filtrele
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as B2BListingStatus | "all");
              setPage(1);
            }}
            className="h-12 border border-border bg-card px-4 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary"
          >
            <option value="all">Tüm İlanlar</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {applications.data?.items.length === 0 ? (
        <div className="border border-border bg-card px-6 py-20 text-center">
          <BriefcaseBusiness className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-5 text-2xl font-semibold">Kayıt Yok</h2>
          <p className="mt-3 text-foreground/55">
            Bu statüde herhangi bir ilan bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
            {applications.data?.items.map((listing) => (
              <button
                key={listing.id}
                type="button"
                onClick={() => setSelectedId(listing.id)}
                className={`w-full border p-5 text-left transition-colors ${
                  selectedApplication?.id === listing.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] tracking-wider text-primary">
                      {listing.referenceCode}
                    </p>
                    <h2 className="mt-2 font-semibold line-clamp-1">
                      {listing.title}
                    </h2>
                  </div>
                  <span className={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                    listing.status === 'approved' ? 'border-green-500/50 text-green-500' :
                    listing.status === 'rejected' ? 'border-red-500/50 text-red-500' :
                    'border-border text-foreground/70'
                  }`}>
                    {statusLabels[listing.status]}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-foreground/50">
                  <span>{listing.organization}</span>
                  <span>{formatDate(listing.createdAt)}</span>
                </div>
              </button>
            ))}
            
            {(applications.data?.page ?? 1) * (applications.data?.pageSize ?? 50) < (applications.data?.total ?? 0) && (
              <button
                onClick={() => setPage(p => p + 1)}
                className="w-full border border-border/70 py-3 text-xs font-semibold uppercase tracking-wider text-primary hover:bg-primary/5"
              >
                Daha Fazla Yükle
              </button>
            )}
          </div>

          {selectedApplication ? (
            <article className="border border-border bg-card p-6 md:p-8 flex flex-col h-full">
              <div className="flex flex-col gap-4 border-b border-border pb-6">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs tracking-wider text-primary">
                      {selectedApplication.referenceCode}
                    </p>
                    <span className="text-xs border border-border/50 px-2 py-1 uppercase tracking-wider font-semibold">
                      {roleLabels[selectedApplication.role]}
                    </span>
                  </div>
                  <h2 className="mt-4 text-3xl font-semibold leading-tight font-serif">
                    {selectedApplication.title}
                  </h2>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-6">
                 {selectedApplication.imageUrl ? (
                   <div className="mb-8 overflow-hidden border border-border/70 bg-background">
                     <img
                       src={selectedApplication.imageUrl}
                       alt={`${selectedApplication.title} ilan görseli`}
                       className="aspect-[16/7] w-full object-cover"
                     />
                   </div>
                 ) : null}

                <dl className="grid gap-x-5 gap-y-8 text-sm sm:grid-cols-2 mb-8">
                  <Info label="Firma / Oluşum" value={selectedApplication.organization} />
                  <Info label="Yetkili Kişi" value={selectedApplication.fullName} />
                  <Info label="Şehir / Ülke" value={selectedApplication.location} />
                  <Info label="İletişim" value={selectedApplication.contact} />
                   {selectedApplication.role === "employer" && selectedApplication.employmentType ? (
                     <Info label="Çalışma şekli" value={selectedApplication.employmentType} />
                   ) : null}
                   {selectedApplication.role === "employer" && selectedApplication.salary ? (
                     <Info label="Ücret / maaş" value={selectedApplication.salary} />
                   ) : null}
                   {selectedApplication.role === "employer" && selectedApplication.experience ? (
                     <Info label="Deneyim şartı" value={selectedApplication.experience} />
                   ) : null}
                  
                  {selectedApplication.website && (
                    <Info label="Web Sitesi" value={selectedApplication.website} link />
                  )}
                  
                  {selectedApplication.publishedAt && (
                    <Info label="Yayınlanma" value={formatDate(selectedApplication.publishedAt)} />
                  )}
                </dl>

                <div className="mb-8">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40 mb-3">
                    Açıklama / Talep
                  </dt>
                  <dd className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap bg-background/50 p-4 border border-border/50">
                    {selectedApplication.description}
                  </dd>
                </div>

                {selectedApplication.socialLinks && Object.values(selectedApplication.socialLinks).some(Boolean) && (
                  <div className="mb-8">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40 mb-3">
                      Sosyal Linkler
                    </dt>
                    <dd className="flex flex-wrap gap-4">
                      {Object.entries(selectedApplication.socialLinks).map(([k, v]) => {
                        if (!v) return null;
                        return (
                          <a key={k} href={v.startsWith('http') ? v : `https://${v}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline capitalize">
                            <ExternalLink size={12} />
                            {k}
                          </a>
                        )
                      })}
                    </dd>
                  </div>
                )}
              </div>

              <form
                onSubmit={saveReview}
                className="border-t border-border pt-6 mt-auto"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    Ağ Görünürlüğü (Statü)
                    <select
                      value={reviewStatus}
                      onChange={(event) =>
                        setReviewStatus(event.target.value as B2BListingStatus)
                      }
                      className="h-12 border border-border bg-background px-4 font-normal text-foreground outline-none focus:border-primary"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    Ekip İçi Not
                    <textarea
                      value={internalNote}
                      onChange={(event) => setInternalNote(event.target.value)}
                      rows={2}
                      placeholder="Sadece personelin görebileceği notlar..."
                      className="border border-border bg-background p-3 font-normal text-foreground outline-none focus:border-primary text-xs resize-none"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={updateStatus.isPending}
                  className="mt-5 flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white disabled:opacity-60 transition-colors hover:bg-primary/90"
                >
                  {updateStatus.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  Değerlendirmeyi Kaydet
                </button>
              </form>
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Info({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
        {label}
      </dt>
      <dd className="mt-1 break-words text-foreground/90 font-medium">
        {link ? (
          <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {value}
          </a>
        ) : value}
      </dd>
    </div>
  );
}
