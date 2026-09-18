import { FormEvent, useEffect, useState } from "react";
import { UserButton, useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Calendar,
  ExternalLink,
  FileCheck2,
  Globe2,
  Loader2,
  MapPin,
  RefreshCw,
} from "lucide-react";
import {
  getGetB2BBusinessProfileReviewQueueQueryKey,
  requestObjectDownloadUrl,
  useGetB2BBusinessProfileReviewQueue,
  useUpdateB2BBusinessProfileStatus,
  type B2BBusinessProfileStatus,
  type B2BBusinessProfile,
} from "@workspace/api-client-react";

const statusLabels: Record<B2BBusinessProfileStatus, string> = {
  pending: "Beklemede",
  verified: "Doğrulandı",
  rejected: "Reddedildi",
  suspended: "Askıda",
};

const statusOptions = ["pending", "verified", "rejected", "suspended"] as const;

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function StaffB2BVerifications() {
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
              href="/staff/ilanlar"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/60 hover:text-primary"
            >
              Eski ilan kuyruğu
            </Link>
            {isSignedIn ? <UserButton /> : null}
          </div>
        </div>
      </header>

      {!isLoaded ? (
        <LoadingState />
      ) : !isSignedIn ? (
        <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <BriefcaseBusiness className="mb-6 h-12 w-12 text-primary" />
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Yetkili personel
          </p>
          <h1 className="mt-4 text-4xl font-semibold">İşletme doğrulamaları</h1>
          <p className="mt-5 leading-relaxed text-foreground/60">
            Firma belgelerini incelemek için personel hesabınızla giriş yapın.
          </p>
          <Link
            href="/staff/giris"
            className="mt-8 inline-flex bg-primary px-8 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-white"
          >
            Personel girişi
          </Link>
        </section>
      ) : (
        <VerificationInbox />
      )}
    </main>
  );
}

