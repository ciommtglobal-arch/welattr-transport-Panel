import { useState } from "react";
import {
  confirmMediaPublication,
  decideMediaItem,
  publishMediaItem,
  recordMediaPublication,
  requestMediaItemDownloadUrl,
  reviewMediaItem,
  submitMediaItem,
  type MediaItem,
  type MediaItemPagePermissions,
} from "@workspace/api-client-react";

type Props = {
  item: MediaItem;
  permissions: MediaItemPagePermissions;
  onChange: () => void;
};

export function MediaApprovalActions({ item, permissions, onChange }: Props) {
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [results, setResults] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
      setNote("");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    } finally {
      setBusy(false);
    }
  }

  const realApproved = item.status === "approved" && item.pilotType === "pilot_real";
  async function downloadAttachment() {
    await run(async () => {
      const file = await requestMediaItemDownloadUrl(item.id);
      window.open(file.downloadURL, "_blank", "noopener,noreferrer");
    }, "Dosya yeni sekmede açıldı.");
  }

  return (
    <section className="border border-border bg-card p-5 sm:p-6">
      <h3 className="text-lg font-semibold">İnceleme ve yayın</h3>
      <p className="mt-2 text-sm text-foreground/65">
        Taslak → medya sorumlusu → kurucu → gerçek yayın. Kurucu onayı yayına çıktığı anlamına gelmez.
      </p>
      {item.pilotType === "test" && (
        <p className="mt-4 border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          TEST içeriği: onaylansa bile dışarı gönderilemez ve yayımlandı olarak kaydedilemez.
        </p>
      )}
      {item.hasFile && <button disabled={busy} onClick={downloadAttachment}
        className="mt-4 border border-border px-4 py-3 text-sm font-semibold disabled:opacity-50">
        Eki incele: {item.fileName || "Medya dosyası"}
      </button>}
      {(item.status === "media_review" && permissions.canReview ||
        item.status === "founder_review" && permissions.canApprove) && (
        <label className="mt-5 block text-sm">
          Karar notu (iade için zorunlu)
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={2}
            className="mt-2 w-full border border-input bg-background p-3" />
        </label>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        {item.status === "draft" && permissions.canCreate && (
          <button disabled={busy} onClick={() => run(() => submitMediaItem(item.id), "Medya incelemesine gönderildi.")}
            className="bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            Medya incelemesine gönder
          </button>
        )}
        {item.status === "media_review" && permissions.canReview && (
          <>
            <button disabled={busy} onClick={() => run(() => reviewMediaItem(item.id, { decision: "approve", note: note || undefined }), "Kurucu incelemesine gönderildi.")}
              className="bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">Kurucuya gönder</button>
            <button disabled={busy || !note.trim()} onClick={() => run(() => reviewMediaItem(item.id, { decision: "reject", note }), "Taslağa iade edildi.")}
              className="border border-border px-4 py-3 text-sm disabled:opacity-50">Gerekçeyle iade et</button>
          </>
        )}
        {item.status === "founder_review" && permissions.canApprove && (
          <>
            <button disabled={busy} onClick={() => run(() => decideMediaItem(item.id, { decision: "approve", note: note || undefined }), "Kurucu onayı kaydedildi; henüz yayımlanmadı.")}
              className="bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">Kurucu olarak onayla</button>
            <button disabled={busy || !note.trim()} onClick={() => run(() => decideMediaItem(item.id, { decision: "reject", note }), "Taslağa iade edildi.")}
              className="border border-border px-4 py-3 text-sm disabled:opacity-50">Gerekçeyle iade et</button>
          </>
        )}
      </div>
      {realApproved && permissions.canPublish && (
        <div className="mt-6 border-t border-border pt-5">
          <h4 className="font-semibold">Gerçek yayın kaydı</h4>
          <p className="mt-2 text-sm text-foreground/65">
            İçeriği kendi sosyal hesabınızda manuel yayımladıktan sonra gerçek gönderi bağlantısını kaydedin.
          </p>
          <label className="mt-4 block text-sm">
            Yayın bağlantısı (HTTPS)
            <input type="url" required value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://..." className="mt-2 w-full border border-input bg-background p-3" />
          </label>
          <label className="mt-4 block text-sm">
            Sonuçlar / notlar
            <textarea value={results} onChange={e => setResults(e.target.value)} maxLength={2000} rows={2}
              className="mt-2 w-full border border-input bg-background p-3" />
          </label>
          <button disabled={busy || !url.startsWith("https://")} onClick={() => run(() => recordMediaPublication(item.id, { url, results }), "Bağlantı kaydedildi; kurucu teyidinden önce yayımlandı sayılmaz.")}
            className="mt-4 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            Manuel yayını kaydet
          </button>
          {permissions.canApprove && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs text-foreground/60">Telegram kanalı yapılandırılmışsa bu düğme gerçek gönderim yapar. TEST içeriklerinde kullanılamaz.</p>
              <button disabled={busy} onClick={() => run(() => publishMediaItem(item.id), "Telegram gönderimi doğrulandı ve yayın kaydedildi.")}
                className="mt-3 border border-primary px-4 py-3 text-sm font-semibold text-primary disabled:opacity-50">
                Kurucu olarak Telegram'da gerçekten yayınla
              </button>
            </div>
          )}
        </div>
      )}
      {item.status === "publication_pending" && (
        <div className="mt-5 border-t border-border pt-5">
          <p className="text-sm text-foreground/70">Manuel yayın bağlantısı girildi; gerçek gönderiyi kurucu kontrol edene kadar “Yayında” gösterilmez.</p>
          {item.publicationUrl && <a href={item.publicationUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3 block break-all text-sm text-primary underline">Gerçek gönderi bağlantısını aç ve kontrol et</a>}
          {permissions.canApprove && <button disabled={busy} onClick={() => run(() => confirmMediaPublication(item.id), "Kurucu gerçek yayını teyit etti.")}
            className="mt-4 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            Gönderiyi ve yetkili hesabı kontrol ettim — yayını teyit et
          </button>}
        </div>
      )}
      {message && <p role="status" className="mt-4 text-sm text-emerald-600">{message}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    </section>
  );
}