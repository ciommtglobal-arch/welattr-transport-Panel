import { Router, type IRouter } from "express";
import {
  RequestObjectDownloadUrlBody,
  RequestObjectDownloadUrlResponse,
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
  CleanupOrphanUploadsBody,
} from "@workspace/api-zod";
import {
  b2bBusinessProfilesTable,
  db,
  limitApplicationDocumentsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";
import { requireStaff } from "../lib/staffAuth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const DEFAULT_ORPHAN_UPLOAD_RETENTION_HOURS = 24;

function getOrphanUploadRetentionHours() {
  const configured = process.env.ORPHAN_UPLOAD_RETENTION_HOURS;
  if (!configured) {
    return DEFAULT_ORPHAN_UPLOAD_RETENTION_HOURS;
  }

  const hours = Number(configured);
  if (!Number.isInteger(hours) || hours < 1) {
    throw new Error(
      "ORPHAN_UPLOAD_RETENTION_HOURS must be a positive integer.",
    );
  }
  return hours;
}

async function getReferencedObjectPaths(objectPaths: string[]) {
  if (objectPaths.length === 0) {
    return new Set<string>();
  }

  const documents = await db
    .select({ objectPath: limitApplicationDocumentsTable.objectPath })
    .from(limitApplicationDocumentsTable)
    .where(inArray(limitApplicationDocumentsTable.objectPath, objectPaths));

  const businessProfiles = await db
    .select({
      objectPath: b2bBusinessProfilesTable.verificationDocumentObjectPath,
    })
    .from(b2bBusinessProfilesTable)
    .where(
      inArray(
        b2bBusinessProfilesTable.verificationDocumentObjectPath,
        objectPaths,
      ),
    );

  return new Set([
    ...documents.map((document) => document.objectPath),
    ...businessProfiles.map((profile) => profile.objectPath),
  ]);
}

router.post("/storage/objects/request-download-url", async (req, res) => {
  if (!(await requireStaff(req, res))) return;

  const parsed = RequestObjectDownloadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Belge yolu geçersiz." });
    return;
  }

  const [document] = await db
    .select({ objectPath: limitApplicationDocumentsTable.objectPath })
    .from(limitApplicationDocumentsTable)
    .where(
      eq(limitApplicationDocumentsTable.objectPath, parsed.data.objectPath),
    )
    .limit(1);

  const [businessProfile] = await db
    .select({
      objectPath: b2bBusinessProfilesTable.verificationDocumentObjectPath,
    })
    .from(b2bBusinessProfilesTable)
    .where(
      eq(
        b2bBusinessProfilesTable.verificationDocumentObjectPath,
        parsed.data.objectPath,
      ),
    )
    .limit(1);

  if (!document && !businessProfile) {
    res.status(404).json({ error: "Belge bulunamadı." });
    return;
  }

  try {
    const download = await objectStorageService.getObjectEntityDownloadURL(
      parsed.data.objectPath,
    );
    res.json(RequestObjectDownloadUrlResponse.parse(download));
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Belge bulunamadı." });
      return;
    }

    req.log.error({ err: error }, "Belge indirme adresi oluşturulamadı");
    res.status(500).json({ error: "Belge indirme adresi oluşturulamadı." });
  }
});

router.post("/storage/uploads/request-url", async (req, res) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error:
        "Yalnızca en fazla 10 MB boyutunda PDF, JPG veya PNG yükleyebilirsiniz.",
    });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath =
      objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: parsed.data,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Belge yükleme adresi oluşturulamadı");
    res.status(500).json({ error: "Belge yükleme adresi oluşturulamadı." });
  }
});

/**
 * Cleans uploaded objects that are not referenced by a saved application
 * document and have exceeded the configured safety retention period.
 *
 * This endpoint is intended to be called by a scheduled maintenance job.
 * It is deliberately restricted to admin and operations staff because it
 * permanently deletes objects. Use { "dryRun": true } to inspect candidates
 * without deleting anything.
 */
router.post("/storage/uploads/cleanup-orphans", async (req, res) => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;

  if (
    authorization.staff.role !== "admin" &&
    authorization.staff.role !== "operations"
  ) {
    res.status(403).json({
      error: "Sahipsiz yükleme temizliği için yönetici yetkisi gerekiyor.",
    });
    return;
  }

  const parsedBody = CleanupOrphanUploadsBody.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ error: "Temizlik isteği geçersiz." });
    return;
  }

  const dryRun = parsedBody.data.dryRun;

  try {
    const retentionHours = getOrphanUploadRetentionHours();
    const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
    const objects = await objectStorageService.listObjectEntityFiles();
    const objectPaths = objects.map((object) => object.objectPath);
    const referencedObjectPaths = await getReferencedObjectPaths(objectPaths);
    const orphanedObjects = objects.filter(
      (object) => !referencedObjectPaths.has(object.objectPath),
    );
    const eligibleObjects = orphanedObjects.filter(
      (object) => object.createdAt <= cutoff,
    );

    const result = {
      dryRun,
      retentionHours,
      cutoffAt: cutoff.toISOString(),
      scannedObjects: objects.length,
      referencedObjects: referencedObjectPaths.size,
      orphanedObjects: orphanedObjects.length,
      eligibleObjects: eligibleObjects.length,
      eligibleObjectPaths: eligibleObjects.map((object) => object.objectPath),
      deletedObjectPaths: [] as string[],
      skippedReferencedObjectPaths: [] as string[],
      failedObjects: [] as Array<{ objectPath: string; error: string }>,
    };

    if (!dryRun && eligibleObjects.length > 0) {
      // Re-check immediately before deletion so a submission that completed
      // while the listing was running is not deleted by this maintenance pass.
      const latestReferencedObjectPaths = await getReferencedObjectPaths(
        eligibleObjects.map((object) => object.objectPath),
      );

      for (const object of eligibleObjects) {
        if (latestReferencedObjectPaths.has(object.objectPath)) {
          result.skippedReferencedObjectPaths.push(object.objectPath);
          continue;
        }

        try {
          await objectStorageService.deleteObjectEntityFile(object.file);
          result.deletedObjectPaths.push(object.objectPath);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          result.failedObjects.push({
            objectPath: object.objectPath,
            error: message,
          });
          req.log?.error(
            { err: error, objectPath: object.objectPath },
            "Sahipsiz belge objesi silinemedi",
          );
        }
      }
    }

    req.log?.info(
      {
        dryRun: result.dryRun,
        retentionHours: result.retentionHours,
        cutoffAt: result.cutoffAt,
        scannedObjects: result.scannedObjects,
        referencedObjects: result.referencedObjects,
        orphanedObjects: result.orphanedObjects,
        eligibleObjects: result.eligibleObjects,
        deletedObjects: result.deletedObjectPaths.length,
        skippedReferencedObjects: result.skippedReferencedObjectPaths.length,
        failedObjects: result.failedObjects.length,
      },
      "Sahipsiz belge objesi temizliği tamamlandı",
    );
    res.json(result);
  } catch (error) {
    req.log?.error({ err: error }, "Sahipsiz belge objesi temizliği başarısız");
    res.status(500).json({
      error: "Sahipsiz belge objesi temizliği gerçekleştirilemedi.",
    });
  }
});

export default router;
