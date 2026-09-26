import { Router, type IRouter } from "express";
import {
  CreatePaymentCheckoutBody,
  GetPaymentReadinessResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/payments/readiness", (_req, res): void => {
  res.json(
    GetPaymentReadinessResponse.parse({
      bankAccountVerified: false,
      providerApproved: false,
      liveEnabled: false,
      cardDataCollected: false,
    }),
  );
});

router.post("/payments/checkout", (req, res): void => {
  const allowedFields = new Set([
    "invoiceReference",
    "amount",
    "currency",
    "description",
  ]);
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body) ||
    Object.keys(req.body).some((key) => !allowedFields.has(key))
  ) {
    res.status(400).json({
      error: "Yalnızca fatura ödeme bilgileri gönderilebilir.",
    });
    return;
  }

  const parsed = CreatePaymentCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Fatura ödeme bilgileri geçersiz." });
    return;
  }
  if (Number(parsed.data.amount) <= 0) {
    res.status(400).json({ error: "Ödeme tutarı sıfırdan büyük olmalıdır." });
    return;
  }

  // Never accept a client-side readiness flag as authorization to charge.
  // Checkout stays closed until company-account verification, provider approval,
  // and a provider-specific hosted-checkout adapter are implemented and verified.
  req.log?.info(
    { reason: "payment_compliance_and_provider_setup_incomplete" },
    "Hosted checkout rejected while live payments are disabled",
  );
  res.status(503).json({
    error:
      "Çevrimiçi tahsilat, şirket hesabı ve lisanslı Sanal POS onayları doğrulanana kadar kapalıdır.",
  });
});

export default router;