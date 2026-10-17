import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetLogisticsAutomationQueryKey,
  useActLogisticsAutomation,
  useGetLogisticsAutomation,
  type LogisticsAutomationAction,
  type LogisticsAutomationActionKind,
  type LogisticsAutomationResponse,
} from "@workspace/api-client-react";
import {
  AlertTriangle, Check, CircleSlash, Download, FileText, Loader2, Lock, RefreshCw, Send, ShieldCheck, Upload,
} from "lucide-react";
import { Feedback, Field, Pill, btnGhost, btnPrimary, classifyError, describeError, fmtDateTime, inputCls } from "./shared";

const DOC_KINDS: { key: LogisticsAutomationActionKind; label: string }[] = [
  { key: "request_confirmation", label: "Yük talebi teyidi" },
  { key: "cargo_details", label: "Yük bilgileri" },
  { key: "company_authority", label: "Firma yetki belgesi" },
  { key: "customs", label: "Gümrük evrakı" },
  { key: "transport", label: "Taşıma evrakı" },
];
const docLabel = (k: string) => DOC_KINDS.find((d) => d.key === k)?.label ?? k;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
const MAX_SIZE = 10 * 1024 * 1024;

const jobStatus: Record<string, { label: string; tone: string; text: string }> = {
  draft: { label: "Taslak", tone: "border-border text-foreground/70", text: "Kurucu doğrulaması bekleniyor." },
  verified: { label: "Doğrulandı", tone: "border-[#7aa2d6]/50 text-[#a9c4e8]", text: "Bilgi ve belgeler kurucu tarafından incelendi; yayın onayı bekleniyor." },
  approved: { label: "Onaylandı", tone: "border-primary/60 text-primary", text: "Bu sürüm yayın için onaylandı. Onay, gönderim yapıldığı anlamına gelmez." },
  sending: { label: "Gönderiliyor", tone: "border-[#f0c06a]/50 text-[#f0c06a]", text: "Sunucu gönderimi işliyor. Sonuç sağlayıcıdan gelene kadar başarılı sayılmaz." },
  sent: { label: "Gönderildi", tone: "border-[#7fae6e]/50 text-[#a8d39a]", text: "Sağlayıcı mesaj kimliğiyle teyit edildi." },
  failed: { label: "Başarısız", tone: "border-[#ef4444]/50 text-[#f5b0b0]", text: "Gönderim sağlayıcı tarafından reddedildi. Kurucu notuyla yeniden denenebilir." },
  uncertain: { label: "Belirsiz", tone: "border-[#ef4444]/50 text-[#f5b0b0]", text: "Teslim durumu bilinmiyor. Telegram kanalını dışarıdan kontrol edin; yeniden deneme kapalıdır (çift yayın riski)." },
};

function scrub(r: LogisticsAutomationResponse): LogisticsAutomationResponse {
  const { uploadURL: _u, uploadDocumentId: _d, downloadURL: _l, ...rest } = r;
  void _u; void _d; void _l;
  return rest;
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/50">{title}</p>{right}
      </div>
      {children}
    </div>
  );
}

export function AutomationPanel({ requestId }: { requestId: number }) {
  const { userId } = useAuth();
  return <AutomationBody key={`${userId ?? "anonymous"}:${requestId}`} requestId={requestId} />;
}

