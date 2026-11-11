import { getAuth } from "@clerk/express";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  CreateTamiPaymentRefundBody,
  CreateTamiPaymentRefundParams,
  CreateTamiPaymentRefundResponse,
  GetTamiPaymentRefundsParams,
  GetTamiPaymentRefundsResponse,
  GetTamiPaymentStatusParams,
  GetTamiPaymentStatusResponse,
  ReconcileTamiPaymentParams,
  ReconcileTamiPaymentResponse,
  SetMockPaymentResultBody,
  SetMockPaymentResultParams,
  SetMockPaymentResultResponse,
} from "@workspace/api-zod";
import {
  db,
  kasaUsersTable,
  paymentAuditEventsTable,
  paymentRefundsTable,
  paymentSessionsTable,
  serviceInvoicesTable,
} from "@workspace/db";
import {
  getPaymentReadiness,
  queryTamiPayment,
  refundTamiPayment,
  TamiGatewayError,
} from "../lib/tami-gateway";
import {
  amountToCents,
  centsToAmount,
  hasSignedRefundTransaction,
  mapTamiPaymentStatus,
  resolveVerifiedPaymentStatus,
  signedRefundOutcome,
} from "../lib/payment-domain";
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

router.use("/payments", (req, res, next) => {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    next();
    return;
  }
  requireSameOrigin(req, res, next);
});

type Session = typeof paymentSessionsTable.$inferSelect;
type Refund = typeof paymentRefundsTable.$inferSelect;

const isTamiProvider = (provider: string) =>
  provider === "tami" || provider === "tami_sandbox";

function getOrderId(req: Request, schema: typeof GetTamiPaymentStatusParams) {
  return schema.safeParse(req.params);
}

async function owner(req: Request, res: Response) {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Giriş yapmanız gerekiyor." });
    return null;
  }
  const [user] = await db
    .select()
    .from(kasaUsersTable)
    .where(eq(kasaUsersTable.clerkUserId, clerkUserId))
    .limit(1);
  if (!user?.active || !user.owner) {
    res.status(403).json({ error: "Bu işlem yalnızca uygulama sahibine açıktır." });
    return null;
  }
  return user;
}

async function findSession(orderId: string) {
  const [session] = await db
    .select()
    .from(paymentSessionsTable)
    .where(eq(paymentSessionsTable.orderId, orderId))
    .limit(1);
  return session;
}

function paymentStatusView(
  session: Session,
  overrides: Partial<{
    status: Session["status"];
    providerPaymentStatus: string | null;
    providerOrderStatus: string | null;
    errorMessage: string | null;
  }> = {},
) {
  if (!session.invoiceReference) throw new Error("Payment session is not linked to an invoice.");
  return GetTamiPaymentStatusResponse.parse({
    orderId: session.orderId,
    invoiceReference: session.invoiceReference,
    amount: Number(session.amount),
    currency: session.currency,
    status: overrides.status ?? session.status,
    mode: session.provider,
    providerPaymentStatus:
      overrides.providerPaymentStatus ?? session.providerPaymentStatus,
    providerOrderStatus: overrides.providerOrderStatus ?? session.providerOrderStatus,
    errorMessage: overrides.errorMessage ?? session.errorMessage,
  });
}

