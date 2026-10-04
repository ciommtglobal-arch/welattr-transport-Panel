import { FormEvent, useRef, useState } from "react";
import { CompanyFundAmendmentForm } from "./company-fund-amendment-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  getGetCompanyInstructionsQueryKey,
  getGetCompanyRecordStatusQueryKey,
  useCreateCompanyFundRecord,
  useGetCompanyRecordStatus,
  type CompanyFundInput,
} from "@workspace/api-client-react";

const PAGE_SIZE = 20;
const DEFAULT_OP = "Kredi / Fon Kaydı";
const CURRENCIES = ["TRY", "EUR", "USD"] as const;
type Currency = (typeof CURRENCIES)[number];
const AMOUNT_RE = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/;

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

function errStatus(e: unknown): number | undefined {
  if (typeof e === "object" && e !== null && "status" in e) {
    const s = (e as { status?: unknown }).status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

/** String-only grouping: "1234567.5" -> "1.234.567,50". No float conversion. */
function formatAmount(raw: string): string {
  const [int = "0", frac = ""] = raw.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${grouped},${(frac + "00").slice(0, 2)}`;
}

function normalizeAmount(input: string): string {
  return input.trim().replace(",", ".");
}

export function CompanyFundRecords({
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
  const params = {
    fon_limit: PAGE_SIZE,
    fon_offset: offset,
    talimat_limit: 1,
    talimat_offset: 0,
  };
  const query = useGetCompanyRecordStatus(params, {
    query: {
      queryKey: [...getGetCompanyRecordStatusQueryKey(params), companyScope],
      enabled: canView,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
    },
  });
  const create = useCreateCompanyFundRecord();
  const [islem, setIslem] = useState(DEFAULT_OP);
  const [kurum, setKurum] = useState("");
  const [miktar, setMiktar] = useState("");
  const [para, setPara] = useState<Currency>("TRY");
  const [aciklama, setAciklama] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshError, setRefreshError] = useState(false);
  const lock = useRef(false);
  const keyRef = useRef<{ sig: string; key: string } | null>(null);
  const pending = create.isPending;
  const [amending, setAmending] = useState<{ id: number; kind: "duzeltme" | "iptal" } | null>(null);

  const data = query.data;
  const list = data?.fon_havuzu ?? [];
  const totalFon = data?.toplam_fon_islem ?? 0;
  const totalTalimat = data?.toplam_talimat ?? 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || pending) return;
    setSuccess("");
    setRefreshError(false);
    setSaveError("");

    const o = islem.trim();
    const k = kurum.trim();
    const m = normalizeAmount(miktar);
    const errs: string[] = [];
    if (o.length < 2 || o.length > 100)
      errs.push("İşlem türü 2 ile 100 karakter arasında olmalıdır.");
    if (k.length < 2 || k.length > 200)
      errs.push("Kurum adı 2 ile 200 karakter arasında olmalıdır.");
    if (!AMOUNT_RE.test(m) || /^0(\.0{1,2})?$/.test(m))
      errs.push(
        "Tutar sıfırdan büyük olmalı, en çok iki ondalık içermeli ve binlik ayırıcı ya da bilimsel gösterim kullanmamalıdır (örn. 1250,50).",
      );
    else if (m.length > 15)
      errs.push("Tutar en fazla 999999999999,99 olabilir.");
    if (aciklama.length > 8000)
      errs.push("Açıklama en fazla 8000 karakter olabilir.");
    setErrors(errs);
    if (errs.length) return;

    const [whole, fraction = ""] = m.split(".");
    const body = {
      islem_turu: o, miktar: `${whole}.${fraction.padEnd(2, "0")}`,
      para_birimi: para, kurum: k, aciklama: aciklama.trim(),
    };
    const sig = JSON.stringify(body);
    if (!keyRef.current || keyRef.current.sig !== sig) {
      keyRef.current = { sig, key: crypto.randomUUID() };
    }
    const payload: CompanyFundInput = {
      ...body,
      istek_anahtari: keyRef.current.key,
    };

    lock.current = true;
    try {
      const res = await create.mutateAsync({ data: payload });
      keyRef.current = null;
      setIslem(DEFAULT_OP);
      setKurum("");
      setMiktar("");
      setPara("TRY");
      setAciklama("");
      setSuccess(res.mesaj || "Kayıt şirket içi kayıt olarak eklendi.");
      setOffset(0);
      try {
        await Promise.all([
          queryClient.invalidateQueries(
            { queryKey: getGetCompanyRecordStatusQueryKey() },
            { throwOnError: true },
          ),
          queryClient.invalidateQueries(
            { queryKey: getGetCompanyInstructionsQueryKey() },
            { throwOnError: true },
          ),
        ]);
      } catch {
        setRefreshError(true);
      }
    } catch (e) {
      if (errStatus(e) === 409) {
        setSaveError(
          "Bu istek anahtarı daha önce başka bir içerikle kullanılmış olabilir. Bilerek değiştirilmiş bir taslak yeni bir istek anahtarıyla gönderilir; metniniz korundu. Kayıt listesini kontrol edin.",
        );
      } else {
        setSaveError(
          errMessage(
            e,
            "Kayıt kaydedilemedi. Girdiğiniz bilgiler korundu; aynı taslağı tekrar gönderebilirsiniz.",
          ),
        );
      }
    } finally {
      lock.current = false;
    }
  }

  const field =
    "mt-2 w-full border border-border/70 bg-background px-3 py-3 text-sm outline-none focus:border-primary disabled:opacity-60";
  const label = "block text-xs font-bold uppercase tracking-[0.12em]";

  return (
    <section
      className="border border-border/70 bg-card p-6 md:p-8"
      aria-labelledby="fon-kayitlari-title"
    >
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
        <Landmark size={14} />
        Fon ve kredi kayıtları
      </p>
      <h2 id="fon-kayitlari-title" className="mt-3 text-2xl font-semibold">
        Kurum içi fon / kredi kaydı
      </h2>
      <p className="mt-3 max-w-3xl border border-border/70 bg-background p-4 text-xs leading-6 text-foreground/65">
        Bu alan yalnızca şirket içi kayıttır. Gerçek bir kredi tahsisi, ödeme
        veya transfer, teminat, dijital imza, resmi mühür ya da onay anlamına
        gelmez. Özgün kayıtlar değiştirilemez ve silinmez. Yalnızca aktif firma
        sahibi gerekçeli düzeltme veya iptal kaydı ekleyebilir. Güncel durumu
        yalnızca iç kayıt durumudur; finansal bakiye veya kredi onayı değildir. WelatTR ve
        Çelik Kubbe yalnızca atıf etiketleridir.
      </p>

      {accessError ? (
        <div role="alert" className="mt-6 space-y-3 text-sm">
          <p>Firma yetkisi kontrol edilemedi. Bu, yetkinizin olmadığı anlamına gelmez.</p>
          <button type="button" onClick={onRetryAccess} className="border border-border px-4 py-2">
            Yetki kontrolünü yeniden dene
          </button>
        </div>
      ) : resolving ? (
        <p role="status" className="mt-6 flex items-center gap-2 text-sm text-foreground/65">
          <Loader2 size={15} className="animate-spin" />
          Yetkiniz doğrulanıyor...
        </p>
      ) : !canView ? (
        <p className="mt-6 text-sm text-foreground/65">
          Fon ve kredi kayıtlarını yalnızca aktif firma sahibi, sistem/ekip
          yöneticisi ve alan lideri görüntüleyebilir.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {data?.canCreate ? (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="space-y-4 border border-border/70 p-5"
              aria-busy={pending}
            >
              <fieldset disabled={pending} className="space-y-4">
                <legend className="text-sm font-semibold">Yeni kayıt</legend>
                <label className={label}>
                  İşlem türü
                  <input className={field} value={islem} maxLength={100} onChange={(e) => setIslem(e.target.value)} />
                </label>
                <label className={label}>
                  Kurum adı
                  <input className={field} value={kurum} maxLength={200} onChange={(e) => setKurum(e.target.value)} />
                </label>
                <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
                  <label className={label}>
                    Tutar
                    <input
                      className={field}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="1250,50"
                      value={miktar}
                      maxLength={16}
                      onChange={(e) => setMiktar(e.target.value)}
                    />
                  </label>
                  <label className={label}>
                    Para birimi
                    <select className={field} value={para} onChange={(e) => setPara(e.target.value as Currency)}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={label}>
                  Açıklama (isteğe bağlı)
                  <textarea className={field} rows={4} value={aciklama} maxLength={8000} onChange={(e) => setAciklama(e.target.value)} />
                </label>
              </fieldset>
              {errors.length ? (
                <ul role="alert" className="space-y-1 border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground/70">
                  {errors.map((m) => (
                    <li key={m} className="flex items-start gap-2">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      {m}
                    </li>
                  ))}
                </ul>
              ) : null}
              {saveError ? (
                <p role="alert" className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground/70">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  {saveError}
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
          ) : data ? (
            <p className="text-xs text-foreground/55">
              Bu hesap kayıtları yalnızca görüntüleyebilir; ekleme, düzeltme ve iptal yetkisi aktif firma sahibine aittir.
            </p>
          ) : null}

          {success ? (
            <div role="status" className="space-y-2 border border-primary/30 bg-primary/10 p-3 text-sm">
              <p className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
                {success}
              </p>
              {refreshError ? (
                <p className="text-xs text-foreground/70">
                  Kayıt kaydedildi; yalnızca liste yenilenemedi. Aynı kaydı tekrar girmeyin, listeyi yeniden yükleyin.
                </p>
              ) : null}
            </div>
          ) : null}

          {query.isLoading ? (
            <div className="space-y-3" role="status" aria-label="Yükleniyor">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : query.isError ? (
            <div role="alert" className="flex flex-col gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm md:flex-row md:items-center md:justify-between">
              <span>{errMessage(query.error, "Kayıtlar yüklenemedi.")}</span>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-border/70 bg-background p-4">
                    <p className="font-mono text-2xl">{totalFon}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/55">Fon / kredi kaydı</p>
                  </div>
                  <div className="border border-border/70 bg-background p-4">
                    <p className="font-mono text-2xl">{totalTalimat}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/55">Talimat kaydı</p>
                  </div>
                </div>
              ) : null}
              {list.length === 0 ? (
                <div className="border border-dashed border-border/70 p-8 text-center text-sm text-foreground/60">
                  <p className="font-semibold text-foreground">Henüz fon / kredi kaydı yok</p>
                  <p className="mt-1">Eklenen kurum içi kayıtlar burada listelenecek.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {list.map((item) => (
                    <li key={item.id} className="border border-border/70 bg-background p-5">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em]">
                        <span className="text-primary">#{item.id} · {item.islem_turu}</span>
                        <span className="border border-border/70 px-2 py-1">
                          {item.guncel_durum === "iptal" ? "İptal edilmiş iç kayıt" : item.guncel_durum === "yerine_gecmis" ? "Yerine yeni kayıt geçmiş" : "Güncel iç kayıt"}
                        </span>
                        <span className="border border-border/70 px-2 py-1 text-foreground/65">Firma içi kayıt</span>
                        <span className="border border-border/70 px-2 py-1 text-foreground/65">WelatTR</span>
                        <span className="border border-border/70 px-2 py-1 text-foreground/65">Çelik Kubbe</span>
                      </div>
                      <h3 className="mt-3 text-base font-semibold break-words">{item.kurum}</h3>
                      <p className="mt-1 font-mono text-lg">
                        {formatAmount(item.miktar)} {item.para_birimi}
                      </p>
                      {item.aciklama ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/75">{item.aciklama}</p>
                      ) : null}
                      <p className="mt-3 text-xs text-foreground/55">
                        {formatTime(item.zaman)} · Oluşturan: {item.olusturan}
                      </p>
                      <p className="mt-1 break-all font-mono text-[10px] text-foreground/40">
                        {item.imza} · {item.ekosistem}
                      </p>
                      {item.duzeltmeler.map((edge) => (
                        <div key={edge.id} className="mt-3 border-l-2 border-primary/50 pl-3 text-xs leading-6">
                          <p className="font-semibold">
                            {edge.tur === "iptal" ? `İptal: kayıt #${edge.onceki_kayit_id}` : `Düzeltme: kayıt #${edge.onceki_kayit_id} → yeni kayıt #${edge.yeni_kayit_id}`}
                          </p>
                          <p className="whitespace-pre-wrap break-words">Gerekçe: {edge.gerekce}</p>
                          <p>{formatTime(edge.zaman)} · Ekleyen: {edge.olusturan}</p>
                          <p className="text-foreground/55">Özgün kayıt korunur; banka işlemi veya para hareketi değildir.</p>
                        </div>
                      ))}
                      {data?.canCreate && item.guncel_durum === "guncel" ? (
                        amending?.id === item.id ? (
                          <CompanyFundAmendmentForm
                            key={`${companyScope}:${item.id}:${amending.kind}`}
                            record={item}
                            kind={amending.kind}
                            onCancel={() => setAmending(null)}
                            onSaved={async () => {
                              setAmending(null);
                              setSuccess("Gerekçeli düzeltme/iptal firma içi kayda eklendi. Özgün kayıt korunuyor; banka işlemi veya para hareketi yapılmadı.");
                              setRefreshError(false);
                              try {
                                await queryClient.invalidateQueries({ queryKey: getGetCompanyRecordStatusQueryKey() }, { throwOnError: true });
                              } catch { setRefreshError(true); }
                            }}
                          />
                        ) : (
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button type="button" onClick={() => { setSuccess(""); setAmending({ id: item.id, kind: "duzeltme" }); }} className="border border-border px-3 py-2 text-xs">Düzeltme ekle</button>
                            <button type="button" onClick={() => { setSuccess(""); setAmending({ id: item.id, kind: "iptal" }); }} className="border border-border px-3 py-2 text-xs">Gerekçeli iptal ekle</button>
                          </div>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {totalFon > PAGE_SIZE || offset > 0 ? (
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
                    {Math.min(offset + 1, totalFon)}-{Math.min(offset + PAGE_SIZE, totalFon)} / {totalFon}
                  </span>
                  <button
                    type="button"
                    disabled={offset + PAGE_SIZE >= totalFon || query.isFetching}
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
