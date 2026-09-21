import { Router, type IRouter } from "express";
import {
  CreateMediaItemBody,
  GetMediaItemsQueryParams,
  RequestMediaUploadUrlBody,
  UpdateMediaItemBody,
} from "@workspace/api-zod";
import {
  db,
  mediaItemsTable,
  type MediaItem,
} from "@workspace/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireStaff } from "../lib/staffAuth";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";
import {
  dispatchMediaToDestinations,
  queuePublishedMediaDelivery,
} from "../lib/mediaPublisher";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

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
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    publishedAt: item.publishedAt?.toISOString() ?? null,
  };
}

function isPrivateObjectPath(value: string) {
  return /^\/objects\/uploads\/[a-zA-Z0-9-]+$/.test(value);
}

router.get("/media/items", async (req, res): Promise<void> => {
  if (!(await requireStaff(req, res))) return;

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

  const now = new Date();
  const [item] = await db
    .insert(mediaItemsTable)
    .values({
      ...parsed.data,
      createdByClerkUserId: authorization.userId,
      publishedAt: parsed.data.status === "published" ? now : null,
    })
    .returning();

  res.status(201).json(serializeMediaItem(item));
  if (item.status === "published") {
    await queuePublishedMediaDelivery(item.id);
  }
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

  const nextStatus = parsed.data.status ?? existing.status;
  const { status, ...editableFields } = parsed.data;
  const [item] = await db
    .update(mediaItemsTable)
    .set({
      ...editableFields,
      ...(status ? { status } : {}),
      publishedAt:
        nextStatus === "published"
          ? existing.publishedAt ?? new Date()
          : null,
      updatedAt: new Date(),
    })
    .where(eq(mediaItemsTable.id, id))
    .returning();

  res.json(serializeMediaItem(item));
  if (existing.status !== "published" && item.status === "published") {
    await queuePublishedMediaDelivery(item.id);
  }
});

router.post("/media/items/:id/publish", async (req, res): Promise<void> => {
  if (!(await requireStaff(req, res))) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Medya numarası geçersiz." });
    return;
  }

  const [item] = await db
    .select()
    .from(mediaItemsTable)
    .where(eq(mediaItemsTable.id, id))
    .limit(1);
  if (!item) {
    res.status(404).json({ error: "Medya kaydı bulunamadı." });
    return;
  }

  if (item.status !== "published") {
    const [published] = await db
      .update(mediaItemsTable)
      .set({
        status: "published",
        publishedAt: item.publishedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mediaItemsTable.id, id))
      .returning();
    if (published) {
      await queuePublishedMediaDelivery(id);
      res.json(serializeMediaItem(published));
      return;
    }
  }

  try {
    await dispatchMediaToDestinations(id);
  } catch {
    res.status(502).json({
      error: "Medya Telegram kanalına gönderilemedi; teslimat kaydı tekrar denenebilir.",
    });
    return;
  }

  res.json(serializeMediaItem(item));
});

router.post("/media/items/:id/download-url", async (req, res): Promise<void> => {
  if (!(await requireStaff(req, res))) return;

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