async function verifyProviderPayment(payload: Record<string, unknown>, session: Session) {
  if (payload.orderId !== session.orderId) {
    throw new TamiGatewayError("Signed Tami response did not match the payment order.");
  }
  const providerAmount = payload.amount;
  if (providerAmount === undefined) {
    throw new TamiGatewayError("Signed Tami response did not include the amount.");
  }
  const actual = amountToCents(
    typeof providerAmount === "number" || typeof providerAmount === "string"
      ? providerAmount
      : "",
  );
  let expectedAmounts = [amountToCents(session.amount)];
  if (session.invoiceReference) {
    const [invoice] = await db
      .select({
        amount: serviceInvoicesTable.amount,
        refundedAmount: serviceInvoicesTable.refundedAmount,
        currency: serviceInvoicesTable.currency,
      })
      .from(serviceInvoicesTable)
      .where(eq(serviceInvoicesTable.reference, session.invoiceReference))
      .limit(1);
    if (!invoice || invoice.currency !== session.currency) {
      throw new TamiGatewayError("Payment invoice was missing or its currency did not match.");
    }
    if (invoice) {
      const total = amountToCents(invoice.amount);
      const refunded = amountToCents(invoice.refundedAmount);
      const [pendingRefund] = await db
        .select({ amount: paymentRefundsTable.amount })
        .from(paymentRefundsTable)
        .where(
          and(
            eq(paymentRefundsTable.orderId, session.orderId),
            eq(paymentRefundsTable.status, "pending"),
          ),
        )
        .limit(1);
      const pending = pendingRefund ? amountToCents(pendingRefund.amount) : 0n;
      if (total !== null && refunded !== null && pending !== null) {
        const net = total - refunded;
        expectedAmounts = pending > 0n ? [net, net - pending] : [net];
      }
    }
  }
  if (actual === null || !expectedAmounts.includes(actual)) {
    throw new TamiGatewayError("Signed Tami response amount did not match the invoice.");
  }
  const providerCurrency = payload.currency ?? payload.currencyCode;
  if (typeof providerCurrency !== "string" ||
    providerCurrency.toUpperCase() !== session.currency) {
    throw new TamiGatewayError("Signed Tami response currency did not match the invoice.");
  }
}

async function saveProviderPaymentState(
  session: Session,
  providerPayload: Record<string, unknown>,
  correlationId: string,
) {
  const mappedStatus = mapTamiPaymentStatus(providerPayload);
  const providerPaymentStatus =
    typeof providerPayload.paymentStatus === "string"
      ? providerPayload.paymentStatus
      : typeof providerPayload.status === "string"
        ? providerPayload.status
        : null;
  const providerOrderStatus =
    typeof providerPayload.orderStatus === "string" ? providerPayload.orderStatus : null;
  const errorMessage =
    typeof providerPayload.errorMessage === "string"
      ? providerPayload.errorMessage.slice(0, 500)
      : null;

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(paymentSessionsTable)
      .where(eq(paymentSessionsTable.orderId, session.orderId))
      .for("update")
      .limit(1);
    if (!current || !current.invoiceReference) return null;

    const effectiveStatus = resolveVerifiedPaymentStatus(current.status, mappedStatus);
    const [updated] = await tx
      .update(paymentSessionsTable)
      .set({
        status: effectiveStatus,
        providerPaymentStatus,
        providerOrderStatus,
        errorMessage,
        lastCheckedAt: new Date(),
      })
      .where(eq(paymentSessionsTable.orderId, current.orderId))
      .returning();

    if (current.status !== effectiveStatus) {
      await tx.insert(paymentAuditEventsTable).values({
        eventKey: `payment:state:${current.orderId}:${effectiveStatus}`,
        eventType: `payment_${effectiveStatus}`,
        provider: current.provider,
        invoiceReference: current.invoiceReference,
        orderId: current.orderId,
        amount: current.amount,
        currency: current.currency,
        providerStatus: providerPaymentStatus,
        correlationId,
      });
      if (effectiveStatus === "success") {
        await tx
          .update(serviceInvoicesTable)
          .set({ status: "paid", paidAt: new Date() })
          .where(
            and(
              eq(serviceInvoicesTable.reference, current.invoiceReference),
              eq(serviceInvoicesTable.status, "issued"),
            ),
          );
      }
    }
    return updated ?? null;
  });
}