function VerificationInbox() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<B2BBusinessProfileStatus>(
    "pending",
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [reviewStatus, setReviewStatus] =
    useState<B2BBusinessProfileStatus>("verified");
  const [internalNote, setInternalNote] = useState("");
  const [downloadError, setDownloadError] = useState("");

  const params = { status: statusFilter, page, pageSize: 50 };
  const profiles = useGetB2BBusinessProfileReviewQueue(params);
  const selectedProfile =
    profiles.data?.items.find((item) => item.id === selectedId) ??
    profiles.data?.items[0] ??
    null;

  const updateStatus = useUpdateB2BBusinessProfileStatus({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getGetB2BBusinessProfileReviewQueueQueryKey(),
        });
      },
    },
  });

  useEffect(() => {
    if (!selectedProfile) return;
    setReviewStatus(selectedProfile.status === "pending" ? "verified" : selectedProfile.status);
    setInternalNote(selectedProfile.internalNote ?? "");
  }, [selectedProfile?.id, selectedProfile?.status]);

  async function openDocument() {
    if (!selectedProfile) return;
    setDownloadError("");
    try {
      const result = await requestObjectDownloadUrl({
        objectPath: selectedProfile.verificationDocumentObjectPath,
      });
      window.open(result.downloadURL, "_blank", "noopener,noreferrer");
    } catch {
      setDownloadError("Belge indirilemedi. Lütfen tekrar deneyin.");
    }
  }

  function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfile) return;
    updateStatus.mutate({
      id: selectedProfile.id,
      data: {
        status: reviewStatus,
        internalNote: internalNote.trim() || undefined,
      },
    });
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            MMT Connect / Güven merkezi
          </p>
          <h1 className="mt-3 text-4xl font-semibold md:text-5xl">
            İşletme doğrulamaları
          </h1>
          <p className="mt-4 text-foreground/55">
            İşletme bir kez doğrulanır; sonraki ilanlar otomatik yayınlanır.
          </p>
        </div>
        <label className="flex min-w-52 flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Duruma göre filtrele
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as B2BBusinessProfileStatus);
              setSelectedId(null);
              setPage(1);
            }}
            className="h-12 border border-border bg-card px-4 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {profiles.isLoading ? (
        <LoadingState />
      ) : profiles.isError ? (
        <section className="mx-auto max-w-xl px-6 py-24 text-center">
          <h2 className="text-3xl font-semibold">Kuyruk açılamadı</h2>
          <p className="mt-4 leading-relaxed text-foreground/60">
            Bu ekran yalnızca yetkili personel hesaplarına açıktır.
          </p>
          <button
            type="button"
            onClick={() => profiles.refetch()}
            className="mt-8 inline-flex items-center gap-2 border border-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary"
          >
            <RefreshCw size={16} />
            Tekrar dene
          </button>
        </section>
      ) : profiles.data?.items.length === 0 ? (
        <div className="border border-border bg-card px-6 py-20 text-center">
          <FileCheck2 className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-5 text-2xl font-semibold">Kayıt yok</h2>
          <p className="mt-3 text-foreground/55">
            Bu statüde doğrulama bekleyen işletme bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
            {profiles.data?.items.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setSelectedId(profile.id)}
                className={`w-full border p-5 text-left transition-colors ${
                  selectedProfile?.id === profile.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] tracking-wider text-primary">
                      PROFİL-{profile.id}
                    </p>
                    <h2 className="mt-2 font-semibold line-clamp-1">
                      {profile.publicName}
                    </h2>
                  </div>
                  <span className="border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
                    {statusLabels[profile.status]}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-foreground/50">
                  <span>{profile.country}</span>
                  <span>{formatDate(profile.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>

          {selectedProfile ? (
            <article className="flex h-full flex-col border border-border bg-card p-6 md:p-8">
              <div className="border-b border-border pb-6">
                <p className="font-mono text-xs tracking-wider text-primary">
                  PROFİL-{selectedProfile.id}
                </p>
                <h2 className="mt-3 text-3xl font-semibold font-serif">
                  {selectedProfile.publicName}
                </h2>
                <p className="mt-2 text-foreground/60">
                  {selectedProfile.legalName}
                </p>
              </div>

              <div className="flex-1 py-6">
                <dl className="grid gap-x-5 gap-y-7 text-sm sm:grid-cols-2">
                  <Info label="Ülke" value={selectedProfile.country} icon={<Globe2 size={14} />} />
                  <Info label="Faaliyet alanı" value={selectedProfile.field} icon={<BriefcaseBusiness size={14} />} />
                  <Info label="İşletme türü" value={selectedProfile.businessType} />
                  <Info label="Kayıt / vergi no" value={selectedProfile.registrationNumber} />
                  <Info label="İletişim" value={selectedProfile.contact} icon={<MapPin size={14} />} />
                  <Info label="Başvuru tarihi" value={formatDate(selectedProfile.createdAt)} icon={<Calendar size={14} />} />
                </dl>
                {selectedProfile.website ? (
                  <a
                    href={selectedProfile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-7 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink size={14} />
                    {selectedProfile.website}
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={openDocument}
                  className="mt-8 flex w-full items-center justify-between border border-primary/40 bg-primary/5 px-4 py-4 text-left text-sm hover:border-primary"
                >
                  <span>
                    <span className="block font-semibold">Resmi belgeyi aç</span>
                    <span className="mt-1 block text-xs text-foreground/55">
                      {selectedProfile.verificationDocumentFileName}
                    </span>
                  </span>
                  <ExternalLink className="h-5 w-5 text-primary" />
                </button>
                {downloadError ? (
                  <p className="mt-3 text-sm text-red-600">{downloadError}</p>
                ) : null}
              </div>

              <form onSubmit={saveReview} className="border-t border-border pt-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    Profil durumu
                    <select
                      value={reviewStatus}
                      onChange={(event) =>
                        setReviewStatus(
                          event.target.value as B2BBusinessProfileStatus,
                        )
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
                    Ekip içi not
                    <textarea
                      value={internalNote}
                      onChange={(event) => setInternalNote(event.target.value)}
                      rows={2}
                      placeholder="Sadece personelin görebileceği notlar..."
                      className="resize-none border border-border bg-background p-3 text-xs font-normal text-foreground outline-none focus:border-primary"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={updateStatus.isPending}
                  className="mt-5 flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {updateStatus.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  Doğrulama kararını kaydet
                </button>
              </form>
            </article>
          ) : null}
        </div>
      )}

      {(profiles.data?.page ?? 1) * (profiles.data?.pageSize ?? 50) <
      (profiles.data?.total ?? 0) ? (
        <button
          type="button"
          onClick={() => setPage((current) => current + 1)}
          className="mt-6 w-full border border-border/70 py-3 text-xs font-semibold uppercase tracking-wider text-primary hover:bg-primary/5"
        >
          Daha fazla yükle
        </button>
      ) : null}
    </section>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-foreground/90">{value}</dd>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[65vh] items-center justify-center gap-3 text-foreground/60">
      <Loader2 className="animate-spin text-primary" />
      Yükleniyor
    </div>
  );
}