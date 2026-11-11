import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SignInButton, UserButton, useAuth } from "@clerk/react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Copy, FlaskConical, KeyRound, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import {
  getGetLogisticsPilotWorkspaceQueryKey,
  getGetLogisticsTestPilotReadinessQueryKey,
  useGetLogisticsPilotWorkspace,
  useMutateLogisticsPilotWorkspace,
  type LogisticsPilotAction,
  type LogisticsPilotTaskRecord,
  type LogisticsPilotWorkspace,
} from "@workspace/api-client-react";

const REFERENCE = "UKR-MERSİN-NARENCİYE-001";
const MAX_POLLS = 40;

const roleLabel: Record<string, string> = { owner: "Dosya sahibi", worker: "Görevli", reviewer: "Denetçi", none: "Rol yok" };
const taskStatusLabel: Record<string, string> = {
  assigned: "Atandı", submitted: "Teslim edildi", revision_requested: "Revizyon istendi", accepted: "Kabul edildi",
};
const reviewLabel: Record<string, string> = {
  draft: "Hazırlık", in_progress: "Çalışılıyor", review_requested: "Final TEST incelemesi bekliyor",
  approved_test: "TEST olarak onaylandı (yalnız alıştırma)", changes_requested: "Değişiklik istendi",
};

function statusOf(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error ? (error as { status?: number }).status : undefined;
}
function messageOf(error: unknown) {
  const s = statusOf(error);
  const data = typeof error === "object" && error !== null && "data" in error ? (error as { data?: unknown }).data : undefined;
  const server = typeof data === "object" && data !== null && "error" in data ? String((data as { error: unknown }).error) : "";
  const base = s === 403 ? "Yetki reddedildi (403)." : s === 404 ? "Kayıt veya TEST alanı bulunamadı (404)." : s === 409 ? "Durum çakışması (409)." : s === 400 || s === 422 ? "Geçersiz istek." : s === 401 ? "Oturum doğrulanamadı (401)." : "İşlem tamamlanamadı; bağlantı veya sunucu hatası.";
  return server ? `${base} Sunucu: ${server}` : base;
}
function fmt(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
function toIso(local: string) {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function stripToken(ws: LogisticsPilotWorkspace): LogisticsPilotWorkspace {
  const { inviteToken: _omit, ...rest } = ws;
  void _omit;
  return rest;
}

const inputCls = "w-full border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/35 focus:border-primary focus:outline-none";
const btnPrimary = "inline-flex items-center justify-center gap-2 bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-50";
const btnGhost = "inline-flex items-center justify-center gap-2 border border-primary/60 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-primary disabled:opacity-50";

function TestBanner() {
  return (
    <div className="sticky top-0 z-30 border-b-2 border-dashed border-primary bg-primary/15 px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-primary" data-testid="banner-test" role="note">
      TEST ALIŞTIRMASI · {REFERENCE} · Gerçek sevkiyat yok · Ticari onay yok · Yayın yok
    </div>
  );
}

function Panel({ title, kicker, children, testId }: { title: string; kicker?: string; children: ReactNode; testId?: string }) {
  return (
    <section className="border border-border bg-card p-4 md:p-5" data-testid={testId}>
      {kicker && <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{kicker}</p>}
      <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ErrorLine({ error }: { error: unknown }) {
  if (!error) return null;
  return <p role="alert" className="mt-2 flex items-start gap-2 text-xs text-destructive" data-testid="text-action-error"><CircleAlert size={14} className="mt-0.5 shrink-0" />{messageOf(error)}</p>;
}

type Run = (action: LogisticsPilotAction) => Promise<boolean>;

function AcceptInvite({ run, pending }: { run: Run; pending: boolean }) {
  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = token.trim();
    if (t.length < 32 || t.length > 128) { setErr("Davet anahtarı 32-128 karakter olmalı."); return; }
    setErr(null);
    const ok = await run({ action: "accept_invite", token: t });
    setToken("");
    if (!ok) setErr(null);
  }
  return (
    <Panel title="Davet anahtarını kabul et" kicker="TEST daveti" testId="panel-accept-invite">
      <form onSubmit={submit} className="space-y-2" autoComplete="off">
        <p className="text-xs leading-5 text-foreground/60">Size elden iletilen anahtarı yapıştırın. Anahtar adres çubuğuna veya tarayıcıya kaydedilmez.</p>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} className={inputCls} placeholder="Davet anahtarı" autoComplete="off" spellCheck={false} data-testid="input-invite-token" />
        {err && <p className="text-xs text-destructive">{err}</p>}
        <button type="submit" disabled={pending || !token.trim()} className={btnPrimary} data-testid="button-accept-invite"><KeyRound size={14} />Kabul et</button>
      </form>
    </Panel>
  );
}

function InviteForm({ run, pending }: { run: Run; pending: boolean }) {
  const [target, setTarget] = useState("");
  const [role, setRole] = useState<"worker" | "reviewer">("worker");
  const [days, setDays] = useState("7");
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(days);
    if (!/^user_[A-Za-z0-9]+$/.test(target.trim())) { setErr("Geçerli bir Clerk kullanıcı kimliği girin (user_...)."); return; }
    if (!Number.isInteger(n) || n < 1 || n > 30) { setErr("Süre 1-30 gün olmalı."); return; }
    setErr(null);
    const ok = await run({ action: "invite", targetUserId: target.trim(), role, expiresAt: new Date(Date.now() + n * 86400000).toISOString() });
    if (ok) setTarget("");
  }
  return (
    <form onSubmit={submit} className="space-y-2 border-t border-border pt-4">
      <p className="text-xs leading-5 text-foreground/60">Alıcı, mevcut bir Clerk geliştirme TEST hesabı olmalıdır (sunucuda logisticsPilotTest işaretli veya +clerk_test@example.com). Diğer hesaplar sunucu tarafından reddedilir.</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls} placeholder="Clerk kullanıcı kimliği" data-testid="input-invite-target" />
        <select value={role} onChange={(e) => setRole(e.target.value as "worker" | "reviewer")} className={inputCls} data-testid="select-invite-role">
          <option value="worker">Görevli</option><option value="reviewer">Denetçi</option>
        </select>
        <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} className={`${inputCls} sm:w-24`} aria-label="Geçerlilik (gün)" data-testid="input-invite-days" />
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <button type="submit" disabled={pending} className={btnPrimary} data-testid="button-create-invite">Davet oluştur</button>
    </form>
  );
}

