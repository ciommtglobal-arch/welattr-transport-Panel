import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  CreatePaymentCheckoutBody,
  CreatePaymentCheckoutResponse,
  GetPaymentReadinessResponse,
  GetPublicServiceInvoiceParams,
  GetPublicServiceInvoiceResponse,
} from "@workspace/api-zod";
import {
  db,
  paymentAuditEventsTable,
  paymentSessionsTable,
  serviceInvoicesTable,
} from "@workspace/db";
import {
  createTamiHostedToken,
  getPaymentReadiness,
  TamiGatewayError,
} from "../lib/tami-gateway";
import { amountToCents, normalizePhone } from "../lib/payment-domain";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";

const router: IRouter = Router();

function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  try {
    const origin = new URL(req.get("origin") ?? "");
    const expectedHost = getClerkProxyHost(req);
    if (
      !expectedHost ||
      !["https:", "http:"].includes(origin.protocol) ||
      origin.host !== expectedHost ||
      req.get("sec-fetch-site") === "cross-site"
    ) {
      throw new Error("Origin mismatch.");
    }
  } catch {
    res.status(403).json({ error: "İstek aynı uygulama üzerinden gönderilmelidir." });
    return;
  }
  next();
}

function publicOrigin(req: Request): string {
  const configured = process.env.MMT_PAYMENT_CALLBACK_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const protocol =
    req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
  const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
  if (!host) throw new Error("Payment callback host is unavailable.");
  return `${protocol}://${host}`;
}

function isSameCheckout(
  session: {
    invoiceReference: string | null;
    fullName: string;
    email: string;
    phone: string;
    idempotencyKey: string | null;
    provider: string;
  },
  input: {
    invoiceReference: string;
    fullName: string;
    email: string;
    phone: string;
    idempotencyKey: string;
    provider: string;
  },
) {
  return (
    session.invoiceReference === input.invoiceReference &&
    session.fullName === input.fullName &&
    session.email === input.email &&
    session.phone === input.phone &&
    session.idempotencyKey === input.idempotencyKey &&
    session.provider === input.provider
  );
}

function checkoutResponse(
  session: {
    orderId: string;
    checkoutUrl: string | null;
    status: "pending" | "success" | "failed" | "cancelled";
    provider: string;
  },
) {
  return CreatePaymentCheckoutResponse.parse({
    checkoutUrl: session.checkoutUrl,
    paymentReference: session.orderId,
    status: session.status,
    mode: session.provider,
  });
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: unknown; cause?: { code?: unknown } } | null;
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}

router.get("/payments/readiness", (_req, res): void => {
  res.json(GetPaymentReadinessResponse.parse(getPaymentReadiness()));
});

router.use("/payments/checkout", requireSameOrigin);

router.get("/payments/invoices/:reference", async (req, res): Promise<void> => {
  const params = GetPublicServiceInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Fatura bulunamadı." });
    return;
  }
  const [invoice] = await db
    .select()
    .from(serviceInvoicesTable)
    .where(eq(serviceInvoicesTable.reference, params.data.reference))
    .limit(1);
  if (!invoice) {
    res.status(404).json({ error: "Fatura bulunamadı." });
    return;
  }
  const [pendingSession] = await db
    .select({ orderId: paymentSessionsTable.orderId })
    .from(paymentSessionsTable)
    .where(
      and(
        eq(paymentSessionsTable.invoiceReference, invoice.reference),
        eq(paymentSessionsTable.status, "pending"),
      ),
    )
    .limit(1);
  const [successfulSession] = await db
    .select({ orderId: paymentSessionsTable.orderId })
    .from(paymentSessionsTable)
    .where(
      and(
        eq(paymentSessionsTable.invoiceReference, invoice.reference),
        eq(paymentSessionsTable.status, "success"),
      ),
    )
    .limit(1);
  const [latestPayment] = await db
    .select({
      orderId: paymentSessionsTable.orderId,
      status: paymentSessionsTable.status,
    })
    .from(paymentSessionsTable)
    .where(eq(paymentSessionsTable.invoiceReference, invoice.reference))
    .orderBy(desc(paymentSessionsTable.createdAt))
    .limit(1);
  const readiness = getPaymentReadiness();
  res.json(
    GetPublicServiceInvoiceResponse.parse({
      reference: invoice.reference,
      amount: invoice.amount,
      currency: invoice.currency,
      description: invoice.description,
      status: invoice.status,
      canPay:
        invoice.status === "issued" &&
        !pendingSession &&
        !successfulSession &&
        (!(readiness.liveEnabled || readiness.sandboxEnabled) || invoice.currency === "TRY"),
      paymentReference: latestPayment?.orderId ?? null,
      paymentStatus: latestPayment?.status ?? null,
    }),
  );
});

