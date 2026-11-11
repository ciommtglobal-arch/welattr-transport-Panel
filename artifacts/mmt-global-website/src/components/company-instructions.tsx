import { FormEvent, useRef, useState } from "react";
import { CompanyRecordExport } from "./company-record-export";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  getGetCompanyInstructionsQueryKey,
  getGetCompanyRecordStatusQueryKey,
  useCreateCompanyInstruction,
  useGetCompanyInstructions,
} from "@workspace/api-client-react";

const PAGE_SIZE = 20;
const DEFAULT_OP = "Resmi Talimat";

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(d);
}

function errMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function CompanyInstructions({
  canView,
  resolving,
  accessError = false,
  onRetryAccess,
  companyScope,
}: {
  canView: boolean;
  resolving: boolean;
  accessError?: boolean;
  onRetryAccess?: () => void;
  companyScope: string;
}) {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const params = { limit: PAGE_SIZE, offset };
  const query = useGetCompanyInstructions(params, {
    query: {
      queryKey: [...getGetCompanyInstructionsQueryKey(params), companyScope],
      enabled: canView,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const create = useCreateCompanyInstruction();
  const [kurum, setKurum] = useState("");
  const [icerik, setIcerik] = useState("");
  const [islem, setIslem] = useState(DEFAULT_OP);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshError, setRefreshError] = useState(false);
  const submitting = useRef(false);
  const pending = create.isPending;

  const data = query.data;
  const list = data?.liste ?? [];
  const total = data?.toplam_talimat ?? 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || submitting.current) return;
    setSuccess("");
    setRefreshError(false);
    const k = kurum.trim();
    const c = icerik.trim();
    const o = islem.trim();
    if (k.length < 2 || k.length > 200) {
      setFormError("Kurum adı 2 ile 200 karakter arasında olmalıdır.");
      return;
    }
    if (c.length < 5 || c.length > 8000) {
      setFormError("Talimat içeriği 5 ile 8000 karakter arasında olmalıdır.");
      return;
    }
    if (o.length < 2 || o.length > 100) {
      setFormError("İşlem türü 2 ile 100 karakter arasında olmalıdır.");
      return;
    }
    setFormError("");
    submitting.current = true;
    try {
      const res = await create.mutateAsync({
        data: { kurum_adi: k, icerik: c, islem_turu: o },
      });
      setKurum("");
      setIcerik("");
      setIslem(DEFAULT_OP);
      setSuccess(res.mesaj || "Talimat kurum kaydına eklendi.");
      setOffset(0);
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetCompanyInstructionsQueryKey() }, { throwOnError: true }),
          queryClient.invalidateQueries({ queryKey: getGetCompanyRecordStatusQueryKey() }, { throwOnError: true }),
        ]);
      } catch {
        setRefreshError(true);
      }
    } catch (e) {
      setFormError(errMessage(e, "Talimat kaydedilemedi. Girdiğiniz metin korundu."));
    } finally {
      submitting.current = false;
    }
  }

  const field =
    "mt-2 w-full border border-border/70 bg-background px-3 py-3 text-sm outline-none focus:border-primary disabled:opacity-60";

  return (
    <section
      className="border border-border/70 bg-card p-6 md:p-8"
      aria-labelledby="kurumsal-talimatlar-title"
    >
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
        <FileText size={14} />
        Kurumsal talimatlar
      </p>
      <h2 id="kurumsal-talimatlar-title" className="mt-3 text-2xl font-semibold">
        Kurum içi talimat kaydı
      </h2>
      <p className="mt-3 max-w-3xl border border-border/70 bg-background p-4 text-xs leading-6 text-foreground/65">
        Bu alan yalnızca şirket içi kayıttır. Dijital imza, resmi yetki
        doğrulaması, dış kuruma gönderim veya otomatik onay anlamına gelmez.
        Kayıtlar düzenlenemez ve silinemez.
      </p>

      {accessError ? (
        <div role="alert" className="mt-6 space-y-3 text-sm">
          <p>Firma yetkisi kontrol edilemedi. Bu, yetkinizin olmadığı anlamına gelmez.</p>
          <button type="button" onClick={onRetryAccess} className="border border-border px-4 py-2">
            Yetki kontrolünü yeniden dene
          </button>
        </div>
      ) : resolving ? (
        <p
          role="status"
          className="mt-6 flex items-center gap-2 text-sm text-foreground/65"
        >
          <Loader2 size={15} className="animate-spin" />
          Yetkiniz doğrulanıyor...
        </p>
      ) : !canView ? (
        <p className="mt-6 text-sm text-foreground/65">
          Kurumsal talimatları yalnızca aktif firma sahibi, sistem/ekip yöneticisi
          ve alan lideri görüntüleyebilir.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <CompanyRecordExport key={companyScope} kind="instructions" />
          {data?.canCreate ? (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 border border-border/70 p-5"
              aria-busy={pending}
            >
              <fieldset disabled={pending} className="space-y-4">
                <legend className="text-sm font-semibold">Yeni talimat</legend>
                <label className="block text-xs font-bold uppercase tracking-[0.12em]">
                  Kurum adı
                  <input
                    className={field}
                    value={kurum}
                    onChange={(e) => setKurum(e.target.value)}
                    maxLength={200}
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-[0.12em]">
                  İşlem türü
                  <input
                    className={field}
                    value={islem}
                    onChange={(e) => setIslem(e.target.value)}
                    maxLength={100}
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-[0.12em]">
                  Talimat içeriği
                  <textarea
                    className={field}
                    rows={6}
                    value={icerik}
                    onChange={(e) => setIcerik(e.target.value)}
                    maxLength={8000}
                  />
                </label>
              </fieldset>
              {formError ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground/70"
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  {formError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.13em] text-primary-foreground disabled:opacity-60"
              >
                {pending ? <Loader2 size={15} className="animate-spin" /> : null}
                {pending ? "Kaydediliyor" : "Kayda ekle"}
              </button>
            </form>
          ) : null}

          {success ? (
            <p
              role="status"
              className="flex items-start gap-2 border border-primary/30 bg-primary/10 p-3 text-sm"
            >
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
              {success}
              {refreshError ? " Talimat kaydedildi; yalnızca liste yenilenemedi. Aynı talimatı tekrar girmeyin, listeyi yeniden yükleyin." : ""}
            </p>
          ) : null}

          {query.isLoading ? (
            <div className="space-y-3" role="status" aria-label="Yükleniyor">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : query.isError ? (
            <div
              role="alert"
              className="flex flex-col gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm md:flex-row md:items-center md:justify-between"
            >
              <span>
                {errMessage(query.error, "Talimatlar yüklenemedi.")}
              </span>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="inline-flex items-center gap-2 border border-border/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.13em]"
              >
                <RefreshCw size={14} />
                Tekrar dene
              </button>
            </div>
          ) : (
            <>
              {data ? (
                <p className="text-xs leading-6 text-foreground/55">
                  Toplam {total} kayıt. Atıf: WelatTR ve Çelik Kubbe
                  etiketleri kayıt sınıflandırmasıdır; dijital imza veya
                  güvenlik sertifikası değildir.
                </p>
              ) : null}
              {list.length === 0 ? (
                <div className="border border-dashed border-border/70 p-8 text-center text-sm text-foreground/60">
                  <p className="font-semibold text-foreground">
                    Henüz talimat kaydı yok
                  </p>
                  <p className="mt-1">
                    Eklenen kurum içi talimatlar burada listelenecek.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {list.map((item) => (
                    <li
                      key={item.id}
                      className="border border-border/70 bg-background p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em]">
                        <span className="text-primary">{item.islem_turu}</span>
                        <span className="border border-border/70 px-2 py-1 text-foreground/65">
                          WelatTR
                        </span>
                        <span className="border border-border/70 px-2 py-1 text-foreground/65">
                          Çelik Kubbe
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-semibold">
                        {item.kurum}
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/75">
                        {item.icerik}
                      </p>
                      <p className="mt-3 text-xs text-foreground/55">
                        {formatTime(item.zaman)} · Oluşturan: {item.olusturan}
                      </p>
                      <p className="mt-1 break-all font-mono text-[10px] text-foreground/40">
                        {item.imza} · {item.ekosistem}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {total > PAGE_SIZE || offset > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={offset === 0 || query.isFetching}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    className="inline-flex items-center gap-2 border border-border/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.13em] disabled:opacity-50"
                  >
                    <ChevronLeft size={14} />
                    Önceki
                  </button>
                  <span className="text-xs text-foreground/55">
                    {Math.min(offset + 1, total)}-
                    {Math.min(offset + PAGE_SIZE, total)} / {total}
                  </span>
                  <button
                    type="button"
                    disabled={offset + PAGE_SIZE >= total || query.isFetching}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    className="inline-flex items-center gap-2 border border-border/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.13em] disabled:opacity-50"
                  >
                    Sonraki
                    <ChevronRight size={14} />
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  );
}
