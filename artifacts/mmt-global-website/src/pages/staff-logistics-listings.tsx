import { useState, type FormEvent } from "react";
import { useAuth, UserButton } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetB2BListingsQueryKey,
  getGetLogisticsListingAccessQueryKey,
  getGetLogisticsListingDraftsQueryKey,
  getGetLogisticsListingGrantsQueryKey,
  useAssignLogisticsListingGrant,
  useCreateLogisticsListingDraft,
  useGetLogisticsListingAccess,
  useGetLogisticsListingDrafts,
  useGetLogisticsListingGrants,
  usePublishLogisticsListingDraft,
  useRevokeLogisticsListingGrant,
  useSaveLogisticsListingDraft,
  type LogisticsListingDraft,
} from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Link, Redirect } from "wouter";
import { isStaffAccessDenied, StaffAccessUnavailable } from "./staff-workspace";
import "@/styles/mmt-corporate.css";

type Fields = { title: string; fullName: string; organization: string; location: string; contact: string; description: string };
const empty: Fields = { title: "", fullName: "", organization: "", location: "", contact: "", description: "" };
const labels: Record<keyof Fields, string> = {
  title: "Başlık", fullName: "Ad soyad", organization: "Kuruluş", location: "Konum", contact: "İletişim", description: "Açıklama",
};
const limits: Record<keyof Fields, number> = { title: 140, fullName: 160, organization: 200, location: 160, contact: 180, description: 2000 };
const inputCls = "w-full border border-[var(--line)] bg-[var(--paper)] p-3 text-sm";

type Mode = { kind: "none" } | { kind: "new" } | { kind: "edit" | "view"; draft: LogisticsListingDraft };

function statusOf(e: unknown) {
  return typeof e === "object" && e !== null && "status" in e ? (e as { status?: number }).status : undefined;
}
function toFields(d: Fields): Fields {
  return { title: d.title, fullName: d.fullName, organization: d.organization, location: d.location, contact: d.contact, description: d.description };
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mmt-management-page"><section className="mmt-panel">{children}</section></main>;
}

export default function StaffLogisticsListings() {
  const { isLoaded, isSignedIn, userId: authUser, signOut } = useAuth();
  const enabled = isLoaded && Boolean(isSignedIn);
  const scope = authUser ?? "anon";
  const access = useGetLogisticsListingAccess({
    query: { queryKey: [...getGetLogisticsListingAccessQueryKey(), scope], enabled, refetchOnMount: "always", refetchInterval: 30000, retry: false },
  });
  if (!isLoaded || (enabled && access.isPending)) return <main className="mmt-management-page"><p className="mmt-note" role="status">Yetki kontrol ediliyor…</p></main>;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  if (access.isError && isStaffAccessDenied(access.error) && !access.data) return <Denied onLogout={() => void signOut()} />;
  if (!access.data) return <StaffAccessUnavailable retry={() => void access.refetch()} />;
  const a = access.data;
  if (!a.canDraft && !a.canManageGrants && !a.canPublish) return <Denied onLogout={() => void signOut()} />;
  // Keep the same user's unsaved editor mounted after a background access
  // failure/revocation, but disable all actions until access is revalidated.
  return <Workspace key={scope} scope={scope} userId={a.userId}
    canDraft={!access.isError && a.canDraft} canManageGrants={!access.isError && a.canManageGrants}
    canPublish={!access.isError && a.canPublish} accessFailed={access.isError}
    retryAccess={() => void access.refetch()} />;
}

function Denied({ onLogout }: { onLogout: () => void }) {
  return (
    <Shell>
      <h1 className="mmt-management-title">Bu çalışma alanına erişim yetkiniz yok.</h1>
      <p className="mmt-management-sub">Lojistik İlanları yetkisi tanımlı değil veya geri alındı. Hesabınız ve diğer rolleriniz etkilenmez.</p>
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/staff/yonlendir" className="mmt-action-link">Çalışma alanına dön</Link>
        <button type="button" className="mmt-action-link" onClick={onLogout} data-testid="button-logout">Çıkış yap</button>
        <UserButton />
      </div>
    </Shell>
  );
}

