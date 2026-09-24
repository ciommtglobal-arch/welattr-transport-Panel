import { Router, type IRouter } from "express";
import {
  CreateMediaItemBody,
  DecideMediaItemBody,
  GetMediaItemsQueryParams,
  RecordMediaPublicationBody,
  RequestMediaUploadUrlBody,
  ReviewMediaItemBody,
  UpdateMediaItemBody,
} from "@workspace/api-zod";
import {
  db,
  mediaItemEventsTable,
  mediaItemsTable,
  type MediaItem,
} from "@workspace/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireStaff, requireUser } from "../lib/staffAuth";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";
import { dispatchMediaToTelegram } from "../lib/mediaPublisher";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const PILOT_NOTICE = "MMT Global, uzman ekibiyle pilot çalışma ve altyapı doğrulama aşamasındadır";

async function mediaActor(req: Parameters<typeof requireUser>[0], res: Parameters<typeof requireUser>[1]) {
  const userId = requireUser(req, res);
  if (!userId) return null;
  const founder = Boolean(process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID?.trim()) &&
    process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID?.trim() === userId;
  if (founder) return { userId, founder: true, staff: null };
  const authorized = await requireStaff(req, res);
  return authorized ? { userId, founder: false, staff: authorized.staff } : null;
}

function canReview(actor: NonNullable<Awaited<ReturnType<typeof mediaActor>>>) {
  return Boolean(actor.staff && ["reviewer", "admin"].includes(actor.staff.role));
}

function validPilotContent(item: Pick<MediaItem, "pilotType" | "summary" | "includesTeamMembers" | "consentNote">) {
  if (item.pilotType !== "pilot_real" && item.pilotType !== "test") return "İçeriği önce gerçek pilot veya TEST olarak işaretleyin.";
  if (item.pilotType === "pilot_real" && !item.summary.includes(PILOT_NOTICE)) {
    return `Gerçek pilot tanıtımında şu bilgi bulunmalı: ${PILOT_NOTICE}.`;
  }
  if (item.includesTeamMembers === 1 && !item.consentNote?.trim()) {
    return "Ekip üyesinin adı veya görüntüsü için alınan izni kaydedin.";
  }
  return null;
}

function serializeMediaItem(item: MediaItem) {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    category: item.category,
    sourceUrl: item.sourceUrl,
    hasFile: Boolean(item.objectPath),
    fileName: item.fileName,
    contentType: item.contentType,
    size: item.size,
    status: item.status,
    pilotType: item.pilotType,
    includesTeamMembers: item.includesTeamMembers === 1,
    consentNote: item.consentNote,
    mediaReviewedAt: item.mediaReviewedAt?.toISOString() ?? null,
    lastDecisionNote: item.lastDecisionNote,
    founderApprovedAt: item.founderApprovedAt?.toISOString() ?? null,
    publicationUrl: item.publicationUrl,
    publicationResults: item.publicationResults,
    publicationMethod: item.publicationMethod,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    publishedAt: item.publishedAt?.toISOString() ?? null,
  };
}

function isPrivateObjectPath(value: string) {
  return /^\/objects\/uploads\/[a-zA-Z0-9-]+$/.test(value);
}

router.get("/media/items", async (req, res): Promise<void> => {
  const actor = await mediaActor(req, res);
  if (!actor) return;

  const parsed = GetMediaItemsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Medya filtreleri geçersiz." });
    return;
  }

  const { status, query, page, pageSize } = parsed.data;
  const normalizedQuery = query?.trim();
  const textFilter = normalizedQuery
    ? or(
        ilike(mediaItemsTable.title, `%${normalizedQuery}%`),
        ilike(mediaItemsTable.summary, `%${normalizedQuery}%`),
        ilike(mediaItemsTable.category, `%${normalizedQuery}%`),
      )
    : undefined;
  const where = and(
    status ? eq(mediaItemsTable.status, status) : undefined,
    textFilter,
  );
  const offset = (page - 1) * pageSize;

  const [items, countRows] = await Promise.all([
    db
      .select()
      .from(mediaItemsTable)
      .where(where)
      .orderBy(desc(mediaItemsTable.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(mediaItemsTable)
      .where(where),
  ]);

  res.json({
    items: items.map(serializeMediaItem),
    page,
    pageSize,
    total: countRows[0]?.count ?? 0,
    permissions: {
      canCreate: Boolean(actor.staff),
      canReview: canReview(actor),
      canApprove: actor.founder,
      canPublish: actor.founder || canReview(actor),
    },
  });
});

router.post("/media/uploads/request-url", async (req, res): Promise<void> => {
  if (!(await requireStaff(req, res))) return;

  const parsed = RequestMediaUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Yalnızca izin verilen türlerde ve en fazla 50 MB boyutunda dosya yükleyebilirsiniz.",
    });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({
      uploadURL,
      objectPath,
      metadata: parsed.data,
    });
  } catch (error) {
    req.log.error({ err: error }, "Medya yükleme adresi oluşturulamadı");
    res.status(500).json({ error: "Medya yükleme adresi oluşturulamadı." });
  }
});

