import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { UserButton, useAuth } from "@clerk/react";
import { Link, Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetGeminiWorkspaceQueryKey,
  getGetStaffAccessQueryKey,
  useGetGeminiWorkspace,
  useGetStaffAccess,
  useSendGeminiInstruction,
  type GeminiWorkspace,
  type GeminiWorkspaceTurn,
} from "@workspace/api-client-react";
import { AlertTriangle, ChevronLeft, Clock, Lock, MessageSquareText, RefreshCw, Send, ShieldAlert, ShieldCheck, WifiOff } from "lucide-react";
import { btnGhost, btnPrimary, classifyError, errorStatus, fmtDateTime } from "@/components/logistics-ops/shared";
import { canClearGeminiInput, createGeminiSubmissionController, mergeGeminiTurn } from "@/lib/gemini-submission";
import { GeminiLogisticsStart } from "@/components/gemini-logistics-start";

const MAX = 3000;
const noAuthRetry = (count: number, error: unknown) => {
  const s = errorStatus(error);
  if (s === 401 || s === 403 || s === 404 || s === 429 || s === 503) return false;
  return count < 2;
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1000px] items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/staff/lojistik-havuzu" className="flex shrink-0 items-center gap-1 text-xs text-foreground/55 hover:text-primary" data-testid="link-back-pool"><ChevronLeft size={14} />Havuz</Link>
            <span className="truncate text-sm font-bold tracking-[0.18em]">MMT <span className="font-normal text-foreground/50">GLOBAL</span></span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-primary sm:inline">Gemini çalışma alanı</span>
          </div>
          <UserButton />
        </div>
      </header>
      {children}
    </main>
  );
}

function Centered({ icon: Icon, title, text, action }: { icon: typeof Lock; title: string; text: string; action?: ReactNode }) {
  return (
    <section className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center px-5 text-center" role="alert">
      <Icon className="h-10 w-10 text-primary" strokeWidth={1.5} />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-7 text-foreground/60">{text}</p>
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1000px] space-y-4 px-4 py-8 md:px-8" role="status" aria-label="Yükleniyor">
      <div className="h-24 animate-pulse bg-card" />
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse bg-card" />)}
    </div>
  );
}

function ErrorView({ error, retry, what }: { error: unknown; retry: () => void; what: string }) {
  const s = errorStatus(error);
  const kind = classifyError(error);
  const back = <Link href="/staff/lojistik-havuzu" className={btnGhost} data-testid="link-back-pool-error">Havuza dön</Link>;
  const btn = <button type="button" className={btnPrimary} onClick={retry} data-testid="button-retry"><RefreshCw size={14} />Yeniden dene</button>;
  if (kind === "unauthenticated") return <Centered icon={Lock} title="Oturum doğrulanamadı (401)" text="Oturumunuz sona ermiş olabilir. Mevcut giriş ekranından yeniden giriş yapın." action={<Link href="/staff/giris" className={btnPrimary} data-testid="link-signin">Girişe git</Link>} />;
  if (kind === "forbidden") return <Centered icon={ShieldAlert} title="Erişim reddedildi (403)" text="Bu çalışma alanı yalnız kurucuya açıktır. Sunucu bu hesabı kurucu olarak tanımıyor." action={back} />;
  if (s === 404) return <Centered icon={ShieldAlert} title="Bu ortamda kapalı" text="Gemini çalışma alanı yalnız önizleme ortamında etkindir; yayındaki sürümde kapalıdır." action={back} />;
  if (s === 503) return <Centered icon={AlertTriangle} title="Gemini şu an kullanılamıyor (503)" text="Entegrasyon yapılandırılmamış veya geçici olarak erişilemiyor. Kayıtlı geçmiş silinmedi." action={<>{btn}{back}</>} />;
  if (s === 429) return <Centered icon={Clock} title="Çok sık istek (429)" text="Kısa bir süre bekleyip yeniden deneyin." action={btn} />;
  if (kind === "schema") return <Centered icon={AlertTriangle} title="Beklenmeyen sunucu yanıtı" text="Yanıt beklenen biçimde değil. Sürüm uyuşmazlığı olabilir." action={btn} />;
  return <Centered icon={WifiOff} title={`${what} alınamadı`} text="Bağlantı veya sunucu hatası. Bu, geçmişin boş olduğu anlamına gelmez." action={btn} />;
}

