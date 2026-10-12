import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { nexusShopifyIntakesTable as intakes } from "@workspace/db";
import { logisticsCorridors } from "./nexusLogisticsShopify";
import { isLogisticsFounder } from "./logisticsListingAuth";

export type NexusRecord = typeof intakes.$inferSelect;
export const nexusSourceFields = [
  "orderName", "variantId", "kind", "productTitle", "quantity", "unitPrice",
  "currency", "financialStatus", "cancelled", "warning", "corridor",
] as const;
export type NexusSource = Pick<NexusRecord, typeof nexusSourceFields[number]>;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const instant = (date: Date | null) => date?.toISOString() ?? null;

// Ignore a provider timestamp-only refresh, but bind approval to every actual
// source term and its shop/order/line identity.
export function nexusSourceHash(row: NexusRecord): string {
  return digest([row.shopDomain, row.orderId, row.lineId,
    ...nexusSourceFields.map(field => row[field] ?? null)]);
}

// Also detects concurrent founder decisions, publication and withdrawal.
export function nexusSnapshotToken(row: NexusRecord): string {
  return digest([nexusSourceHash(row), row.status, row.reviewedSourceHash,
    instant(row.reviewedAt), row.reviewedBy, row.publishedSourceHash,
    instant(row.publishedAt), row.publishedBy]);
}

export function hasValidNexusApproval(row: NexusRecord): boolean {
  return row.status === "FOUNDER_APPROVED" && row.cancelled === 0 && row.quantity > 0 &&
    Boolean(row.reviewedAt && row.reviewedBy && isLogisticsFounder(row.reviewedBy)) &&
    row.reviewedSourceHash === nexusSourceHash(row);
}

export function canPublishNexus(row: NexusRecord): boolean {
  return hasValidNexusApproval(row) &&
    logisticsCorridors.some(corridor => corridor === row.corridor);
}

export function isPublishedNexus(row: NexusRecord): boolean {
  return canPublishNexus(row) && Boolean(row.publishedAt && row.publishedBy &&
    isLogisticsFounder(row.publishedBy)) && row.publishedSourceHash === nexusSourceHash(row);
}

export function serializeNexus(row: NexusRecord) {
  return {
    ...row, snapshotToken: nexusSnapshotToken(row), approvalValid: hasValidNexusApproval(row),
    canPublish: canPublishNexus(row) && !isPublishedNexus(row), isPublished: isPublishedNexus(row),
    corridor: logisticsCorridors.some(value => value === row.corridor) ? row.corridor : null,
    sourceUpdatedAt: row.sourceUpdatedAt.toISOString(), createdAt: row.createdAt.toISOString(),
    reviewedAt: instant(row.reviewedAt), publishedAt: instant(row.publishedAt),
  };
}

export function sameNexusSource(old: NexusSource, incoming: NexusSource): boolean {
  return nexusSourceFields.every(field => (old[field] ?? null) === (incoming[field] ?? null));
}

// Both receivers use this reset. A webhook may invalidate a decision, but can
// never approve or publish; an unchanged retry preserves the real decision.
export function nexusReviewUpdate(row: NexusSource) {
  const changed = sql.join(nexusSourceFields.map(field =>
    sql`${intakes[field]} IS DISTINCT FROM ${row[field] ?? null}`), sql` OR `);
  return {
    status: sql`CASE WHEN (${changed}) THEN 'PENDING_FOUNDER_APPROVAL'::nexus_approval_status ELSE ${intakes.status} END`,
    reviewedSourceHash: sql`CASE WHEN (${changed}) THEN NULL ELSE ${intakes.reviewedSourceHash} END`,
    reviewedAt: sql`CASE WHEN (${changed}) THEN NULL ELSE ${intakes.reviewedAt} END`,
    reviewedBy: sql`CASE WHEN (${changed}) THEN NULL ELSE ${intakes.reviewedBy} END`,
    publishedSourceHash: sql`CASE WHEN (${changed}) THEN NULL ELSE ${intakes.publishedSourceHash} END`,
    publishedAt: sql`CASE WHEN (${changed}) THEN NULL ELSE ${intakes.publishedAt} END`,
    publishedBy: sql`CASE WHEN (${changed}) THEN NULL ELSE ${intakes.publishedBy} END`,
  };
}

export class NexusReviewError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function applyNexusDecision(row: NexusRecord, action: "approve" | "reject", actor: string) {
  if (!isLogisticsFounder(actor)) throw new NexusReviewError(403, "Bu karar yalnız kurucudan gelebilir.");
  if (action === "approve" && (row.cancelled !== 0 || row.quantity <= 0)) {
    throw new NexusReviewError(409, "İptal edilmiş veya kaldırılmış kalem onaylanamaz.");
  }
  return { status: action === "approve" ? "FOUNDER_APPROVED" as const : "FOUNDER_REJECTED" as const,
    reviewedSourceHash: nexusSourceHash(row), reviewedAt: new Date(), reviewedBy: actor,
    publishedSourceHash: null, publishedAt: null, publishedBy: null };
}

export function applyNexusPublication(row: NexusRecord, action: "publish" | "withdraw", actor: string) {
  if (!isLogisticsFounder(actor)) throw new NexusReviewError(403, "Bu karar yalnız kurucudan gelebilir.");
  if (action === "withdraw") return { publishedSourceHash: null, publishedAt: null, publishedBy: null };
  if (!canPublishNexus(row)) {
    throw new NexusReviewError(409, "Güncel kurucu onayı ve doğrulanmış lojistik koridoru gerekiyor.");
  }
  if (isPublishedNexus(row)) throw new NexusReviewError(409, "Bu kayıt zaten yayımlanmış.");
  return { publishedSourceHash: nexusSourceHash(row), publishedAt: new Date(), publishedBy: actor };
}
