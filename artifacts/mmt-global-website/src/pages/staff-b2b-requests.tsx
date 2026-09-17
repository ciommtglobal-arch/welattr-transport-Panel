import { FormEvent, useEffect, useState } from "react";
import { SignInButton, UserButton, useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import {
  getGetB2BRequestReviewQueueQueryKey,
  useGetB2BRequestReviewQueue,
  useUpdateB2BRequestStatus,
  type B2BRequestCategory,
  type B2BRequestStatus,
} from "@workspace/api-client-react";

const statuses = ["pending", "approved", "rejected", "closed"] as const;
const statusLabels: Record<B2BRequestStatus, string> = {
  pending: "Beklemede",
  approved: "Yayınlandı",
  rejected: "Reddedildi",
  closed: "Kapatıldı",
};
const categoryLabels: Record<B2BRequestCategory, string> = {
  product: "Ürün",
  service: "Hizmet",
  logistics: "Lojistik",
  partnership: "İş ortaklığı",
  employment: "İş arıyorum",
  other: "Diğer",
};

function date(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function StaffB2BRequests() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Loading />;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />
      {!isSignedIn ? (
        <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <AlertTriangle className="mb-6 h-12 w-12 text-primary" />
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Yetkili personel
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Alıcı talepleri</h1>
          <p className="mt-4 text-foreground/60">
            Talepleri yönetmek için personel hesabınızla giriş yapın.
          </p>
          <SignInButton mode="modal">
            <button className="mt-8 bg-primary px-8 py-4 text-sm font-semibold uppercase tracking-wider text-white">
              Personel girişi
            </button>
          </SignInButton>
        </section>
      ) : (
        <Inbox />
      )}
    </main>
  );
}

function Header() {
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
          <Link href="/staff/b2b-dogrulamalar" className="staff-link">Doğrulamalar</Link>
          <Link href="/staff/ilanlar" className="staff-link">İlanlar</Link>
          <Link href="/staff/b2b-sikayetler" className="staff-link">Şikâyetler</Link>
          <UserButton />
        </nav>
      </div>
    </header>
  );
}

function Inbox() {
  const client = useQueryClient();
  const [filter, setFilter] = useState<B2BRequestStatus>("pending");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [decision, setDecision] = useState<B2BRequestStatus>("approved");
  const [note, setNote] = useState("");
  const queue = useGetB2BRequestReviewQueue({
    status: filter,
    page: 1,
    pageSize: 50,
  });
  const selected =
    queue.data?.items.find((item) => item.id === selectedId) ??
    queue.data?.items[0] ??
    null;
  const update = useUpdateB2BRequestStatus({
    mutation: {
      onSuccess: () =>
        client.invalidateQueries({
          queryKey: getGetB2BRequestReviewQueueQueryKey(),
        }),
    },
  });

  useEffect(() => {
    if (!selected) return;
    setDecision(selected.status === "pending" ? "approved" : selected.status);
    setNote(selected.internalNote ?? "");
  }, [selected?.id, selected?.status]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    update.mutate({
      id: selected.id,
      data: { status: decision, internalNote: note.trim() || undefined },
    });
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            MMT Connect / Talep kontrolü
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Alıcı talebi kuyruğu</h1>
          <p className="mt-4 text-foreground/55">
            Talepleri kontrol edin, yayınlayın veya MMT ağı için kapatın.
          </p>
        </div>
        <select
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value as B2BRequestStatus);
            setSelectedId(null);
          }}
          className="h-12 border border-border bg-card px-4 text-sm outline-none focus:border-primary"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>{statusLabels[status]}</option>
          ))}
        </select>
      </div>

      {queue.isLoading ? (
        <Loading />
      ) : queue.isError ? (
        <div className="py-20 text-center text-foreground/60">
          <p>Talep kuyruğu açılamadı.</p>
          <button onClick={() => queue.refetch()} className="mt-5 inline-flex items-center gap-2 border border-primary px-5 py-3 text-xs font-semibold uppercase tracking-wider text-primary">
            <RefreshCw size={15} /> Tekrar dene
          </button>
        </div>
      ) : queue.data?.items.length === 0 ? (
        <div className="border border-border bg-card py-20 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-5 text-2xl font-semibold">Kayıt yok</h2>
          <p className="mt-3 text-foreground/55">Bu statüde talep bulunmuyor.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-3">
            {queue.data?.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full border p-5 text-left ${
                  selected?.id === item.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <p className="font-mono text-[10px] text-primary">{item.referenceCode}</p>
                <h2 className="mt-2 line-clamp-2 font-semibold">{item.title}</h2>
                <p className="mt-3 text-xs text-foreground/55">{item.location} · {statusLabels[item.status]}</p>
              </button>
            ))}
          </div>
          {selected ? (
            <article className="flex flex-col border border-border bg-card p-6 md:p-8">
              <p className="font-mono text-xs text-primary">{selected.referenceCode}</p>
              <h2 className="mt-3 text-3xl font-semibold font-serif">{selected.title}</h2>
              <p className="mt-2 text-foreground/60">
                {selected.organization || selected.requesterName} · {selected.location}
              </p>
              <div className="mt-7 grid gap-5 text-sm sm:grid-cols-2">
                <Info label="Tür" value={categoryLabels[selected.category]} />
                <Info label="Gönderilme" value={date(selected.createdAt)} />
                  {selected.category === "employment" && selected.employmentType ? (
                    <Info label="Çalışma şekli" value={selected.employmentType} />
                  ) : null}
                  {selected.category === "employment" && selected.salary ? (
                    <Info label="Ücret / maaş" value={selected.salary} />
                  ) : null}
                  {selected.category === "employment" && selected.experience ? (
                    <Info label="Deneyim şartı" value={selected.experience} />
                  ) : null}
              </div>
              <div className="mt-7 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">Talep açıklaması</p>
                <p className="mt-3 whitespace-pre-wrap border border-border/50 bg-background/50 p-4 text-sm leading-relaxed">{selected.description}</p>
                <p className="mt-4 text-sm text-primary">{selected.contact}</p>
              </div>
              <form onSubmit={save} className="mt-7 border-t border-border pt-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    <span className="mb-2 block">MMT kararı</span>
                    <select value={decision} onChange={(event) => setDecision(event.target.value as B2BRequestStatus)} className="h-12 w-full border border-border bg-background px-3 text-sm font-normal">
                      {statuses.filter((status) => status !== "pending").map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    <span className="mb-2 block">Ekip içi not</span>
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="w-full resize-none border border-border bg-background p-3 text-xs font-normal" />
                  </label>
                </div>
                <button type="submit" disabled={update.isPending} className="mt-5 flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60">
                  {update.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
                  Kararı kaydet
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

function Loading() {
  return <div className="flex min-h-[65vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
}