export default function StaffGemini() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const access = useGetStaffAccess({ query: { queryKey: [...getGetStaffAccessQueryKey(), userId], enabled: isLoaded && Boolean(isSignedIn), staleTime: 60_000, retry: noAuthRetry } });
  const isFounder = access.data?.role === "founder";

  useEffect(() => { document.title = "Gemini Çalışma Alanı | MMT Global"; }, []);

  if (!isLoaded) return <Shell><Skeleton /></Shell>;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  if (access.isPending) return <Shell><Skeleton /></Shell>;
  if (access.isError) return <Shell><ErrorView error={access.error} retry={() => void access.refetch()} what="Yetki bilgisi" /></Shell>;
  if (!isFounder) return <Shell><Centered icon={ShieldAlert} title="Yalnız kurucu" text="Bu önizleme çalışma alanı yalnız kurucu hesabına açıktır. Bu sayfa yeni yetki vermez." action={<Link href="/staff/yonlendir" className={btnGhost}>Çalışma alanıma dön</Link>} /></Shell>;
  return <Shell><Workspace key={userId ?? "anon"} userId={userId ?? ""} /></Shell>;
}

function sendErrorText(error: unknown): { text: string; ambiguous: boolean } {
  const s = errorStatus(error);
  const kind = classifyError(error);
  if (s === 401) return { text: "Oturum doğrulanamadı (401). Metniniz korunuyor; yeniden giriş yapın.", ambiguous: false };
  if (s === 403) return { text: "Bu işlem için kurucu yetkisi gerekiyor (403).", ambiguous: false };
  if (s === 404) return { text: "Bu ortamda Gemini çalışma alanı kapalı (404).", ambiguous: false };
  if (s === 429) return { text: "Çok sık istek gönderildi (429). Biraz bekleyip yeniden deneyin; metniniz korunuyor.", ambiguous: false };
  if (s === 503) return { text: "Gemini şu an kullanılamıyor (503). Metniniz korunuyor.", ambiguous: true };
  if (kind === "validation") return { text: "Sunucu talimatı kabul etmedi. Uzunluğu (1-3000 karakter) kontrol edin.", ambiguous: false };
  if (kind === "network" || kind === "schema") return { text: "Yanıt alınamadı; talimat sunucuya ulaşmış olabilir. Geçmiş yeniden kontrol ediliyor. Aynı metinle yeniden denerseniz aynı istek kimliği kullanılır ve çift kayıt oluşmaz.", ambiguous: true };
  return { text: "Sunucu hatası. Sonuç belirsiz; geçmiş yeniden kontrol ediliyor. Aynı metinle yeniden deneyebilirsiniz.", ambiguous: true };
}

