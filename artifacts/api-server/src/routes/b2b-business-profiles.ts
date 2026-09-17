import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import {
  CreateMyB2BBusinessProfileBody,
  GetB2BBusinessProfileReviewQueueQueryParams,
  RequestB2BBusinessVerificationUploadUrlBody,
  UpdateB2BBusinessProfileStatusBody,
  UpdateB2BBusinessProfileStatusParams,
} from "@workspace/api-zod";
import {
  b2bBusinessProfilesTable,
  db,
  type B2BBusinessProfile,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import { requireStaff, requireUser } from "../lib/staffAuth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function serializeBusinessProfile(profile: B2BBusinessProfile) {
  return {
    id: profile.id,
    legalName: profile.legalName,
    publicName: profile.publicName,
    country: profile.country,
    registrationNumber: profile.registrationNumber,
    businessType: profile.businessType,
    field: profile.field,
    website: profile.website,
    contact: profile.contact,
    verificationDocumentObjectPath: profile.verificationDocumentObjectPath,
    verificationDocumentFileName: profile.verificationDocumentFileName,
    verificationDocumentContentType: profile.verificationDocumentContentType,
    verificationDocumentSize: profile.verificationDocumentSize,
    status: profile.status,
    internalNote: profile.internalNote,
    reviewerClerkUserId: profile.reviewerClerkUserId,
    reviewedAt: profile.reviewedAt?.toISOString() ?? null,
    verifiedAt: profile.verifiedAt?.toISOString() ?? null,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

router.get("/b2b/business-profile/me", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const [profile] = await db
    .select()
    .from(b2bBusinessProfilesTable)
    .where(eq(b2bBusinessProfilesTable.ownerClerkUserId, userId))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "İşletme profili bulunamadı." });
    return;
  }

  res.json(serializeBusinessProfile(profile));
});

router.post("/b2b/business-profile/verification-upload-url", async (req, res) => {
  if (!requireUser(req, res)) return;

  const parsed = RequestB2BBusinessVerificationUploadUrlBody.safeParse(
    req.body,
  );
  if (!parsed.success) {
    res.status(400).json({
      error: "Yalnızca en fazla 10 MB boyutunda PDF, JPG veya PNG yükleyebilirsiniz.",
    });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath =
      objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({
      uploadURL,
      objectPath,
      metadata: parsed.data,
    });
  } catch (error) {
    req.log.error(
      { err: error },
      "B2B işletme doğrulama belgesi yükleme adresi oluşturulamadı",
    );
    res.status(500).json({
      error: "Doğrulama belgesi yükleme adresi oluşturulamadı.",
    });
  }
});

