import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import type { LogisticsPoolAction, LogisticsPoolEntry, LogisticsPoolMatch, LogisticsPoolSource, LogisticsPoolWorkspace } from "@workspace/api-client-react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock, Database, Globe, History, Link2, Lock, Mail, RefreshCw, XCircle } from "lucide-react";
import { Feedback, Field, Pill, btnGhost, btnPrimary, describeError, fmtDateTime, inputCls } from "@/components/logistics-ops/shared";

export type Act = (data: LogisticsPoolAction) => Promise<LogisticsPoolWorkspace>;

export const roleLabels: Record<string, string> = { buyer: "Alıcı", seller: "Satıcı", carrier: "Taşıyıcı", load: "Yük" };
const roleTone: Record<string, string> = {
  buyer: "border-sky-400/40 text-sky-300",
  seller: "border-amber-400/40 text-amber-300",
  carrier: "border-emerald-400/40 text-emerald-300",
  load: "border-primary/50 text-primary",
};
export const matchLabels: Record<string, string> = { pending: "Kurucu incelemesi bekliyor", approved: "Onaylandı (taslak)", rejected: "Reddedildi", stale: "Güncelliğini yitirdi" };
const matchTone: Record<string, string> = {
  pending: "border-primary/50 text-primary",
  approved: "border-emerald-400/40 text-emerald-300",
  rejected: "border-red-400/40 text-red-300",
  stale: "border-border text-foreground/45",
};

export function RoleBadge({ role }: { role: string }) {
  return <Pill className={roleTone[role] ?? "border-border"}>{roleLabels[role] ?? role}</Pill>;
}
export function TestBadge() {
  return <Pill className="border-yellow-400/50 bg-yellow-400/10 text-yellow-200">TEST</Pill>;
}

function route(e: LogisticsPoolEntry) {
  if (e.origin || e.destination) return `${e.origin || "?"} → ${e.destination || "?"}`;
  return e.location || "Konum belirtilmemiş";
}

