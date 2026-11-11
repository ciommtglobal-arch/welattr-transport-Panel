import { useRef, useState, type FormEvent } from "react";
import { useCreateCompanyFundAmendment, type CompanyFundRecord, type CompanyFundAmendmentInput } from "@workspace/api-client-react";

export function CompanyFundAmendmentForm({
  record, kind, onCancel, onSaved,
}: {
  record: CompanyFundRecord;
  kind: "duzeltme" | "iptal";
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const mutation = useCreateCompanyFundAmendment();
  const [reason, setReason] = useState("");
  const [institution, setInstitution] = useState(record.kurum);
  const [operation, setOperation] = useState(record.islem_turu);
  const [amount, setAmount] = useState(record.miktar);
  const [currency, setCurrency] = useState(record.para_birimi);
  const [description, setDescription] = useState(record.aciklama);
  const [error, setError] = useState("");
  const keyRef = useRef<{ signature: string; key: string } | null>(null);
  const lock = useRef(false);
  const field = "mt-1 w-full border border-border/70 bg-background px-3 py-2 text-sm disabled:opacity-60";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    setError("");
    const exact = amount.trim().replace(",", ".");
    if (reason.trim().length < 5 || reason.trim().length > 2000) {
      setError("Gerekçe 5 ile 2000 karakter arasında olmalıdır."); return;
    }
    if (kind === "duzeltme" && (
      institution.trim().length < 2 || operation.trim().length < 2 ||
      !/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/.test(exact) || /^0(\.0{1,2})?$/.test(exact)
    )) {
      setError("Kurum ve işlem türünü doldurun. Tutar pozitif ondalıklı metin olmalıdır; en fazla 999999999999,99 (örn. 1250,50)."); return;
    }
    const [whole, fraction = ""] = exact.split(".");
    const draft = {
      tur: kind, gerekce: reason.trim(),
      ...(kind === "duzeltme" ? { yeni_kayit: {
        kurum: institution.trim(), islem_turu: operation.trim(),
        miktar: `${whole}.${fraction.padEnd(2, "0")}`, para_birimi: currency, aciklama: description.trim(),
      } } : {}),
    };
    const signature = JSON.stringify({ id: record.id, ...draft });
    if (!keyRef.current || keyRef.current.signature !== signature)
      keyRef.current = { signature, key: crypto.randomUUID() };
    const data: CompanyFundAmendmentInput = { ...draft, istek_anahtari: keyRef.current.key };
    lock.current = true;
    try {
      await mutation.mutateAsync({ id: record.id, data });
      await onSaved();
    } catch (e) {
      const status = typeof e === "object" && e !== null && "status" in e ? e.status : undefined;
      const data = typeof e === "object" && e !== null && "data" in e ? e.data : undefined;
      const schemaPending = status === 503 && typeof data === "object" && data !== null &&
        "code" in data && data.code === "FUND_SCHEMA_PENDING";
      setError(schemaPending
        ? "Güvenlik kontrolü: düzeltme/iptal işlemi ikinci yayın tamamlanana kadar kapalıdır. Hiçbir kayıt değiştirilmedi; girdiğiniz bilgiler korundu."
        : status === 409
        ? "Kayıt zaten düzeltilmiş/iptal edilmiş veya istek anahtarı başka içerikle kullanılmış. Listeyi yenileyin; girdiğiniz bilgiler korundu."
        : "Düzeltme sonucu doğrulanamadı. Listeyi kontrol edin. Bilgileriniz korundu; aynı taslağı yeniden gönderdiğinizde çift kayıt oluşturulmaz.");
    } finally {
      lock.current = false;
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border border-primary/40 p-4" aria-label={`Kayıt #${record.id} ${kind === "iptal" ? "iptal" : "düzeltme"} formu`}>
      <fieldset disabled={mutation.isPending} className="space-y-3">
        <legend className="text-sm font-semibold">Kayıt #{record.id} · {kind === "iptal" ? "Gerekçeli iptal" : "Yeni düzeltme kaydı"}</legend>
        <p className="text-xs leading-6 text-foreground/65">Özgün içerik, yazar ve tarih korunur. Bu işlem yalnızca firma içi kayda eklenir; banka işlemi veya Kasa QR iptali değildir.</p>
        {kind === "duzeltme" ? (
          <>
            <label className="block text-xs">Yeni kurum adı<input className={field} value={institution} maxLength={200} onChange={(e) => setInstitution(e.target.value)} /></label>
            <label className="block text-xs">Yeni işlem türü<input className={field} value={operation} maxLength={100} onChange={(e) => setOperation(e.target.value)} /></label>
            <label className="block text-xs">Yeni tutar<input className={field} inputMode="decimal" value={amount} maxLength={16} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="block text-xs">Yeni para birimi
              <select className={field} value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>
                {["TRY", "EUR", "USD"].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="block text-xs">Yeni açıklama<textarea className={field} value={description} maxLength={8000} onChange={(e) => setDescription(e.target.value)} /></label>
          </>
        ) : null}
        <label className="block text-xs">Gerekçe (zorunlu)<textarea className={field} required minLength={5} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="bg-primary px-4 py-2 text-sm text-primary-foreground">{mutation.isPending ? "Kaydediliyor..." : kind === "iptal" ? "İptal kaydı ekle" : "Düzeltme kaydı ekle"}</button>
          <button type="button" onClick={onCancel} className="border border-border px-4 py-2 text-sm">Vazgeç</button>
        </div>
      </fieldset>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}