async function currentPayment(req: Request, res: Response, orderId: string, detail: boolean) {
  const session = await findSession(orderId);
  if (!session || !session.invoiceReference) {
    res.status(404).json({ error: "Hizmet faturası için ödeme oturumu bulunamadı." });
    return null;
  }
  if (session.provider === "mock") {
    return paymentStatusView(session);
  }
  if (!isTamiProvider(session.provider)) {
    res.status(404).json({ error: "Ödeme oturumu bulunamadı." });
    return null;
  }
  if (!detail) {
    if (session.status !== "pending") return paymentStatusView(session);
    if (
      session.lastCheckedAt &&
      Date.now() - session.lastCheckedAt.getTime() < 3000
    ) {
      return paymentStatusView(session);
    }
  }

  try {
    const result = await queryTamiPayment(orderId, detail);
    await verifyProviderPayment(result.payload, session);
    const updated = await saveProviderPaymentState(session, result.payload, result.correlationId);
    if (!updated) {
      res.status(404).json({ error: "Hizmet faturası için ödeme oturumu bulunamadı." });
      return null;
    }
    return paymentStatusView(updated);
  } catch (error) {
    req.log?.warn({ err: error, orderId }, "Tami payment status could not be verified");
    const status = error instanceof TamiGatewayError && !error.ambiguous ? 503 : 502;
    res.status(status).json({
      error: "Ödeme sağlayıcısının imzalı durumu doğrulanamadı; ödeme beklemede bırakıldı.",
    });
    return null;
  }
}

// A callback body is only a lookup hint, never trusted payment evidence.
// Keep this separate from authenticated provider notification contracts.
export async function verifyPaymentCallback(
  req: Request,
  res: Response,
  orderId: string,
) {
  const readiness = getPaymentReadiness();
  if (!readiness.liveEnabled && !readiness.sandboxEnabled) {
    res.status(503).json({ error: "Tami ödeme doğrulama ortamı etkin değil." });
    return null;
  }
  const session = await findSession(orderId);
  if (!session?.invoiceReference || !isTamiProvider(session.provider)) {
    res.status(404).json({ error: "Tami hizmet faturası ödeme oturumu bulunamadı." });
    return null;
  }
  if (
    (session.provider === "tami" && !readiness.liveEnabled) ||
    (session.provider === "tami_sandbox" && !readiness.sandboxEnabled)
  ) {
    res.status(503).json({ error: "Ödeme kaydıyla eşleşen Tami ortamı etkin değil." });
    return null;
  }
  // Force a fresh signed query, including for previously settled payments.
  return currentPayment(req, res, orderId, true);
}

async function settleRefund(
  refund: Refund,
  orderId: string,
  correlationId: string,
  providerReference: string | null = null,
  provider = "tami",
) {
  return db.transaction(async (tx) => {
    const [currentRefund] = await tx
      .select()
      .from(paymentRefundsTable)
      .where(eq(paymentRefundsTable.id, refund.id))
      .for("update")
      .limit(1);
    if (!currentRefund || currentRefund.status !== "pending") return currentRefund ?? null;
    const [invoice] = await tx
      .select()
      .from(serviceInvoicesTable)
      .where(eq(serviceInvoicesTable.reference, currentRefund.invoiceReference))
      .for("update")
      .limit(1);
    if (!invoice) return null;
    const currentCents = amountToCents(invoice.refundedAmount);
    const refundCents = amountToCents(currentRefund.amount);
    const totalCents = amountToCents(invoice.amount);
    if (
      currentCents === null ||
      refundCents === null ||
      totalCents === null ||
      currentCents + refundCents > totalCents
    ) {
      return null;
    }
    const updatedAmount = centsToAmount(currentCents + refundCents);
    const status = currentCents + refundCents === totalCents ? "refunded" : "partially_refunded";
    const providerOperationId = currentRefund.providerCorrelationId ?? correlationId;
    const [updated] = await tx
      .update(paymentRefundsTable)
      .set({
        status: "success",
        providerReference,
        providerCorrelationId: providerOperationId,
        errorMessage: null,
        resolvedAt: new Date(),
      })
      .where(eq(paymentRefundsTable.id, currentRefund.id))
      .returning();
    await tx
      .update(serviceInvoicesTable)
      .set({ refundedAmount: updatedAmount, status })
      .where(eq(serviceInvoicesTable.reference, invoice.reference));
    await tx.insert(paymentAuditEventsTable).values({
      eventKey: `refund:success:${currentRefund.id}`,
      eventType: "refund_succeeded",
      provider,
      invoiceReference: invoice.reference,
      orderId,
      amount: currentRefund.amount,
      currency: currentRefund.currency,
      providerStatus: "SUCCESS",
      correlationId: providerOperationId,
      actorKasaUserId: currentRefund.createdByKasaUserId,
    });
    return updated ?? null;
  });
}

