import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import {
  useApproveLogisticsOffer,
  useDecideLogisticsOffer,
  useMarkLogisticsOfferSent,
  useReviewLogisticsCarrier,
  useUpdateLogisticsRequestStatus,
  type LogisticsCarrierRecord,
  type LogisticsCommunicationRecord,
  type LogisticsOfferDispatchInputChannel,
  type LogisticsOfferRecord,
  type LogisticsRequestRecord,
  type LogisticsShipmentRecord,
  type LogisticsShipmentStatus,
} from "@workspace/api-client-react";
import { AlertTriangle, Check, Clock, Loader2, Mail, MapPin, Phone, Plus, RefreshCw, X } from "lucide-react";
import {
  Feedback, Field, Pill, STATUS_FLOW, btnGhost, btnPrimary, carrierLabels, carrierTone, classifyError, describeError,
  expiresSoon, fmtDate, fmtDateTime, fmtMoney, inputCls, isExpired, modeLabels, offerLabels, offerTone,
  statusLabels, statusTone, toLocalInput, useInvalidateOperations,
} from "./shared";
import { AutomationPanel } from "./automation-panel";
import { CommunicationForm, OfferForm, channelLabels, directionLabels } from "./forms";

function NoteAction({ label, confirmLabel, tone = "primary", hint, withChannel, onSubmit, testId }: {
  label: string; confirmLabel: string; tone?: "primary" | "danger"; hint?: string; withChannel?: boolean; testId: string;
  onSubmit: (note: string, channel: LogisticsOfferDispatchInputChannel) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<LogisticsOfferDispatchInputChannel>("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = note.trim();
    if (n.length < 3 || n.length > 1000) { setError("Not 3–1000 karakter olmalı."); return; }
    setBusy(true); setError(null);
    try { await onSubmit(n, channel); setOpen(false); setNote(""); }
    catch (err) { setError(describeError(err)); }
    finally { setBusy(false); }
  }

  if (!open) {
    return <button type="button" className={tone === "danger" ? `${btnGhost} hover:border-[#ef4444]/60 hover:text-[#f5b0b0]` : btnGhost} onClick={() => setOpen(true)} data-testid={`button-${testId}`}>{label}</button>;
  }
  return (
    <form onSubmit={submit} className="w-full space-y-2 border border-border bg-[#0d131c] p-3 animate-in fade-in slide-in-from-top-1">
      {withChannel ? (
        <Field label="Manuel iletim kanalı">
          <select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value as LogisticsOfferDispatchInputChannel)} data-testid={`select-${testId}-channel`}>
            <option value="phone">Telefon</option><option value="email">E-posta</option><option value="whatsapp">WhatsApp</option>
          </select>
        </Field>
      ) : null}
      <Field label="Not *" hint={hint}><textarea rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} autoFocus data-testid={`input-${testId}-note`} /></Field>
      {error ? <Feedback kind="error">{error}</Feedback> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={tone === "danger" ? `${btnPrimary} bg-[#b91c1c]` : btnPrimary} data-testid={`button-${testId}-confirm`}>{busy ? <Loader2 size={14} className="animate-spin" /> : null}{confirmLabel}</button>
        <button type="button" className={btnGhost} onClick={() => { setOpen(false); setError(null); }}>Vazgeç</button>
      </div>
    </form>
  );
}

