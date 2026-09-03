import { Router, type IRouter } from "express";
import {
  RequestObjectDownloadUrlBody,
  RequestObjectDownloadUrlResponse,
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { db, limitApplicationDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";
import { requireStaff } from "../lib/staffAuth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

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

  if (!document) {
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

export default router;