async function failRefund(
  refund: Refund,
  correlationId: string,
  providerMessage: string | null,
  provider = "tami",
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(paymentRefundsTable)
      .where(eq(paymentRefundsTable.id, refund.id))
      .for("update")
      .limit(1);
    if (!current || current.status !== "pending") return current ?? null;
    const [updated] = await tx
      .update(paymentRefundsTable)
      .set({
        status: "failed",
        errorMessage: providerMessage?.slice(0, 500) ?? "Tami iadeyi reddetti.",
        providerCorrelationId: correlationId,
        resolvedAt: new Date(),
      })
      .where(eq(paymentRefundsTable.id, current.id))
      .returning();
    await tx.insert(paymentAuditEventsTable).values({
      eventKey: `refund:failed:${current.id}`,
      eventType: "refund_failed",
      provider,
      invoiceReference: current.invoiceReference,
      orderId: current.orderId,
      amount: current.amount,
      currency: current.currency,
      providerStatus: "FAILED",
      correlationId,
      actorKasaUserId: current.createdByKasaUserId,
    });
    return updated ?? null;
  });
}

async function reconcilePendingRefunds(
  orderId: string,
  payload: Record<string, unknown>,
  correlationId: string,
  provider: string,
) {
  const pending = await db
    .select()
    .from(paymentRefundsTable)
    .where(and(eq(paymentRefundsTable.orderId, orderId), eq(paymentRefundsTable.status, "pending")));
  for (const refund of pending) {
    const refundedCents = amountToCents(refund.amount);
    const [invoice] = await db
      .select({
        amount: serviceInvoicesTable.amount,
        refundedAmount: serviceInvoicesTable.refundedAmount,
      })
      .from(serviceInvoicesTable)
      .where(eq(serviceInvoicesTable.reference, refund.invoiceReference))
      .limit(1);
    const totalCents = invoice ? amountToCents(invoice.amount) : null;
    const alreadyRefunded = invoice ? amountToCents(invoice.refundedAmount) : null;
    if (
      refundedCents !== null &&
      totalCents !== null &&
      alreadyRefunded !== null &&
      hasSignedRefundTransaction(
        payload,
        orderId,
        refund.amount,
        centsToAmount(totalCents - alreadyRefunded - refundedCents),
      )
    ) {
      await settleRefund(refund, orderId, correlationId, null, provider);
    }
  }
}

