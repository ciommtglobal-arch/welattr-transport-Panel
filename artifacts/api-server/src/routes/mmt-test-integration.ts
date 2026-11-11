import { Router, type IRouter, type Request, type Response } from "express";
import { ReceiveMmtTestEventBody, ReceiveMmtTestEventResponse } from "@workspace/api-zod";
import { requireUser } from "../lib/staffAuth";
import { requireLogisticsOperator, requireLogisticsFounder } from "../lib/logisticsWorkflowAuth";
import {
  MmtTestError, requireMmtTestEnvironment, verifyMmtTestRequest,
  decodeMmtTestBody, validateMmtTestReference, persistMmtTestEvent,
} from "../lib/mmtTestIntegration";

const router: IRouter = Router();
router.use(requireMmtTestEnvironment);

function failure(req: Request, res: Response, error: unknown): void {
  if (error instanceof MmtTestError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  // Never log the error object, credentials, raw body or user identity.
  req.log?.error("MMT TEST entegrasyon işlemi tamamlanamadı.");
  res.status(503).json({ error: "TEST kayıt işlemi tamamlanamadı." });
}

router.post("/events", async (req, res): Promise<void> => {
  try {
    // A valid peer signature never substitutes for a real Clerk session.
    if (!requireUser(req, res)) return;
    const envelope = verifyMmtTestRequest(req);
    const actor = await requireLogisticsOperator(req, res);
    if (!actor) return;
    const json = decodeMmtTestBody(req.body);
    if (!json || typeof json !== "object" || Array.isArray(json) ||
        Object.keys(json).some((key) => !["docRef", "kind"].includes(key))) {
      throw new MmtTestError(400, "Yalnız docRef ve kind alanları kabul edilir.");
    }
    const parsed = ReceiveMmtTestEventBody.safeParse(json);
    if (!parsed.success) throw new MmtTestError(400, "Dosya referansı veya olay türü geçersiz.");
    const input = { ...parsed.data, docRef: validateMmtTestReference(parsed.data.docRef) };
    const result = await persistMmtTestEvent(input, envelope, actor);
    res.json(ReceiveMmtTestEventResponse.parse({
      ok: true, eventId: envelope.eventId, ...result,
      persisted: true, activityRecorded: true,
      testOnly: true, queuedForReview: false, shipmentApproved: false,
    }));
  } catch (error) { failure(req, res, error); }
});

router.post("/approve", async (req, res): Promise<void> => {
  try {
    if (!requireUser(req, res)) return;
    verifyMmtTestRequest(req);
    if (!requireLogisticsFounder(req, res)) return;
    // Deliberately no writes, no task/review transitions, no fake approval.
    res.status(501).json({ error: "Bu özel entegrasyonun dosya/görev/kurucu onay akışı henüz uygulanmadı." });
  } catch (error) { failure(req, res, error); }
});

export default router;
