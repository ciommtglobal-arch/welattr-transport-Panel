import { useState, type FormEvent } from "react";
import {
  useCreateLogisticsCarrier,
  useCreateLogisticsCommunication,
  useCreateLogisticsOffer,
  useCreateLogisticsRequest,
  useReviseLogisticsOffer,
  type LogisticsCarrierRecord,
  type LogisticsCommunicationChannel,
  type LogisticsCommunicationDirection,
  type LogisticsOfferRecord,
  type LogisticsTransportMode,
} from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import {
  Feedback, Field, btnGhost, btnPrimary, classifyError, describeError, fmtMoney, inputCls, isValidAmount,
  modeLabels, toLocalInput, useInvalidateOperations,
} from "./shared";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Errors = Record<string, string>;

function len(v: string, min: number, max: number) {
  const t = v.trim();
  if (t.length < min) return min <= 1 ? "Zorunlu alan." : `En az ${min} karakter.`;
  if (t.length > max) return `En fazla ${max} karakter.`;
  return "";
}

function clean(errors: Errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
}

const emptyRequest = {
  requesterName: "", organization: "", email: "", phone: "", origin: "", destination: "",
  cargoType: "", weightKg: "", volumeM3: "", transportMode: "road" as LogisticsTransportMode, loadingDate: "", notes: "",
};

