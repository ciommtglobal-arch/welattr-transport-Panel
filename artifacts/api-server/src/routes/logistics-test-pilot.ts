import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, logisticsRequestsTable, logisticsShipmentsTable } from "@workspace/db";
import { GetLogisticsTestPilotReadinessResponse } from "@workspace/api-zod";
import { requireLogisticsOperator } from "../lib/logisticsWorkflowAuth";
import { buildLogisticsPilotReadiness, LOGISTICS_TEST_PILOT } from "../lib/logisticsPilotReadiness";

const router: IRouter = Router();

router.get("/logistics/test-pilot/readiness", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  // This interactive, read-only Clerk endpoint is not the X-MMT service webhook.
  // Never infer TEST mode from caller input, signatures or a record's name.
  if (!["development", "test"].includes(process.env.NODE_ENV ?? "") ||
      process.env.REPLIT_DEPLOYMENT) {
    res.status(404).json({ error: "Bu TEST kontrolü bu ortamda kapalı." });
    return;
  }
  try {
    const actor = await requireLogisticsOperator(req, res);
    if (!actor) return;
    const [record] = await db.select({
      id: logisticsRequestsTable.id,
      requesterClerkUserId: logisticsRequestsTable.requesterClerkUserId,
    }).from(logisticsRequestsTable).where(and(
      eq(logisticsRequestsTable.referenceCode, LOGISTICS_TEST_PILOT),
      eq(logisticsRequestsTable.isTest, true),
    )).limit(1);
    if (!record && !actor.isFounder) {
      res.status(404).json({ error: "Erişilebilir TEST dosyası bulunamadı." });
      return;
    }
    if (record && !actor.isFounder && record.requesterClerkUserId !== actor.userId) {
      const [assignment] = await db.select({ id: logisticsShipmentsTable.id })
        .from(logisticsShipmentsTable).where(and(
          eq(logisticsShipmentsTable.requestId, record.id),
          eq(logisticsShipmentsTable.assignedStaffClerkUserId, actor.userId),
        )).limit(1);
      if (!assignment) {
        res.status(403).json({ error: "Bu TEST dosyasına erişim yetkiniz yok." });
        return;
      }
    }
    res.json(GetLogisticsTestPilotReadinessResponse.parse(
      buildLogisticsPilotReadiness(Boolean(record)),
    ));
  } catch {
    req.log?.error("Lojistik TEST hazırlık kontrolü okunamadı.");
    res.status(503).json({ error: "TEST kontrolü okunamadı; sonuç doğrulanmadı." });
  }
});

export default router;