router.post("/media/items", async (req, res): Promise<void> => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;

  const parsed = CreateMediaItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Medya bilgileri geçersiz.",
    });
    return;
  }

  if (parsed.data.objectPath && !isPrivateObjectPath(parsed.data.objectPath)) {
    res.status(400).json({ error: "Medya dosyası yolu geçersiz." });
    return;
  }

  if (parsed.data.pilotType !== "pilot_real" && parsed.data.pilotType !== "test") {
    res.status(400).json({ error: "Gerçek pilot veya TEST seçimi zorunludur." });
    return;
  }
  const [item] = await db
    .insert(mediaItemsTable)
    .values({
      ...parsed.data,
      includesTeamMembers: parsed.data.includesTeamMembers ? 1 : 0,
      createdByClerkUserId: authorization.userId,
    })
    .returning();

  res.status(201).json(serializeMediaItem(item));
});

router.patch("/media/items/:id", async (req, res): Promise<void> => {
  if (!(await requireStaff(req, res))) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Medya numarası geçersiz." });
    return;
  }

  const parsed = UpdateMediaItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Medya güncellemesi geçersiz.",
    });
    return;
  }

  if (parsed.data.objectPath && !isPrivateObjectPath(parsed.data.objectPath)) {
    res.status(400).json({ error: "Medya dosyası yolu geçersiz." });
    return;
  }

  const [existing] = await db
    .select()
    .from(mediaItemsTable)
    .where(eq(mediaItemsTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Medya kaydı bulunamadı." });
    return;
  }

  if (existing.status !== "draft") {
    res.status(409).json({ error: "Yalnızca taslak düzenlenebilir; incelemeden iade edilmesini bekleyin." });
    return;
  }
  const { includesTeamMembers, ...editableFields } = parsed.data;
  const [item] = await db
    .update(mediaItemsTable)
    .set({
      ...editableFields,
      ...(includesTeamMembers !== undefined ? { includesTeamMembers: includesTeamMembers ? 1 : 0 } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(mediaItemsTable.id, id), eq(mediaItemsTable.status, "draft")))
    .returning();
  if (!item) { res.status(409).json({ error: "Taslak durumu değişti; yenileyin." }); return; }
  res.json(serializeMediaItem(item));
});

function mediaId(value: string | undefined) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.post("/media/items/:id/submit", async (req, res): Promise<void> => {
  const actor = await mediaActor(req, res);
  if (!actor) return;
  if (!actor.staff) { res.status(403).json({ error: "Medya personeli yetkisi gerekiyor." }); return; }
  const id = mediaId(req.params.id);
  if (!id) { res.status(400).json({ error: "Medya numarası geçersiz." }); return; }
  const [item] = await db.select().from(mediaItemsTable).where(eq(mediaItemsTable.id, id)).limit(1);
  if (!item) { res.status(404).json({ error: "Medya kaydı bulunamadı." }); return; }
  if (item.status !== "draft") { res.status(409).json({ error: "Yalnızca taslak incelemeye gönderilebilir." }); return; }
  const issue = validPilotContent(item);
  if (issue) { res.status(400).json({ error: issue }); return; }
  const updated = await db.transaction(async tx => {
    const [next] = await tx.update(mediaItemsTable).set({ status: "media_review", updatedAt: new Date() })
      .where(and(eq(mediaItemsTable.id, id), eq(mediaItemsTable.status, "draft"))).returning();
    if (next) await tx.insert(mediaItemEventsTable).values({ mediaItemId: id, actorClerkUserId: actor.userId, action: "submitted" });
    return next;
  });
  if (!updated) { res.status(409).json({ error: "Kayıt değişti; yenileyin." }); return; }
  res.json(serializeMediaItem(updated));
});