function AutomationBody({ requestId }: { requestId: number }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const queryKey = [...getGetLogisticsAutomationQueryKey(requestId), userId] as const;
  const q = useGetLogisticsAutomation(requestId, {
    query: {
      queryKey, enabled: Boolean(userId), staleTime: 5_000, refetchInterval: 20_000,
      select: scrub,
      retry: (n, e) => !["unauthenticated", "forbidden"].includes(classifyError(e)) && n < 2,
    },
  });
  const act = useActLogisticsAutomation({ mutation: { gcTime: 0 } });

  const job = q.data?.job ?? null;
  const serverVersion = job?.version ?? null;
  const [pinned, setPinned] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [msgDirty, setMsgDirty] = useState(false);
  const [required, setRequired] = useState<string[]>([]);
  const [reqDirty, setReqDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Pin once on first load; later polls never move the pin silently.
  useEffect(() => {
    if (job && pinned === null) { setPinned(job.version); setMessage(job.publicMessage); setRequired(job.requiredDocuments); }
  }, [job, pinned]);

  const stale = job !== null && pinned !== null && serverVersion !== pinned;

  function loadNewVersion() {
    if (!job) return;
    setPinned(job.version);
    if (!msgDirty) setMessage(job.publicMessage);
    if (!reqDirty) setRequired(job.requiredDocuments);
    setFeedback({ kind: "success", text: `Sürüm v${job.version} yüklendi.${msgDirty || reqDirty ? " Kaydedilmemiş düzenlemeleriniz korundu; yeni sürümle karşılaştırın." : ""}` });
  }

  async function run(label: string, data: LogisticsAutomationAction, success: string) {
    setBusy(label); setFeedback(null);
    try {
      const res = await act.mutateAsync({ id: requestId, data });
      const clean = scrub(res);
      qc.setQueryData(queryKey, clean);
      void qc.invalidateQueries({ queryKey });
      if (clean.job) {
        setPinned(clean.job.version);
        setMessage(clean.job.publicMessage); setMsgDirty(false);
        setRequired(clean.job.requiredDocuments); setReqDirty(false);
      }
      setFeedback({ kind: "success", text: success });
      return true;
    } catch (e) {
      setFeedback({ kind: "error", text: describeError(e) });
      if (classifyError(e) === "conflict") void qc.invalidateQueries({ queryKey });
      return false;
    } finally { setBusy(null); act.reset(); }
  }

  if (q.isPending) return (
    <section className="space-y-2" role="status" aria-label="Yayın masası yükleniyor">
      <div className="h-5 w-48 animate-pulse bg-card" /><div className="h-24 animate-pulse bg-card" />
    </section>
  );
  if (q.isError || !q.data) return (
    <section className="border border-[#ef4444]/40 bg-[#ef4444]/[0.06] p-4" data-testid="automation-error">
      <p className="flex items-start gap-2 text-sm text-[#f5b0b0]"><AlertTriangle size={15} className="mt-0.5 shrink-0" />Yayın masası alınamadı. {describeError(q.error)}</p>
      <p className="mt-1 text-xs text-foreground/50">Bu bir “kayıt yok” durumu değildir; veri gösterilmiyor.</p>
      <button type="button" className={`${btnGhost} mt-3`} onClick={() => void q.refetch()} data-testid="button-automation-retry-load"><RefreshCw size={14} />Yeniden dene</button>
    </section>
  );

  const d = q.data;
  const founder = d.canApprove;
  const v = pinned ?? 0;
  const disabled = stale || busy !== null;
  const st = job ? jobStatus[job.status] ?? { label: job.status, tone: "border-border", text: "" } : null;
  const sentProven = job?.status === "sent" && Boolean(job.providerMessageId);

  return (
    <section className="min-w-0 max-w-full space-y-4" data-testid="automation-panel">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">MMT · Mersin yayın masası</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">Telegram yük ilanı — kurucu kontrollü</h3>
          <p className="mt-0.5 font-mono text-[11px] text-foreground/45">{d.reference}{job ? ` · iş #${job.id} · v${job.version}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d.isTest ? <Pill className="border-[#f0c06a]/60 bg-[#f0c06a]/10 text-[#f0c06a]">TEST · asla gönderilmez</Pill> : null}
          {st ? <Pill className={st.tone}>{st.label}</Pill> : <Pill className="border-border text-foreground/50">Hazırlanmadı</Pill>}
          <button type="button" onClick={() => void q.refetch()} className="text-foreground/40 hover:text-primary" aria-label="Yenile" data-testid="button-automation-refresh"><RefreshCw size={13} className={q.isFetching ? "animate-spin" : ""} /></button>
        </div>
      </header>

      <div className={`border-l-2 px-3 py-2 text-xs ${d.dispatchAvailable ? "border-[#7fae6e] bg-[#7fae6e]/[0.06] text-foreground/75" : "border-foreground/30 bg-card text-foreground/65"}`} data-testid="status-dispatch">
        <p className="flex items-center gap-2 font-semibold">{d.dispatchAvailable ? <Send size={13} /> : <Lock size={13} />}
          {d.dispatchAvailable ? "Otomatik gönderim etkin: yalnızca onaylı, güncel ve TEST olmayan kayıt gönderilir." : "Otomatik gönderim kapalı — onay gönderim yapmaz."}</p>
        {d.dispatchBlockers.length ? <ul className="mt-1 list-disc space-y-0.5 pl-5">{d.dispatchBlockers.map((b) => <li key={b}>{b}</li>)}</ul> : null}
      </div>

      {!job ? (
        <div className="border border-dashed border-border p-4">
          <p className="text-sm">Bu talep için yayın takibi henüz yok.</p>
          <p className="mt-1 text-xs text-foreground/50">Hazırlamak; mevcut talep kaydından bir taslak, belge listesi ve görev listesi oluşturur. Hiçbir şey gönderilmez.</p>
          {feedback ? <div className="mt-2"><Feedback kind={feedback.kind}>{feedback.text}</Feedback></div> : null}
          <button type="button" className={`${btnPrimary} mt-3`} disabled={busy !== null} onClick={() => void run("prepare", { action: "prepare" }, "Yayın takibi hazırlandı (taslak).")} data-testid="button-automation-prepare">
            {busy === "prepare" ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}Yayın takibini hazırla
          </button>
        </div>
      ) : (
        <>
          {st ? <p className="text-xs text-foreground/60" data-testid="text-job-status">{st.text}{job.status === "sent" && !sentProven ? " Sağlayıcı mesaj kimliği yok; gönderim kanıtlanmadı." : ""}</p> : null}
          {sentProven ? <p className="font-mono text-[11px] text-[#a8d39a]" data-testid="text-provider-id">Sağlayıcı mesaj kimliği: {job.providerMessageId}</p> : null}
          {job.lastError ? <p className="text-xs text-[#f5b0b0]">Son hata: {job.lastError}</p> : null}

          {stale ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border border-[#f0c06a]/50 bg-[#f0c06a]/[0.07] px-3 py-2 text-xs text-[#f0c06a]" role="alert" data-testid="alert-automation-stale">
              <span className="flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Siz v{pinned} üzerinde çalışırken sunucuda v{serverVersion} oluştu. İşlemler kilitli; notlarınız korunuyor.</span>
              <button type="button" className={btnGhost} onClick={loadNewVersion} data-testid="button-load-new-version"><RefreshCw size={14} />Yeni sürümü yükle</button>
            </div>
          ) : null}
          {!job.sourceCurrent ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-[#f0c06a] bg-[#f0c06a]/[0.06] px-3 py-2 text-xs text-[#f0c06a]">
              <span>Talep kaydı bu taslaktan sonra değişti. Metin eski bilgiye dayanıyor olabilir; yenileyin ve yeniden inceleyin.</span>
              <button type="button" className={btnGhost} disabled={disabled} data-testid="button-regenerate-source"
                onClick={() => void run("regen", { action: "edit", expectedVersion: v }, "Taslak güncel talep kaydından yeniden oluşturuldu. Doğrulama ve onay sıfırlandı.")}>
                {busy === "regen" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Güncel kayıttan yenile
              </button>
            </div>
          ) : null}
          {feedback ? <Feedback kind={feedback.kind}>{feedback.text}</Feedback> : null}

          <Section title="Herkese açık ilan metni">
            <textarea rows={6} className={`${inputCls} font-mono text-xs`} value={message} maxLength={3000}
              onChange={(e) => { setMessage(e.target.value); setMsgDirty(true); }} data-testid="input-public-message" />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-foreground/40">{message.length}/3000{msgDirty ? " · kaydedilmedi" : ""}</span>
              <div className="flex gap-2">
                {msgDirty ? <button type="button" className={btnGhost} onClick={() => { setMessage(job.publicMessage); setMsgDirty(false); }} data-testid="button-discard-message">Geri al</button> : null}
                <button type="button" className={btnGhost} disabled={disabled || !msgDirty || !message.trim()} data-testid="button-save-message"
                  onClick={() => void run("msg", { action: "edit", expectedVersion: v, publicMessage: message.trim() }, "Metin kaydedildi; yeni sürüm oluştu, doğrulama ve onay sıfırlandı.")}>
                  {busy === "msg" ? <Loader2 size={14} className="animate-spin" /> : null}Metni kaydet
                </button>
              </div>
            </div>
          </Section>

          <Section title="Zorunlu belgeler" right={!founder ? <span className="text-[10px] text-foreground/40">Yalnızca kurucu değiştirebilir</span> : null}>
            <div className="grid gap-1 sm:grid-cols-2">
              {DOC_KINDS.map((k) => {
                const on = required.includes(k.key);
                const has = Boolean(d.documents.filter((doc) => doc.kind === k.key).at(-1)?.confirmed);
                return (
                  <label key={k.key} className={`flex items-center gap-2 border px-2 py-1.5 text-xs ${on ? "border-foreground/25" : "border-border text-foreground/45"}`}>
                    <input type="checkbox" disabled={!founder || disabled} checked={on} className="accent-[hsl(var(--primary))]" data-testid={`check-required-${k.key}`}
                      onChange={() => { setReqDirty(true); setRequired((r) => on ? r.filter((x) => x !== k.key) : [...r, k.key]); }} />
                    <span className="flex-1">{k.label}</span>
                    {on ? has ? <Check size={12} className="text-[#a8d39a]" /> : <span className="text-[10px] text-[#f0c06a]">eksik</span> : null}
                  </label>
                );
              })}
            </div>
            {founder && reqDirty ? (
              <div className="mt-2 flex gap-2">
                <button type="button" className={btnGhost} disabled={disabled || required.length === 0} data-testid="button-save-required"
                  onClick={() => void run("req", { action: "edit", expectedVersion: v, requiredDocuments: required as LogisticsAutomationAction["requiredDocuments"] }, "Zorunlu belge listesi güncellendi.")}>
                  {busy === "req" ? <Loader2 size={14} className="animate-spin" /> : null}Listeyi kaydet
                </button>
                <button type="button" className={btnGhost} onClick={() => { setRequired(job.requiredDocuments); setReqDirty(false); }}>Geri al</button>
              </div>
            ) : null}
          </Section>

          <Section title={`Belgeler (${d.documents.length})`}>
            {d.documents.length === 0 ? <p className="text-xs text-foreground/45">Henüz belge yok.</p> : (
              <ul className="divide-y divide-border border border-border">
                {d.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 px-3 py-2 text-xs" data-testid={`row-doc-${doc.id}`}>
                    <FileText size={14} className="shrink-0 text-foreground/40" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{doc.fileName}</p>
                      <p className="text-[10px] text-foreground/45">{docLabel(doc.kind)} · {doc.size < 1024 ? `${doc.size} bayt` : `${(doc.size / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} KB`} · {doc.uploadedBy === userId ? "siz" : `kullanıcı ${doc.uploadedBy.slice(-6)}`}</p>
                    </div>
                    {doc.confirmed ? <Pill className="border-border text-foreground/60">Yüklendi</Pill> : <Pill className="border-[#f0c06a]/50 text-[#f0c06a]">Tamamlanmadı</Pill>}
                    {doc.confirmed ? <DownloadButton requestId={requestId} documentId={doc.id} /> : null}
                  </li>
                ))}
              </ul>
            )}
            <UploadForm disabled={disabled} onUpload={async (file, kind) => {
              setBusy("upload"); setFeedback(null);
              try {
                const r1 = await act.mutateAsync({ id: requestId, data: { action: "request_upload", expectedVersion: v, kind, fileName: file.name.slice(0, 150), contentType: file.type as LogisticsAutomationAction["contentType"], size: file.size } });
                const url = r1.uploadURL; const docId = r1.uploadDocumentId; const ver = r1.job?.version;
                qc.setQueryData(queryKey, scrub(r1));
                if (!url || !docId || !ver) throw new Error("upload-init");
                setPinned(ver);
                const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
                if (!put.ok) throw new Error("upload-put");
                const r2 = await act.mutateAsync({ id: requestId, data: { action: "confirm_upload", expectedVersion: ver, documentId: docId } });
                qc.setQueryData(queryKey, scrub(r2));
                if (r2.job) setPinned(r2.job.version);
                setFeedback({ kind: "success", text: "Belge yüklendi ve kayda bağlandı. Belge, bilginin doğru olduğunu kanıtlamaz; kurucu doğrulaması gerekir." });
                return true;
              } catch (e) {
                const local = e instanceof Error && e.message.startsWith("upload-");
                setFeedback({ kind: "error", text: local ? "Dosya depolamaya aktarılamadı. Belge tamamlanmadı; yeniden deneyin." : describeError(e) });
                return false;
              } finally { setBusy(null); act.reset(); void qc.invalidateQueries({ queryKey }); }
            }} busy={busy === "upload"} />
          </Section>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Görev listesi">
              <ul className="space-y-1">
                {d.tasks.map((t) => (
                  <li key={t.key} className="flex items-start gap-2 text-xs" data-testid={`task-${t.key}`}>
                    <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center border ${t.done ? "border-primary bg-primary text-primary-foreground" : "border-foreground/30"}`}>{t.done ? <Check size={10} /> : null}</span>
                    <span className={t.done ? "text-foreground/50 line-through decoration-foreground/30" : ""}>{t.title}</span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Geçmiş">
              <ol className="max-h-56 space-y-2 overflow-y-auto border-l border-border pl-3">
                {[...job.events].reverse().map((ev, i) => {
                  const system = ev.actorKind === "system" || !ev.actorUserId;
                  return (
                    <li key={`${ev.at}-${i}`} className="relative text-xs">
                      <span className={`absolute -left-[17px] top-1 h-2 w-2 rounded-full ${system ? "bg-foreground/30" : "bg-primary"}`} />
                      <p className="text-[10px] uppercase tracking-[0.1em] text-foreground/45">{fmtDateTime(ev.at)} · {system ? "Sistem" : ev.actorUserId === userId ? "Siz" : `Kullanıcı ${ev.actorUserId!.slice(-6)}`} · {ev.action}</p>
                      <p className="whitespace-pre-wrap text-foreground/75">{ev.detail}</p>
                    </li>
                  );
                })}
              </ol>
            </Section>
          </div>

          <Section title="Kurucu kararları">
            {!founder ? <p className="text-xs text-foreground/50">Doğrulama, onay, ret ve yeniden deneme yalnızca kurucuya aittir.</p> : (
              <FounderDecisions status={job.status} disabled={disabled} busy={busy} isTest={d.isTest}
                verifiedAt={job.verifiedAt} approvedAt={job.approvedAt}
                onAct={(label, data, ok) => run(label, { ...data, expectedVersion: v }, ok)} />
            )}
          </Section>
        </>
      )}
    </section>
  );
}