async function processTamiRefund(
  refund: Refund,
  orderId: string,
  amountCents: bigint,
  reason: string,
  provider: string,
) {
  const correlationId = randomUUID();
  await db.transaction(async (tx) => {
    await tx
      .update(paymentRefundsTable)
      .set({ providerCorrelationId: correlationId })
      .where(
        and(
          eq(paymentRefundsTable.id, refund.id),
          eq(paymentRefundsTable.status, "pending"),
        ),
      );
    await tx
      .update(paymentAuditEventsTable)
      .set({ correlationId })
      .where(eq(paymentAuditEventsTable.eventKey, `refund:requested:${refund.id}`));
  });
  const result = await refundTamiPayment({
    orderId,
    amount: centsToAmount(amountCents),
    reason,
  }, correlationId);
  const outcome = signedRefundOutcome(
    result.payload,
    orderId,
    amountCents,
    refund.currency,
    correlationId,
  );
  if (!outcome) return null;
  if (outcome === "failed") {
    return failRefund(
      refund,
      result.correlationId,
      typeof result.payload.errorMessage === "string" ? result.payload.errorMessage : null,
      provider,
    );
  }
  const reference =
    typeof result.payload.transactionId === "string"
      ? result.payload.transactionId
      : typeof result.payload.reference === "string"
        ? result.payload.reference
        : typeof result.payload.bankReferenceNumber === "string"
          ? result.payload.bankReferenceNumber
          : null;
  return settleRefund(refund, orderId, result.correlationId, reference, provider);
}

router.post("/payments/mock/:orderId/result", async (req, res): Promise<void> => {
  if (!getPaymentReadiness().testEnabled) {
    res.status(409).json({ error: "Geliştirme test ödeme modu etkin değil." });
    return;
  }
  const params = SetMockPaymentResultParams.safeParse(req.params);
  const body = SetMockPaymentResultBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Test ödeme sonucu geçersiz." });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(paymentSessionsTable)
      .where(eq(paymentSessionsTable.orderId, params.data.orderId))
      .for("update")
      .limit(1);
    if (!session || !session.invoiceReference) return { kind: "missing" as const };
    if (session.provider !== "mock") return { kind: "conflict" as const };
    let status = body.data.status;
    if (session.status === "success") status = "success";
    else if (session.status !== "pending") status = session.status;
    const [updated] = await tx
      .update(paymentSessionsTable)
      .set({
        status,
        providerPaymentStatus: `MOCK_${status.toUpperCase()}`,
        providerOrderStatus: "MOCK",
        errorMessage: status === "failed" ? "Test başarısızlık simülasyonu." : null,
        lastCheckedAt: new Date(),
      })
      .where(eq(paymentSessionsTable.orderId, session.orderId))
      .returning();
    if (session.status !== status) {
      await tx.insert(paymentAuditEventsTable).values({
        eventKey: `payment:state:${session.orderId}:${status}`,
        eventType: `payment_${status}`,
        provider: "mock",
        invoiceReference: session.invoiceReference,
        orderId: session.orderId,
        amount: session.amount,
        currency: session.currency,
        providerStatus: `MOCK_${status.toUpperCase()}`,
      });
      if (status === "success") {
        await tx
          .update(serviceInvoicesTable)
          .set({ status: "paid", paidAt: new Date() })
          .where(
            and(
              eq(serviceInvoicesTable.reference, session.invoiceReference),
              eq(serviceInvoicesTable.status, "issued"),
            ),
          );
      }
    }
    return { kind: "ok" as const, session: updated! };
  });
  if (result.kind === "missing") {
    res.status(404).json({ error: "Fatura ödeme oturumu bulunamadı." });
    return;
  }
  if (result.kind === "conflict") {
    res.status(409).json({ error: "Bu oturum test ödemesi değil." });
    return;
  }
  res.json(paymentStatusView(result.session));
});

router.get("/payments/tami/:orderId", async (req, res): Promise<void> => {
  const params = getOrderId(req, GetTamiPaymentStatusParams);
  if (!params.success) {
    res.status(404).json({ error: "Ödeme oturumu bulunamadı." });
    return;
  }
  const result = await currentPayment(req, res, params.data.orderId, false);
  if (result) res.json(result);
});

