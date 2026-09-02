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
  limitApplicationDocumentsTable,
  limitApplicationsTable,
  staffUsersTable,
  type LimitApplication,
  type LimitApplicationDocument,
} from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function serializeApplication(
  application: LimitApplication,
  documents: LimitApplicationDocument[],
) {
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
    vehicleDetails: application.vehicleDetails,
    documents: documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      objectPath: document.objectPath,
      fileName: document.fileName,
      contentType: document.contentType,
      size: document.size,
    })),
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

  const requiredDocumentTypes: Array<
    (typeof parsed.data.documents)[number]["documentType"]
  > = [
    "personal_information",
    "tax_certificate",
    "signature_circular",
    "kkb_report",
    "findeks_report",
    ...(parsed.data.applicationType === "individual"
      ? ["ssk_service_statement" as const]
      : []),
  ];
  const providedDocumentTypes = new Set(
    parsed.data.documents.map((document) => document.documentType),
  );
  const missingDocument = requiredDocumentTypes.find(
    (documentType) => !providedDocumentTypes.has(documentType),
  );
  if (missingDocument) {
    res.status(400).json({ error: "Gerekli başvuru belgeleri eksik." });
    return;
  }

  if (
    parsed.data.applicationType === "vehicle" &&
    !parsed.data.vehicleDetails?.trim()
  ) {
    res.status(400).json({ error: "Araç bilgilerini girmeniz gerekiyor." });
    return;
  }

  try {
    await Promise.all(
      parsed.data.documents.map((document) =>
        objectStorageService.getObjectEntityFile(document.objectPath),
      ),
    );
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "Yüklenen belgelerden biri bulunamadı." });
      return;
    }
    throw error;
  }

  const applicantClerkUserId = getAuth(req).userId ?? null;
  const created = await db.transaction(async (tx) => {
    const { documents, ...applicationData } = parsed.data;
    const [application] = await tx
      .insert(limitApplicationsTable)
      .values({
        ...applicationData,
        vehicleDetails: applicationData.vehicleDetails?.trim() || null,
        note: applicationData.note?.trim() || null,
        referenceCode: createReferenceCode(),
        applicantClerkUserId,
      })
      .returning();

    const createdDocuments = await tx
      .insert(limitApplicationDocumentsTable)
      .values(
        documents.map((document) => ({
          applicationId: application.id,
          ...document,
        })),
      )
      .returning();

    await tx.insert(limitApplicationAuditLogsTable).values({
      applicationId: application.id,
      actorClerkUserId: applicantClerkUserId,
      action: "application_created",
      nextStatus: "new",
      metadata: { documentCount: createdDocuments.length },
    });

    return { application, documents: createdDocuments };
  });

  res
    .status(201)
    .json(serializeApplication(created.application, created.documents));
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
  const documents =
    items.length === 0
      ? []
      : await db
          .select()
          .from(limitApplicationDocumentsTable)
          .where(
            inArray(
              limitApplicationDocumentsTable.applicationId,
              items.map((item) => item.id),
            ),
          );

  res.json({
    items: items.map((application) =>
      serializeApplication(
        application,
        documents.filter(
          (document) => document.applicationId === application.id,
        ),
      ),
    ),
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

  const documents = await db
    .select()
    .from(limitApplicationDocumentsTable)
    .where(eq(limitApplicationDocumentsTable.applicationId, updated.id));

  res.json(serializeApplication(updated, documents));
});

export default router;