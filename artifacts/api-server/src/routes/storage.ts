import { Router, type IRouter } from "express";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.post("/storage/uploads/request-url", async (req, res) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
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