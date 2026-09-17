import { Router, type IRouter } from "express";
import {
  CreateB2BListingBody,
  RequestB2BListingImageUploadUrlBody,
  GetB2BListingParams,
  GetB2BListingsQueryParams,
  GetB2BListingReviewQueueQueryParams,
  UpdateB2BListingStatusBody,
  UpdateB2BListingStatusParams,
} from "@workspace/api-zod";
import {
  b2bBusinessProfilesTable,
  b2bListingsTable,
  db,
  type B2BListing,
  type B2BListingSocialLinks,
} from "@workspace/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireStaff, requireUser } from "../lib/staffAuth";
import { ObjectStorageService } from "../lib/objectStorage";
import { randomBytes } from "node:crypto";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function createReferenceCode() {
  const year = new Date().getUTCFullYear();
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `B2B-${year}-${suffix}`;
}

function cleanSocialLinks(
  links: B2BListingSocialLinks | undefined,
): B2BListingSocialLinks | null {
  if (!links) return null;

  const cleaned = Object.fromEntries(
    Object.entries(links).filter(([, value]) => value?.trim()),
  ) as B2BListingSocialLinks;

  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function serializeListing(listing: B2BListing, includeInternalNote = false) {
  return {
    id: listing.id,
    referenceCode: listing.referenceCode,
    role: listing.role,
    title: listing.title,
    fullName: listing.fullName,
    organization: listing.organization,
    location: listing.location,
    contact: listing.contact,
    description: listing.description,
    imageUrl: listing.imageObjectPath
      ? `/api/b2b-listings/${listing.id}/image`
      : null,
    employmentType: listing.employmentType,
    salary: listing.salary,
    experience: listing.experience,
    website: listing.website,
    socialLinks: listing.socialLinks ?? null,
    status: listing.status,
    internalNote: includeInternalNote ? listing.internalNote : null,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    publishedAt: listing.publishedAt?.toISOString() ?? null,
  };
}

router.post(
  "/b2b-listings/image-upload-url",
  async (req, res): Promise<void> => {
    const userId = requireUser(req, res);
    if (!userId) return;

    const parsed = RequestB2BListingImageUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "İlan görseli geçersiz." });
      return;
    }

    const [businessProfile] = await db
      .select({ status: b2bBusinessProfilesTable.status })
      .from(b2bBusinessProfilesTable)
      .where(
        eq(b2bBusinessProfilesTable.ownerClerkUserId, userId),
      )
      .limit(1);

    if (businessProfile?.status !== "verified") {
      res.status(403).json({
        error: "İlan görseli yüklemek için doğrulanmış işletme profili gerekiyor.",
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
      req.log.error({ err: error }, "B2B ilan görseli yükleme adresi oluşturulamadı");
      res.status(500).json({
        error: "İlan görseli yükleme adresi oluşturulamadı.",
      });
    }
  },
);

router.get("/b2b-listings/:id/image", async (req, res): Promise<void> => {
  const params = GetB2BListingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "İlan numarası geçersiz." });
    return;
  }

  const [listing] = await db
    .select({
      imageObjectPath: b2bListingsTable.imageObjectPath,
    })
    .from(b2bListingsTable)
    .where(
      and(
        eq(b2bListingsTable.id, params.data.id),
        eq(b2bListingsTable.status, "approved"),
      ),
    )
    .limit(1);

  if (!listing?.imageObjectPath) {
    res.status(404).json({ error: "İlan görseli bulunamadı." });
    return;
  }

  try {
    const download = await objectStorageService.getObjectEntityDownloadURL(
      listing.imageObjectPath,
    );
    res.redirect(download.downloadURL);
  } catch (error) {
    req.log.error({ err: error }, "B2B ilan görseli açılamadı");
    res.status(404).json({ error: "İlan görseli bulunamadı." });
  }
});

router.get("/b2b-listings", async (req, res): Promise<void> => {
  const parsed = GetB2BListingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "İlan filtreleri geçersiz." });
    return;
  }

  const { role, query, page, pageSize } = parsed.data;
  const normalizedQuery = query?.trim();
  const textFilter = normalizedQuery
    ? or(
        ilike(b2bListingsTable.title, `%${normalizedQuery}%`),
        ilike(b2bListingsTable.organization, `%${normalizedQuery}%`),
        ilike(b2bListingsTable.description, `%${normalizedQuery}%`),
        ilike(b2bListingsTable.location, `%${normalizedQuery}%`),
      )
    : undefined;
  const where = and(
    eq(b2bListingsTable.status, "approved"),
    role ? eq(b2bListingsTable.role, role) : undefined,
    textFilter,
  );
  const offset = (page - 1) * pageSize;

  const [items, countRows] = await Promise.all([
    db
      .select()
      .from(b2bListingsTable)
      .where(where)
      .orderBy(desc(b2bListingsTable.publishedAt), desc(b2bListingsTable.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(b2bListingsTable)
      .where(where),
  ]);

  res.json({
    items: items.map((item) => serializeListing(item)),
    page,
    pageSize,
    total: countRows[0]?.count ?? 0,
  });
});