function DownloadButton({ requestId, documentId }: { requestId: number; documentId: string }) {
  const act = useActLogisticsAutomation({ mutation: { gcTime: 0 } });
  const [err, setErr] = useState(false);
  return (
    <button type="button" className="text-foreground/50 hover:text-primary disabled:opacity-40" disabled={act.isPending} aria-label="Belgeyi aç"
      title={err ? "Belge açılamadı" : "Belgeyi aç"} data-testid={`button-download-${documentId}`}
      onClick={async () => {
        setErr(false);
        const w = window.open("about:blank", "_blank");
        try {
          const r = await act.mutateAsync({ id: requestId, data: { action: "download", documentId } });
          if (!r.downloadURL || !w) throw new Error();
          w.opener = null; w.location.href = r.downloadURL;
        } catch { w?.close(); setErr(true); } finally { act.reset(); }
      }}>
      {act.isPending ? <Loader2 size={14} className="animate-spin" /> : err ? <AlertTriangle size={14} className="text-[#f5b0b0]" /> : <Download size={14} />}
    </button>
  );
}

function UploadForm({ disabled, busy, onUpload }: { disabled: boolean; busy: boolean; onUpload: (f: File, k: LogisticsAutomationActionKind) => Promise<boolean> }) {
  const [kind, setKind] = useState<LogisticsAutomationActionKind | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <form className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 border border-border bg-[#0d131c] p-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!kind) { setErr("Belge kategorisi seçin."); return; }
        if (!file) { setErr("Dosya seçin."); return; }
        if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) { setErr("Yalnızca PDF, JPEG veya PNG."); return; }
        if (file.size < 1 || file.size > MAX_SIZE) { setErr("Dosya boyutu 10 MB'ı aşamaz."); return; }
        setErr(null);
        if (await onUpload(file, kind)) { setFile(null); setKind(""); if (inputRef.current) inputRef.current.value = ""; }
      }}>
      <Field label="Kategori *">
        <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as LogisticsAutomationActionKind)} data-testid="select-upload-kind">
          <option value="">Seçin</option>{DOC_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
      </Field>
      <Field label="Dosya (PDF/JPEG/PNG, ≤10 MB) *">
        <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png" className={`${inputCls} min-w-0 max-w-full file:mr-2 file:border-0 file:bg-transparent file:text-xs file:text-primary`}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="input-upload-file" />
      </Field>
      <button type="submit" className={btnGhost} disabled={disabled || busy} data-testid="button-upload">{busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}Yükle</button>
      {err ? <p className="text-xs text-[#f5b0b0] sm:col-span-3">{err}</p> : null}
    </form>
  );
}

