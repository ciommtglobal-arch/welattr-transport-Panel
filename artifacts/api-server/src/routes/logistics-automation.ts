import { Router, type IRouter } from "express";
import {
  ActLogisticsAutomationBody, ActLogisticsAutomationParams, GetLogisticsAutomationResponse,
} from "@workspace/api-zod";
import { requireLogisticsOperator } from "../lib/logisticsWorkflowAuth";
import { actLogisticsAutomation, getLogisticsAutomation, AutomationError } from "../lib/logisticsAutomation";
import { dispatchOneLogisticsJob } from "../lib/logisticsAutomationWorker";

const router: IRouter = Router();
router.all("/logistics/requests/:id/automation", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const actor = await requireLogisticsOperator(req, res);
  if (!actor) return;
  const params = ActLogisticsAutomationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Geçerli yük talebi numarası gerekli." }); return; }
  try {
    let result;
    if (req.method === "GET") result = await getLogisticsAutomation(params.data.id, actor);
    else if (req.method === "POST") {
      if (Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8") > 32768) {
        res.status(413).json({ error: "Otomasyon işlem boyutu sınırı aşıldı." }); return;
      }
      const body = ActLogisticsAutomationBody.strict().safeParse(req.body);
      if (!body.success) { res.status(400).json({ error: "İşlem alanlarını, dosya biçimini ve sürümü kontrol edin." }); return; }
      result = await actLogisticsAutomation(params.data.id, body.data, actor);
      if (body.data.action === "approve") {
        // Autoscale can sleep between requests: a human's final approval must
        // not depend on a background interval waking up to dispatch it.
        await dispatchOneLogisticsJob(fetch, params.data.id);
        result = await getLogisticsAutomation(params.data.id, actor);
      }
    } else { res.status(405).json({ error: "Yöntem desteklenmiyor." }); return; }
    res.json(GetLogisticsAutomationResponse.parse(result));
  } catch (error) {
    if (error instanceof AutomationError) { res.status(error.status).json({ error: error.message }); return; }
    req.log?.error("Lojistik otomasyon işlem sonucu doğrulanamadı; gizli bağlantı bilgileri loglanmadı.");
    res.status(503).json({ error: "İşlem sonucu doğrulanamadı. Yeniden işlem yapmadan önce kaydı yenileyin ve gönderim durumunu kontrol edin." });
  }
});
export default router;