router.post("/b2b-listings", async (req, res): Promise<void> => {
  const submitterClerkUserId = requireUser(req, res);
  if (!submitterClerkUserId) return;

  const parsed = CreateB2BListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "İlan bilgileri geçersiz.",
    });
    return;
  }

  const input = parsed.data;
  const [businessProfile] = await db
    .select()
    .from(b2bBusinessProfilesTable)
    .where(
      eq(b2bBusinessProfilesTable.ownerClerkUserId, submitterClerkUserId),
    )
    .limit(1);

  if (!businessProfile) {
    res.status(403).json({
      error:
        "İlan yayınlamak için önce MMT Connect işletme profilinizi oluşturup doğrulatın.",
    });
    return;
  }

  if (businessProfile.status !== "verified") {
    const statusMessage =
      businessProfile.status === "pending"
        ? "İşletme profiliniz doğrulama bekliyor."
        : businessProfile.status === "rejected"
          ? "İşletme profiliniz doğrulanmadı. Bilgilerinizi güncelleyip yeniden başvurun."
          : "İşletme profiliniz askıya alınmış durumda.";
    res.status(403).json({ error: statusMessage });
    return;
  }

  const publishedAt = new Date();
  const [listing] = await db
    .insert(b2bListingsTable)
    .values({
      referenceCode: createReferenceCode(),
      submitterClerkUserId,
      businessProfileId: businessProfile.id,
      role: input.role,
      title: input.title.trim(),
      fullName: input.fullName.trim(),
      organization: input.organization.trim(),
      location: input.location.trim(),
      contact: input.contact.trim(),
      description: input.description.trim(),
      imageObjectPath: input.imageObjectPath ?? null,
      employmentType: input.employmentType ?? null,
      salary: input.salary?.trim() || null,
      experience: input.experience?.trim() || null,
      website: input.website?.trim() || null,
      socialLinks: cleanSocialLinks(input.socialLinks),
      status: "approved",
      publishedAt,
    })
    .returning();

  req.log.info(
    { listingId: listing.id, referenceCode: listing.referenceCode },
    "B2B listing published by verified business",
  );
  res.status(201).json(serializeListing(listing, true));
});

router.get("/b2b-listings/review", async (req, res): Promise<void> => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;

  const parsed = GetB2BListingReviewQueueQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "İlan inceleme filtreleri geçersiz." });
    return;
  }

  const { status, page, pageSize } = parsed.data;
  const where = status
    ? eq(b2bListingsTable.status, status)
    : undefined;
  const offset = (page - 1) * pageSize;

  const [items, countRows] = await Promise.all([
    db
      .select()
      .from(b2bListingsTable)
      .where(where)
      .orderBy(desc(b2bListingsTable.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(b2bListingsTable)
      .where(where),
  ]);

  res.json({
    items: items.map((item) => serializeListing(item, true)),
    page,
    pageSize,
    total: countRows[0]?.count ?? 0,
  });
});

router.get("/b2b-listings/:id", async (req, res): Promise<void> => {
  const params = GetB2BListingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "İlan numarası geçersiz." });
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

  res.json(serializeListing(listing));
});

router.patch("/b2b-listings/:id/status", async (req, res): Promise<void> => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;

  const params = UpdateB2BListingStatusParams.safeParse(req.params);
  const body = UpdateB2BListingStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "İlan durum güncellemesi geçersiz." });
    return;
  }

  const [existing] = await db
    .select()
    .from(b2bListingsTable)
    .where(eq(b2bListingsTable.id, params.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "İlan bulunamadı." });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(b2bListingsTable)
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
    .where(eq(b2bListingsTable.id, existing.id))
    .returning();

  req.log.info(
    {
      listingId: updated.id,
      previousStatus: existing.status,
      nextStatus: updated.status,
    },
    "B2B listing moderation status updated",
  );
  res.json(serializeListing(updated, true));
});

export default router;