function Workspace({ scope, userId, canDraft, canManageGrants, canPublish, accessFailed, retryAccess }: {
  scope: string; userId: string; canDraft: boolean; canManageGrants: boolean; canPublish: boolean;
  accessFailed: boolean; retryAccess: () => void;
}) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>({ kind: "none" });
  const [notice, setNotice] = useState("");
  const drafts = useGetLogisticsListingDrafts({ page }, {
    query: { queryKey: [...getGetLogisticsListingDraftsQueryKey({ page }), scope], enabled: canDraft || canManageGrants, refetchOnMount: "always", refetchInterval: 30000, retry: false },
  });
  const revoked = accessFailed || statusOf(drafts.error) === 403;
  const inv = () => {
    void qc.invalidateQueries({ queryKey: getGetLogisticsListingDraftsQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetB2BListingsQueryKey() });
  };

  return (
    <main className="mmt-management-page">
      <div className="mmt-management-shell">
        <header className="mmt-management-topbar">
          <Link href="/" className="mmt-brand">MMT <span>GLOBAL</span></Link>
          <nav className="mmt-management-nav" aria-label="Lojistik İlanları">
            <Link href="/staff/yonlendir">Çalışma alanı</Link>
            <Link href="/staff/lojistik-ilanlari" aria-current="page">Lojistik İlanları</Link>
          </nav>
          <UserButton />
        </header>
        <div className="mmt-management-header">
          <div>
            <p className="mmt-kicker">Taslak çalışma alanı</p>
            <h1 className="mmt-management-title">Lojistik İlanları</h1>
            <p className="mmt-management-sub">Taslak oluşturma ve kaydetme. Yayımlama yalnız kurucuda. Bu yetki finans erişimi veya bütçe onayı vermez.</p>
          </div>
          <span className="mmt-user">{canPublish ? "Kurucu" : canManageGrants ? "Yönetici" : "Taslak yazarı"}</span>
        </div>
        {notice ? <p className="mmt-note" role="status" data-testid="text-notice">{notice}</p> : null}
        {revoked ? (
          <section className="mmt-panel" role="alert">
            <p>Yetki kontrolü tamamlanamadı veya erişiminiz geri alındı. İşlemler durduruldu; kaydedilmemiş yazınız açık formda korunuyor. Sayfayı yenilemeden önce kopyalayabilirsiniz.</p>
            <button type="button" className="mmt-action-link" onClick={retryAccess}>Yetkiyi yeniden denetle</button>
          </section>
        ) : null}
        {canManageGrants ? <Grants scope={scope} /> : null}
        {mode.kind !== "none" ? (
          <Editor key={mode.kind + ("draft" in mode ? mode.draft.id : "")} mode={mode} userId={userId} canDraft={canDraft} canPublish={canPublish}
            drafts={drafts.data?.items ?? []}
            onRefresh={() => void drafts.refetch()}
            onClose={() => setMode({ kind: "none" })} onOpen={setMode}
            onDone={(msg) => { setNotice(msg); inv(); }} onRevoked={() => { void qc.invalidateQueries({ queryKey: getGetLogisticsListingAccessQueryKey() }); }} />
        ) : null}
        <section className="mmt-panel" aria-labelledby="drafts-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="drafts-title">Taslaklar</h2>
            {canDraft ? <button type="button" className="mmt-button" data-testid="button-new-draft" onClick={() => { setNotice(""); setMode({ kind: "new" }); }}>Yeni taslak</button> : null}
          </div>
          {drafts.isPending && !revoked ? <div className="mt-4 grid gap-3" role="status" aria-label="Yükleniyor">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse border border-[var(--line)] bg-[var(--paper)]" />)}</div> : null}
          {drafts.isError && !revoked ? (
            <div className="mmt-empty-state" role="alert"><p>Taslaklar yüklenemedi.</p>
              <button type="button" className="mmt-action-link" onClick={() => void drafts.refetch()}><RefreshCw size={15} /> Yeniden dene</button></div>
          ) : null}
          {drafts.isSuccess && drafts.data.items.length === 0 ? <p className="mmt-empty-state" data-testid="text-empty">{page > 1 ? "Bu sayfada taslak yok." : "Henüz taslak bulunmuyor."}</p> : null}
          {!revoked && drafts.data?.items.length ? (
            <div className="mt-5 grid gap-3">
              {drafts.data.items.map((d) => {
                const published = d.publishedListingId !== null;
                const own = d.authorClerkUserId === userId;
                return (
                  <article key={d.id} className="min-w-0 border border-[var(--line)] bg-[var(--paper)] p-4" data-testid={`card-draft-${d.id}`}>
                    <div className="flex flex-col justify-between gap-2 sm:flex-row">
                      <div className="min-w-0">
                        <p className="mmt-kicker">{published ? "Yayımlandı" : "Taslak"} · Revizyon {d.revision}{own ? " · Sizin" : ""}</p>
                        <h3 className="mt-1 break-words font-semibold">{d.title}</h3>
                        <p className="text-xs text-[var(--muted)]">Güncellendi: {new Date(d.updatedAt).toLocaleString("tr-TR")}</p>
                      </div>
                      <div className="flex shrink-0 items-start gap-3">
                        <button type="button" className="mmt-action-link" data-testid={`button-view-${d.id}`} onClick={() => { setNotice(""); setMode({ kind: "view", draft: d }); }}>Ayrıntılar</button>
                        {canDraft && own && !published ? <button type="button" className="mmt-action-link" data-testid={`button-edit-${d.id}`} onClick={() => { setNotice(""); setMode({ kind: "edit", draft: d }); }}>Düzenle</button> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
          {drafts.data ? (
            <div className="mt-5 flex items-center justify-between gap-3 text-sm">
              <button type="button" disabled={page <= 1 || drafts.isFetching} onClick={() => setPage((p) => p - 1)} className="mmt-action-link disabled:opacity-40" data-testid="button-prev"><ChevronLeft size={16} /> Önceki</button>
              <span className="text-xs text-[var(--muted)]">{drafts.data.page}. sayfa</span>
              <button type="button" disabled={!drafts.data.hasMore || drafts.isFetching} onClick={() => setPage((p) => p + 1)} className="mmt-action-link disabled:opacity-40" data-testid="button-next">Sonraki <ChevronRight size={16} /></button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Grants({ scope }: { scope: string }) {
  const qc = useQueryClient();
  const grants = useGetLogisticsListingGrants({
    query: { queryKey: [...getGetLogisticsListingGrantsQueryKey(), scope], refetchOnMount: "always", refetchInterval: 30000, retry: false },
  });
  const assign = useAssignLogisticsListingGrant();
  const revoke = useRevokeLogisticsListingGrant();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: getGetLogisticsListingAccessQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetLogisticsListingGrantsQueryKey() });
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await assign.mutateAsync({ data: { email: email.trim() } });
      setEmail("");
      setMsg("Yetki kaydedildi.");
      refresh();
    } catch (err) {
      setMsg(statusOf(err) === 404 ? "Bu e-posta ile doğrulanmış bir hesap bulunamadı." : "Yetki kaydedilemedi. Girdiğiniz e-posta korundu; tekrar deneyin.");
    }
  }
  async function off(id: number) {
    if (!window.confirm("Bu kişinin yalnızca Lojistik İlanları yetkisi kapatılacak. Hesap, roller ve taslaklar korunur. Devam edilsin mi?")) return;
    setMsg("");
    try { await revoke.mutateAsync({ id }); setMsg("Yetki geri alındı."); refresh(); } catch { setMsg("Yetki geri alınamadı. Tekrar deneyin."); }
  }
  return (
    <section className="mmt-panel" aria-labelledby="grants-title">
      <h2 id="grants-title">Taslak yetkileri</h2>
      <p className="mmt-management-sub">Yalnızca doğrulanmış tam e-posta adresiyle atama yapılır. Yetki, taslak oluşturma ve kaydetme ile sınırlıdır.</p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="grant-email">Doğrulanmış e-posta</label>
        <input id="grant-email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="Doğrulanmış e-posta adresi" data-testid="input-grant-email" />
        <button type="submit" className="mmt-button shrink-0" disabled={assign.isPending || !email.trim()} data-testid="button-assign-grant">{assign.isPending ? "Kaydediliyor…" : "Yetki ver"}</button>
      </form>
      {msg ? <p className="mt-3 text-sm" role="status" data-testid="text-grant-message">{msg}</p> : null}
      {grants.isPending ? <p className="mmt-empty-state" role="status">Yetkiler yükleniyor…</p> : null}
      {grants.isError ? <div className="mmt-empty-state" role="alert"><p>Yetkiler yüklenemedi.</p><button type="button" className="mmt-action-link" onClick={() => void grants.refetch()}><RefreshCw size={15} /> Yeniden dene</button></div> : null}
      {grants.isSuccess && grants.data.length === 0 ? <p className="mmt-empty-state">Henüz atanmış yetki yok.</p> : null}
      {grants.data?.length ? (
        <div className="mt-4 grid gap-2">
          {grants.data.map((g) => (
            <div key={g.id} className="flex flex-col justify-between gap-2 border border-[var(--line)] bg-[var(--paper)] p-3 sm:flex-row sm:items-center" data-testid={`row-grant-${g.id}`}>
              <div className="min-w-0"><p className="break-words font-semibold">{g.displayName || g.verifiedEmail}</p><p className="break-all text-xs text-[var(--muted)]">{g.verifiedEmail} · {g.active ? "Etkin" : "Geri alındı"} · {new Date(g.updatedAt).toLocaleString("tr-TR")}</p></div>
              {g.active ? <button type="button" className="mmt-action-link" disabled={revoke.isPending} onClick={() => void off(g.id)} data-testid={`button-revoke-${g.id}`}>Yetkiyi geri al</button> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Editor({ mode, userId, canDraft, canPublish, drafts, onClose, onOpen, onDone, onRevoked, onRefresh }: {
  mode: Exclude<Mode, { kind: "none" }>; userId: string; canDraft: boolean; canPublish: boolean; drafts: LogisticsListingDraft[];
  onClose: () => void; onOpen: (m: Mode) => void; onDone: (msg: string) => void; onRevoked: () => void; onRefresh: () => void;
}) {
  const base = mode.kind === "new" ? null : mode.draft;
  const [values, setValues] = useState<Fields>(base ? toFields(base) : empty);
  const [revision, setRevision] = useState(base?.revision ?? 0);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const create = useCreateLogisticsListingDraft();
  const save = useSaveLogisticsListingDraft();
  const publish = usePublishLogisticsListingDraft();
  const fresh = base ? drafts.find((draft) => draft.id === base.id) : undefined;
  const published = base?.publishedListingId != null || fresh?.publishedListingId != null;
  const readOnly = mode.kind === "view" || published;
  const busy = create.isPending || save.isPending || publish.isPending;

  function fail(err: unknown, what: string) {
    const s = statusOf(err);
    if (s === 403) { setError("Yetkiniz geri alınmış olabilir. Yazdıklarınız bu formda korunuyor."); onRevoked(); }
    else if (s === 409) { setConflict(true); onRefresh(); setError("Taslak başka bir işlemle değişti. Yazdıklarınız korunuyor; güncel revizyonu alıp tekrar kaydedebilirsiniz."); }
    else if (s === 400 || s === 422) setError(`${what} Eksik veya geçersiz alanları kontrol edin.`);
    else setError(`${what} Bağlantıyı kontrol edip tekrar deneyin.`);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!values.title.trim()) { setError("Başlık zorunludur."); return; }
    try {
      if (!base) {
        const d = await create.mutateAsync({ data: values });
        onDone("Taslak oluşturuldu."); onOpen({ kind: "edit", draft: d });
      } else {
        const d = await save.mutateAsync({ id: base.id, data: { ...values, revision } });
        setRevision(d.revision); setConflict(false);
        onDone("Taslak kaydedildi.");
        onOpen({ kind: "edit", draft: d });
      }
    } catch (err) { fail(err, "Taslak kaydedilemedi."); }
  }
  async function doPublish() {
    if (!base) return;
    setError("");
    try {
      await publish.mutateAsync({ id: base.id, data: { revision: base.revision } });
      onDone("Taslak yayımlandı."); onClose();
    } catch (err) { setConfirming(false); fail(err, "Yayımlanamadı."); }
  }
  function takeLatest() {
    const latest = base ? drafts.find((d) => d.id === base.id) : undefined;
    if (!latest) { setError("Güncel sürüm henüz alınamadı. Birkaç saniye sonra tekrar deneyin."); return; }
    if (latest.publishedListingId !== null) { setError("Bu taslak yayımlandı ve düzenlenemez. Yazdıklarınız bu formda duruyor; kopyalayabilirsiniz."); return; }
    if (mode.kind === "view") {
      onOpen({ kind: "view", draft: latest });
      setValues(toFields(latest)); setRevision(latest.revision); setConflict(false); setError("");
      return;
    }
    if (!window.confirm("Yazdıklarınız korunacak. Kaydederseniz başka kişinin güncel taslağının üzerine yazılacak. Devam edilsin mi?")) return;
    setRevision(latest.revision); setConflict(false); setError("Güncel revizyon alındı. Kaydederseniz sunucudaki içeriğin üzerine yazılır.");
  }
  const canEdit = !readOnly && canDraft && (!base || base.authorClerkUserId === userId);
  return (
    <section className="mmt-panel" aria-labelledby="editor-title">
      <h2 id="editor-title">{!base ? "Yeni taslak" : mode.kind === "view" ? "Taslak ayrıntıları" : "Taslağı düzenle"}</h2>
      {published ? <p className="mmt-note">Bu taslak yayımlandı; düzenlenemez.</p> : null}
      <form onSubmit={submit} className="mt-3 grid gap-4">
        {(Object.keys(labels) as (keyof Fields)[]).map((k) => (
          <label key={k} className="grid gap-1 text-sm">
            <span className="font-semibold">{labels[k]}{k === "title" ? " *" : ""}</span>
            {k === "description"
              ? <textarea rows={6} maxLength={limits[k]} readOnly={!canEdit} value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} className={inputCls} data-testid={`input-${k}`} />
              : <input maxLength={limits[k]} readOnly={!canEdit} value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} className={inputCls} data-testid={`input-${k}`} />}
          </label>
        ))}
        {error ? <p role="alert" className="text-sm font-semibold" data-testid="text-editor-error">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          {canEdit ? <button type="submit" className="mmt-button" disabled={busy} data-testid="button-save-draft">{busy && !publish.isPending ? "Kaydediliyor…" : "Kaydet"}</button> : null}
          {conflict ? <button type="button" className="mmt-button secondary" onClick={takeLatest} data-testid="button-take-latest">Güncel revizyonu al</button> : null}
          {mode.kind === "view" && base && canEdit === false && canDraft && base.authorClerkUserId === userId && !published ? (
            <button type="button" className="mmt-button secondary" onClick={() => onOpen({ kind: "edit", draft: base })} data-testid="button-start-edit">Düzenle</button>
          ) : null}
          {mode.kind === "view" && base && canPublish && !published ? (
            <button type="button" className="mmt-button" onClick={() => setConfirming(true)} data-testid="button-publish">Yayımla…</button>
          ) : null}
          <button type="button" className="mmt-button secondary" disabled={busy} onClick={onClose} data-testid="button-cancel">{canEdit ? "Vazgeç" : "Kapat"}</button>
        </div>
      </form>
      {confirming && base ? (
        <div role="dialog" aria-modal="true" aria-labelledby="publish-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90dvh] w-full max-w-xl overflow-auto border border-[var(--line)] bg-[var(--paper)] p-5">
            <h3 id="publish-title" className="text-lg font-semibold">Herkese açık yayımlamayı onaylayın</h3>
            <p className="mt-2 text-sm">Aşağıdaki kayıtlı içerik (revizyon {base.revision}) herkese açık lojistik ilanı olarak yayımlanır. Eksik alanlar sunucu tarafından reddedilebilir.</p>
            <dl className="mt-3 grid gap-2 text-sm" data-testid="publish-preview">
              {(Object.keys(labels) as (keyof Fields)[]).map((k) => (
                <div key={k}><dt className="text-xs text-[var(--muted)]">{labels[k]}</dt><dd className="whitespace-pre-wrap break-words">{base[k] || "—"}</dd></div>
              ))}
            </dl>
            <div className="mt-4 flex gap-3">
              <button type="button" className="mmt-button" disabled={publish.isPending} onClick={() => void doPublish()} data-testid="button-confirm-publish">{publish.isPending ? "Yayımlanıyor…" : "Onayla ve yayımla"}</button>
              <button type="button" className="mmt-button secondary" disabled={publish.isPending} onClick={() => setConfirming(false)} data-testid="button-cancel-publish">Vazgeç</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
