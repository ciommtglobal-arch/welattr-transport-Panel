import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, mediaItemsTable, type MediaItem } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const objectStorageService = new ObjectStorageService();
const logisticsMediaCategories = [
  "logistics",
  "lojistik",
  "route",
  "rota",
  "transport",
  "taşıma",
  "advertisement",
  "reklam",
] as const;

function serializePublicMedia(item: MediaItem) {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    category: item.category,
    sourceUrl: item.sourceUrl,
    fileUrl: item.objectPath
      ? `/api/public/logistics/media/${item.id}/file`
      : null,
    contentType: item.contentType,
    publishedAt: item.publishedAt?.toISOString() ?? item.updatedAt.toISOString(),
  };
}

const publishedLogisticsMediaWhere = and(
  eq(mediaItemsTable.status, "published"),
  inArray(mediaItemsTable.category, logisticsMediaCategories),
);

router.get("/public/logistics/media", async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(mediaItemsTable)
    .where(publishedLogisticsMediaWhere)
    .orderBy(desc(mediaItemsTable.publishedAt), desc(mediaItemsTable.createdAt))
    .limit(50);

  res.json(items.map(serializePublicMedia));
});

router.get(
  "/public/logistics/media/:id/file",
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "Medya numarası geçersiz." });
      return;
    }

    const [item] = await db
      .select()
      .from(mediaItemsTable)
      .where(and(eq(mediaItemsTable.id, id), publishedLogisticsMediaWhere))
      .limit(1);
    if (!item?.objectPath) {
      res.status(404).json({ error: "Yayınlanmış lojistik medyası bulunamadı." });
      return;
    }

    try {
      const download = await objectStorageService.getObjectEntityDownloadURL(
        item.objectPath,
        15 * 60,
      );
      res.redirect(download.downloadURL);
    } catch (error) {
      console.error("Public logistics media download unavailable", {
        mediaItemId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(404).json({ error: "Medya dosyası bulunamadı." });
    }
  },
);

export default router;