export function EntryRow({ entry }: { entry: LogisticsPoolEntry }) {
  return (
    <li className={`min-w-0 px-4 py-3 ${entry.active ? "" : "opacity-55"}`} data-testid={`row-entry-${entry.id}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <RoleBadge role={entry.role} />
        {entry.isTest ? <TestBadge /> : null}
        {!entry.active ? <Pill className="border-border text-foreground/50">Pasif</Pill> : null}
        {entry.verified ? <Pill className="border-emerald-400/40 text-emerald-300">Doğrulanmış kayıt</Pill> : <Pill className="border-border text-foreground/50">Aday / doğrulanmadı</Pill>}
        {!entry.eligible ? <Pill className="border-red-400/40 text-red-300">Eşleşmeye uygun değil</Pill> : null}
      </div>
      <p className="mt-1.5 break-words text-sm font-semibold">{entry.name}</p>
      <p className="break-words text-xs text-foreground/55">{route(entry)}{entry.transportMode ? ` · ${entry.transportMode}` : ""}</p>
      <p className="mt-0.5 break-words font-mono text-[10px] text-foreground/40">
        {entry.sourceKind}{entry.reference ? ` · ${entry.reference}` : ""}
        {entry.capacityKg != null ? ` · kapasite ${entry.capacityKg} kg` : ""}
        {entry.requiredKg != null ? ` · ihtiyaç ${entry.requiredKg} kg` : ""}
        {entry.products.length ? ` · ${entry.products.join(", ")}` : ""}
        {` · son görülme ${fmtDateTime(entry.lastSeenAt)}`}
      </p>
    </li>
  );
}

export function MatchListItem({ match, entries, selected, onSelect }: { match: LogisticsPoolMatch; entries: Map<string, LogisticsPoolEntry>; selected: boolean; onSelect: () => void }) {
  const parts = match.entryIds.map((id) => entries.get(id));
  const isTest = parts.some((p) => p?.isTest);
  return (
    <li>
      <button type="button" onClick={onSelect} data-testid={`row-match-${match.id}`}
        className={`w-full min-w-0 px-4 py-3 text-left transition-colors ${selected ? "bg-primary/10 shadow-[inset_2px_0_0_hsl(var(--primary))]" : "hover:bg-card"}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-primary">Skor {match.score}</span>
          <Pill className={matchTone[match.status]}>{matchLabels[match.status]}</Pill>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">{parts.map((p, i) => p ? <RoleBadge key={i} role={p.role} /> : null)}{isTest ? <TestBadge /> : null}</div>
        <p className="mt-1 truncate text-sm font-semibold">{parts.map((p) => p?.name ?? "Kayıt bulunamadı").join(" + ")}</p>
        {match.missing.length ? <p className="mt-0.5 text-xs text-[#f08a8a]">{match.missing.length} eksik bilgi</p> : null}
      </button>
    </li>
  );
}

export function MatchDetail({ match, latest, entries, canApprove, note, setNote, act, onReload, onClose }: {
  match: LogisticsPoolMatch; latest: LogisticsPoolMatch | undefined; entries: Map<string, LogisticsPoolEntry>; canApprove: boolean;
  note: string; setNote: (v: string) => void; act: Act; onReload: () => void; onClose: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const changed = !latest || latest.version !== match.version || latest.status !== match.status;
  const parts = match.entryIds.map((id) => ({ id, e: entries.get(id) }));

  async function review(decision: "approved" | "rejected") {
    setError(null); setOk(null);
    if (note.trim().length < 3) { setError("Not en az 3 karakter olmalı."); return; }
    if (decision === "approved" && !confirmed) { setError("Onay için bilgilerin kontrol edildiğini işaretleyin."); return; }
    setBusy(decision);
    try {
      await act({ action: "review", id: match.id, expectedVersion: match.version, decision, note: note.trim(), ...(decision === "approved" ? { informationConfirmed: true } : {}) });
      setOk(decision === "approved" ? "Onay kaydedildi. Hiçbir mesaj gönderilmedi." : "Ret kaydedildi.");
      setNote(""); setConfirmed(false); onReload();
    } catch (err) {
      setError(describeError(err));
    } finally { setBusy(null); }
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Eşleşme adayı · sürüm {match.version}</p>
          <h2 className="mt-1 break-words text-xl font-semibold">{parts.map((p) => p.e?.name ?? "Kayıt bulunamadı").join(" + ")}</h2>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 text-xs text-foreground/50 hover:text-primary lg:hidden" data-testid="button-close-match">Listeye dön</button>
      </div>

      {changed ? (
        <div className="flex flex-col gap-2 border-l-2 border-primary bg-primary/10 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between" role="status">
          <span>{latest ? `Sunucuda daha yeni sürüm var (${latest.version}, ${matchLabels[latest.status]}). Gösterilen sürüm sabitlendi.` : "Bu eşleşme artık havuzda değil. Gösterilen kayıt son görülen sürümdür."}</span>
          <button type="button" onClick={onReload} className={btnGhost} data-testid="button-reload-match"><RefreshCw size={12} />Güncel sürümü yükle</button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Pill className={matchTone[match.status]}>{matchLabels[match.status]}</Pill>
        <span className="font-mono text-sm">Sezgisel skor {match.score}</span>
        <span className="text-[11px] text-foreground/45">Skor bir olasılık değildir; yalnız kural tabanlı uyum sıralamasıdır.</span>
      </div>

      <section className="grid min-w-0 gap-3 md:grid-cols-2">
        {parts.map(({ id, e }) => e ? (
          <div key={id} className="min-w-0 border border-border bg-background/40 p-3">
            <div className="flex flex-wrap gap-1"><RoleBadge role={e.role} />{e.isTest ? <TestBadge /> : null}{!e.verified ? <Pill className="border-border text-foreground/50">Aday</Pill> : null}</div>
            <p className="mt-1.5 break-words font-semibold">{e.name}</p>
            <p className="break-words text-xs text-foreground/55">{route(e)}</p>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
              {e.transportMode ? <><dt className="text-foreground/45">Mod</dt><dd>{e.transportMode}</dd></> : null}
              {e.capacityKg != null ? <><dt className="text-foreground/45">Kapasite</dt><dd>{e.capacityKg} kg</dd></> : null}
              {e.requiredKg != null ? <><dt className="text-foreground/45">İhtiyaç</dt><dd>{e.requiredKg} kg</dd></> : null}
              {e.availableDate ? <><dt className="text-foreground/45">Uygun tarih</dt><dd>{e.availableDate}</dd></> : null}
              {e.requiredDate ? <><dt className="text-foreground/45">İstenen tarih</dt><dd>{e.requiredDate}</dd></> : null}
              {e.products.length ? <><dt className="text-foreground/45">Ürün</dt><dd className="break-words">{e.products.join(", ")}</dd></> : null}
              <dt className="text-foreground/45">Kaynak</dt><dd className="break-words">{e.sourceKind}{e.reference ? ` · ${e.reference}` : ""}</dd>
              {e.contact ? <><dt className="flex items-center gap-1 text-foreground/45"><Lock size={10} />İletişim</dt><dd className="break-words">{e.contact}</dd></> : null}
            </dl>
            {e.sourceUrl ? <a href={e.sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 break-all text-[11px] text-primary hover:underline">Kaynak kaydı<ArrowUpRight size={11} /></a> : null}
          </div>
        ) : <p key={id} className="border border-dashed border-border p-3 text-xs text-foreground/50">Kayıt {id} artık havuzda değil.</p>)}
      </section>
      <p className="text-[11px] text-foreground/45"><Lock size={10} className="mr-1 inline" />İletişim bilgileri yalnız iç kullanım içindir; paylaşmayın.</p>

      <section className="grid min-w-0 gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">Neden eşleşti</h3>
          {match.reasons.length ? <ul className="mt-2 space-y-1 text-sm">{match.reasons.map((r, i) => <li key={i} className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" /><span className="break-words">{r}</span></li>)}</ul> : <p className="mt-2 text-xs text-foreground/50">Gerekçe bildirilmedi.</p>}
        </div>
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">Eksik bilgi</h3>
          {match.missing.length ? <ul className="mt-2 space-y-1 text-sm">{match.missing.map((r, i) => <li key={i} className="flex gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#f08a8a]" /><span className="break-words">{r}</span></li>)}</ul> : <p className="mt-2 text-xs text-foreground/50">Bildirilen eksik yok.</p>}
        </div>
      </section>

      <section>
        <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55"><Mail size={12} />Tanıştırma taslağı (gönderilmedi)</h3>
        <pre className="mt-2 whitespace-pre-wrap break-words border border-border bg-background/50 p-3 font-sans text-sm leading-6" data-testid="text-introduction">{match.introduction || "Taslak yok."}</pre>
        <p className="mt-1 text-[11px] text-foreground/45">Bu yalnız bir metin taslağıdır. Sistem e-posta veya mesaj göndermez; teklif, sözleşme, ödeme veya sevkiyat oluşturmaz.</p>
      </section>

      {canApprove ? (
        match.status === "pending" && !changed ? (
          <section className="space-y-3 border border-border bg-background/40 p-4">
            <h3 className="text-sm font-semibold">Kurucu incelemesi</h3>
            <Field label="İnceleme notu" hint="3–2000 karakter. Kaydedilip zaman çizelgesine eklenir.">
              <textarea className={`${inputCls} min-h-[90px]`} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} aria-label="İnceleme notu" data-testid="input-review-note" />
            </Field>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" data-testid="checkbox-information-confirmed" />
              <span>Taraf bilgilerini ve kaynakları kontrol ettim. Onay yalnız tanıştırma taslağını kabul eder; nihai operasyon yetkileri mevcut süreçte kalır.</span>
            </label>
            {error ? <Feedback kind="error">{error}</Feedback> : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => void review("approved")} data-testid="button-approve-match"><CheckCircle2 size={14} />{busy === "approved" ? "Kaydediliyor" : "Onayla"}</button>
              <button type="button" className={btnGhost} disabled={busy !== null} onClick={() => void review("rejected")} data-testid="button-reject-match"><XCircle size={14} />{busy === "rejected" ? "Kaydediliyor" : "Reddet"}</button>
            </div>
          </section>
        ) : null
      ) : <p className="border border-dashed border-border p-3 text-xs text-foreground/55">İnceleme kararı yalnız kurucuya açıktır. Bu ekranda görüntüleyebilirsiniz.</p>}
      {ok ? <Feedback kind="success">{ok}</Feedback> : null}

      <section>
        <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55"><History size={12} />Zaman çizelgesi</h3>
        {match.reviewedAt ? <p className="mt-1 text-xs text-foreground/55">İnceleyen {match.reviewedBy ?? "bilinmiyor"} · {fmtDateTime(match.reviewedAt)}</p> : null}
        {match.events.length ? (
          <ol className="mt-2 space-y-2 border-l border-border pl-4">
            {[...match.events].reverse().map((ev, i) => (
              <li key={i} className="text-xs">
                <span className="font-mono text-foreground/45">{fmtDateTime(ev.at)}</span> · <span className="font-semibold">{ev.action}</span>{ev.actorUserId ? <span className="text-foreground/45"> · {ev.actorUserId}</span> : null}
                {ev.note ? <p className="mt-0.5 break-words text-foreground/65">{ev.note}</p> : null}
              </li>
            ))}
          </ol>
        ) : <p className="mt-2 text-xs text-foreground/50">Kayıtlı olay yok.</p>}
      </section>

      <Link href="/staff/lojistik-operasyon" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary hover:underline" data-testid="link-operations-from-match">
        <Link2 size={12} />Yük işlemleri için lojistik operasyon masası
      </Link>
    </div>
  );
}

function SourceCard({ source, canApprove, act }: { source: LogisticsPoolSource; canApprove: boolean; act: Act }) {
  const [busy, setBusy] = useState<"toggle" | "sync" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(kind: "toggle" | "sync") {
    setBusy(kind); setError(null);
    try {
      await act(kind === "toggle" ? { action: "source_update", id: source.id, expectedVersion: source.version, enabled: !source.enabled } : { action: "source_sync", id: source.id });
    } catch (err) { setError(describeError(err)); } finally { setBusy(null); }
  }
  return (
    <li className="min-w-0 border border-border bg-card p-4" data-testid={`card-source-${source.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words font-semibold">{source.name}</p>
        <Pill className={source.enabled ? "border-emerald-400/40 text-emerald-300" : "border-border text-foreground/50"}>{source.enabled ? "Etkin" : "Devre dışı"}</Pill>
      </div>
      <p className="mt-1 break-all font-mono text-[11px] text-foreground/50">{source.url}</p>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-xs">
        <dt className="text-foreground/45">Son deneme</dt><dd>{source.lastAttemptAt ? fmtDateTime(source.lastAttemptAt) : "Henüz yok"}</dd>
        <dt className="text-foreground/45">Son başarı</dt><dd>{source.lastSuccessAt ? fmtDateTime(source.lastSuccessAt) : "Henüz yok"}</dd>
        <dt className="text-foreground/45">Sürüm</dt><dd>{source.version}</dd>
      </dl>
      {source.lastError ? <p className="mt-2 break-words border-l-2 border-red-400 bg-red-400/10 px-2 py-1 text-xs text-red-200" role="alert">Son hata: {source.lastError}</p> : null}
      {error ? <div className="mt-2"><Feedback kind="error">{error}</Feedback></div> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnGhost} disabled={busy !== null || !source.enabled} onClick={() => void run("sync")} data-testid={`button-sync-source-${source.id}`}><RefreshCw size={12} className={busy === "sync" ? "animate-spin" : ""} />Şimdi içe aktar</button>
        {canApprove ? <button type="button" className={btnGhost} disabled={busy !== null} onClick={() => void run("toggle")} data-testid={`button-toggle-source-${source.id}`}>{source.enabled ? "Devre dışı bırak" : "Etkinleştir"}</button> : null}
      </div>
    </li>
  );
}

const schemaExample = `{
  "items": [
    {
      "id": "kayit-001",
      "role": "carrier",
      "name": "Firma adı",
      "origin": "Mersin",
      "destination": "Odesa",
      "transportMode": "road",
      "capacityKg": 22000,
      "availableDate": "2025-07-14"
    }
  ]
}`;

export function SourcesPanel({ data, act }: { data: LogisticsPoolWorkspace; act: Act }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null); setOk(null);
    const n = name.trim(), u = url.trim();
    if (n.length < 2) return setError("Kaynak adı en az 2 karakter olmalı.");
    let parsed: URL | null = null;
    try { parsed = new URL(u); } catch { parsed = null; }
    if (!parsed || parsed.protocol !== "https:") return setError("Adres https:// ile başlayan geçerli bir URL olmalı.");
    if (!consent) return setError("Kaynağı kullanma izninin olduğunu onaylayın.");
    setBusy(true);
    try {
      await act({ action: "source_create", name: n, url: u, consentConfirmed: true });
      setOk("Kaynak kaydedildi."); setName(""); setUrl(""); setConsent(false);
    } catch (err) { setError(describeError(err)); } finally { setBusy(false); }
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <section className="min-w-0 space-y-3">
        <div className="border border-border bg-card p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold"><Database size={14} className="text-primary" />İç kayıtlar</p>
          <p className="mt-1 text-xs leading-6 text-foreground/60">Mevcut onaylı yük talepleri ve taşıyıcı kayıtları kurulum gerekmeden havuza eklenir. URL gerekmez.</p>
        </div>
        <h2 className="flex items-center gap-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55"><Globe size={12} />Dış kaynaklar ({data.sources.length})</h2>
        {data.sources.length ? (
          <ul className="grid min-w-0 gap-3 md:grid-cols-2">{data.sources.map((s) => <SourceCard key={`${s.id}-${s.version}`} source={s} canApprove={data.canApprove} act={act} />)}</ul>
        ) : (
          <p className="border border-dashed border-border p-6 text-center text-sm text-foreground/55">Kayıtlı dış kaynak yok. Havuz şu an yalnız iç kayıtlardan oluşur.</p>
        )}
      </section>
      <section className="min-w-0 border border-border bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Yeni dış besleme</p>
        <h2 className="mb-1 mt-1 text-lg font-semibold">Yetkili JSON kaynağı ekle</h2>
        <p className="mb-4 text-xs leading-5 text-foreground/55">Yalnız herkese açık, HTTPS üzerinden sunulan ve kullanma izniniz olan JSON beslemeleri. Web kazıma veya API anahtarı desteklenmez.</p>
        {data.canApprove ? (
          <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
            <Field label="Kaynak adı"><input className={inputCls} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} aria-label="Kaynak adı" data-testid="input-source-name" /></Field>
            <Field label="Besleme adresi (HTTPS)"><input className={inputCls} type="url" inputMode="url" value={url} maxLength={2000} placeholder="https://" onChange={(e) => setUrl(e.target.value)} aria-label="Besleme adresi" data-testid="input-source-url" /></Field>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" data-testid="checkbox-source-consent" />
              <span>Bu kaynağın sahibi verilerin bu amaçla kullanılmasına izin verdi ve içerikteki kişiler bilgilendirildi.</span>
            </label>
            {error ? <Feedback kind="error">{error}</Feedback> : null}
            {ok ? <Feedback kind="success">{ok}</Feedback> : null}
            <button type="submit" className={btnPrimary} disabled={busy} data-testid="button-create-source">{busy ? "Kaydediliyor" : "Kaynağı kaydet"}</button>
          </form>
        ) : <p className="border border-dashed border-border p-3 text-xs text-foreground/55">Kaynak eklemek ve etkinleştirmek yalnız kurucuya açıktır.</p>}
        <details className="mt-5 text-xs">
          <summary className="cursor-pointer font-semibold text-foreground/70">Beklenen JSON biçimi</summary>
          <p className="mt-2 leading-5 text-foreground/55">Kök nesne <code>items</code> dizisi içermeli. Zorunlu: <code>id</code>, <code>role</code> (buyer, seller, carrier, load), <code>name</code>. İsteğe bağlı: location, origin, destination, products (metin dizisi), transportMode (road, sea, air, rail), capacityKg, requiredKg, availableDate ve requiredDate (YYYY-AA-GG), contact, reference, sourceUrl, isTest. Eksik alanlı kayıtlar doğrulanmamış aday olarak kalır.</p>
          <pre className="mt-2 overflow-x-auto border border-border bg-background/60 p-3 font-mono text-[11px]">{schemaExample}</pre>
        </details>
      </section>
    </div>
  );
}

export function Freshness({ at }: { at: number }) {
  return <span className="inline-flex items-center gap-1"><Clock size={11} />{at ? new Date(at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "henüz yok"}</span>;
}