function TaskForm({ ws, run, pending }: { ws: LogisticsPilotWorkspace; run: Run; pending: boolean }) {
  const workers = ws.invitations.filter((i) => i.role === "worker" && i.acceptedAt && !i.revokedAt).map((i) => i.targetUserId);
  const options = Array.from(new Set([ws.actorUserId, ...workers]));
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(ws.actorUserId);
  const [due, setDue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const iso = toIso(due);
    if (!title.trim() || title.length > 200) { setErr("Başlık 1-200 karakter olmalı."); return; }
    if (!iso) { setErr("Son tarih seçin."); return; }
    setErr(null);
    const ok = await run({ action: "create_task", title: title.trim(), assignedTo: assignee, dueAt: iso });
    if (ok) { setTitle(""); setDue(""); }
  }
  return (
    <form onSubmit={submit} className="space-y-2 border-t border-border pt-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} sm:col-span-2`} placeholder="Görev başlığı" data-testid="input-task-title" />
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls} data-testid="select-task-assignee">
          {options.map((id) => <option key={id} value={id}>{id === ws.actorUserId ? `Kendim (${id})` : id}</option>)}
        </select>
        <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} data-testid="input-task-due" />
      </div>
      {workers.length === 0 && <p className="text-xs text-foreground/50">Daveti kabul etmiş görevli yok; görev yalnız size atanabilir.</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}
      <button type="submit" disabled={pending} className={btnPrimary} data-testid="button-create-task">Görev oluştur</button>
    </form>
  );
}

