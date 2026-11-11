import { Router, type IRouter } from "express";
import {
  CreateB2BReportBody,
  CreateB2BReportParams,
  GetB2BReportReviewQueueQueryParams,
  RateB2BReportBody,
  RateB2BReportParams,
  UpdateB2BReportStatusBody,
  UpdateB2BReportStatusParams,
} from "@workspace/api-zod";
import {
  b2bReportsTable,
  b2bListingsTable,
  db,
  type B2BReport,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { requireStaff, requireUser } from "../lib/staffAuth";

const router: IRouter = Router();

function createReportReferenceCode() {
  const year = new Date().getUTCFullYear();
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `REPORT-${year}-${suffix}`;
}

function serializeReport(report: B2BReport, includeInternalNote = false) {
  return {
    id: report.id,
    referenceCode: report.referenceCode,
    listingId: report.listingId,
    businessProfileId: report.businessProfileId,
    listingReferenceCode: report.listingReferenceCode,
    listingTitle: report.listingTitle,
    organization: report.organization,
    category: report.category,
    details: report.details,
    status: report.status,
    internalNote: includeInternalNote ? report.internalNote : null,
    reviewerClerkUserId: includeInternalNote
      ? report.reviewerClerkUserId
      : null,
    reviewedAt: report.reviewedAt?.toISOString() ?? null,
    rating: report.rating,
    ratingComment: report.ratingComment,
    ratedAt: report.ratedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

router.post(
  "/b2b-listings/:id/reports",
  async (req, res): Promise<void> => {
    const reporterClerkUserId = requireUser(req, res);
    if (!reporterClerkUserId) return;

    const params = CreateB2BReportParams.safeParse(req.params);
    const body = CreateB2BReportBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Şikâyet bilgileri geçersiz." });
      return;
    }

    const [listing] = await db
      .select()
      .from(b2bListingsTable)
      .where(
        and(
          eq(b2bListingsTable.id, params.data.id),
          eq(b2bListingsTable.status, "approved"),
        ),
      )
      .limit(1);

    if (!listing) {
      res.status(404).json({ error: "İlan bulunamadı." });
      return;
    }

    const [report] = await db
      .insert(b2bReportsTable)
      .values({
        referenceCode: createReportReferenceCode(),
        reporterClerkUserId,
        listingId: listing.id,
        businessProfileId: listing.businessProfileId,
        listingReferenceCode: listing.referenceCode,
        listingTitle: listing.title,
        organization: listing.organization,
        category: body.data.category,
        details: body.data.details.trim(),
      })
      .returning();

    req.log.info(
      {
        reportId: report.id,
        listingId: listing.id,
        category: report.category,
      },
      "B2B listing report submitted",
    );
    res.status(201).json(serializeReport(report));
  },
);

router.get("/b2b-reports/review", async (req, res): Promise<void> => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;

  const parsed = GetB2BReportReviewQueueQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Şikâyet filtreleri geçersiz." });
    return;
  }

  const { status, page, pageSize } = parsed.data;
  const where = status ? eq(b2bReportsTable.status, status) : undefined;
  const offset = (page - 1) * pageSize;
  const [items, countRows] = await Promise.all([
    db
      .select()
      .from(b2bReportsTable)
      .where(where)
      .orderBy(desc(b2bReportsTable.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(b2bReportsTable)
      .where(where),
  ]);

  res.json({
    items: items.map((report) => serializeReport(report, true)),
    page,
    pageSize,
    total: countRows[0]?.count ?? 0,
  });
});

router.post(
  "/b2b-reports/:id/rating",
  async (req, res): Promise<void> => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const params = RateB2BReportParams.safeParse(req.params);
    const body = RateB2BReportBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Puan bilgileri geçersiz." });
      return;
    }

    const [existing] = await db
      .select()
      .from(b2bReportsTable)
      .where(
        and(
          eq(b2bReportsTable.id, params.data.id),
          eq(b2bReportsTable.reporterClerkUserId, userId),
        ),
      )
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Şikâyet kaydı bulunamadı." });
      return;
    }

    const [updated] = await db
      .update(b2bReportsTable)
      .set({
        rating: body.data.rating,
        ratingComment: body.data.comment?.trim() || null,
        ratedAt: new Date(),
      })
      .where(eq(b2bReportsTable.id, existing.id))
      .returning();
    res.json(serializeReport(updated));
  },
);

router.patch(
  "/b2b-reports/:id/status",
  async (req, res): Promise<void> => {
    const authorization = await requireStaff(req, res);
    if (!authorization) return;

    const params = UpdateB2BReportStatusParams.safeParse(req.params);
    const body = UpdateB2BReportStatusBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Şikâyet karar güncellemesi geçersiz." });
      return;
    }

    const [existing] = await db
      .select()
      .from(b2bReportsTable)
      .where(eq(b2bReportsTable.id, params.data.id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Şikâyet bulunamadı." });
      return;
    }

    const [updated] = await db
      .update(b2bReportsTable)
      .set({
        status: body.data.status,
        internalNote: body.data.internalNote?.trim() || null,
        reviewerClerkUserId: authorization.userId,
        reviewedAt: new Date(),
      })
      .where(eq(b2bReportsTable.id, existing.id))
      .returning();

    req.log.info(
      {
        reportId: updated.id,
        previousStatus: existing.status,
        nextStatus: updated.status,
      },
      "B2B report moderation status updated",
    );
    res.json(serializeReport(updated, true));
  },
);

export default router;