import { useEffect, useRef, useState, type FormEvent } from "react";
import { exportCompanyRecords } from "@workspace/api-client-react";
import { Download, Loader2 } from "lucide-react";

export function CompanyRecordExport({ kind }: { kind: "funds" | "instructions" }) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date());
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function download(event: FormEvent) {
    event.preventDefault();
    if (controller.current) return;
    setError(""); setSuccess("");
    const days = (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;
    if (!Number.isFinite(days)) { setError("Geçerli başlangıç ve bitiş tarihlerini seçin."); return; }
    if (days < 1) { setError("Bitiş tarihi başlangıçtan önce olamaz."); return; }
    if (days > 92) { setError("En fazla 92 gün seçin; tarih aralığını daraltın."); return; }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      // Direct authenticated request: never retain private files in query cache.
      const file = await exportCompanyRecords(kind, { start, end }, {
        responseType: "blob", cache: "no-store", credentials: "include", signal: abort.signal,
      });
      if (abort.signal.aborted) return;
      if (!(file instanceof Blob) || file.size > 20 * 1024 * 1024) throw new Error("Dosya boyutu sınırı aşıldı. Tarih aralığını daraltın.");
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `firma-ici-${kind}-${start}-${end}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Temporary local URL only, never a public or persistent download link.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSuccess("CSV indirildi. Özel arşivinizde güvenli saklayın.");
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "CSV indirilemedi. Yeniden deneyin.");
    } finally {
      controller.current = null;
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <form onSubmit={download} className="space-y-3 border border-border/70 p-4" aria-busy={busy}>
      <h3 className="text-sm font-semibold">Özel şirket arşivi — CSV indir</h3>
      <p className="text-xs leading-6 text-foreground/65">
        Özgün kayıt tarihine göre tüm sayfalar indirilir. Türkiye saatiyle başlangıç ve bitiş günleri dahildir.
        En fazla 92 gün, 10.000 kayıt ve 20 MiB. Para birimleri ayrı tutulur; tutarlar tam ondalıklıdır.
        Yalnızca şirket içi kayıttır; resmi banka belgesi, mühür, kredi onayı veya finansal güvence değildir.
      </p>
      <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
        <label className="text-xs">Başlangıç tarihi
          <input type="date" required value={start} onChange={(e) => { setStart(e.target.value); setSuccess(""); setError(""); }} className="mt-1 block border border-border bg-background p-2" />
        </label>
        <label className="text-xs">Bitiş tarihi
          <input type="date" required value={end} min={start} onChange={(e) => { setEnd(e.target.value); setSuccess(""); setError(""); }} className="mt-1 block border border-border bg-background p-2" />
        </label>
        <button type="submit" className="inline-flex items-center gap-2 border border-border px-4 py-2 text-xs disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {busy ? "Hazırlanıyor..." : "CSV indir"}
        </button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && <p role="status" className="text-xs">{success}</p>}
    </form>
  );
}