function Workspace({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const key = useMemo(() => [...getGetGeminiWorkspaceQueryKey(), userId] as const, [userId]);
  const ws = useGetGeminiWorkspace({
    query: {
      queryKey: key,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: noAuthRetry,
      refetchInterval: (q) => (q.state.data?.turns.some((t) => t.status === "pending") ? 5_000 : false),
    },
  });
  const send = useSendGeminiInstruction({ mutation: { retry: false } });
  const mutateRef = useRef(send.mutateAsync);
  mutateRef.current = send.mutateAsync;

  const [text, setText] = useState("");
  const textRef = useRef(text);
  textRef.current = text;
  const submission = useRef(createGeminiSubmissionController());
  const editRevision = useRef(0);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const turns = ws.data?.turns ?? [];
  const hasPending = turns.some((t) => t.status === "pending");
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = turns[turns.length - 1]?.id;
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lastId]);

  if (ws.isPending) return <Skeleton />;
  if (ws.isError && !ws.data) return <ErrorView error={ws.error} retry={() => void ws.refetch()} what="Geçmiş" />;

  const trimmed = text.trim();
  const tooLong = text.length > MAX;
  const disabled = sending || hasPending || ws.isError || !trimmed || tooLong;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (disabled) return;
    const started = submission.current.begin(textRef.current);
    if (!started) return;
    const { requestId, instruction } = started;
    const submittedRevision = editRevision.current;
    let keepForRetry = false;
    setSending(true);
    setFeedback(null);
    try {
      const turn = await mutateRef.current({ data: { requestId, instruction } });
      qc.setQueryData<GeminiWorkspace>(key, (current) =>
        current ? { ...current, turns: mergeGeminiTurn(current.turns, turn) } : current,
      );
      if (canClearGeminiInput(submittedRevision, editRevision.current, textRef.current, instruction)) {
        textRef.current = "";
        setText("");
      }
      setFeedback({ kind: turn.status === "failed" ? "error" : "ok", text: turn.status === "pending" ? "Talimat kaydedildi; yanıt hazırlanıyor." : turn.status === "failed" ? "Talimat kaydedildi ancak yanıt üretilemedi." : "Yanıt kaydedildi." });
    } catch (err) {
      const r = sendErrorText(err);
      keepForRetry = r.ambiguous;
      setFeedback({ kind: "error", text: r.text });
    } finally {
      submission.current.finish(keepForRetry);
      setSending(false);
      void qc.invalidateQueries({ queryKey: key });
    }
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 md:px-8">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Kurucu · önizleme</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Gemini talimat defteri</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/60">Talimat yazın, yanıt sunucuda saklanır; daha sonra döndüğünüzde konuşma burada olur. Yanıtlar öneridir; hiçbir işlem kendiliğinden yürütülmez.</p>
      </div>

      <section className="mt-5 grid gap-px border border-border bg-border sm:grid-cols-2" aria-label="Kapsam">
        <div className="bg-card px-4 py-3 text-xs leading-5 text-foreground/65" data-testid="text-preview-scope">
          <p className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground"><ShieldCheck size={13} className="text-primary" />Yalnız öneri</p>
          Mod: <span className="font-mono">{ws.data?.mode === "preview_drafts_only" ? "yalnız taslak (önizleme)" : ws.data?.mode}</span> · Model: <span className="font-mono break-all" data-testid="text-model">{ws.data?.model}</span>. Dışarıya mesaj göndermez; ticari onay, ödeme, yayın/dağıtım veya arka plan görevi yürütmez.
        </div>
        <div className="bg-card px-4 py-3 text-xs leading-5 text-foreground/65">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">Ne değildir</p>
          Sürekli çalışan bir ajan veya Gemini tüketici uygulamanıza bağlı bir hesap değildir. Her talimat mevcut Gemini entegrasyonu kredisini kullanır; sayfa kendiliğinden yapay zekâ çağrısı yapmaz.
        </div>
      </section>

      <GeminiLogisticsStart userId={userId} busy={sending || hasPending || ws.isError} onPrepare={(instruction) => {
        const combined = textRef.current.trim() ? `${textRef.current}\n\n${instruction}` : instruction;
        if (combined.length > MAX) {
          setFeedback({ kind: "error", text: "Lojistik özetiyle birlikte 3000 karakter sınırı aşılacak. Mevcut metniniz korundu; önce kısaltın." });
          return;
        }
        editRevision.current += 1;
        textRef.current = combined;
        setText(combined);
        setFeedback({ kind: "ok", text: "Lojistik özeti talimata eklendi; henüz gönderilmedi. Metni kontrol edip Gönder düğmesini kullanın." });
        document.getElementById("gemini-instruction")?.focus();
      }} />

      {ws.isError ? <p className="mt-3 flex items-start gap-2 border-l-2 border-red-400 bg-red-400/10 px-3 py-2 text-xs text-red-200" role="alert"><WifiOff size={14} className="mt-0.5 shrink-0" />Son yenileme başarısız. Gösterilen geçmiş eskimiş olabilir.<button type="button" className="ml-auto underline" onClick={() => void ws.refetch()} data-testid="button-refetch">Yenile</button></p> : null}

      <section className="mt-6" aria-label="Talimat geçmişi" aria-live="polite">
        <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/45">
          <span>Son {turns.length} kayıt (en fazla 40)</span>
          <span>{ws.isFetching ? "yenileniyor" : hasPending ? "5 sn'de bir kontrol" : ""}</span>
        </div>
        {turns.length === 0 ? (
          <div className="flex flex-col items-center border border-dashed border-border px-5 py-12 text-center" data-testid="state-empty">
            <MessageSquareText className="h-9 w-9 text-foreground/25" strokeWidth={1.4} />
            <p className="mt-3 max-w-sm text-sm text-foreground/55">Henüz kayıtlı talimat yok. İlk talimatınızı aşağıdan yazın; yanıt bu sayfada saklanır.</p>
          </div>
        ) : (
          <ol className="space-y-4">{turns.map((t) => <TurnItem key={t.id} turn={t} />)}</ol>
        )}
        <div ref={endRef} />
      </section>

      <form onSubmit={onSubmit} className="sticky bottom-0 mt-6 border-t border-border bg-background/95 pb-4 pt-4 backdrop-blur">
        <label htmlFor="gemini-instruction" className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">Talimat</label>
        <p id="gemini-warning" className="mt-1 flex items-start gap-2 text-xs leading-5 text-foreground/55"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-primary" />Şifre, erişim anahtarı/token, kart bilgisi veya müşteri kişisel verisi yazmayın.</p>
        <textarea id="gemini-instruction" value={text} onChange={(e) => {
          editRevision.current += 1;
          textRef.current = e.target.value;
          setText(e.target.value);
        }} rows={4} aria-describedby="gemini-warning gemini-count"
          className="mt-2 w-full resize-y border border-border bg-card px-3 py-2 text-sm leading-6 text-foreground placeholder:text-foreground/35 focus:border-primary focus:outline-none"
          placeholder="Örnek: Mersin narenciye koridoru için taşıyıcı seçiminde kontrol listesini taslak olarak hazırla." data-testid="input-instruction" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span id="gemini-count" className={`font-mono text-[10px] ${tooLong ? "text-red-300" : "text-foreground/45"}`}>{text.length}/{MAX}</span>
          <button type="submit" disabled={disabled} className={`${btnPrimary} disabled:opacity-50`} data-testid="button-send">
            {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? "Yanıt bekleniyor (45 sn sürebilir)" : hasPending ? "Önceki yanıt bekleniyor" : "Gönder"}
          </button>
        </div>
        <div role="status" aria-live="polite" className="mt-2 text-xs">
          {hasPending && !sending ? <p className="text-foreground/60">Bekleyen bir yanıt var; tamamlanınca yeni talimat gönderebilirsiniz. Yazmaya devam edebilirsiniz.</p> : null}
          {sending ? <p className="text-foreground/60">Yeni talimatınızı yazabilirsiniz; bekleyen yanıt yazdığınız yeni metni silmez.</p> : null}
          {feedback ? <p className={feedback.kind === "error" ? "text-red-300" : "text-primary"} data-testid="status-send">{feedback.text}</p> : null}
        </div>
      </form>
    </div>
  );
}