router.post("/payments/tami/:orderId/reconcile", async (req, res): Promise<void> => {
  if (!await owner(req, res)) return;
  const params = ReconcileTamiPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Ödeme referansı geçersiz." });
    return;
  }
  const session = await findSession(params.data.orderId);
  if (!session || !session.invoiceReference) {
    res.status(404).json({ error: "Ödeme oturumu bulunamadı." });
    return;
  }
  if (isTamiProvider(session.provider)) {
    try {
      const query = await queryTamiPayment(params.data.orderId, true);
      await verifyProviderPayment(query.payload, session);
      const updated = await saveProviderPaymentState(
        session,
        query.payload,
        query.correlationId,
      );
      if (!updated) {
        res.status(404).json({ error: "Ödeme oturumu bulunamadı." });
        return;
      }
      await reconcilePendingRefunds(
        params.data.orderId,
        query.payload,
        query.correlationId,
        session.provider,
      );
    } catch (error) {
      req.log?.warn({ err: error, orderId: params.data.orderId }, "Tami payment/refund reconciliation failed");
      res.status(502).json({ error: "Ödeme/iade mutabakatı doğrulanamadı; kayıt beklemede bırakıldı." });
      return;
    }
  }
  const latest = await findSession(params.data.orderId);
  if (!latest) {
    res.status(404).json({ error: "Ödeme oturumu bulunamadı." });
    return;
  }
  res.json(paymentStatusView(latest));
});