type Act = (label: string, data: Omit<LogisticsAutomationAction, "expectedVersion">, ok: string) => Promise<boolean>;

function FounderDecisions({ status, disabled, busy, isTest, verifiedAt, approvedAt, onAct }: {
  status: string; disabled: boolean; busy: string | null; isTest: boolean; verifiedAt?: string | null; approvedAt?: string | null; onAct: Act;
}) {
  const [mode, setMode] = useState<"verify" | "approve" | "reject" | "retry" | null>(null);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const noteOk = note.trim().length >= 3 && note.trim().length <= 2000;

  const open = (m: typeof mode) => { setMode(m); setConfirmed(false); };
  const done = (ok: boolean) => { if (ok) { setMode(null); setNote(""); setConfirmed(false); } };

  const buttons: ReactNode[] = [];
  if (status === "draft") buttons.push(<button key="v" type="button" className={btnPrimary} disabled={disabled} onClick={() => open("verify")} data-testid="button-open-verify"><ShieldCheck size={14} />Doğrula</button>);
  if (status === "verified") buttons.push(<button key="a" type="button" className={btnPrimary} disabled={disabled} onClick={() => open("approve")} data-testid="button-open-approve"><Check size={14} />Yayın metnini onayla</button>);
  if (["draft", "verified", "approved", "failed"].includes(status)) buttons.push(<button key="r" type="button" className={`${btnGhost} hover:border-[#ef4444]/60 hover:text-[#f5b0b0]`} disabled={disabled} onClick={() => open("reject")} data-testid="button-open-reject"><CircleSlash size={14} />Reddet</button>);
  if (status === "failed" && !isTest) buttons.push(<button key="t" type="button" className={btnGhost} disabled={disabled} onClick={() => open("retry")} data-testid="button-open-retry"><RefreshCw size={14} />Yeniden dene</button>);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-foreground/45">Doğrulama: {fmtDateTime(verifiedAt)} · Onay: {fmtDateTime(approvedAt)}</p>
      {status === "uncertain" ? <p className="flex items-start gap-2 text-xs text-[#f5b0b0]"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Sağlayıcı teslimi bilinmiyor. Telegram kanalını elle kontrol edin. Yeniden deneme bilinçli olarak kapalıdır.</p> : null}
      {mode === null ? (buttons.length ? <div className="flex flex-wrap gap-2">{buttons}</div> : <p className="text-xs text-foreground/45">Bu durumda kurucu işlemi yok.</p>) : (
        <form className="space-y-2 border border-border bg-[#0d131c] p-3 animate-in fade-in slide-in-from-top-1"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!noteOk || ((mode === "verify" || mode === "approve") && !confirmed)) return;
            const n = note.trim();
            if (mode === "verify") done(await onAct("verify", { action: "verify", note: n, informationConfirmed: true }, "Doğrulama kaydedildi."));
            if (mode === "approve") done(await onAct("approve", { action: "approve", note: n, publicContentConfirmed: true }, "Bu sürüm onaylandı. Gönderim yalnızca sunucu koşulları sağlanınca yapılır; durumu izleyin."));
            if (mode === "reject") done(await onAct("reject", { action: "reject", note: n }, "Ret kaydedildi."));
            if (mode === "retry") done(await onAct("retry", { action: "retry", note: n }, "Yeniden deneme isteği kaydedildi. Sonuç gelene kadar gönderilmiş sayılmaz."));
          }}>
          {mode === "verify" ? (
            <label className="flex items-start gap-2 text-xs leading-5">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 accent-[hsl(var(--primary))]" data-testid="check-information-confirmed" />
              <span>Gerçek belgeleri ve talep bilgilerini kendim elle inceledim. Belgelerin eksiksiz olması bilginin doğru olduğunu kanıtlamaz; bu kayıt otomatik bir hukuki güvence değildir.</span>
            </label>
          ) : null}
          {mode === "approve" ? (
            <label className="flex items-start gap-2 text-xs leading-5">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 accent-[hsl(var(--primary))]" data-testid="check-public-content-confirmed" />
              <span>Yalnızca incelediğim bu sürümün herkese açık Telegram yük ilanı metnini onaylıyorum. Teklif fiyatını, ödemeyi, sevkiyatı veya hukuki sözleşmeyi onaylamaz.</span>
            </label>
          ) : null}
          {mode === "retry" ? <p className="text-xs text-foreground/55">Yalnızca sağlayıcının açıkça reddettiği gönderimler için. Belirsiz durumlar yeniden denenemez.</p> : null}
          <Field label="Kurucu notu * (3–2000)" hint={mode === "verify" ? "Hangi belge ve bilgileri nasıl incelediğinizi yazın." : undefined}>
            <textarea rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} autoFocus data-testid={`input-${mode}-note`} />
          </Field>
          <div className="flex gap-2">
            <button type="submit" className={mode === "reject" ? `${btnPrimary} bg-[#b91c1c]` : btnPrimary}
              disabled={disabled || !noteOk || ((mode === "verify" || mode === "approve") && !confirmed)} data-testid={`button-confirm-${mode}`}>
              {busy === mode ? <Loader2 size={14} className="animate-spin" /> : null}
              {mode === "verify" ? "Doğrulamayı kaydet" : mode === "approve" ? "Onayı kaydet" : mode === "reject" ? "Reddi kaydet" : "Yeniden denemeyi iste"}
            </button>
            <button type="button" className={btnGhost} onClick={() => setMode(null)}>Vazgeç (not korunur)</button>
          </div>
        </form>
      )}
    </div>
  );
}
