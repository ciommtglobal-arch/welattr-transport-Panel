import { useState } from "react";
import { Link } from "wouter";
import type { NexusIntake } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { nexusCopy } from "@/lib/nexus-copy";

export type NexusAction = "approve" | "reject" | "publish" | "withdraw";
type Props = {
  records: NexusIntake[];
  loading?: boolean;
  unavailable?: boolean;
  preview?: boolean;
  reload: () => Promise<NexusIntake[]>;
  act: (record: NexusIntake, action: NexusAction) => Promise<NexusIntake>;
};
const button = "min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40";

export default function NexusReviewDesk({ records, loading, unavailable, preview, reload, act }: Props) {
  const { locale } = useI18n();
  const copy = nexusCopy[locale];
  const [selected, setSelected] = useState<{ row: NexusIntake; action: NexusAction } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const status = (row: NexusIntake) => row.cancelled !== 0 || row.quantity <= 0 ? copy.inactive :
    row.isPublished ? copy.published :
    row.status === "PENDING_FOUNDER_APPROVAL" ? copy.pending :
    row.status === "FOUNDER_REJECTED" ? copy.rejected : row.approvalValid ? copy.approved : copy.needsReview;
  const open = (row: NexusIntake, action: NexusAction) => {
    // Freeze the displayed snapshot. Polling must not silently change a modal.
    setSelected({ row: { ...row }, action }); setError(""); setSaved(false);
  };
  async function confirm() {
    if (!selected || busy) return;
    setBusy(true); setError("");
    try { await act(selected.row, selected.action); setSelected(null); setSaved(true); }
    catch (failure) { setError((failure as { status?: number }).status === 409 ? copy.stale : copy.failure); }
    finally { setBusy(false); }
  }
  async function refreshReviewed() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const current = (await reload()).find(row => row.id === selected.row.id);
      if (!current) { setError(copy.unavailable); return; }
      setSelected({ row: { ...current }, action: selected.action }); setError("");
    } catch { setError(copy.unavailable); }
    finally { setBusy(false); }
  }
  const blocked = selected && (selected.action === "publish" ? !selected.row.canPublish :
    selected.action === "approve" ? selected.row.cancelled !== 0 || selected.row.quantity <= 0 : false);

  return <main className="mx-auto max-w-5xl px-5 py-10 text-foreground">
    {!preview && <Link href="/staff/yonetim-paneli" className="text-sm text-primary">{copy.back}</Link>}
    <p className="mt-4 font-mono text-xs uppercase tracking-widest text-primary">MMT Global · MMT Nexus</p>
    <h1 className="mt-3 text-3xl font-semibold">{copy.title}</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.subtitle}</p>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.publicNote}</p>
    <p className="mt-5 rounded-lg border border-border bg-card p-4 text-sm font-medium">{copy.flow}</p>
    <button className={`${button} my-5`} onClick={async () => {
      setBusy(true); setError("");
      try { await reload(); } catch { setError(copy.unavailable); } finally { setBusy(false); }
    }} disabled={loading || busy}>{copy.reload}</button>
    {saved && <p role="status" className="mb-4 text-sm text-primary">{copy.saved}</p>}
    {!selected && error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
    {loading ? <p role="status">{copy.loading}</p> : unavailable ? <p role="alert">{copy.unavailable}</p> :
      !records.length ? <p className="rounded-xl border border-border p-6">{copy.empty}</p> :
      <ul className="space-y-5">{records.map(row => <li key={row.id} data-testid={`nexus-intake-${row.id}`}
        className="rounded-xl border border-border bg-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs text-muted-foreground">{row.orderName}</p>
            <h2 className="mt-1 text-lg font-semibold break-words">{preview ? copy.testTitle : row.productTitle}</h2></div>
          <span className="rounded-full border border-primary/30 px-3 py-1 text-xs text-primary">{status(row)}</span>
        </div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">{copy.amount}</dt><dd className="mt-1">{row.quantity} / {row.unitPrice} {row.currency}</dd></div>
          <div><dt className="text-muted-foreground">{copy.financial}</dt><dd className="mt-1">{row.financialStatus}</dd></div>
          <div><dt className="text-muted-foreground">{copy.source}</dt><dd className="mt-1">{new Date(row.sourceUpdatedAt).toLocaleString(locale)}</dd></div>
        </dl>
        <p className="mt-3 text-sm">{row.corridor ?? "—"}</p>
        {row.warning && <p className="mt-3 text-sm text-muted-foreground">{row.warning}</p>}
        {(row.cancelled !== 0 || row.quantity <= 0) && <p className="mt-3 text-sm text-destructive">{copy.cancelled}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={`${button} bg-primary text-primary-foreground`} onClick={() => open(row, "approve")}
            disabled={busy || row.approvalValid || row.cancelled !== 0 || row.quantity <= 0} data-testid="nexus-approve">{copy.approve}</button>
          <button className={button} onClick={() => open(row, "reject")} disabled={busy || row.status === "FOUNDER_REJECTED"} data-testid="nexus-reject">{copy.reject}</button>
          <button className={button} onClick={() => open(row, "publish")} disabled={busy || !row.canPublish} data-testid="nexus-publish">{copy.publish}</button>
          <button className={button} onClick={() => open(row, "withdraw")} disabled={busy || !row.isPublished} data-testid="nexus-withdraw">{copy.withdraw}</button>
        </div>
        {!row.canPublish && !row.isPublished && <p className="mt-3 text-xs text-muted-foreground">{copy.blocked}</p>}
      </li>)}</ul>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open && !busy) setSelected(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{selected ? copy[selected.action] : copy.title}</DialogTitle>
          <DialogDescription>{copy.reviewNote}</DialogDescription>
        </DialogHeader>
        {selected && <div className="space-y-3 text-sm">
          <p className="font-semibold break-words">{preview ? copy.testTitle : selected.row.productTitle}</p>
          <p>{selected.row.orderName} · {selected.row.quantity} / {selected.row.unitPrice} {selected.row.currency}</p>
          <p>{selected.row.financialStatus} · {selected.row.corridor ?? "—"}</p>
          {selected.row.warning && <p className="text-muted-foreground">{selected.row.warning}</p>}
          {selected.action === "publish" && <div className="rounded-lg border border-border p-4">
            <p>{selected.row.kind === "reservation" ? copy.reservation : copy.financing} · {selected.row.corridor}</p>
            <p className="mt-2 text-muted-foreground">{copy.publicFields}</p>
            <p className="mt-2 text-muted-foreground">{copy.privateFields}</p>
          </div>}
          {blocked && <p role="alert" className="text-destructive">{copy.blocked}</p>}
          {error && <p role="alert" className="text-destructive">{error}</p>}
        </div>}
        <DialogFooter className="gap-2">
          {error && <button className={button} onClick={() => { void refreshReviewed(); }} disabled={busy}>{copy.refresh}</button>}
          <button className={button} onClick={() => setSelected(null)} disabled={busy}>{copy.cancel}</button>
          <button className={`${button} bg-primary text-primary-foreground`} onClick={() => { void confirm(); }}
            disabled={busy || Boolean(blocked) || Boolean(error)} data-testid="nexus-confirm">{copy.confirm}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </main>;
}