const statusMeta: Record<GeminiWorkspaceTurn["status"], { label: string; cls: string }> = {
  pending: { label: "Yanıt bekleniyor", cls: "border-primary/60 text-primary" },
  answered: { label: "Yanıtlandı · öneri", cls: "border-border text-foreground/60" },
  failed: { label: "Başarısız", cls: "border-red-400/60 text-red-300" },
};

function TurnItem({ turn }: { turn: GeminiWorkspaceTurn }) {
  const meta = statusMeta[turn.status];
  return (
    <li className="min-w-0 border border-border" data-testid={`turn-${turn.id}`}>
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/45">
          <span>Talimatınız · {fmtDateTime(turn.createdAt)}</span>
          <span className={`border px-2 py-0.5 ${meta.cls}`} data-testid={`status-turn-${turn.id}`}>{meta.label}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{turn.instruction}</p>
      </div>
      <div className="px-4 py-3">
        {turn.status === "pending" ? (
          <p className="flex items-center gap-2 text-sm text-foreground/60" role="status"><RefreshCw size={13} className="animate-spin text-primary" />Gemini yanıtı hazırlanıyor. Sayfadan ayrılabilirsiniz; yanıt kaydedilecek.</p>
        ) : turn.status === "failed" ? (
          <p className="text-sm text-red-300" role="alert">Yanıt üretilemedi{turn.failureMessage ? `: ${turn.failureMessage}` : "."}</p>
        ) : (
          <>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/45">Gemini önerisi · yürütülmedi · {fmtDateTime(turn.updatedAt)}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/85" data-testid={`text-reply-${turn.id}`}>{turn.reply ?? ""}</p>
          </>
        )}
      </div>
    </li>
  );
}
