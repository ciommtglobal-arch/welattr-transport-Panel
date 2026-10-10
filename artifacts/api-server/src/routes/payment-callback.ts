import { Router, type IRouter } from "express";
import {
  CheckPaymentCallbackBody,
  CheckPaymentCallbackResponse,
} from "@workspace/api-zod";
import { verifyPaymentCallback } from "./tami-payments";

const router: IRouter = Router();

// Public reconciliation hint, not a signed webhook receiver.
// The same order must not trigger concurrent queries or unlimited rapid retries.
const retryAfter = new Map<string, number>();
const cooldownMs = 5000;
const maxTrackedOrders = 1000;

router.post("/payment/callback", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const body = CheckPaymentCallbackBody.strict().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Ödeme kontrolü için geçerli bir sipariş referansı gerekiyor." });
    return;
  }

  const now = Date.now();
  for (const [order, until] of retryAfter) {
    if (until <= now) retryAfter.delete(order);
  }
  const orderId = body.data.merchant_oid;
  if (retryAfter.has(orderId) || retryAfter.size >= maxTrackedOrders) {
    res.set("Retry-After", "5");
    res.status(429).json({ error: "Ödeme kontrolünü birkaç saniye sonra tekrar deneyin." });
    return;
  }
  // Retain the entry while the provider request is in flight.
  retryAfter.set(orderId, Number.POSITIVE_INFINITY);
  try {
    const verified = await verifyPaymentCallback(req, res, orderId);
    if (!verified) return;
    res.json(CheckPaymentCallbackResponse.parse({
      status: verified.status,
      paymentReference: verified.orderId,
      operationApproved: false,
      message: verified.status === "success"
        ? "Ödeme Tami üzerinden doğrulandı; operasyon için şirket sahibinin ayrı onayı gerekir."
        : verified.status === "pending"
          ? "Tami ödeme sonucunu henüz kesinleştirmedi; ödeme onaylanmadı."
          : "Tami sorgusuna göre ödeme başarılı değil.",
    }));
  } catch {
    req.log?.warn({ orderId }, "Payment callback verification could not be completed");
    res.status(503).json({ error: "Ödeme doğrulaması tamamlanamadı; ödeme onayı verilmedi." });
  } finally {
    retryAfter.set(orderId, Date.now() + cooldownMs);
  }
});

export default router;