function TaskCard({ task, ws, run, pending }: { task: LogisticsPilotTaskRecord; ws: LogisticsPilotWorkspace; run: Run; pending: boolean }) {
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const isAssignee = task.assignedTo === ws.actorUserId;
  const canSubmit = isAssignee && (task.status === "assigned" || task.status === "revision_requested");
  const canReview = (ws.role === "owner" || ws.role === "reviewer") && task.status === "submitted";
  const overdue = task.status !== "accepted" && new Date(task.dueAt).getTime() < Date.now();
  const subs = [...task.submissions].sort((a, b) => b.revision - a.revision);

  async function submit() {
    if (!content.trim() || content.length > 20000) { setErr("İçerik 1-20000 karakter olmalı."); return; }
    setErr(null);
    if (await run({ action: "submit_task", taskId: task.id, content })) setContent("");
  }
  async function revise() {
    if (!note.trim() || note.length > 2000) { setErr("Revizyon gerekçesi zorunlu (en çok 2000)."); return; }
    setErr(null);
    if (await run({ action: "request_revision", taskId: task.id, note: note.trim() })) setNote("");
  }
  return (
    <article className="border border-border bg-background/40 p-4" data-testid={`card-task-${task.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words font-semibold">{task.title}</h3>
          <p className="mt-1 break-all font-mono text-[10px] text-foreground/50">Atanan: {task.assignedTo}{isAssignee && " (siz)"} · Son: {fmt(task.dueAt)}</p>
        </div>
        <div className="flex gap-1">
          {overdue && <span className="border border-destructive/60 px-2 py-0.5 text-[10px] font-bold text-destructive">Gecikti</span>}
          <span className="border border-primary/40 px-2 py-0.5 text-[10px] font-bold text-primary" data-testid={`status-task-${task.id}`}>{taskStatusLabel[task.status] ?? task.status}</span>
        </div>
      </div>
      {task.revisionNote && <p className="mt-3 border-l-2 border-primary pl-3 text-xs leading-5 text-foreground/75"><strong>Revizyon gerekçesi:</strong> {task.revisionNote}</p>}
      {subs.length > 0 && (
        <ol className="mt-3 space-y-2">
          {subs.map((s) => (
            <li key={s.id} className="border border-border bg-card p-3">
              <p className="font-mono text-[10px] text-foreground/50">Revizyon {s.revision} · {s.createdBy} · {fmt(s.createdAt)} · değiştirilemez</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{s.content}</p>
            </li>
          ))}
        </ol>
      )}
      {canSubmit && (
        <div className="mt-3 space-y-2">
          <textarea value={content} maxLength={20000} onChange={(e) => setContent(e.target.value)} rows={4} className={inputCls} placeholder="TEST çıktısı" data-testid={`input-submit-${task.id}`} />
          <p className="text-right font-mono text-[10px] text-foreground/40">{content.length}/20000</p>
          <button type="button" disabled={pending} onClick={() => void submit()} className={btnPrimary} data-testid={`button-submit-${task.id}`}>Teslim et</button>
        </div>
      )}
      {canReview && (
        <div className="mt-3 space-y-2">
          <textarea value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} rows={2} className={inputCls} placeholder="Revizyon gerekçesi" data-testid={`input-revision-${task.id}`} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => void revise()} className={btnGhost} data-testid={`button-revision-${task.id}`}>Revizyona gönder</button>
            <button type="button" disabled={pending || isAssignee} title={isAssignee ? "Kendi görevinizi kabul edemezsiniz" : undefined} onClick={() => void run({ action: "accept_task", taskId: task.id })} className={btnPrimary} data-testid={`button-accept-task-${task.id}`}>Kabul et</button>
          </div>
          {isAssignee && <p className="text-xs text-foreground/50">Kendi görevinizi kabul edemezsiniz; başka bir yetkili kabul etmelidir.</p>}
        </div>
      )}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </article>
  );
}

function FinalReview({ ws, run, pending }: { ws: LogisticsPilotWorkspace; run: Run; pending: boolean }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const allAccepted = ws.tasks.length > 0 && ws.tasks.every((t) => t.status === "accepted");
  const state = ws.file?.reviewState ?? "";
  async function decide(decision: "approved_test" | "changes_requested") {
    if (!note.trim()) { setErr("Karar notu zorunlu."); return; }
    setErr(null);
    if (await run({ action: "decide_review", decision, note: note.trim() })) setNote("");
  }
  return (
    <Panel title="Final TEST incelemesi" kicker="Alıştırma sonucu" testId="panel-final-review">
      <p className="text-sm">Durum: <strong data-testid="text-review-state">{reviewLabel[state] ?? state}</strong></p>
      {ws.file?.decisionNote && <p className="mt-2 border-l-2 border-primary pl-3 text-xs text-foreground/70">Karar notu: {ws.file.decisionNote}</p>}
      <p className="mt-2 text-xs leading-5 text-foreground/55">"TEST olarak onaylandı" yalnız alıştırma sonucudur; ticari onay, sevkiyat veya yayın değildir. Ticari onay: <strong>{ws.commercialApproval ? "Var" : "Yok"}</strong>.</p>
      {ws.role === "owner" && state !== "review_requested" && (
        <div className="mt-3">
          <button type="button" disabled={pending || !allAccepted} onClick={() => void run({ action: "request_review" })} className={btnPrimary} data-testid="button-request-review">İnceleme iste</button>
          {!allAccepted && <p className="mt-1 text-xs text-foreground/50">En az bir görev olmalı ve tüm görevler kabul edilmiş olmalı.</p>}
        </div>
      )}
      {ws.isFounder && state === "review_requested" && (
        <div className="mt-3 space-y-2">
          <textarea value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} rows={2} className={inputCls} placeholder="Karar notu (zorunlu)" data-testid="input-decision-note" />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => void decide("changes_requested")} className={btnGhost} data-testid="button-decide-changes">Değişiklik iste</button>
            <button type="button" disabled={pending} onClick={() => void decide("approved_test")} className={btnPrimary} data-testid="button-decide-approve">TEST olarak onayla</button>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      )}
      {!ws.isFounder && state === "review_requested" && <p className="mt-3 text-xs text-foreground/50">Final kararı yalnız sunucunun kurucu olarak tanıdığı hesap verebilir.</p>}
    </Panel>
  );
}

function Workspace({ ws, run, pending, token, clearToken }: { ws: LogisticsPilotWorkspace; run: Run; pending: boolean; token: string | null; clearToken: () => void }) {
  const [copied, setCopied] = useState(false);
  const isOwner = ws.role === "owner";
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2" data-testid="summary-workspace">
        {[["Eksik", ws.summary.missing], ["Geciken", ws.summary.overdue], ["Karar bekleyen", ws.summary.awaitingDecision]].map(([l, v]) => (
          <div key={l as string} className="border border-border bg-card p-3"><dd className="text-2xl font-semibold">{v}</dd><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/50">{l}</dt></div>
        ))}
      </dl>
      {token && (
        <section className="border-2 border-primary bg-primary/10 p-4" data-testid="panel-invite-token">
          <p className="text-sm font-semibold">Davet anahtarı yalnız bir kez gösterilir</p>
          <p className="mt-1 text-xs text-foreground/60">Alıcıya güvenli kanaldan iletin. Bir sonraki işlemde, çıkışta veya sayfadan ayrılınca silinir.</p>
          <p className="mt-2 text-xs text-foreground/65" data-testid="text-invite-token">Davet anahtarı ekranda gösterilmez. Yalnız Kopyala ile güvenli kanaldan alıcıya iletin.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={btnGhost} onClick={() => { void navigator.clipboard?.writeText(token).then(() => setCopied(true), () => setCopied(false)); }} data-testid="button-copy-token"><Copy size={13} />{copied ? "Kopyalandı" : "Kopyala"}</button>
            <button type="button" className={btnGhost} onClick={clearToken} data-testid="button-dismiss-token">Gizle</button>
          </div>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Panel title={`Görevler (${ws.tasks.length})`} kicker="TEST iş akışı" testId="panel-tasks">
            {ws.tasks.length === 0 ? <p className="text-sm text-foreground/55">Henüz görev yok.{isOwner ? " Aşağıdan ilk TEST görevini oluşturun." : " Dosya sahibinin görev atamasını bekleyin."}</p> : (
              <div className="space-y-3">{ws.tasks.map((t) => <TaskCard key={t.id} task={t} ws={ws} run={run} pending={pending} />)}</div>
            )}
            {isOwner && <div className="mt-4"><TaskForm ws={ws} run={run} pending={pending} /></div>}
          </Panel>
          <FinalReview ws={ws} run={run} pending={pending} />
        </div>
        <div className="space-y-4">
          <Panel title={`Davetler (${ws.invitations.length})`} kicker="Erişim" testId="panel-invitations">
            {ws.invitations.length === 0 ? <p className="text-sm text-foreground/55">Davet yok.</p> : (
              <ul className="divide-y divide-border">
                {ws.invitations.map((i) => {
                  const st = i.revokedAt ? "İptal" : i.acceptedAt ? "Kabul edildi" : new Date(i.expiresAt) < new Date() ? "Süresi doldu" : "Bekliyor";
                  return (
                    <li key={i.id} className="py-2 text-xs" data-testid={`row-invite-${i.id}`}>
                      <p className="break-all font-mono">{i.targetUserId}</p>
                      <p className="mt-1 text-foreground/55">{roleLabel[i.role] ?? i.role} · {st} · bitiş {fmt(i.expiresAt)}</p>
                      {isOwner && !i.revokedAt && <button type="button" disabled={pending} onClick={() => void run({ action: "revoke_invite", inviteId: i.id })} className="mt-1 text-[11px] font-bold text-destructive disabled:opacity-50" data-testid={`button-revoke-${i.id}`}>İptal et</button>}
                    </li>
                  );
                })}
              </ul>
            )}
            {isOwner && <div className="mt-3"><InviteForm run={run} pending={pending} /></div>}
          </Panel>
          <Panel title={`Geçmiş (${ws.history.length})`} kicker="Clerk aktör kaydı" testId="panel-history">
            {ws.history.length === 0 ? <p className="text-sm text-foreground/55">Kayıt yok.</p> : (
              <ol className="max-h-96 space-y-2 overflow-y-auto">
                {ws.history.map((h) => (
                  <li key={h.id} className="border-l-2 border-primary/50 pl-3 text-xs">
                    <p className="font-semibold">{h.action}</p>
                    <p className="text-foreground/65 break-words">{h.detail}</p>
                    <p className="break-all font-mono text-[10px] text-foreground/45">{h.actorUserId} · {fmt(h.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Body({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const key = [...getGetLogisticsPilotWorkspaceQueryKey(), userId] as const;
  const polls = useRef(0);
  const ws = useGetLogisticsPilotWorkspace({
    query: {
      queryKey: key, retry: false, staleTime: 5000,
      refetchInterval: (q) => (q.state.status === "error" || polls.current++ >= MAX_POLLS ? false : 20000),
      refetchIntervalInBackground: false,
    },
  });
  const mutation = useMutateLogisticsPilotWorkspace({ mutation: { gcTime: 0 } });
  const [token, setToken] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const resetRef = useRef(mutation.reset);
  resetRef.current = mutation.reset;

  useEffect(() => () => { setToken(null); }, []);

  const run: Run = async (action) => {
    setToken(null); setActionError(null); setNotice(null);
    try {
      const res = await mutation.mutateAsync({ data: { reference: REFERENCE, ...action } });
      const t = res.inviteToken ?? null;
      resetRef.current();
      qc.setQueryData(key, stripToken(res));
      polls.current = 0;
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetLogisticsPilotWorkspaceQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetLogisticsTestPilotReadinessQueryKey() }),
      ]);
      if (t) setToken(t);
      setNotice("İşlem sunucu tarafından kaydedildi.");
      return true;
    } catch (e) {
      resetRef.current();
      setActionError(e);
      return false;
    }
  };

  const pending = mutation.isPending;
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-foreground/55" aria-live="polite">{ws.isFetching ? "Yenileniyor…" : ws.dataUpdatedAt ? `Son güncelleme ${fmt(new Date(ws.dataUpdatedAt).toISOString())}` : ""}</p>
      <button type="button" onClick={() => { polls.current = 0; void ws.refetch(); }} disabled={ws.isFetching} className={btnGhost} data-testid="button-refresh-workspace"><RefreshCw size={13} className={ws.isFetching ? "animate-spin" : undefined} />Yenile</button>
    </div>
  );

  let main: ReactNode;
  if (ws.isPending) {
    main = <div className="space-y-3" role="status" aria-label="Yükleniyor"><div className="h-16 animate-pulse bg-card" /><div className="h-48 animate-pulse bg-card" /></div>;
  } else if (ws.isError) {
    const s = statusOf(ws.error);
    main = (
      <section className="border border-destructive/50 bg-card p-5" data-testid="status-workspace-error">
        <p className="flex items-center gap-2 font-semibold"><ShieldAlert size={16} className="text-destructive" />{s === 403 ? "Bu TEST dosyasına erişiminiz yok" : s === 404 ? "TEST alanı kapalı veya bulunamadı" : "TEST alanı yüklenemedi"}</p>
        <p className="mt-2 text-sm text-foreground/60">{s === 403 ? "Bu boş bir dosya değildir; erişim reddedildi. Davet aldıysanız anahtarı aşağıya girin." : messageOf(ws.error)}</p>
      </section>
    );
  } else if (ws.data && !ws.data.file) {
    main = (
      <section className="border border-primary/40 bg-card p-5" data-testid="panel-no-file">
        <p className="font-semibold">TEST dosyası henüz oluşturulmadı</p>
        <p className="mt-2 text-sm text-foreground/60">Hesabınız bu dosyayı başlatabilir. Otomatik oluşturulmaz; oluşturduğunuzda dosya sahibi siz olursunuz.</p>
        <button type="button" disabled={pending} onClick={() => void run({ action: "create_file" })} className={`${btnPrimary} mt-4`} data-testid="button-create-file">{pending && <Loader2 size={13} className="animate-spin" />}TEST dosyası oluştur</button>
      </section>
    );
  } else if (ws.data) {
    main = <Workspace ws={ws.data} run={run} pending={pending} token={token} clearToken={() => setToken(null)} />;
  }

  return (
    <div className="space-y-4">
      {ws.data && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 border border-border bg-card px-4 py-3 text-xs" data-testid="panel-identity">
          <span>Rol: <strong data-testid="text-role">{roleLabel[ws.data.role] ?? ws.data.role}</strong></span>
          <span>Kurucu: <strong>{ws.data.isFounder ? "Evet" : "Hayır"}</strong></span>
          <span>TEST: <strong>{ws.data.isTest ? "Evet" : "Hayır"}</strong></span>
          <span>Ticari onay: <strong>{ws.data.commercialApproval ? "Var" : "Yok"}</strong></span>
          <span className="break-all font-mono text-foreground/55">{ws.data.actorUserId}</span>
        </div>
      )}
      {header}
      {notice && <p className="text-xs text-primary" role="status" data-testid="text-action-notice">{notice}</p>}
      <ErrorLine error={actionError} />
      {main}
      {(!ws.data || ws.data.role === "none" || ws.isError) && <AcceptInvite run={run} pending={pending} />}
      {ws.data && ws.data.role !== "none" && !ws.isError && (
        <details className="border border-border bg-card p-4 text-sm"><summary className="cursor-pointer font-semibold">Başka bir davet anahtarını kabul et</summary><div className="mt-3"><AcceptInvite run={run} pending={pending} /></div></details>
      )}
    </div>
  );
}

export default function StaffTestLogistics() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  useEffect(() => { document.title = `TEST Lojistik ${REFERENCE} | MMT Global`; }, []);
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <TestBanner />
      <header className="border-b border-border/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-8">
          <Link href="/staff/operasyon-masasi" className="flex items-center gap-3" data-testid="link-ops-desk">
            <span className="flex h-9 w-9 items-center justify-center rounded-br-2xl rounded-tl-2xl bg-primary text-lg font-bold text-primary-foreground">M</span>
            <span className="text-sm font-bold tracking-[0.18em]">MMT <span className="font-normal text-foreground/55">GLOBAL</span></span>
          </Link>
          {isSignedIn && <UserButton />}
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-primary"><FlaskConical size={14} />Geliştirme / TEST çalışma alanı</p>
        <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight md:text-5xl" data-testid="text-reference">{REFERENCE}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/60">Ukrayna - Mersin narenciye TEST dosyası. Buradaki hiçbir işlem gerçek sevkiyat, ticari onay veya yayın üretmez.</p>
        <div className="mt-6">
          {!isLoaded ? <div className="h-32 animate-pulse bg-card" role="status" aria-label="Oturum yükleniyor" /> : !isSignedIn || !userId ? (
            <section className="border border-border bg-card p-6 text-center">
              <p className="text-sm text-foreground/65">TEST alanına girmek için oturum açın.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <SignInButton mode="modal"><button type="button" className={btnPrimary} data-testid="button-sign-in">Giriş yap</button></SignInButton>
                <Link href="/staff/giris" className={btnGhost} data-testid="link-staff-sign-in">Personel giriş sayfası</Link>
              </div>
            </section>
          ) : <Body key={userId} userId={userId} />}
        </div>
      </div>
    </main>
  );
}
