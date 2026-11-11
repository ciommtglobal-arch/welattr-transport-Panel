import { useRef, useState, type FormEvent } from "react";
import { usePasteLogisticsAds, type CopiedMarketAdsInput, type CopiedMarketAdsResult } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, ClipboardPaste, Lock, RefreshCw } from "lucide-react";
import { classifyError, describeError, inputCls } from "@/components/logistics-ops/shared";
import { roleLabels } from "./pool-panels";

const newId = () => crypto.randomUUID();
const DAY = 24 * 60 * 60 * 1000;
const FUTURE = 5 * 60 * 1000;

export function PasteAds({ onSaved }: { onSaved: () => Promise<unknown> }) {
  const [channel, setChannel] = useState<"whatsapp" | "facebook">("whatsapp");
  const [sourceName, setSourceName] = useState("");
  const [reference, setReference] = useState("");
  const [occurredLocal, setOccurredLocal] = useState("");
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [frozen, setFrozen] = useState<CopiedMarketAdsInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [result, setResult] = useState<CopiedMarketAdsResult | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const mutation = usePasteLogisticsAds();
  const mutateRef = useRef(mutation.mutateAsync);
  mutateRef.current = mutation.mutateAsync;

  async function send(body: CopiedMarketAdsInput) {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError(null); setRefreshError(null);
    try {
      const res = await mutateRef.current({ data: body });
      setResult(res); setFrozen(null);
      setText(""); setReference(""); setConsent(false); setOccurredLocal("");
      try { await onSaved(); } catch { setRefreshError("Kayıt sunucuda saklandı; havuz görünümü yenilenemedi. Tekrar göndermeyin, sayfayı yenileyin."); }
    } catch (err) {
      const kind = classifyError(err);
      const definite = kind === "validation" || kind === "forbidden" || kind === "unauthenticated" || kind === "conflict";
      setError(`${describeError(err)}${definite ? " Metni düzenleyip yeni istek olarak gönderebilirsiniz." : " Sonuç belirsiz: kayıt oluşmuş olabilir. Aynı isteği tekrar gönderin; sunucu yinelemeyi aynı istek kimliğiyle tanır."}`);
    } finally { inFlight.current = false; setPending(false); }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setResult(null);
    if (frozen) { void send(frozen); return; }
    if (!consent) { setError("Kopyalanan ilanları MMT eşleştirmesi için saklama ve kullanma yetkinizi teyit edin."); return; }
    const name = sourceName.trim();
    if (name.length < 2 || name.length > 120) { setError("Kaynak adı 2-120 karakter olmalı."); return; }
    if (!occurredLocal) { setError("İlanın orijinal paylaşım tarih ve saatini girin."); return; }
    const t = new Date(occurredLocal).getTime();
    if (!Number.isFinite(t)) { setError("Tarih/saat geçersiz."); return; }
    const now = Date.now();
    if (t < now - DAY) { setError("İlan 24 saatten eski. Güncel olmayan ilanlar havuza alınmaz."); return; }
    if (t > now + FUTURE) { setError("Paylaşım zamanı gelecekte olamaz (en fazla 5 dakika sapma)."); return; }
    if (!text.trim() || text.length > 8192) { setError("İlan metni 1-8192 karakter olmalı."); return; }
    const body: CopiedMarketAdsInput = {
      requestId: newId(), channel, sourceName: name, occurredAt: new Date(t).toISOString(), text, consentConfirmed: true,
      ...(reference.trim() ? { reference: reference.trim().slice(0, 300) } : {}),
    };
    setFrozen(body);
    void send(body);
  }

  function unlock() { if (pending) return; setFrozen(null); setError(null); }

  const locked = frozen !== null || pending;

  return <section className="mt-5 max-w-3xl border border-border bg-card p-4 sm:p-6" data-testid="panel-paste-ads">
    <div className="mb-5 flex items-start gap-3">
      <div className="mt-1 rounded-full border border-primary/30 bg-primary/10 p-2 text-primary"><ClipboardPaste size={17} /></div>
      <div><h2 className="text-lg font-semibold">İlan yapıştır — yalnız kurucu</h2>
        <p className="mt-1 text-xs leading-5 text-foreground/55">Bu ekran yalnız elle yapıştırılan metni kabul eder. WhatsApp veya Facebook hesaplarını otomatik okumaz, gruplara bağlanmaz, mesaj göndermez. Kaydedilen ilanlar ticari onay almaz; eşleşme incelemesi ayrıca gerekir.</p>
      </div>
    </div>
    <form onSubmit={submit} className="space-y-4" data-testid="form-paste-ads">
      <fieldset disabled={locked} className="space-y-4 disabled:opacity-70">
        <div className="grid grid-cols-2 gap-2">
          {(["whatsapp", "facebook"] as const).map((c) => (
            <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)} data-testid={`paste-channel-${c}`}
              className={`border p-3 text-sm font-semibold ${channel === c ? "border-primary bg-primary/10" : "border-border text-foreground/55"}`}>{c === "whatsapp" ? "WhatsApp" : "Facebook"}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-xs text-foreground/75"><span>Kaynak adı (grup, sayfa veya kişi)</span>
            <input className={`${inputCls} w-full`} required minLength={2} maxLength={120} value={sourceName} onChange={(e) => setSourceName(e.target.value)} data-testid="input-paste-source" /></label>
          <label className="block space-y-1.5 text-xs text-foreground/75"><span>Orijinal paylaşım tarihi ve saati</span>
            <input className={`${inputCls} w-full`} type="datetime-local" required value={occurredLocal} onChange={(e) => setOccurredLocal(e.target.value)} data-testid="input-paste-occurred" />
            <span className="block text-[11px] leading-5 text-foreground/50">İlandaki zamanı girin, bugünün saatini değil. En fazla 24 saat önce.</span></label>
          <label className="block space-y-1.5 text-xs text-foreground/75 sm:col-span-2"><span>Referans (isteğe bağlı: bağlantı veya mesaj notu)</span>
            <input className={`${inputCls} w-full`} maxLength={300} value={reference} onChange={(e) => setReference(e.target.value)} data-testid="input-paste-reference" /></label>
        </div>
        <label className="block space-y-1.5 text-xs text-foreground/75"><span>İlan metni ({text.length}/8192)</span>
          <textarea className={`${inputCls} min-h-48 w-full font-mono text-xs`} required maxLength={8192} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Bir veya birden fazla ilanı olduğu gibi yapıştırın." data-testid="input-paste-text" /></label>
        <label className="flex items-start gap-3 border border-border bg-background p-3 text-xs leading-5 text-foreground/70">
          <input type="checkbox" className="mt-1 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="checkbox-paste-consent" />
          <span>Bu ilanları MMT içi eşleştirme için saklama ve kullanma yetkim olduğunu doğruladım. Bir kanalı herkese açık takip etmek tek başına bu izni vermez.</span>
        </label>
      </fieldset>
      {frozen && !pending ? <p className="flex items-start gap-2 border-l-2 border-primary bg-primary/10 px-3 py-2 text-xs leading-5" role="status">
        <Lock size={14} className="mt-0.5 shrink-0 text-primary" />Gönderilen içerik kilitli (istek {frozen.requestId.slice(0, 8)}). Tekrar gönderim aynı içerik ve aynı kimlikle yapılır. Değiştirmek için düzenleyin; bu yeni bir istek oluşturur.
      </p> : null}
      {error ? <p role="alert" className="flex gap-2 border-l-2 border-red-400 bg-red-400/10 px-3 py-2 text-xs text-red-200"><AlertTriangle size={14} className="shrink-0" />{error}</p> : null}
      {refreshError ? <p role="alert" className="flex gap-2 border-l-2 border-red-400 bg-red-400/10 px-3 py-2 text-xs text-red-200"><AlertTriangle size={14} className="shrink-0" />{refreshError}</p> : null}
      {result ? <div role="status" className="space-y-3 border-l-2 border-emerald-400 bg-emerald-400/10 px-3 py-3 text-xs text-emerald-100" data-testid="paste-result">
        <p className="flex gap-2"><CheckCircle2 size={14} className="shrink-0" />{result.savedCount} ilan kaydedildi, {result.duplicateCount} yineleme atlandı. Mesaj gönderilmedi{result.messagesSent ? " (sunucu aksini bildirdi, kontrol edin)" : ""}; ticari onay verilmedi{result.approvalGranted ? " (sunucu aksini bildirdi, kontrol edin)" : ""}.</p>
        {result.items.length ? <ul className="divide-y divide-border border border-border bg-background text-foreground/75">
          {result.items.map((it) => <li key={it.id} className="px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{roleLabels[it.role] ?? it.role}</span>
              <span>{it.origin || "?"} → {it.destination || "?"}</span>
              {it.isTest ? <span className="border border-amber-400 px-1.5 font-mono text-[10px] text-amber-300">TEST</span> : null}
              <span className={`font-mono text-[10px] uppercase ${it.eligible ? "text-emerald-300" : "text-foreground/45"}`}>{it.eligible ? "Eşleşmeye uygun" : "Eşleşmeye uygun değil"}</span>
            </div>
            {it.missing.length ? <p className="mt-1 text-[11px] text-foreground/55">Eksik: {it.missing.join(", ")}</p> : null}
          </li>)}
        </ul> : null}
      </div> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || (!frozen && !consent)} data-testid="button-submit-paste"
          className="flex items-center gap-2 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          {frozen ? <RefreshCw size={14} className={pending ? "animate-spin" : ""} /> : null}
          {pending ? "Gönderiliyor…" : frozen ? "Aynı isteği tekrar gönder" : "İlanları havuza kaydet"}
        </button>
        {frozen && !pending ? <button type="button" onClick={unlock} className="border border-border px-4 py-3 text-sm text-foreground/70 hover:text-foreground" data-testid="button-edit-paste">Düzenle (yeni istek)</button> : null}
      </div>
    </form>
  </section>;
}
