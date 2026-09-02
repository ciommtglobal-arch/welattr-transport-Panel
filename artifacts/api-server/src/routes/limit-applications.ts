import { randomBytes } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import {
  CreateLimitApplicationBody,
  GetLimitApplicationsQueryParams,
  UpdateLimitApplicationStatusBody,
  UpdateLimitApplicationStatusParams,
} from "@workspace/api-zod";
import {
  db,
  limitApplicationAuditLogsTable,
  limitApplicationsTable,
  staffUsersTable,
  type LimitApplication,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

function serializeApplication(application: LimitApplication) {
  return {
    id: application.id,
    referenceCode: application.referenceCode,
    applicationType: application.applicationType,
    fullName: application.fullName,
    company: application.company,
    email: application.email,
    phone: application.phone,
    requestType: application.requestType,
    amount: application.amount,
    currency: application.currency,
    note: application.note,
    status: application.status,
    internalNote: application.internalNote,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

function createReferenceCode() {
  const year = new Date().getUTCFullYear();
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `MMT-${year}-${suffix}`;
}

async function requireStaff(req: Request, res: Response) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Oturum açmanız gerekiyor." });
    return null;
  }

  const [staff] = await db
    .select()
    .from(staffUsersTable)
    .where(
      and(
        eq(staffUsersTable.clerkUserId, userId),
        eq(staffUsersTable.active, 1),
      ),
    )
    .limit(1);

  if (!staff) {
    res.status(403).json({ error: "Bu alan için personel yetkisi gerekiyor." });
    return null;
  }

  return { staff, userId };
}

router.post("/limit-applications", async (req, res) => {
  const parsed = CreateLimitApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Başvuru bilgileri geçersiz.",
    });
    return;
  }

  const applicantClerkUserId = getAuth(req).userId ?? null;
  const created = await db.transaction(async (tx) => {
    const [application] = await tx
      .insert(limitApplicationsTable)
      .values({
        ...parsed.data,
        note: parsed.data.note?.trim() || null,
        referenceCode: createReferenceCode(),
        applicantClerkUserId,
      })
      .returning();

    await tx.insert(limitApplicationAuditLogsTable).values({
      applicationId: application.id,
      actorClerkUserId: applicantClerkUserId,
      action: "application_created",
      nextStatus: "new",
    });

    return application;
  });

  res.status(201).json(serializeApplication(created));
});

router.get("/limit-applications", async (req, res) => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;

  const parsed = GetLimitApplicationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Liste filtreleri geçersiz." });
    return;
  }

  const { page, pageSize, status } = parsed.data;
  const where = status ? eq(limitApplicationsTable.status, status) : undefined;
  const offset = (page - 1) * pageSize;

  const [items, countRows] = await Promise.all([
    db
      .select()
      .from(limitApplicationsTable)
      .where(where)
      .orderBy(desc(limitApplicationsTable.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(limitApplicationsTable)
      .where(where),
  ]);

  res.json({
    items: items.map(serializeApplication),
    page,
    pageSize,
    total: countRows[0]?.count ?? 0,
  });
});

router.patch("/limit-applications/:id/status", async (req, res) => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;

  const params = UpdateLimitApplicationStatusParams.safeParse(req.params);
  const body = UpdateLimitApplicationStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Durum güncellemesi geçersiz." });
    return;
  }

  const [existing] = await db
    .select()
    .from(limitApplicationsTable)
    .where(eq(limitApplicationsTable.id, params.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Başvuru bulunamadı." });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    const [application] = await tx
      .update(limitApplicationsTable)
      .set({
        status: body.data.status,
        internalNote: body.data.internalNote?.trim() || null,
        reviewerClerkUserId: authorization.userId,
        reviewedAt: new Date(),
      })
      .where(eq(limitApplicationsTable.id, existing.id))
      .returning();

    await tx.insert(limitApplicationAuditLogsTable).values({
      applicationId: existing.id,
      actorClerkUserId: authorization.userId,
      action: "status_updated",
      previousStatus: existing.status,
      nextStatus: body.data.status,
      metadata: {
        role: authorization.staff.role,
        internalNoteChanged:
          (existing.internalNote ?? null) !==
          (body.data.internalNote?.trim() || null),
      },
    });

    return application;
  });

  res.json(serializeApplication(updated));
});

export default router;