router.post("/b2b/business-profile/me", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const parsed = CreateMyB2BBusinessProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error:
        parsed.error.issues[0]?.message ?? "İşletme bilgileri geçersiz.",
    });
    return;
  }

  const [existing] = await db
    .select({ id: b2bBusinessProfilesTable.id })
    .from(b2bBusinessProfilesTable)
    .where(eq(b2bBusinessProfilesTable.ownerClerkUserId, userId))
    .limit(1);

  if (existing) {
    const [existingProfile] = await db
      .select()
      .from(b2bBusinessProfilesTable)
      .where(eq(b2bBusinessProfilesTable.id, existing.id))
      .limit(1);

    if (existingProfile?.status === "rejected") {
      const input = parsed.data;
      const [profile] = await db
        .update(b2bBusinessProfilesTable)
        .set({
          legalName: input.legalName.trim(),
          publicName: input.publicName.trim(),
          country: input.country.trim(),
          registrationNumber: input.registrationNumber.trim(),
          businessType: input.businessType.trim(),
          field: input.field.trim(),
          website: input.website?.trim() || null,
          contact: input.contact.trim(),
          verificationDocumentObjectPath:
            input.verificationDocument.objectPath,
          verificationDocumentFileName:
            input.verificationDocument.fileName.trim(),
          verificationDocumentContentType:
            input.verificationDocument.contentType,
          verificationDocumentSize: input.verificationDocument.size,
          status: "pending",
          internalNote: null,
          reviewerClerkUserId: null,
          reviewedAt: null,
          verifiedAt: null,
        })
        .where(eq(b2bBusinessProfilesTable.id, existing.id))
        .returning();

      req.log.info(
        { businessProfileId: profile.id },
        "Rejected B2B business profile resubmitted for verification",
      );
      res.status(201).json(serializeBusinessProfile(profile));
      return;
    }

    res.status(409).json({
      error: "Bu hesap için zaten bir işletme profili bulunuyor.",
    });
    return;
  }

  const input = parsed.data;
  const [profile] = await db
    .insert(b2bBusinessProfilesTable)
    .values({
      ownerClerkUserId: userId,
      legalName: input.legalName.trim(),
      publicName: input.publicName.trim(),
      country: input.country.trim(),
      registrationNumber: input.registrationNumber.trim(),
      businessType: input.businessType.trim(),
      field: input.field.trim(),
      website: input.website?.trim() || null,
      contact: input.contact.trim(),
      verificationDocumentObjectPath:
        input.verificationDocument.objectPath,
      verificationDocumentFileName: input.verificationDocument.fileName.trim(),
      verificationDocumentContentType:
        input.verificationDocument.contentType,
      verificationDocumentSize: input.verificationDocument.size,
    })
    .returning();

  req.log.info(
    { businessProfileId: profile.id },
    "B2B business profile submitted for verification",
  );
  res.status(201).json(serializeBusinessProfile(profile));
});

router.get("/b2b/business-profiles/review", async (req, res): Promise<void> => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;

  const parsed = GetB2BBusinessProfileReviewQueueQueryParams.safeParse(
    req.query,
  );
  if (!parsed.success) {
    res.status(400).json({ error: "İşletme doğrulama filtreleri geçersiz." });
    return;
  }

  const { status, page, pageSize } = parsed.data;
  const where = status
    ? eq(b2bBusinessProfilesTable.status, status)
    : undefined;
  const offset = (page - 1) * pageSize;
  const [items, countRows] = await Promise.all([
    db
      .select()
      .from(b2bBusinessProfilesTable)
      .where(where)
      .orderBy(desc(b2bBusinessProfilesTable.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(b2bBusinessProfilesTable)
      .where(where),
  ]);

  res.json({
    items: items.map(serializeBusinessProfile),
    page,
    pageSize,
    total: countRows[0]?.count ?? 0,
  });
});

router.patch(
  "/b2b/business-profiles/:id/status",
  async (req, res): Promise<void> => {
    const authorization = await requireStaff(req, res);
    if (!authorization) return;

    const params = UpdateB2BBusinessProfileStatusParams.safeParse(req.params);
    const body = UpdateB2BBusinessProfileStatusBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({
        error: "İşletme doğrulama durum güncellemesi geçersiz.",
      });
      return;
    }

    const [existing] = await db
      .select()
      .from(b2bBusinessProfilesTable)
      .where(eq(b2bBusinessProfilesTable.id, params.data.id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "İşletme profili bulunamadı." });
      return;
    }

    const now = new Date();
    const [updated] = await db
      .update(b2bBusinessProfilesTable)
      .set({
        status: body.data.status,
        internalNote: body.data.internalNote?.trim() || null,
        reviewerClerkUserId: authorization.userId,
        reviewedAt: now,
        verifiedAt:
          body.data.status === "verified"
            ? existing.verifiedAt ?? now
            : null,
      })
      .where(eq(b2bBusinessProfilesTable.id, existing.id))
      .returning();

    req.log.info(
      {
        businessProfileId: updated.id,
        previousStatus: existing.status,
        nextStatus: updated.status,
      },
      "B2B business profile verification status updated",
    );
    res.json(serializeBusinessProfile(updated));
  },
);

export default router;