router.post("/payments/tami/:orderId/refunds", async (req, res): Promise<void> => {
  const user = await owner(req, res);
  if (!user) return;
  const params = CreateTamiPaymentRefundParams.safeParse(req.params);
  const body = CreateTamiPaymentRefundBody.strict().safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "İade bilgileri geçersiz." });
    return;
  }
  const amountCents = amountToCents(body.data.amount);
  if (amountCents === null || amountCents <= 0n) {
    res.status(400).json({ error: "İade tutarı geçersiz." });
    return;
  }

  const reservation = await db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(paymentSessionsTable)
      .where(eq(paymentSessionsTable.orderId, params.data.orderId))
      .for("update")
      .limit(1);
    if (!session || !session.invoiceReference) return { kind: "missing" as const };
    const [invoice] = await tx
      .select()
      .from(serviceInvoicesTable)
      .where(eq(serviceInvoicesTable.reference, session.invoiceReference))
      .for("update")
      .limit(1);
    if (!invoice) return { kind: "missing" as const };
    const [sameKey] = await tx
      .select()
      .from(paymentRefundsTable)
      .where(eq(paymentRefundsTable.idempotencyKey, body.data.idempotencyKey))
      .for("update")
      .limit(1);
    if (sameKey) {
      if (
        sameKey.orderId !== session.orderId ||
        amountToCents(sameKey.amount) !== amountCents ||
        sameKey.reason !== body.data.reason.trim()
      ) {
        return { kind: "keyConflict" as const };
      }
      return { kind: "existing" as const, refund: sameKey, session, invoice };
    }
    const [pendingRefund] = await tx
      .select()
      .from(paymentRefundsTable)
      .where(
        and(
          eq(paymentRefundsTable.orderId, session.orderId),
          eq(paymentRefundsTable.status, "pending"),
        ),
      )
      .limit(1);
    if (pendingRefund) return { kind: "pending" as const };
    if (session.status !== "success" || invoice.status === "cancelled") {
      return { kind: "notRefundable" as const };
    }
    if (!isTamiProvider(session.provider) && session.provider !== "mock") {
      return { kind: "notRefundable" as const };
    }
    if (session.provider === "mock" && !getPaymentReadiness().testEnabled) {
      return { kind: "providerUnavailable" as const };
    }
    if (session.provider === "tami_sandbox" && !getPaymentReadiness().sandboxEnabled) {
      return { kind: "providerUnavailable" as const };
    }
    const refundedCents = amountToCents(invoice.refundedAmount);
    const totalCents = amountToCents(invoice.amount);
    if (
      refundedCents === null ||
      totalCents === null ||
      refundedCents + amountCents > totalCents
    ) {
      return { kind: "excessive" as const };
    }
    const [refund] = await tx
      .insert(paymentRefundsTable)
      .values({
        orderId: session.orderId,
        invoiceReference: invoice.reference,
        idempotencyKey: body.data.idempotencyKey,
        amount: centsToAmount(amountCents),
        currency: invoice.currency,
        reason: body.data.reason.trim(),
        status: "pending",
        createdByKasaUserId: user.id,
      })
      .returning();
    await tx.insert(paymentAuditEventsTable).values({
      eventKey: `refund:requested:${refund!.id}`,
      eventType: "refund_requested",
      provider: session.provider,
      invoiceReference: invoice.reference,
      orderId: session.orderId,
      amount: refund!.amount,
      currency: refund!.currency,
      actorKasaUserId: user.id,
    });
    return { kind: "created" as const, refund: refund!, session, invoice };
  });

  if (reservation.kind === "missing") {
    res.status(404).json({ error: "Fatura ödeme kaydı bulunamadı." });
    return;
  }
  if (reservation.kind === "keyConflict") {
    res.status(409).json({ error: "Bu iade anahtarı farklı bir istek için kullanılmış." });
    return;
  }
  if (reservation.kind === "pending") {
    res.status(409).json({ error: "Bekleyen iade mutabık kılınmadan yeni iade başlatılamaz." });
    return;
  }
  if (reservation.kind === "notRefundable") {
    res.status(409).json({ error: "Yalnızca başarıyla tahsil edilmiş hizmet faturaları iade edilebilir." });
    return;
  }
  if (reservation.kind === "providerUnavailable") {
    res.status(503).json({ error: "Bu test ödeme ortamı etkin değil." });
    return;
  }
  if (reservation.kind === "excessive") {
    res.status(400).json({ error: "İade tutarı tahsil edilen kalan tutarı aşamaz." });
    return;
  }
  if (reservation.kind === "existing") {
    res.json(CreateTamiPaymentRefundResponse.parse(reservation.refund));
    return;
  }

  const refund = reservation.refund;
  if (reservation.session.provider === "mock") {
    const reference = `MOCK-${refund.id}`;
    const updated = await settleRefund(
      refund,
      reservation.session.orderId,
      reference,
      reference,
      "mock",
    );
    if (!updated) {
      res.status(409).json({ error: "Test iadesi fatura bakiyesiyle mutabık kılınamadı." });
      return;
    }
    res.status(201).json(CreateTamiPaymentRefundResponse.parse(updated));
    return;
  }

  try {
    const outcome = await processTamiRefund(
      refund,
      reservation.session.orderId,
      amountCents,
      body.data.reason.trim(),
      reservation.session.provider,
    );
    if (!outcome) {
      res.status(502).json({ error: "Tami yanıtı kesin değil. İade beklemede kaldı; mutabakat yapmadan tekrar göndermeyin." });
      return;
    }
    res.status(outcome.status === "success" ? 201 : 502).json(
      CreateTamiPaymentRefundResponse.parse(outcome),
    );
  } catch (error) {
    req.log?.warn({ err: error, orderId: reservation.session.orderId }, "Tami refund outcome is uncertain");
    res.status(502).json({ error: "Tami iadesinin sonucu belirsiz; kayıt beklemede kaldı. Tekrar göndermeden önce mutabakat yapın." });
  }
});

router.get("/payments/tami/:orderId/refunds", async (req, res): Promise<void> => {
  if (!await owner(req, res)) return;
  const params = GetTamiPaymentRefundsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Ödeme referansı geçersiz." });
    return;
  }
  const session = await findSession(params.data.orderId);
  if (!session || !session.invoiceReference) {
    res.status(404).json({ error: "Ödeme kaydı bulunamadı." });
    return;
  }
  const refunds = await db
    .select()
    .from(paymentRefundsTable)
    .where(eq(paymentRefundsTable.orderId, session.orderId))
    .orderBy(desc(paymentRefundsTable.createdAt));
  res.json(GetTamiPaymentRefundsResponse.parse(refunds));
});

export default router;