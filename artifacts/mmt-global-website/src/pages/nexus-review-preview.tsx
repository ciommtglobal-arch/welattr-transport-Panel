import { useRef, useState } from "react";
import type { NexusIntake, PublicNexusPublication } from "@workspace/api-client-react";
import NexusReviewDesk, { type NexusAction } from "@/components/nexus-review-desk";
import { NexusPublicationCards } from "@/components/nexus-publications";
import { useI18n } from "@/lib/i18n";
import { nexusCopy } from "@/lib/nexus-copy";

// Development-only, in-memory controls. Never create Shopify products, seed
// commercial records, write the database or call the decision/publication API.
function testRecord(): NexusIntake {
  return {
    id: 0, shopDomain: "test-only.invalid", orderId: "TEST", orderName: "TEST",
    lineId: "TEST", variantId: "TEST", kind: "reservation", productTitle: "TEST",
    quantity: 1, unitPrice: "0.00", currency: "TRY", financialStatus: "test_only",
    cancelled: 0, warning: null, status: "PENDING_FOUNDER_APPROVAL",
    corridor: "Samsun-Irak-Proje", sourceUpdatedAt: "2026-10-12T09:00:00Z",
    createdAt: "2026-10-12T09:00:00Z", snapshotToken: "0".repeat(64),
    approvalValid: false, canPublish: false, isPublished: false, reviewedAt: null, publishedAt: null,
  };
}
export default function NexusReviewPreview() {
  const { locale } = useI18n();
  const copy = nexusCopy[locale];
  const current = useRef(testRecord());
  const revision = useRef(0);
  const [row, setRow] = useState(current.current);
  const save = (value: NexusIntake) => {
    const next = { ...value, snapshotToken: (++revision.current).toString(16).padStart(64, "0") };
    current.current = next; setRow(next); return next;
  };
  const sourceChange = (cancelled = false) => save({
    ...current.current, quantity: cancelled ? 0 : current.current.quantity + 1,
    cancelled: cancelled ? 1 : 0, status: "PENDING_FOUNDER_APPROVAL",
    approvalValid: false, canPublish: false, isPublished: false, reviewedAt: null, publishedAt: null,
    sourceUpdatedAt: new Date().toISOString(),
  });
  async function act(reviewed: NexusIntake, action: NexusAction) {
    const latest = current.current;
    if (reviewed.snapshotToken !== latest.snapshotToken) throw { status: 409 };
    if (action === "approve") {
      if (latest.cancelled || latest.quantity <= 0) throw { status: 409 };
      return save({ ...latest, status: "FOUNDER_APPROVED", approvalValid: true, canPublish: true,
        isPublished: false, reviewedAt: new Date().toISOString(), publishedAt: null });
    }
    if (action === "reject") return save({ ...latest, status: "FOUNDER_REJECTED", approvalValid: false,
      canPublish: false, isPublished: false, reviewedAt: new Date().toISOString(), publishedAt: null });
    if (action === "publish") {
      if (!latest.canPublish) throw { status: 409 };
      return save({ ...latest, canPublish: false, isPublished: true, publishedAt: new Date().toISOString() });
    }
    return save({ ...latest, isPublished: false, publishedAt: null, canPublish: latest.approvalValid });
  }
  const published: PublicNexusPublication[] = row.isPublished && row.corridor && row.publishedAt
    ? [{ id: row.id, kind: row.kind, corridor: row.corridor, publishedAt: row.publishedAt }] : [];
  return <div className="min-h-screen bg-background pt-16">
    <section className="mx-auto max-w-5xl px-5">
      <p className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm leading-6 text-primary" data-testid="nexus-preview-isolated">{copy.preview}</p>
      <p className="mt-3 text-xs text-muted-foreground">{copy.testRecord}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="min-h-11 rounded-lg border border-border px-4 text-sm" onClick={() => sourceChange()} data-testid="nexus-source-change">{copy.change}</button>
        <button className="min-h-11 rounded-lg border border-border px-4 text-sm" onClick={() => sourceChange(true)}>{copy.cancellation}</button>
        <button className="min-h-11 rounded-lg border border-border px-4 text-sm" onClick={() => save(testRecord())}>{copy.reset}</button>
      </div>
    </section>
    <NexusReviewDesk preview records={[row]} act={act} reload={async () => [current.current]} />
    <section className="mx-auto max-w-5xl px-5 pb-12" data-testid="nexus-preview-public">
      <h2 className="text-xl font-semibold">{copy.previewPublic}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{copy.publicNote}</p>
      <NexusPublicationCards records={published} />
    </section>
  </div>;
}
