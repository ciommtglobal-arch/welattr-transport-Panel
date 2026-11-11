import { Router, type IRouter } from "express";
import {
  CreateB2BRequestBody,
  GetB2BRequestReviewQueueQueryParams,
  GetB2BRequestsQueryParams,
  UpdateB2BRequestStatusBody,
  UpdateB2BRequestStatusParams,
} from "@workspace/api-zod";
import {
  b2bRequestsTable,
  db,
  type B2BRequest,
} from "@workspace/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { requireStaff, requireUser } from "../lib/staffAuth";

const router: IRouter = Router();

function createReferenceCode() {
  const year = new Date().getUTCFullYear();
  return `REQ-${year}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function serializeRequest(request: B2BRequest, includeInternalNote = false) {
  return {
    id: request.id,
    referenceCode: request.referenceCode,
    category: request.category,
    title: request.title,
    requesterName: request.requesterName,
    organization: request.organization,
    location: request.location,
    contact: request.contact,
    description: request.description,
    employmentType: request.employmentType,
    salary: request.salary,
    experience: request.experience,
    status: request.status,
    internalNote: includeInternalNote ? request.internalNote : null,
    reviewerClerkUserId: includeInternalNote
      ? request.reviewerClerkUserId
      : null,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    publishedAt: request.publishedAt?.toISOString() ?? null,
  };
}

router.get("/b2b-requests", async (req, res): Promise<void> => {
  const parsed = GetB2BRequestsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Talep filtreleri geçersiz." });
    return;
  }

  const { category, query, page, pageSize } = parsed.data;
  const normalizedQuery = query?.trim();
  const textFilter = normalizedQuery
    ? or(
        ilike(b2bRequestsTable.title, `%${normalizedQuery}%`),
        ilike(b2bRequestsTable.description, `%${normalizedQuery}%`),
        ilike(b2bRequestsTable.location, `%${normalizedQuery}%`),
        ilike(b2bRequestsTable.organization, `%${normalizedQuery}%`),
      )
    : undefined;
  const where = and(
    eq(b2bRequestsTable.status, "approved"),
    category ? eq(b2bRequestsTable.category, category) : undefined,
    textFilter,
  );
  const offset = (page - 1) * pageSize;
  const [items, countRows] = await Promise.all([
    db
      .select()
      .from(b2bRequestsTable)
      .where(where)
      .orderBy(desc(b2bRequestsTable.publishedAt), desc(b2bRequestsTable.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(b2bRequestsTable)
      .where(where),
  ]);

  res.json({
    items: items.map((request) => serializeRequest(request)),
    page,
    pageSize,
    total: countRows[0]?.count ?? 0,
  });
});

router.post("/b2b-requests", async (req, res): Promise<void> => {
  const requesterClerkUserId = requireUser(req, res);
  if (!requesterClerkUserId) return;

  const parsed = CreateB2BRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Talep bilgileri geçersiz.",
    });
    return;
  }

  const input = parsed.data;
  const [request] = await db
    .insert(b2bRequestsTable)
    .values({
      referenceCode: createReferenceCode(),
      requesterClerkUserId,
      category: input.category,
      title: input.title.trim(),
      requesterName: input.requesterName.trim(),
      organization: input.organization?.trim() || null,
      location: input.location.trim(),
      contact: input.contact.trim(),
      description: input.description.trim(),
      employmentType: input.employmentType ?? null,
      salary: input.salary?.trim() || null,
      experience: input.experience?.trim() || null,
    })
    .returning();

  req.log.info(
    { requestId: request.id, referenceCode: request.referenceCode },
    "B2B buyer request submitted",
  );
  res.status(201).json(serializeRequest(request));
});

router.get("/b2b-requests/review", async (req, res): Promise<void> => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;

  const parsed = GetB2BRequestReviewQueueQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Talep inceleme filtreleri geçersiz." });
    return;
  }

  const { status, page, pageSize } = parsed.data;
  const where = status ? eq(b2bRequestsTable.status, status) : undefined;
  const offset = (page - 1) * pageSize;
  const [items, countRows] = await Promise.all([
    db
      .select()
      .from(b2bRequestsTable)
      .where(where)
      .orderBy(desc(b2bRequestsTable.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(b2bRequestsTable)
      .where(where),
  ]);

  res.json({
    items: items.map((request) => serializeRequest(request, true)),
    page,
    pageSize,
    total: countRows[0]?.count ?? 0,
  });
});

router.patch(
  "/b2b-requests/:id/status",
  async (req, res): Promise<void> => {
    const authorization = await requireStaff(req, res);
    if (!authorization) return;

    const params = UpdateB2BRequestStatusParams.safeParse(req.params);
    const body = UpdateB2BRequestStatusBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Talep karar güncellemesi geçersiz." });
      return;
    }

    const [existing] = await db
      .select()
      .from(b2bRequestsTable)
      .where(eq(b2bRequestsTable.id, params.data.id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Talep bulunamadı." });
      return;
    }

    const now = new Date();
    const [updated] = await db
      .update(b2bRequestsTable)
      .set({
        status: body.data.status,
        internalNote: body.data.internalNote?.trim() || null,
        reviewerClerkUserId: authorization.userId,
        reviewedAt: now,
        publishedAt:
          body.data.status === "approved"
            ? existing.publishedAt ?? now
            : null,
      })
      .where(eq(b2bRequestsTable.id, existing.id))
      .returning();

    req.log.info(
      {
        requestId: updated.id,
        previousStatus: existing.status,
        nextStatus: updated.status,
      },
      "B2B buyer request moderation status updated",
    );
    res.json(serializeRequest(updated, true));
  },
);

export default router;