router.post("/media/items/:id/review", async (req, res): Promise<void> => {
  const actor = await mediaActor(req, res);
  if (!actor) return;
  if (!canReview(actor) || actor.founder) { res.status(403).json({ error: "Medya sorumlusu yetkisi gerekiyor." }); return; }
  const id = mediaId(req.params.id);
  const body = ReviewMediaItemBody.safeParse(req.body);
  if (!id || !body.success) { res.status(400).json({ error: "İnceleme kararı geçersiz." }); return; }
  if (body.data.decision === "reject" && !body.data.note?.trim()) {
    res.status(400).json({ error: "İade gerekçesi zorunludur." }); return;
  }
  const updated = await db.transaction(async tx => {
    const [next] = await tx.update(mediaItemsTable).set({
      status: body.data.decision === "approve" ? "founder_review" : "draft",
      mediaReviewedBy: body.data.decision === "approve" ? actor.userId : null,
      mediaReviewedAt: body.data.decision === "approve" ? new Date() : null,
      lastDecisionNote: body.data.note?.trim() || null,
      updatedAt: new Date(),
    }).where(and(eq(mediaItemsTable.id, id), eq(mediaItemsTable.status, "media_review"))).returning();
    if (next) await tx.insert(mediaItemEventsTable).values({
      mediaItemId: id, actorClerkUserId: actor.userId,
      action: body.data.decision === "approve" ? "media_approved" : "media_returned",
      note: body.data.note?.trim() || null,
    });
    return next;
  });
  if (!updated) { res.status(409).json({ error: "İncelemede kayıt bulunamadı veya durum değişti." }); return; }
  res.json(serializeMediaItem(updated));
});

router.post("/media/items/:id/founder-decision", async (req, res): Promise<void> => {
  const actor = await mediaActor(req, res);
  if (!actor) return;
  if (!actor.founder) { res.status(403).json({ error: "Kurucu onayı gerekiyor." }); return; }
  const id = mediaId(req.params.id);
  const body = DecideMediaItemBody.safeParse(req.body);
  if (!id || !body.success) { res.status(400).json({ error: "Kurucu kararı geçersiz." }); return; }
  if (body.data.decision === "reject" && !body.data.note?.trim()) {
    res.status(400).json({ error: "İade gerekçesi zorunludur." }); return;
  }
  const updated = await db.transaction(async tx => {
    const [next] = await tx.update(mediaItemsTable).set({
      status: body.data.decision === "approve" ? "approved" : "draft",
      founderApprovedBy: body.data.decision === "approve" ? actor.userId : null,
      founderApprovedAt: body.data.decision === "approve" ? new Date() : null,
      lastDecisionNote: body.data.note?.trim() || null,
      updatedAt: new Date(),
    }).where(and(eq(mediaItemsTable.id, id), eq(mediaItemsTable.status, "founder_review"))).returning();
    if (next) await tx.insert(mediaItemEventsTable).values({
      mediaItemId: id, actorClerkUserId: actor.userId,
      action: body.data.decision === "approve" ? "founder_approved" : "founder_returned",
      note: body.data.note?.trim() || null,
    });
    return next;
  });
  if (!updated) { res.status(409).json({ error: "Kurucu incelemesinde kayıt bulunamadı veya durum değişti." }); return; }
  res.json(serializeMediaItem(updated));
});

router.post("/media/items/:id/record-publication", async (req, res): Promise<void> => {
  const actor = await mediaActor(req, res);
  if (!actor) return;
  if (!actor.founder && !canReview(actor)) { res.status(403).json({ error: "Yayın kaydı için medya veya kurucu yetkisi gerekiyor." }); return; }
  const id = mediaId(req.params.id);
  const body = RecordMediaPublicationBody.safeParse(req.body);
  if (!id || !body.success || !/^https:\/\//i.test(body.data.url)) {
    res.status(400).json({ error: "Geçerli bir HTTPS yayın bağlantısı girin." }); return;
  }
  const updated = await db.transaction(async tx => {
    const [next] = await tx.update(mediaItemsTable).set({
      status: "publication_pending", publicationUrl: body.data.url.trim(),
      publicationResults: body.data.results?.trim() || null,
      publicationMethod: "manual", updatedAt: new Date(),
    }).where(and(eq(mediaItemsTable.id, id), eq(mediaItemsTable.status, "approved"), eq(mediaItemsTable.pilotType, "pilot_real"))).returning();
    if (next) await tx.insert(mediaItemEventsTable).values({ mediaItemId: id, actorClerkUserId: actor.userId, action: "manual_publication", note: body.data.url.trim() });
    return next;
  });
  if (!updated) { res.status(409).json({ error: "Yalnızca kurucunun onayladığı gerçek pilot içeriği yayımlanabilir." }); return; }
  res.json(serializeMediaItem(updated));
});

