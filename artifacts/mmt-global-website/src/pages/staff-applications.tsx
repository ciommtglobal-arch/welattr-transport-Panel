import { FormEvent, useEffect, useState } from "react";
import { SignInButton, UserButton, useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BriefcaseBusiness,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import {
  useGetLimitApplications,
  useUpdateLimitApplicationStatus,
  type LimitApplication,
  type LimitApplicationStatus,
} from "@workspace/api-client-react";

const statusLabels: Record<LimitApplicationStatus, string> = {
  new: "Yeni",
  reviewing: "İnceleniyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

const typeLabels: Record<LimitApplication["applicationType"], string> = {
  individual: "Bireysel",
  commercial: "Ticari",
  housing: "Konut",
  vehicle: "Taşıt",
};

const documentLabels: Record<
  LimitApplication["documents"][number]["documentType"],
  string
> = {
  personal_information: "Şahıs bilgileri",
  tax_certificate: "Vergi levhası",
  signature_circular: "İmza sirküsü",
  kkb_report: "KKB raporu",
  findeks_report: "Findeks raporu",
  ssk_service_statement: "SSK hizmet dökümü",
};

const statusOptions = [
  "new",
  "reviewing",
  "approved",
  "rejected",
] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAmount(application: LimitApplication) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: application.currency,
    maximumFractionDigits: 2,
  }).format(Number(application.amount));
}

export default function StaffApplications() {
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
          <h1 className="mt-4 text-4xl font-semibold">Başvuru merkezi</h1>
          <p className="mt-5 leading-relaxed text-foreground/60">
            Finans başvurularını görmek ve değerlendirmek için personel
            hesabınızla giriş yapın.
          </p>
          <SignInButton mode="modal">
            <button className="mt-8 bg-primary px-8 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-white">
              Personel girişi
            </button>
          </SignInButton>
        </section>
      ) : (
        <ApplicationInbox />
      )}
    </main>
  );
}

function ApplicationInbox() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<
    LimitApplicationStatus | "all"
  >("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const params = {
    page: 1,
    pageSize: 50,
    ...(statusFilter === "all" ? {} : { status: statusFilter }),
  };
  const applications = useGetLimitApplications(params);
  const selectedApplication =
    applications.data?.items.find((item) => item.id === selectedId) ??
    applications.data?.items[0] ??
    null;
  const [reviewStatus, setReviewStatus] =
    useState<LimitApplicationStatus>("new");
  const [internalNote, setInternalNote] = useState("");
  const updateStatus = useUpdateLimitApplicationStatus({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["/api/limit-applications"],
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
        Başvurular yükleniyor
      </div>
    );
  }

  if (applications.isError) {
    return (
      <section className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold">Başvurular açılamadı</h1>
        <p className="mt-4 leading-relaxed text-foreground/60">
          Bu ekran yalnızca staff tablosunda aktif kaydı bulunan yetkili
          personel hesaplarına açıktır.
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
            Finans ekibi
          </p>
          <h1 className="mt-3 text-4xl font-semibold md:text-5xl">
            Gelen başvurular
          </h1>
          <p className="mt-4 text-foreground/55">
            Form gönderildiğinde başvuru bilgileri burada görünür.
          </p>
        </div>
        <label className="flex min-w-52 flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Duruma göre filtrele
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as LimitApplicationStatus | "all",
              )
            }
            className="h-12 border border-border bg-card px-4 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary"
          >
            <option value="all">Tüm başvurular</option>
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
          <h2 className="mt-5 text-2xl font-semibold">Henüz başvuru yok</h2>
          <p className="mt-3 text-foreground/55">
            Yeni başvurular gönderildiğinde bu listede görünecek.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
            {applications.data?.items.map((application) => (
              <button
                key={application.id}
                type="button"
                onClick={() => setSelectedId(application.id)}
                className={`w-full border p-5 text-left transition-colors ${
                  selectedApplication?.id === application.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] tracking-wider text-primary">
                      {application.referenceCode}
                    </p>
                    <h2 className="mt-2 font-semibold">
                      {application.fullName}
                    </h2>
                  </div>
                  <span className="border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
                    {statusLabels[application.status]}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-foreground/50">
                  <span>{typeLabels[application.applicationType]}</span>
                  <span>{formatDate(application.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>

          {selectedApplication ? (
            <article className="border border-border bg-card p-6 md:p-8">
              <div className="flex flex-col justify-between gap-5 border-b border-border pb-6 md:flex-row md:items-start">
                <div>
                  <p className="font-mono text-xs tracking-wider text-primary">
                    {selectedApplication.referenceCode}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {selectedApplication.fullName}
                  </h2>
                  <p className="mt-2 text-sm text-foreground/50">
                    {formatDate(selectedApplication.createdAt)}
                  </p>
                </div>
                <p className="text-2xl font-semibold text-primary">
                  {formatAmount(selectedApplication)}
                </p>
              </div>

              <dl className="grid gap-5 py-7 text-sm sm:grid-cols-2">
                <Info label="Kategori" value={typeLabels[selectedApplication.applicationType]} />
                <Info label="Talep" value={selectedApplication.requestType} />
                <Info label="Şirket / kurum" value={selectedApplication.company} />
                <Info label="Telefon" value={selectedApplication.phone} />
                <Info label="E-posta" value={selectedApplication.email} />
                {selectedApplication.vehicleDetails ? (
                  <Info label="Araç bilgileri" value={selectedApplication.vehicleDetails} />
                ) : null}
              </dl>

              {selectedApplication.note ? (
                <div className="border-l-2 border-primary pl-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
                    Başvuru notu
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/75">
                    {selectedApplication.note}
                  </p>
                </div>
              ) : null}

              <div className="mt-8">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <FileText size={17} className="text-primary" />
                  Yüklenen belgeler
                </h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selectedApplication.documents.map((document) => (
                    <div
                      key={document.id}
                      className="border border-border bg-background/40 px-4 py-3"
                    >
                      <p className="text-xs font-semibold">
                        {documentLabels[document.documentType]}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-foreground/45">
                        {document.fileName}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <form
                onSubmit={saveReview}
                className="mt-8 border-t border-border pt-7"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    Başvuru durumu
                    <select
                      value={reviewStatus}
                      onChange={(event) =>
                        setReviewStatus(
                          event.target.value as LimitApplicationStatus,
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
                      rows={3}
                      className="border border-border bg-background p-3 font-normal text-foreground outline-none focus:border-primary"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={updateStatus.isPending}
                  className="mt-5 flex w-full items-center justify-center gap-2 bg-primary px-5 py-3 text-sm font-semibold uppercase tracking-wider text-white disabled:opacity-60"
                >
                  {updateStatus.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  Değerlendirmeyi kaydet
                </button>
              </form>
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
        {label}
      </dt>
      <dd className="mt-1 break-words text-foreground/80">{value}</dd>
    </div>
  );
}