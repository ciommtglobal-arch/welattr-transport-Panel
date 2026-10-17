import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, staffUsersTable } from "@workspace/db";
import { GetLogisticsPilotWorkspaceResponse, MutateLogisticsPilotWorkspaceBody } from "@workspace/api-zod";
import { requireUser } from "../lib/staffAuth";
import { isLogisticsFounder } from "../lib/logisticsListingAuth";
import { getPilotWorkspace, mutatePilotWorkspace, PilotError, pilotEnvironmentEnabled } from "../lib/logisticsPilotWorkspace";

const router: IRouter = Router();
router.use("/logistics/test-pilot/workspace", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!pilotEnvironmentEnabled()) { res.status(404).json({ error: "Bu TEST çalışma alanı bu ortamda kapalı." }); return; }
  if (req.headers["content-length"] && Number(req.headers["content-length"]) > 32768) {
    res.status(413).json({ error: "TEST isteği boyut sınırını aşıyor." }); return;
  }
  next();
});

router.all("/logistics/test-pilot/workspace", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  if (!["GET", "POST"].includes(req.method)) { res.status(405).json({ error: "Yöntem desteklenmiyor." }); return; }
  try {
    const actor = { userId, isFounder: isLogisticsFounder(userId) };
    const [staff] = actor.isFounder ? [] : await db.select({ id: staffUsersTable.id }).from(staffUsersTable)
      .where(and(eq(staffUsersTable.clerkUserId, userId), eq(staffUsersTable.active, 1), eq(staffUsersTable.role, "operations"))).limit(1);
    const canInitialize = actor.isFounder || Boolean(staff);
    if (Object.keys(req.query).length) { res.status(400).json({ error: "Bu uç yalnız sabit TEST dosyasını destekler." }); return; }
    let result;
    if (req.method === "POST") {
      // Bound the decoded payload too; Content-Length alone is not trustworthy.
      if (Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8") > 32768) {
        res.status(413).json({ error: "TEST isteği boyut sınırını aşıyor." }); return;
      }
      const input = MutateLogisticsPilotWorkspaceBody.strict().safeParse(req.body);
      if (!input.success) { res.status(400).json({ error: "TEST işlem alanlarını ve tarihleri kontrol edin." }); return; }
      result = await mutatePilotWorkspace(actor, input.data, canInitialize);
    } else result = await getPilotWorkspace(actor, canInitialize);
    res.json(GetLogisticsPilotWorkspaceResponse.parse(result));
  } catch (error) {
    if (error instanceof PilotError) { res.status(error.status).json({ error: error.message }); return; }
    req.log?.error("Lojistik TEST işlemi tamamlanamadı; hiçbir başarı sonucu üretilmedi.");
    res.status(503).json({ error: "TEST işlemi doğrulanamadı; lütfen yeniden deneyin." });
  }
});
export default router;
