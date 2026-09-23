import { FormEvent, useEffect, useState } from "react";
import { SignInButton, UserButton, useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import {
  getGetB2BReportReviewQueueQueryKey,
  useGetB2BReportReviewQueue,
  useUpdateB2BReportStatus,
  type B2BReportCategory,
  type B2BReportStatus,
} from "@workspace/api-client-react";

const statusLabels: Record<B2BReportStatus, string> = {
  pending: "Beklemede",
  reviewing: "İncelemede",
  resolved: "Çözüldü",
  dismissed: "Reddedildi",
};
const categoryLabels: Record<B2BReportCategory, string> = {
  misleading_information: "Yanıltıcı işletme bilgisi",
  fraud_or_scam: "Dolandırıcılık / sahte teklif",
  inappropriate_content: "Uygunsuz içerik",
  spam: "Spam / tekrarlı ilan",
  contact_issue: "İletişim bilgisi çalışmıyor",
  other: "Diğer",
};
const statusOptions = ["pending", "reviewing", "resolved", "dismissed"] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function StaffB2BReports() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingState />;
  if (!isSignedIn) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <StaffHeader />
        <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <AlertTriangle className="mb-6 h-12 w-12 text-primary" />
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Yetkili personel
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Şikâyet incelemeleri</h1>
          <p className="mt-5 text-foreground/60">
            Bildirimleri incelemek için personel hesabınızla giriş yapın.
          </p>
          <SignInButton mode="modal">
            <button className="mt-8 bg-primary px-8 py-4 text-sm font-semibold uppercase tracking-wider text-white">
              Personel girişi
            </button>
          </SignInButton>
        </section>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-background text-foreground">
      <StaffHeader />
      <ReportInbox />
    </main>
  );
}

function StaffHeader() {
  return (
    <header className="border-b border-border/70 bg-background/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-5 md:px-12">
        <Link href="/" className="text-lg font-semibold tracking-wider">
          <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-br-xl rounded-tl-xl bg-primary text-white">
            M
          </span>
          MMT <span className="font-light opacity-80">GLOBAL</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/staff/b2b-dogrulamalar" className="text-xs font-semibold uppercase tracking-wider text-foreground/60 hover:text-primary">
            Doğrulamalar
          </Link>
          <Link href="/staff/ilanlar" className="text-xs font-semibold uppercase tracking-wider text-foreground/60 hover:text-primary">
            İlanlar
          </Link>
          <UserButton />
        </nav>
      </div>
    </header>
  );
}

function ReportInbox() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<B2BReportStatus>("pending");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState<B2BReportStatus>("reviewing");
  const [note, setNote] = useState("");
  const reports = useGetB2BReportReviewQueue({ status: filter, page: 1, pageSize: 50 });
  const selected =
    reports.data?.items.find((item) => item.id === selectedId) ??
    reports.data?.items[0] ??
    null;
  const update = useUpdateB2BReportStatus({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getGetB2BReportReviewQueueQueryKey(),
        }),
    },
  });

  useEffect(() => {
    if (!selected) return;
    setReviewStatus(selected.status === "pending" ? "reviewing" : selected.status);
    setNote(selected.internalNote ?? "");
  }, [selected?.id, selected?.status]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    update.mutate({
      id: selected.id,
      data: { status: reviewStatus, internalNote: note.trim() || undefined },
    });
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            MMT Connect / Güven merkezi
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Şikâyet incelemeleri</h1>
          <p className="mt-4 text-foreground/55">
            Her bildirim MMT personeli tarafından karara bağlanır.
          </p>
        </div>
        <select
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value as B2BReportStatus);
            setSelectedId(null);
          }}
          className="h-12 border border-border bg-card px-4 text-sm text-foreground outline-none focus:border-primary"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>{statusLabels[status]}</option>
          ))}
        </select>
      </div>

      {reports.isLoading ? (
        <LoadingState />
      ) : reports.isError ? (
        <div className="py-20 text-center">
          <p className="text-foreground/60">Şikâyet kuyruğu açılamadı.</p>
          <button onClick={() => reports.refetch()} className="mt-5 inline-flex items-center gap-2 border border-primary px-5 py-3 text-xs font-semibold uppercase tracking-wider text-primary">
            <RefreshCw size={15} /> Tekrar dene
          </button>
        </div>
      ) : reports.data?.items.length === 0 ? (
        <div className="border border-border bg-card px-6 py-20 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-5 text-2xl font-semibold">Kayıt yok</h2>
          <p className="mt-3 text-foreground/55">Bu statüde bildirim bulunmuyor.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-3">
            {reports.data?.items.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedId(report.id)}
                className={`w-full border p-5 text-left ${
                  selected?.id === report.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <p className="font-mono text-[10px] text-primary">{report.referenceCode}</p>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <h2 className="line-clamp-1 font-semibold">{report.listingTitle}</h2>
                  <span className="whitespace-nowrap text-[10px] uppercase tracking-wider text-foreground/55">
                    {statusLabels[report.status]}
                  </span>
                </div>
                <p className="mt-3 text-xs text-foreground/55">{report.organization}</p>
              </button>
            ))}
          </div>
          {selected ? (
            <article className="flex flex-col border border-border bg-card p-6 md:p-8">
              <p className="font-mono text-xs text-primary">{selected.referenceCode}</p>
              <h2 className="mt-3 text-3xl font-semibold font-serif">{selected.listingTitle}</h2>
              <p className="mt-2 text-foreground/60">
                {selected.organization} · {selected.listingReferenceCode}
              </p>
              <dl className="mt-8 grid gap-5 sm:grid-cols-2 text-sm">
                <Info label="Bildirim türü" value={categoryLabels[selected.category]} />
                <Info label="Bildirim tarihi" value={formatDate(selected.createdAt)} />
                <Info
                  label="Kullanıcı puanı"
                  value={
                    selected.rating
                      ? `${selected.rating}/5${selected.ratingComment ? ` · ${selected.ratingComment}` : ""}`
                      : "Henüz puanlanmadı"
                  }
                />
              </dl>
              <div className="mt-8 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                  Kullanıcı açıklaması
                </p>
                <p className="mt-3 whitespace-pre-wrap border border-border/50 bg-background/50 p-4 text-sm leading-relaxed">
                  {selected.details}
                </p>
              </div>
              <form onSubmit={save} className="mt-8 border-t border-border pt-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    <span className="mb-2 block">MMT kararı</span>
                    <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as B2BReportStatus)} className="h-12 w-full border border-border bg-background px-3 text-sm font-normal">
                      {statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    <span className="mb-2 block">Ekip içi not</span>
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="w-full resize-none border border-border bg-background p-3 text-xs font-normal" />
                  </label>
                </div>
                <button type="submit" disabled={update.isPending} className="mt-5 flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60">
                  {update.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
                  MMT kararını kaydet
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
  return <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}

function LoadingState() {
  return <div className="flex min-h-[65vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
}