router.post("/media/items/:id/confirm-publication", async (req, res): Promise<void> => {
  const actor = await mediaActor(req, res);
  if (!actor) return;
  if (!actor.founder) { res.status(403).json({ error: "Yayın bağlantısını kurucu teyit etmelidir." }); return; }
  const id = mediaId(req.params.id);
  if (!id) { res.status(400).json({ error: "Medya numarası geçersiz." }); return; }
  const [item] = await db.select().from(mediaItemsTable).where(eq(mediaItemsTable.id, id)).limit(1);
  if (!item || item.status !== "publication_pending" || item.pilotType !== "pilot_real" || !item.founderApprovedAt || !item.publicationUrl) {
    res.status(409).json({ error: "Teyit bekleyen gerçek yayın bağlantısı bulunamadı." }); return;
  }
  const updated = await db.transaction(async tx => {
    const [next] = await tx.update(mediaItemsTable).set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(mediaItemsTable.id, id), eq(mediaItemsTable.status, "publication_pending"), eq(mediaItemsTable.pilotType, "pilot_real"))).returning();
    if (next) await tx.insert(mediaItemEventsTable).values({
      mediaItemId: id, actorClerkUserId: actor.userId, action: "manual_publication_confirmed",
      note: item.publicationUrl,
    });
    return next;
  });
  if (!updated) { res.status(409).json({ error: "Yayın durumu değişti; yenileyin." }); return; }
  res.json(serializeMediaItem(updated));
});

router.post("/media/items/:id/publish", async (req, res): Promise<void> => {
  const actor = await mediaActor(req, res);
  if (!actor) return;
  if (!actor.founder) { res.status(403).json({ error: "Telegram yayını için kurucu yetkisi gerekiyor." }); return; }
  const id = mediaId(req.params.id);
  if (!id) { res.status(400).json({ error: "Medya numarası geçersiz." }); return; }
  const [item] = await db.select().from(mediaItemsTable).where(eq(mediaItemsTable.id, id)).limit(1);
  if (!item || item.status !== "approved" || item.pilotType !== "pilot_real" || !item.founderApprovedAt) {
    res.status(409).json({ error: "Kurucu onaylı gerçek pilot içeriği gerekiyor; TEST gönderilemez." }); return;
  }
  try {
    const delivery = await dispatchMediaToTelegram(id);
    const chat = process.env.MEDIA_TELEGRAM_CHAT_ID?.trim();
    const publicationUrl = chat?.startsWith("@") && delivery.externalId
      ? `https://t.me/${chat.slice(1)}/${delivery.externalId}` : null;
    const updated = await db.transaction(async tx => {
      const [next] = await tx.update(mediaItemsTable).set({
        status: "published", publishedAt: delivery.sentAt ?? new Date(),
        publicationUrl, publicationMethod: "telegram",
        publicationResults: delivery.externalId ? `Telegram mesajı: ${delivery.externalId}` : null,
        updatedAt: new Date(),
      }).where(and(eq(mediaItemsTable.id, id), eq(mediaItemsTable.status, "approved"), eq(mediaItemsTable.pilotType, "pilot_real"))).returning();
      if (next) await tx.insert(mediaItemEventsTable).values({
        mediaItemId: id, actorClerkUserId: actor.userId, action: "telegram_publication",
        note: publicationUrl,
      });
      return next;
    });
    if (!updated) { res.status(409).json({ error: "Gönderim yapıldı; kayıt durumunu kontrol edin." }); return; }
    res.json(serializeMediaItem(updated));
  } catch {
    res.status(502).json({ error: "Telegram gönderimi doğrulanamadı; yayın durumu değiştirilmedi. Tekrar denemeden önce kanalı kontrol edin." });
  }
});

router.post("/media/items/:id/download-url", async (req, res): Promise<void> => {
  if (!(await mediaActor(req, res))) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Medya numarası geçersiz." });
    return;
  }

  const [item] = await db
    .select({ objectPath: mediaItemsTable.objectPath })
    .from(mediaItemsTable)
    .where(eq(mediaItemsTable.id, id))
    .limit(1);
  if (!item?.objectPath) {
    res.status(404).json({ error: "Medya dosyası bulunamadı." });
    return;
  }

  try {
    const download = await objectStorageService.getObjectEntityDownloadURL(
      item.objectPath,
    );
    res.json(download);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Medya dosyası bulunamadı." });
      return;
    }
    req.log.error({ err: error }, "Medya indirme adresi oluşturulamadı");
    res.status(500).json({ error: "Medya indirme adresi oluşturulamadı." });
  }
});

export default router;