router.post("/payments/checkout", async (req, res): Promise<void> => {
  const allowedFields = new Set([
    "invoiceReference",
    "fullName",
    "email",
    "phone",
    "idempotencyKey",
  ]);
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body) ||
    Object.keys(req.body).some((key) => !allowedFields.has(key))
  ) {
    res.status(400).json({ error: "Yalnızca fatura referansı ve iletişim bilgileri gönderilebilir." });
    return;
  }
  const parsed = CreatePaymentCheckoutBody.strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Fatura ödeme bilgileri geçersiz." });
    return;
  }

  const readiness = getPaymentReadiness();
  const provider = readiness.liveEnabled
    ? "tami"
    : readiness.sandboxEnabled
      ? "tami_sandbox"
      : readiness.testEnabled
        ? "mock"
        : null;
  if (!provider) {
    res.status(503).json({
      error: "Canlı tahsilat için şirket, banka, Tami, 3D Secure ve yazılı yetki onayları henüz tamamlanmadı.",
    });
    return;
  }

  const invoiceReference = parsed.data.invoiceReference.trim();
  const fullName = parsed.data.fullName.trim();
  const email = parsed.data.email.trim().toLowerCase();
  const phone = normalizePhone(parsed.data.phone);
  if (phone.length < 10 || phone.length > 15) {
    res.status(400).json({ error: "Telefon numarası geçersiz." });
    return;
  }

  let reserved:
    | { kind: "created" | "existing"; session: Awaited<ReturnType<typeof loadSession>> }
    | {
        kind:
          | "missing"
          | "notPayable"
          | "inProgress"
          | "keyConflict"
          | "unavailable"
          | "currencyUnsupported";
      };
  try {
    reserved = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(serviceInvoicesTable)
        .where(eq(serviceInvoicesTable.reference, invoiceReference))
        .for("update")
        .limit(1);
      if (!invoice) return { kind: "missing" as const };
      if (provider !== "mock" && invoice.currency !== "TRY") {
        return { kind: "currencyUnsupported" as const };
      }

      const [sameKey] = await tx
        .select()
        .from(paymentSessionsTable)
        .where(eq(paymentSessionsTable.idempotencyKey, parsed.data.idempotencyKey))
        .for("update")
        .limit(1);
      const request = {
        invoiceReference,
        fullName,
        email,
        phone,
        idempotencyKey: parsed.data.idempotencyKey,
        provider,
      };
      if (sameKey) {
        if (!isSameCheckout(sameKey, request)) return { kind: "keyConflict" as const };
        return { kind: "existing" as const, session: sameKey };
      }
      if (invoice.status !== "issued") return { kind: "notPayable" as const };

      const [successful] = await tx
        .select({ orderId: paymentSessionsTable.orderId })
        .from(paymentSessionsTable)
        .where(
          and(
            eq(paymentSessionsTable.invoiceReference, invoiceReference),
            eq(paymentSessionsTable.status, "success"),
          ),
        )
        .for("update")
        .limit(1);
      if (successful) return { kind: "notPayable" as const };

      const [pending] = await tx
        .select({ orderId: paymentSessionsTable.orderId })
        .from(paymentSessionsTable)
        .where(
          and(
            eq(paymentSessionsTable.invoiceReference, invoiceReference),
            eq(paymentSessionsTable.status, "pending"),
          ),
        )
        .for("update")
        .limit(1);
      if (pending) return { kind: "inProgress" as const };

      const cents = amountToCents(invoice.amount);
      if (cents === null || cents <= 0n) return { kind: "unavailable" as const };
      const orderId = randomUUID();
      const [session] = await tx
        .insert(paymentSessionsTable)
        .values({
          orderId,
          provider,
          invoiceReference,
          idempotencyKey: parsed.data.idempotencyKey,
          amount: invoice.amount,
          currency: invoice.currency,
          fullName,
          email,
          phone,
          description: invoice.description,
        })
        .returning();
      await tx.insert(paymentAuditEventsTable).values({
        eventKey: `checkout:created:${orderId}`,
        eventType: "checkout_created",
        provider,
        invoiceReference,
        orderId,
        amount: invoice.amount,
        currency: invoice.currency,
      });
      return { kind: "created" as const, session: session! };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Bu fatura için zaten bir ödeme denemesi sürüyor. Durum mutabakatı tamamlanana kadar yeni oturum açılamaz." });
      return;
    }
    throw error;
  }

  if (reserved.kind === "missing") {
    res.status(404).json({ error: "Fatura bulunamadı." });
    return;
  }
  if (reserved.kind === "notPayable") {
    res.status(409).json({ error: "Bu fatura artık ödemeye açık değil." });
    return;
  }
  if (reserved.kind === "inProgress") {
    res.status(409).json({ error: "Bu fatura için bir ödeme işlemi sürüyor. Yeni ödeme başlatılamaz." });
    return;
  }
  if (reserved.kind === "keyConflict") {
    res.status(409).json({ error: "Bu tekrar deneme anahtarı farklı bir ödeme isteğinde kullanılmış." });
    return;
  }
  if (reserved.kind === "unavailable") {
    res.status(503).json({ error: "Fatura tutarı işlenemiyor." });
    return;
  }
  if (reserved.kind === "currencyUnsupported") {
    res.status(409).json({
      error: "Tami bu hesapta yalnızca TRY tahsil edebiliyor. USD ve EUR faturaları canlı ödeme için uygun değil.",
    });
    return;
  }
  if (!("session" in reserved) || !reserved.session) {
    res.status(500).json({ error: "Ödeme oturumu oluşturulamadı." });
    return;
  }
  const session = reserved.session;
  if (reserved.kind === "existing") {
    if (session.status !== "pending") {
      res.status(409).json({ error: "Bu tekrar deneme anahtarıyla açılan ödeme tamamlandı; yeni bir deneme başlatın." });
      return;
    }
    if (!session.checkoutUrl) {
      res.status(409).json({ error: "Ödeme sağlayıcısının yanıtı belirsiz. Yeni oturum açmadan önce fatura için mutabakat gerekir." });
      return;
    }
    res.json(checkoutResponse(session));
    return;
  }

  if (provider === "mock") {
    const url = new URL("/odeme/test", publicOrigin(req));
    url.searchParams.set("orderId", session.orderId);
    const [updated] = await db
      .update(paymentSessionsTable)
      .set({ checkoutUrl: url.toString() })
      .where(eq(paymentSessionsTable.orderId, session.orderId))
      .returning();
    res.status(201).json(checkoutResponse(updated!));
    return;
  }

  try {
    const checkoutUrl = await createTamiHostedToken({
      amount: Number(session.amount),
      orderId: session.orderId,
      fullName: session.fullName,
      email: session.email,
      phone: session.phone,
      description: session.description,
      callbackBaseUrl: publicOrigin(req),
    });
    const [updated] = await db
      .update(paymentSessionsTable)
      .set({ checkoutUrl })
      .where(eq(paymentSessionsTable.orderId, session.orderId))
      .returning();
    res.status(201).json(checkoutResponse(updated!));
  } catch (error) {
    req.log?.error({ err: error, orderId: session.orderId }, "Tami hosted checkout creation failed");
    if (error instanceof TamiGatewayError && !error.ambiguous) {
      await db.transaction(async (tx) => {
        const [failed] = await tx
          .update(paymentSessionsTable)
          .set({
            status: "failed",
            errorMessage: "Tami ödeme oturumu açılamadı.",
            lastCheckedAt: new Date(),
          })
          .where(
            and(
              eq(paymentSessionsTable.orderId, session.orderId),
              eq(paymentSessionsTable.status, "pending"),
            ),
          )
          .returning();
        if (failed) {
          await tx.insert(paymentAuditEventsTable).values({
            eventKey: `checkout:failed:${session.orderId}`,
            eventType: "checkout_creation_failed",
            provider: session.provider,
            invoiceReference,
            orderId: session.orderId,
            amount: session.amount,
            currency: session.currency,
          });
        }
      });
    }
    res.status(502).json({ error: "Tami güvenli ödeme sayfası oluşturulamadı. Sonuç belirsizse tekrar denemeden önce mutabakat yapın." });
  }
});

async function loadSession(orderId: string) {
  const [session] = await db
    .select()
    .from(paymentSessionsTable)
    .where(eq(paymentSessionsTable.orderId, orderId))
    .limit(1);
  return session;
}

export default router;