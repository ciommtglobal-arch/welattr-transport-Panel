import { Router, type IRouter } from "express";
import { ActLogisticsPoolBody, GetLogisticsPoolResponse } from "@workspace/api-zod";
import { requireLogisticsOperator } from "../lib/logisticsWorkflowAuth";
import { AutomationError } from "../lib/logisticsAutomation";
import { getPoolWorkspace, actOnPool } from "../lib/logisticsPool";
const router: IRouter = Router();
router.all(["/logistics/pool","/logistics/pool/actions"], async (req,res): Promise<void> => {
  res.set("Cache-Control","no-store");
  const actor = await requireLogisticsOperator(req,res);
  if (!actor) return;
  try {
    let result;
    if (req.method === "GET" && req.path === "/logistics/pool") result = await getPoolWorkspace(actor);
    else if (req.method === "POST" && req.path === "/logistics/pool/actions") {
      if (Buffer.byteLength(JSON.stringify(req.body ?? {}),"utf8") > 8192) { res.status(413).json({error:"İşlem boyutu sınırı aşıldı."}); return; }
      const input = ActLogisticsPoolBody.strict().safeParse(req.body);
      if (!input.success) { res.status(400).json({error:"İşlem alanlarını, kimliği ve sürümü kontrol edin."}); return; }
      result = await actOnPool(input.data,actor);
    } else { res.status(405).json({error:"Desteklenmeyen yöntem."}); return; }
    res.json(GetLogisticsPoolResponse.parse(result));
  } catch (error) {
    if (error instanceof AutomationError) {res.status(error.status).json({error:error.message});return;}
    req.log?.error("Lojistik havuz işlemi doğrulanamadı; kaynak içerikleri veya gizli bilgiler loglanmadı.");
    res.status(503).json({error:"Havuz işlemi doğrulanamadı. Kayıtları yenileyin; eski veya boş veriyi başarılı tarama saymayın."});
  }
});
export default router;