export function RequestForm({ onCreated }: { onCreated?: (id: number) => void }) {
  const invalidate = useInvalidateOperations();
  const create = useCreateLogisticsRequest({ mutation: { onSettled: invalidate } });
  const [v, setV] = useState(emptyRequest);
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const set = (k: keyof typeof emptyRequest) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = clean({
      requesterName: len(v.requesterName, 2, 160),
      organization: v.organization.length > 200 ? "En fazla 200 karakter." : "",
      email: EMAIL_RE.test(v.email.trim()) ? "" : "Geçerli bir e-posta girin.",
      phone: len(v.phone, 5, 40),
      origin: len(v.origin, 2, 160),
      destination: len(v.destination, 2, 160),
      cargoType: len(v.cargoType, 2, 160),
      weightKg: v.weightKg !== "" && Number(v.weightKg) >= 0 ? "" : "0 veya daha büyük bir sayı girin.",
      volumeM3: v.volumeM3 !== "" && Number(v.volumeM3) >= 0 ? "" : "0 veya daha büyük bir sayı girin.",
      loadingDate: v.loadingDate ? "" : "Yükleme tarihi seçin.",
      notes: v.notes.length > 2000 ? "En fazla 2000 karakter." : "",
    });
    setErrors(errs);
    setResult(null);
    if (Object.keys(errs).length) return;
    try {
      const created = await create.mutateAsync({
        data: {
          requesterName: v.requesterName.trim(),
          organization: v.organization.trim() || undefined,
          email: v.email.trim(),
          phone: v.phone.trim(),
          origin: v.origin.trim(),
          destination: v.destination.trim(),
          cargoType: v.cargoType.trim(),
          weightKg: Number(v.weightKg),
          volumeM3: Number(v.volumeM3),
          transportMode: v.transportMode,
          loadingDate: v.loadingDate,
          notes: v.notes.trim() || undefined,
        },
      });
      setV(emptyRequest);
      setResult({ kind: "success", text: `Talep ${created.referenceCode} olarak kaydedildi.` });
      onCreated?.(created.id);
    } catch (err) {
      setResult({ kind: "error", text: describeError(err) });
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4" data-testid="form-request">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Talep sahibi *" error={errors.requesterName}><input className={inputCls} value={v.requesterName} onChange={set("requesterName")} data-testid="input-requester-name" /></Field>
        <Field label="Firma" error={errors.organization}><input className={inputCls} value={v.organization} onChange={set("organization")} data-testid="input-organization" /></Field>
        <Field label="E-posta *" error={errors.email}><input type="email" className={inputCls} value={v.email} onChange={set("email")} data-testid="input-request-email" /></Field>
        <Field label="Telefon *" error={errors.phone}><input className={inputCls} value={v.phone} onChange={set("phone")} data-testid="input-request-phone" /></Field>
        <Field label="Çıkış *" error={errors.origin}><input className={inputCls} value={v.origin} onChange={set("origin")} data-testid="input-origin" /></Field>
        <Field label="Varış *" error={errors.destination}><input className={inputCls} value={v.destination} onChange={set("destination")} data-testid="input-destination" /></Field>
        <Field label="Yük türü *" error={errors.cargoType}><input className={inputCls} value={v.cargoType} onChange={set("cargoType")} data-testid="input-cargo-type" /></Field>
        <Field label="Taşıma modu *">
          <select className={inputCls} value={v.transportMode} onChange={set("transportMode")} data-testid="select-request-mode">
            {Object.entries(modeLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Ağırlık (kg) *" error={errors.weightKg}><input type="number" min={0} step="any" className={inputCls} value={v.weightKg} onChange={set("weightKg")} data-testid="input-weight" /></Field>
        <Field label="Hacim (m³) *" error={errors.volumeM3}><input type="number" min={0} step="any" className={inputCls} value={v.volumeM3} onChange={set("volumeM3")} data-testid="input-volume" /></Field>
        <Field label="Yükleme tarihi *" error={errors.loadingDate}><input type="date" className={inputCls} value={v.loadingDate} onChange={set("loadingDate")} data-testid="input-loading-date" /></Field>
      </div>
      <Field label="Notlar" error={errors.notes} hint="Müşteriden aldığınız bilgiyi olduğu gibi yazın; tahmin eklemeyin.">
        <textarea rows={3} className={inputCls} value={v.notes} onChange={set("notes")} data-testid="input-request-notes" />
      </Field>
      {result ? <Feedback kind={result.kind}>{result.text}</Feedback> : null}
      <button type="submit" className={btnPrimary} disabled={create.isPending} data-testid="button-submit-request">
        {create.isPending ? <Loader2 size={14} className="animate-spin" /> : null}Talebi kaydet
      </button>
    </form>
  );
}

const emptyCarrier = {
  companyName: "", contactName: "", email: "", phone: "", serviceRoutes: "",
  transportMode: "road" as LogisticsTransportMode, capacity: "", availability: "", notes: "",
};

export function CarrierForm() {
  const invalidate = useInvalidateOperations();
  const create = useCreateLogisticsCarrier({ mutation: { onSettled: invalidate } });
  const [v, setV] = useState(emptyCarrier);
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const set = (k: keyof typeof emptyCarrier) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = clean({
      companyName: len(v.companyName, 2, 200),
      contactName: len(v.contactName, 2, 160),
      email: EMAIL_RE.test(v.email.trim()) ? "" : "Geçerli bir e-posta girin.",
      phone: len(v.phone, 5, 40),
      serviceRoutes: len(v.serviceRoutes, 2, 1000),
      capacity: len(v.capacity, 1, 200),
      availability: len(v.availability, 1, 500),
      notes: v.notes.length > 2000 ? "En fazla 2000 karakter." : "",
    });
    setErrors(errs);
    setResult(null);
    if (Object.keys(errs).length) return;
    try {
      const created = await create.mutateAsync({
        data: {
          companyName: v.companyName.trim(), contactName: v.contactName.trim(), email: v.email.trim(),
          phone: v.phone.trim(), serviceRoutes: v.serviceRoutes.trim(), transportMode: v.transportMode,
          capacity: v.capacity.trim(), availability: v.availability.trim(), notes: v.notes.trim() || undefined,
        },
      });
      setV(emptyCarrier);
      setResult({ kind: "success", text: `Taşıyıcı başvurusu ${created.referenceCode} incelemeye alındı.` });
    } catch (err) {
      setResult({ kind: "error", text: describeError(err) });
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4" data-testid="form-carrier">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Firma adı *" error={errors.companyName}><input className={inputCls} value={v.companyName} onChange={set("companyName")} data-testid="input-carrier-company" /></Field>
        <Field label="Yetkili kişi *" error={errors.contactName}><input className={inputCls} value={v.contactName} onChange={set("contactName")} data-testid="input-carrier-contact" /></Field>
        <Field label="E-posta *" error={errors.email}><input type="email" className={inputCls} value={v.email} onChange={set("email")} data-testid="input-carrier-email" /></Field>
        <Field label="Telefon *" error={errors.phone}><input className={inputCls} value={v.phone} onChange={set("phone")} data-testid="input-carrier-phone" /></Field>
        <Field label="Taşıma modu *">
          <select className={inputCls} value={v.transportMode} onChange={set("transportMode")} data-testid="select-carrier-mode">
            {Object.entries(modeLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Kapasite *" error={errors.capacity}><input className={inputCls} value={v.capacity} onChange={set("capacity")} placeholder="Araç / konteyner bilgisi" data-testid="input-carrier-capacity" /></Field>
      </div>
      <Field label="Hizmet güzergâhları *" error={errors.serviceRoutes}><textarea rows={2} className={inputCls} value={v.serviceRoutes} onChange={set("serviceRoutes")} data-testid="input-carrier-routes" /></Field>
      <Field label="Uygunluk *" error={errors.availability}><input className={inputCls} value={v.availability} onChange={set("availability")} data-testid="input-carrier-availability" /></Field>
      <Field label="Notlar" error={errors.notes}><textarea rows={2} className={inputCls} value={v.notes} onChange={set("notes")} data-testid="input-carrier-notes" /></Field>
      {result ? <Feedback kind={result.kind}>{result.text}</Feedback> : null}
      <button type="submit" className={btnPrimary} disabled={create.isPending} data-testid="button-submit-carrier">
        {create.isPending ? <Loader2 size={14} className="animate-spin" /> : null}Başvuruyu kaydet
      </button>
    </form>
  );
}

function offerDraft(offer: LogisticsOfferRecord | undefined, eligible: LogisticsCarrierRecord[]) {
  return {
    carrierId: offer ? String(offer.carrierId) : eligible[0] ? String(eligible[0].id) : "",
    carrierCostAmount: offer ? String(offer.carrierCostAmount) : "",
    customerPriceAmount: offer ? String(offer.customerPriceAmount) : "",
    currency: offer?.currency ?? "TRY",
    includedServices: offer?.includedServices ?? "",
    validUntil: offer ? toLocalInput(offer.validUntil) : "",
  };
}

export function OfferForm({ requestId, carriers, offer, onDone }: {
  requestId: number; /** Already filtered to the request's test/live scope. */ carriers: LogisticsCarrierRecord[]; offer?: LogisticsOfferRecord; onDone: () => void;
}) {
  const invalidate = useInvalidateOperations();
  const create = useCreateLogisticsOffer({ mutation: { onSettled: invalidate } });
  const revise = useReviseLogisticsOffer({ mutation: { onSettled: invalidate } });
  const approved = carriers.filter((c) => c.status === "approved");
  // Draft and its version baseline are captured once; polling never rewrites them.
  const [v, setV] = useState(() => offerDraft(offer, approved));
  const [baseline, setBaseline] = useState(() => offer?.updatedAt ?? "");
  const [revisionNote, setRevisionNote] = useState("");
  const [conflict, setConflict] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  const pending = create.isPending || revise.isPending;
  const diff = isValidAmount(v.customerPriceAmount) && isValidAmount(v.carrierCostAmount)
    ? Number(v.customerPriceAmount) - Number(v.carrierCostAmount) : null;

  function reloadCurrent() {
    if (!offer) return;
    setV(offerDraft(offer, approved));
    setBaseline(offer.updatedAt);
    setConflict(false);
    setError(null);
    setErrors({});
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = clean({
      carrierId: approved.some((c) => String(c.id) === v.carrierId) ? "" : "Seçili taşıyıcı artık uygun değil; onaylı bir taşıyıcı seçin.",
      carrierCostAmount: isValidAmount(v.carrierCostAmount) ? "" : "Pozitif, en fazla 2 ondalıklı tutar.",
      customerPriceAmount: isValidAmount(v.customerPriceAmount) ? "" : "Pozitif, en fazla 2 ondalıklı tutar.",
      currency: /^[A-Z]{3}$/.test(v.currency) ? "" : "3 harfli para birimi kodu.",
      includedServices: len(v.includedServices, 2, 2000),
      validUntil: v.validUntil && new Date(v.validUntil).getTime() > Date.now() ? "" : "Gelecekte bir tarih seçin.",
    });
    setErrors(errs);
    setError(null);
    if (Object.keys(errs).length) return;
    const body = {
      carrierId: Number(v.carrierId),
      carrierCostAmount: Number(v.carrierCostAmount),
      customerPriceAmount: Number(v.customerPriceAmount),
      currency: v.currency,
      includedServices: v.includedServices.trim(),
      validUntil: new Date(v.validUntil).toISOString(),
    };
    try {
      if (offer) {
        if (revisionNote.trim().length < 3) { setError("Revizyon gerekçesi en az 3 karakter olmalıdır."); return; }
        await revise.mutateAsync({ id: offer.id, data: { ...body, expectedUpdatedAt: baseline, revisionNote: revisionNote.trim() } });
      }
      else await create.mutateAsync({ data: { ...body, requestId } });
      onDone();
    } catch (err) {
      setConflict(Boolean(offer) && classifyError(err) === "conflict");
      setError(describeError(err));
    }
  }

  if (!offer && approved.length === 0) {
    return <p className="border border-dashed border-border p-4 text-sm text-foreground/55">Bu talebin kapsamında (test/gerçek) onaylı taşıyıcı yok. Teklif için önce uygun bir taşıyıcı başvurusunu onaylayın.</p>;
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 border border-primary/30 bg-primary/[0.04] p-4 animate-in fade-in slide-in-from-top-1" data-testid="form-offer">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{offer ? `Teklif #${offer.id} revizyonu` : "Yeni teklif"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Taşıyıcı *" error={errors.carrierId} className="sm:col-span-2">
          <select className={inputCls} value={v.carrierId} onChange={set("carrierId")} data-testid="select-offer-carrier">
            {!approved.some((c) => String(c.id) === v.carrierId) ? <option value={v.carrierId}>Uygun olmayan taşıyıcı — yeniden seçin</option> : null}
            {approved.map((c) => <option key={c.id} value={c.id}>{c.companyName} · {modeLabels[c.transportMode]} · {c.referenceCode}</option>)}
          </select>
        </Field>
        <Field label="Taşıyıcı maliyeti *" error={errors.carrierCostAmount}><input inputMode="decimal" className={inputCls} value={v.carrierCostAmount} onChange={set("carrierCostAmount")} data-testid="input-offer-cost" /></Field>
        <Field label="Müşteri fiyatı *" error={errors.customerPriceAmount}><input inputMode="decimal" className={inputCls} value={v.customerPriceAmount} onChange={set("customerPriceAmount")} data-testid="input-offer-price" /></Field>
        <Field label="Para birimi *" error={errors.currency}>
          <select className={inputCls} value={v.currency} onChange={set("currency")} data-testid="select-offer-currency">
            {["TRY", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Geçerlilik sonu *" error={errors.validUntil}><input type="datetime-local" className={inputCls} value={v.validUntil} onChange={set("validUntil")} data-testid="input-offer-valid-until" /></Field>
      </div>
      <Field label="Dahil hizmetler *" error={errors.includedServices}><textarea rows={2} className={inputCls} value={v.includedServices} onChange={set("includedServices")} data-testid="input-offer-services" /></Field>
      {diff !== null ? (
        <p className={`text-xs ${diff < 0 ? "text-[#f08a8a]" : "text-foreground/60"}`} data-testid="text-offer-diff">
          Brüt ticari satış farkı: <strong className="font-mono">{fmtMoney(diff, v.currency)}</strong> — net kâr veya platform komisyonu değildir.
        </p>
      ) : null}
      {offer ? <>
        <Field label="Revizyon gerekçesi *"><textarea required minLength={3} maxLength={1000} className={inputCls} value={revisionNote} onChange={e => setRevisionNote(e.target.value)} data-testid="input-offer-revision-note" /></Field>
        <p className="text-[11px] text-foreground/45">Yeni teklif kurucu incelemesine düşer. Eski fiyat ve şartlar eski teklif kartında, karşılaştırma ve gerekçe iletişim geçmişinde korunur.</p>
      </> : <p className="text-[11px] text-foreground/45">Kayıt, sevkiyatı teklif onayı adımına taşır. Müşteriye hiçbir mesaj gönderilmez.</p>}
      {error ? <Feedback kind="error">{error}{conflict ? " Düzenlemeleriniz korunuyor; güncel kaydı yükleyip yeniden kontrol edin." : ""}</Feedback> : null}
      <div className="flex flex-wrap gap-2">
        {conflict ? <button type="button" className={btnGhost} onClick={reloadCurrent} data-testid="button-reload-offer">Güncel kaydı yükle</button> : null}
        <button type="submit" className={btnPrimary} disabled={pending} data-testid="button-submit-offer">{pending ? <Loader2 size={14} className="animate-spin" /> : null}{offer ? "Revizyonu kaydet" : "Teklifi kaydet"}</button>
        <button type="button" className={btnGhost} onClick={onDone} data-testid="button-cancel-offer">Vazgeç</button>
      </div>
    </form>
  );
}

const channelLabels: Record<LogisticsCommunicationChannel, string> = { phone: "Telefon", email: "E-posta", whatsapp: "WhatsApp", note: "İç not" };
const directionLabels: Record<LogisticsCommunicationDirection, string> = { inbound: "Gelen", outbound: "Giden", internal: "İç" };
export { channelLabels, directionLabels };

export function CommunicationForm({ requestId }: { requestId: number }) {
  const invalidate = useInvalidateOperations();
  const create = useCreateLogisticsCommunication({ mutation: { onSettled: invalidate } });
  const [channel, setChannel] = useState<LogisticsCommunicationChannel>("phone");
  const [direction, setDirection] = useState<LogisticsCommunicationDirection>("inbound");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const m = message.trim();
    if (!m || m.length > 4000) { setResult({ kind: "error", text: "Mesaj 1–4000 karakter olmalı." }); return; }
    setResult(null);
    try {
      await create.mutateAsync({ data: { requestId, channel, direction, message: m } });
      setMessage("");
      setResult({ kind: "success", text: "Görüşme kaydı eklendi. Dış kanala mesaj gönderilmedi." });
    } catch (err) {
      setResult({ kind: "error", text: describeError(err) });
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-2" data-testid="form-communication">
      <div className="flex gap-2">
        <select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value as LogisticsCommunicationChannel)} data-testid="select-comm-channel">
          {Object.entries(channelLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className={inputCls} value={direction} onChange={(e) => setDirection(e.target.value as LogisticsCommunicationDirection)} data-testid="select-comm-direction">
          {Object.entries(directionLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <textarea rows={2} className={inputCls} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Görüşmenin özeti, kim ne dedi…" data-testid="input-comm-message" />
      {result ? <Feedback kind={result.kind}>{result.text}</Feedback> : null}
      <button type="submit" className={btnGhost} disabled={create.isPending} data-testid="button-submit-comm">{create.isPending ? <Loader2 size={14} className="animate-spin" /> : null}Kaydı ekle</button>
    </form>
  );
}