export function CarrierCard({ carrier }: { carrier: LogisticsCarrierRecord }) {
  const invalidate = useInvalidateOperations();
  const review = useReviewLogisticsCarrier({ mutation: { onSettled: invalidate } });
  return (
    <article className="border border-border bg-card p-4 transition-colors hover:border-foreground/25" data-testid={`card-carrier-${carrier.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.14em] text-primary">{carrier.referenceCode}</p>
          <h3 className="mt-1 truncate font-semibold">{carrier.companyName}</h3>
          <p className="text-xs text-foreground/50">{carrier.contactName} · {modeLabels[carrier.transportMode]}</p>
        </div>
        <Pill className={carrierTone[carrier.status]}>{carrierLabels[carrier.status]}</Pill>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-foreground/40">Güzergâh</dt><dd className="break-words">{carrier.serviceRoutes}</dd>
        <dt className="text-foreground/40">Kapasite</dt><dd>{carrier.capacity}</dd>
        <dt className="text-foreground/40">Uygunluk</dt><dd>{carrier.availability}</dd>
        <dt className="text-foreground/40">İletişim</dt><dd className="break-all">{carrier.email} · {carrier.phone}</dd>
        {carrier.notes ? <><dt className="text-foreground/40">Not</dt><dd className="whitespace-pre-wrap">{carrier.notes}</dd></> : null}
        {carrier.reviewedAt ? <><dt className="text-foreground/40">İnceleme</dt><dd>{fmtDateTime(carrier.reviewedAt)}</dd></> : null}
      </dl>
      {carrier.status === "pending" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <NoteAction label="Onayla" confirmLabel="Onayı kaydet" testId={`approve-carrier-${carrier.id}`} hint="Hangi belge veya görüşmeye dayanarak onayladığınızı yazın."
            onSubmit={(note) => review.mutateAsync({ id: carrier.id, data: { status: "approved", note } })} />
          <NoteAction label="Reddet" confirmLabel="Reddi kaydet" tone="danger" testId={`reject-carrier-${carrier.id}`}
            onSubmit={(note) => review.mutateAsync({ id: carrier.id, data: { status: "rejected", note } })} />
        </div>
      ) : <p className="mt-3 text-[11px] text-foreground/40">İnceleme kesinleşti; yeniden değerlendirilemez.</p>}
    </article>
  );
}

function Stepper({ status }: { status: LogisticsShipmentStatus }) {
  const idx = STATUS_FLOW.indexOf(status);
  return (
    <ol className="grid grid-cols-7 gap-1" aria-label="Sevkiyat adımları">
      {STATUS_FLOW.map((s, i) => (
        <li key={s} className="min-w-0" aria-current={i === idx ? "step" : undefined}>
          <div className={`h-1 transition-colors duration-500 ${i < idx ? "bg-primary/60" : i === idx ? "bg-primary" : "bg-border"}`} />
          <p className={`mt-1.5 truncate text-[9px] font-semibold uppercase tracking-[0.06em] ${i === idx ? "text-primary" : i < idx ? "text-foreground/55" : "text-foreground/30"}`}>{statusLabels[s]}</p>
        </li>
      ))}
    </ol>
  );
}

function manualNext(status: LogisticsShipmentStatus): LogisticsShipmentStatus | null {
  // quote_approval and customer_approval are reached only via offer creation/approval.
  if (status === "new_request") return "planning";
  if (status === "customer_approval") return "loading";
  if (status === "loading") return "in_transit";
  if (status === "in_transit") return "delivered";
  return null;
}

function shipmentDraft(shipment?: LogisticsShipmentRecord) {
  return {
    note: shipment?.internalNote ?? "",
    plannedLoading: toLocalInput(shipment?.plannedLoadingAt),
    plannedDelivery: toLocalInput(shipment?.plannedDeliveryAt),
  };
}

function StatusEditor({ request, shipment, status, loadingBlocker }: {
  request: LogisticsRequestRecord; shipment?: LogisticsShipmentRecord; status: LogisticsShipmentStatus; loadingBlocker: string | null;
}) {
  const invalidate = useInvalidateOperations();
  const update = useUpdateLogisticsRequestStatus({ mutation: { onSettled: invalidate } });
  const serverVersion = shipment?.updatedAt ?? request.updatedAt;
  const [draft, setDraft] = useState(() => shipmentDraft(shipment));
  const [version, setVersion] = useState(serverVersion);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [result, setResult] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const next = manualNext(status);
  const blocked = next === "loading" ? loadingBlocker : null;
  const outdated = dirty && version !== serverVersion;

  // While clean, follow fresh server data; while dirty, keep the original version so stale saves are rejected.
  useEffect(() => {
    if (dirty) return;
    setDraft(shipmentDraft(shipment));
    setVersion(serverVersion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, serverVersion, shipment?.internalNote, shipment?.plannedLoadingAt, shipment?.plannedDeliveryAt]);

  const edit = (k: keyof ReturnType<typeof shipmentDraft>) => (e: { target: { value: string } }) => {
    setDirty(true);
    setDraft((d) => ({ ...d, [k]: e.target.value }));
  };

  function reloadCurrent() {
    setDraft(shipmentDraft(shipment));
    setVersion(serverVersion);
    setDirty(false);
    setConflict(false);
    setResult(null);
  }

  async function save(target: LogisticsShipmentStatus) {
    if (draft.note.length > 4000) { setResult({ kind: "error", text: "İç not en fazla 4000 karakter." }); return; }
    setResult(null);
    try {
      const row = await update.mutateAsync({ id: request.id, data: {
        status: target,
        expectedUpdatedAt: version,
        internalNote: draft.note.trim() || null,
        plannedLoadingAt: draft.plannedLoading ? new Date(draft.plannedLoading).toISOString() : null,
        plannedDeliveryAt: draft.plannedDelivery ? new Date(draft.plannedDelivery).toISOString() : null,
      } });
      setDraft(shipmentDraft(row));
      setVersion(row.updatedAt);
      setDirty(false);
      setConflict(false);
      setResult({ kind: "success", text: target === status ? "Plan ve not güncellendi." : `Durum "${statusLabels[target]}" olarak kaydedildi.` });
    } catch (err) {
      setConflict(classifyError(err) === "conflict");
      setResult({ kind: "error", text: describeError(err) });
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Planlanan yükleme"><input type="datetime-local" className={inputCls} value={draft.plannedLoading} onChange={edit("plannedLoading")} data-testid="input-planned-loading" /></Field>
        <Field label="Planlanan teslim"><input type="datetime-local" className={inputCls} value={draft.plannedDelivery} onChange={edit("plannedDelivery")} data-testid="input-planned-delivery" /></Field>
      </div>
      <Field label="İç not"><textarea rows={2} className={inputCls} value={draft.note} onChange={edit("note")} data-testid="input-internal-note" /></Field>
      {shipment?.actualLoadingAt || shipment?.actualDeliveryAt ? (
        <p className="text-xs text-foreground/50">Gerçekleşen yükleme: {fmtDateTime(shipment.actualLoadingAt)} · teslim: {fmtDateTime(shipment.actualDeliveryAt)}</p>
      ) : null}
      {outdated && !conflict ? <p className="flex items-start gap-2 text-xs text-[#f0c06a]"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Siz düzenlerken kayıt sunucuda değişti. Kaydetme reddedilecektir; güncel kaydı yükleyin.</p> : null}
      {blocked ? <p className="flex items-start gap-2 text-xs text-[#f0c06a]"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{blocked}</p> : null}
      {result ? <Feedback kind={result.kind}>{result.text}{conflict ? " Düzenlemeleriniz korunuyor; otomatik birleştirme yapılmadı." : ""}</Feedback> : null}
      <div className="flex flex-wrap gap-2">
        {conflict || outdated ? <button type="button" className={btnGhost} onClick={reloadCurrent} data-testid="button-reload-shipment"><RefreshCw size={14} />Güncel kaydı yükle</button> : null}
        <button type="button" className={btnGhost} disabled={update.isPending} onClick={() => save(status)} data-testid="button-save-plan">Planı kaydet</button>
        {next ? (
          <button type="button" className={btnPrimary} disabled={update.isPending || Boolean(blocked)} onClick={() => save(next)} data-testid="button-advance-status">
            {update.isPending ? <Loader2 size={14} className="animate-spin" /> : null}Sonraki adım: {statusLabels[next]}
          </button>
        ) : status === "planning" || status === "quote_approval" ? (
          <span className="self-center text-xs text-foreground/45">Sonraki adım teklif kaydı ve kurucu onayıyla ilerler.</span>
        ) : null}
      </div>
    </div>
  );
}

const PRE_LOADING: LogisticsShipmentStatus[] = ["planning", "quote_approval", "customer_approval"];

export function approvedByFounder(offer: LogisticsOfferRecord, founderId: string | null | undefined) {
  return Boolean(founderId && offer.approvedByClerkUserId === founderId && offer.approvedAt);
}

function OfferCard({ offer, carrier, canApprove, shipmentStatus, otherAccepted, carriers, requestId, founderId }: {
  offer: LogisticsOfferRecord; carrier?: LogisticsCarrierRecord; canApprove: boolean; shipmentStatus: LogisticsShipmentStatus;
  otherAccepted: boolean; carriers: LogisticsCarrierRecord[]; requestId: number; founderId: string | null | undefined;
}) {
  const invalidate = useInvalidateOperations();
  const approve = useApproveLogisticsOffer({ mutation: { onSettled: invalidate } });
  const markSent = useMarkLogisticsOfferSent({ mutation: { onSettled: invalidate } });
  const decide = useDecideLogisticsOffer({ mutation: { onSettled: invalidate } });
  const [revising, setRevising] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const expired = isExpired(offer);
  const live = ["pending_approval", "approved", "sent"].includes(offer.status);
  const preLoading = PRE_LOADING.includes(shipmentStatus);
  const quoting = shipmentStatus === "planning" || shipmentStatus === "quote_approval";
  const founderApproved = approvedByFounder(offer, founderId);
  const version = offer.updatedAt;
  const diff = offer.customerPriceAmount - offer.carrierCostAmount;

  if (revising) return <OfferForm requestId={requestId} carriers={carriers} offer={offer} onDone={() => setRevising(false)} />;

  const actions: ReactNode[] = [];
  if (offer.status === "pending_approval") {
    if (canApprove && !expired && preLoading && !otherAccepted) actions.push(
      <button key="ap" type="button" className={btnPrimary} disabled={approve.isPending} data-testid={`button-approve-offer-${offer.id}`}
        onClick={async () => { setApproveError(null); try { await approve.mutateAsync({ id: offer.id, data: { expectedUpdatedAt: version } }); } catch (e) { setApproveError(describeError(e)); } }}>
        {approve.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Kurucu onayı
      </button>);
    if (quoting) actions.push(
      <button key="rv" type="button" className={btnGhost} onClick={() => setRevising(true)} data-testid={`button-revise-offer-${offer.id}`}>Revize et</button>);
  }
  if (canApprove && offer.status === "approved" && !expired && preLoading && founderApproved) actions.push(
    <NoteAction key="ms" label="Manuel iletildi olarak işaretle" confirmLabel="İletimi kaydet" withChannel testId={`sent-offer-${offer.id}`}
      hint="Bu kayıt mesaj göndermez. Teklifi kendiniz hangi kanaldan ilettiğinizi yazın."
      onSubmit={(note, channel) => markSent.mutateAsync({ id: offer.id, data: { channel, note, expectedUpdatedAt: version } })} />);
  if (canApprove && offer.status === "sent" && !expired && !otherAccepted && preLoading && founderApproved) actions.push(
    <NoteAction key="ac" label="Müşteri kabulünü kaydet" confirmLabel="Kabulü kaydet" testId={`accept-offer-${offer.id}`}
      hint="Müşterinin kabulünü kendiniz nasıl teyit ettiğinizi yazın (ör. tarih, kanal). Bu kayıt sözleşme imzalamaz."
      onSubmit={(note) => decide.mutateAsync({ id: offer.id, data: { decision: "accept_customer", note, expectedUpdatedAt: version } })} />);
  if (canApprove && live && preLoading) actions.push(
    <NoteAction key="rj" label="Reddet" confirmLabel="Reddi kaydet" tone="danger" testId={`reject-offer-${offer.id}`}
      hint="Son onaylı/iletilmiş teklif reddedilirse sevkiyat teklif onayı adımına döner."
      onSubmit={(note) => decide.mutateAsync({ id: offer.id, data: { decision: "reject", note, expectedUpdatedAt: version } })} />);

  const expiryCopy = !live ? "" : expired
    ? offer.status === "pending_approval"
      ? " — süresi geçti; onaylanamaz. Yeni geçerlilik tarihiyle revize edebilir veya reddedebilirsiniz."
      : " — süresi geçti; iletilemez veya kabul edilemez. Reddedip yeni teklif oluşturun (hiçbir iletim otomatik yapılmaz)."
    : expiresSoon(offer) ? " — 24 saatten az kaldı." : "";

  return (
    <article className={`border p-4 transition-colors ${offer.status === "accepted" ? "border-[#7fae6e]/40 bg-[#7fae6e]/[0.04]" : "border-border bg-[#0f1621]"}`} data-testid={`card-offer-${offer.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] text-foreground/45">TEKLİF #{offer.id}{offer.isTest ? " · TEST" : ""}</p>
          <p className="mt-1 text-sm font-semibold">{carrier ? carrier.companyName : `Taşıyıcı #${offer.carrierId}`}{carrier && carrier.status !== "approved" ? <span className="ml-2 text-[11px] text-[#f08a8a]">(taşıyıcı artık onaylı değil)</span> : null}</p>
        </div>
        <Pill className={offerTone[offer.status]}>{offerLabels[offer.status]}</Pill>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><p className="text-foreground/40">Taşıyıcı maliyeti</p><p className="font-mono">{fmtMoney(offer.carrierCostAmount, offer.currency)}</p></div>
        <div><p className="text-foreground/40">Müşteri fiyatı</p><p className="font-mono">{fmtMoney(offer.customerPriceAmount, offer.currency)}</p></div>
        <div><p className="text-foreground/40">Brüt ticari satış farkı</p><p className={`font-mono ${diff < 0 ? "text-[#f08a8a]" : "text-primary"}`}>{fmtMoney(diff, offer.currency)}</p></div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-xs text-foreground/65">{offer.includedServices}</p>
      <p className={`mt-2 flex items-start gap-1.5 text-[11px] ${live && expired ? "text-[#f08a8a]" : live && expiresSoon(offer) ? "text-[#f0c06a]" : "text-foreground/45"}`}>
        <Clock size={12} className="mt-0.5 shrink-0" /><span>Geçerlilik: {fmtDateTime(offer.validUntil)}{expiryCopy}</span>
      </p>
      {offer.approvedAt || offer.sentAt ? <p className="mt-1 text-[11px] text-foreground/40">Onay: {fmtDateTime(offer.approvedAt)} · İletim kaydı: {fmtDateTime(offer.sentAt)}</p> : null}
      {live && (offer.status === "approved" || offer.status === "sent") && !founderApproved ? <p className="mt-1 text-[11px] text-[#f0c06a]">Bu onay mevcut kurucu hesabına ait değil; iletim/kabul kaydedilemez. Yükleme öncesi reddedilebilir.</p> : null}
      {live && otherAccepted ? <p className="mt-1 text-[11px] text-foreground/45">Bu talepte kabul edilmiş başka bir teklif var.</p> : null}
      {live && !preLoading ? <p className="mt-1 text-[11px] text-foreground/45">Sevkiyat yükleme sonrası aşamada; teklif işlemleri kapalı.</p> : null}
      {approveError ? <div className="mt-2"><Feedback kind="error">{approveError}</Feedback></div> : null}
      {actions.length ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}

export function RequestDetail({ request, shipment, offers, carriers, communications, canApprove, onClose }: {
  request: LogisticsRequestRecord; shipment?: LogisticsShipmentRecord; offers: LogisticsOfferRecord[]; carriers: LogisticsCarrierRecord[];
  communications: LogisticsCommunicationRecord[]; canApprove: boolean; onClose: () => void;
}) {
  const { userId } = useAuth();
  const [creating, setCreating] = useState(false);
  const scopedCarriers = carriers.filter((c) => c.isTest === request.isTest);
  const status = shipment?.status ?? request.status;
  const accepted = offers.find((o) => o.status === "accepted");
  const acceptedCarrier = accepted ? carriers.find((c) => c.id === accepted.carrierId) : undefined;
  const loadingBlocker = !accepted ? "Yükleme için müşteri kabulü kaydedilmiş bir teklif gerekir."
    : !approvedByFounder(accepted, userId) ? "Kabul edilen teklif mevcut kurucu hesabıyla onaylanmamış."
    : acceptedCarrier?.status !== "approved" ? "Kabul edilen teklifin taşıyıcısı şu anda onaylı değil." : null;
  const canCreateOffer = status === "planning" || status === "quote_approval";
  const sortedComms = [...communications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300" data-testid={`detail-request-${request.id}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.16em] text-primary">{request.referenceCode}{request.isTest ? " · TEST" : ""}</p>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight"><MapPin size={18} className="text-primary" />{request.origin} <span className="text-foreground/35">→</span> {request.destination}</h2>
        </div>
        <button type="button" onClick={onClose} className="p-1 text-foreground/50 hover:text-foreground lg:hidden" aria-label="Detayı kapat" data-testid="button-close-detail"><X size={18} /></button>
      </header>
      <Stepper status={status} />
      <section className="grid gap-x-6 gap-y-2 border-y border-border py-4 text-sm sm:grid-cols-2">
        <p><span className="text-foreground/40">Talep sahibi · </span>{request.requesterName}{request.organization ? ` (${request.organization})` : ""}</p>
        <p className="flex items-center gap-3 break-all"><Mail size={13} className="text-foreground/40" />{request.email}</p>
        <p className="flex items-center gap-3"><Phone size={13} className="text-foreground/40" />{request.phone}</p>
        <p><span className="text-foreground/40">Yük · </span>{request.cargoType} · {modeLabels[request.transportMode]}</p>
        <p><span className="text-foreground/40">Ölçü · </span>{request.weightKg.toLocaleString("tr-TR")} kg · {request.volumeM3.toLocaleString("tr-TR")} m³</p>
        <p><span className="text-foreground/40">Yükleme tarihi · </span>{fmtDate(request.loadingDate)}</p>
        {request.notes ? <p className="whitespace-pre-wrap sm:col-span-2"><span className="text-foreground/40">Not · </span>{request.notes}</p> : null}
        <p className="text-xs text-foreground/40 sm:col-span-2">Kayıt: {fmtDateTime(request.createdAt)} · Güncelleme: {fmtDateTime(shipment?.updatedAt ?? request.updatedAt)}</p>
      </section>

      <section>
        <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/55">Sevkiyat takibi · <Pill className={statusTone[status]}>{statusLabels[status]}</Pill></h3>
        <StatusEditor key={request.id} request={request} shipment={shipment} status={status} loadingBlocker={loadingBlocker} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/55">Teklifler ({offers.length})</h3>
          {canCreateOffer && !creating ? <button type="button" className={btnGhost} onClick={() => setCreating(true)} data-testid="button-new-offer"><Plus size={14} />Teklif ekle</button> : null}
        </div>
        {!canApprove ? <p className="text-xs text-[#f0c06a]">Sunucu bu oturum için kurucu onay yetkisi bildirmedi; nihai işlemler gizlendi.</p> : null}
        {creating ? <OfferForm key={`new-${request.id}`} requestId={request.id} carriers={scopedCarriers} onDone={() => setCreating(false)} /> : null}
        {offers.length === 0 && !creating ? <p className="border border-dashed border-border p-4 text-sm text-foreground/50">{canCreateOffer ? "Henüz teklif yok. Onaylı bir taşıyıcıyla ilk teklifi oluşturun." : status === "new_request" ? "Teklif için önce talebi planlamaya alın." : "Bu talepte teklif kaydı yok."}</p> : null}
        {[...offers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((o) => (
          <OfferCard key={o.id} offer={o} carrier={carriers.find((c) => c.id === o.carrierId)} canApprove={canApprove} shipmentStatus={status}
            otherAccepted={Boolean(accepted && accepted.id !== o.id)} carriers={scopedCarriers} requestId={request.id} founderId={userId} />
        ))}
      </section>

      <div className="border border-border bg-[#0f1621] p-4">
        <AutomationPanel key={request.id} requestId={request.id} />
      </div>

      <section className="space-y-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/55">Görüşme kayıtları ({communications.length})</h3>
        <CommunicationForm key={request.id} requestId={request.id} />
        <ol className="space-y-2 border-l border-border pl-4">
          {sortedComms.length === 0 ? <li className="text-xs text-foreground/45">Kayıtlı görüşme yok.</li> : sortedComms.map((c) => (
            <li key={c.id} className="relative" data-testid={`row-comm-${c.id}`}>
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary/70" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/45">{channelLabels[c.channel]} · {directionLabels[c.direction]} · {fmtDateTime(c.createdAt)}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.message}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
