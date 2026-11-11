import { Router, type IRouter } from "express";
import { GetGeminiWorkspaceResponse, SendGeminiInstructionBody, SendGeminiInstructionResponse } from "@workspace/api-zod";
import { requireLogisticsFounder } from "../lib/logisticsWorkflowAuth";
import {
  geminiWorkspaceEnabled, getGeminiWorkspace, sendGeminiInstruction, GeminiWorkspaceError,
} from "../lib/geminiWorkspace";

const router: IRouter = Router();
router.all("/gemini/workspace", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  if (!geminiWorkspaceEnabled()) {
    res.status(404).json({ error: "Gemini çalışma alanı yalnız geliştirme önizlemesinde açıktır." }); return;
  }
  const actor = requireLogisticsFounder(req, res);
  if (!actor) return;
  try {
    if (req.method === "GET") {
      res.json(GetGeminiWorkspaceResponse.parse(await getGeminiWorkspace(actor.userId))); return;
    }
    if (req.method !== "POST") { res.status(405).json({ error: "Desteklenmeyen yöntem." }); return; }
    if (Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8") > 16_384) {
      res.status(413).json({ error: "Talimat boyutu sınırı aşıldı." }); return;
    }
    const parsed = SendGeminiInstructionBody.strict().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Talimat ve istek kimliğini kontrol edin." }); return; }
    res.json(SendGeminiInstructionResponse.parse(await sendGeminiInstruction(actor.userId, parsed.data)));
  } catch (error) {
    if (error instanceof GeminiWorkspaceError) { res.status(error.status).json({ error: error.message }); return; }
    req.log?.warn("Gemini çalışma alanı isteği tamamlanamadı; içerik ve hata ayrıntıları loglanmadı.");
    res.status(503).json({ error: "Çalışma alanı doğrulanamadı. Talimat geçmişini yenileyin." });
  }
});
export default router;
