import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { eq } from "drizzle-orm";
import { CreateTamiHostedPaymentSessionBody } from "@workspace/api-zod";
import { db, paymentSessionsTable } from "@workspace/db";

const router: IRouter = Router();

function getTamiEnvironment() {
  return process.env.TAMI_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
}

function getTamiBaseUrl() {
  return getTamiEnvironment() === "sandbox"
    ? "https://sandbox-paymentapi.tami.com.tr"
    : "https://paymentapi.tami.com.tr";
}

function getTamiPortalUrl() {
  return getTamiEnvironment() === "sandbox"
    ? "https://sandbox-portal.tami.com.tr"
    : "https://portal.tami.com.tr";
}

function getTamiCredentials() {
  const merchantNumber = process.env.TAMI_MERCHANT_NUMBER?.trim();
  const terminalNumber = process.env.TAMI_TERMINAL_NUMBER?.trim();
  const secretKey = process.env.TAMI_SECRET_KEY?.trim();

  if (!merchantNumber || !terminalNumber || !secretKey) return null;
  return { merchantNumber, terminalNumber, secretKey };
}

function getTamiAuthHash() {
  const credentials = getTamiCredentials();
  if (!credentials) return null;

  return createHash("sha256")
    .update(
      `${credentials.merchantNumber}${credentials.terminalNumber}${credentials.secretKey}`,
      "utf8",
    )
    .digest("base64");
}

function getTamiHeaders() {
  const credentials = getTamiCredentials();
  const hash = getTamiAuthHash();
  if (!credentials || !hash) return null;

  return {
    Accept: "application/json",
    "Accept-Language": "tr",
    "Content-Type": "application/json",
    correlationId: randomUUID(),
    "PG-Auth-Token": `${credentials.merchantNumber}:${credentials.terminalNumber}:${hash}`,
    "PG-Api-Version": "v3",
  };
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  return digits;
}

function createOrderId() {
  return `MMT${Date.now().toString(36).toUpperCase()}${randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function getCallbackBaseUrl(req: Request) {
  const configured = process.env.MMT_PAYMENT_CALLBACK_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || req.protocol;
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.get("host");
  if (!host) throw new Error("Payment callback host is unavailable.");

  return `${protocol}://${host}`;
}

function getCallbackUrl(req: Request, orderId: string, result: "success" | "failed") {
  const baseUrl = getCallbackBaseUrl(req);
  const url = new URL("/odeme/sonuc", baseUrl);
  url.searchParams.set("orderId", orderId);
  url.searchParams.set("result", result);
  return url.toString();
}

function readProviderMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  return typeof data.errorMessage === "string" ? data.errorMessage : null;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function mapProviderStatus(payload: Record<string, unknown>) {
  const paymentStatus =
    typeof payload.paymentStatus === "string"
      ? payload.paymentStatus.toUpperCase()
      : null;
  const success = payload.success === true;

  if (success && paymentStatus === "SUCCESS") return "success" as const;
  if (payload.success === false || ["FAIL", "FAILED", "ERROR"].includes(paymentStatus ?? "")) {
    return "failed" as const;
  }
  return "pending" as const;
}

function createJwkSecurityHash(payload: Record<string, unknown>) {
  const kid = process.env.TAMI_JWK_KID?.trim();
  const key = process.env.TAMI_JWK_K?.trim();
  if (!kid || !key) return null;

  const header = Buffer.from(
    JSON.stringify({ kid, typ: "JWT", alg: "HS512" }),
    "utf8",
  ).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signingInput = `${header}.${encodedPayload}`;
  const signature = createHmac(
    "sha512",
    Buffer.from(key, "base64url"),
  )
    .update(signingInput, "utf8")
    .digest("base64url");

  return `${signingInput}.${signature}`;
}

router.post("/payments/tami/hosted-session", async (req, res) => {
  const parsed = CreateTamiHostedPaymentSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Ödeme bilgileri geçersiz.",
    });
    return;
  }

  const headers = getTamiHeaders();
  if (!headers) {
    res.status(503).json({
      error: "Tami ödeme altyapısı henüz yapılandırılmadı.",
    });
    return;
  }

  const phoneNumber = normalizePhone(parsed.data.phone);
  if (phoneNumber.length < 10) {
    res.status(400).json({ error: "Telefon numarası geçersiz." });
    return;
  }

  const orderId = createOrderId();
  const amount = Number(parsed.data.amount.toFixed(2));

  try {
    await db.insert(paymentSessionsTable).values({
      orderId,
      amount: amount.toFixed(2),
      fullName: parsed.data.fullName.trim(),
      email: parsed.data.email.trim().toLowerCase(),
      phone: phoneNumber,
      description: parsed.data.description.trim(),
    });

    const response = await fetch(
      `${getTamiBaseUrl()}/hosted/create-one-time-hosted-token`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount,
          orderId,
          successCallbackUrl: getCallbackUrl(req, orderId, "success"),
          failCallbackUrl: getCallbackUrl(req, orderId, "failed"),
          mobilePhoneNumber: phoneNumber,
          data: {
            fullName: parsed.data.fullName.trim(),
            email: parsed.data.email.trim().toLowerCase(),
            description: parsed.data.description.trim(),
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const payload = await readJson(response);

    if (!response.ok || !payload || typeof payload !== "object") {
      await db
        .update(paymentSessionsTable)
        .set({ status: "failed", errorMessage: "Tami token servisi hata verdi." })
        .where(eq(paymentSessionsTable.orderId, orderId));
      res.status(502).json({
        error: "Tami ödeme sayfası oluşturulamadı.",
      });
      return;
    }

    const oneTimeToken = (payload as Record<string, unknown>).oneTimeToken;
    if (typeof oneTimeToken !== "string" || !oneTimeToken) {
      await db
        .update(paymentSessionsTable)
        .set({
          status: "failed",
          errorMessage: readProviderMessage(payload) ?? "Tami token yanıtı geçersiz.",
        })
        .where(eq(paymentSessionsTable.orderId, orderId));
      res.status(502).json({ error: "Tami ödeme sayfası yanıtı geçersiz." });
      return;
    }

    const paymentUrl = new URL("/hostedPaymentPage", getTamiPortalUrl());
    paymentUrl.searchParams.set("token", oneTimeToken);

    res.status(201).json({
      orderId,
      paymentUrl: paymentUrl.toString(),
      status: "pending",
    });
  } catch (error) {
    req.log?.error({ err: error, orderId }, "Tami hosted payment creation failed");
    await db
      .update(paymentSessionsTable)
      .set({ status: "failed", errorMessage: "Ödeme oturumu oluşturulamadı." })
      .where(eq(paymentSessionsTable.orderId, orderId))
      .catch(() => undefined);
    res.status(502).json({ error: "Ödeme oturumu oluşturulamadı." });
  }
});

router.get("/payments/tami/:orderId", async (req, res) => {
  const [session] = await db
    .select()
    .from(paymentSessionsTable)
    .where(eq(paymentSessionsTable.orderId, req.params.orderId))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Ödeme oturumu bulunamadı." });
    return;
  }

  const headers = getTamiHeaders();
  const securityHash = createJwkSecurityHash({
    orderId: session.orderId,
    isTransactionDetail: "false",
  });
  if (!headers || !securityHash) {
    res.status(503).json({
      error: "Tami durum sorgusu için güvenlik ayarları tamamlanmadı.",
    });
    return;
  }

  try {
    const response = await fetch(`${getTamiBaseUrl()}/payment/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        orderId: session.orderId,
        isTransactionDetail: "false",
        securityHash,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const payload = await readJson(response);

    if (!response.ok || !payload || typeof payload !== "object") {
      res.status(502).json({ error: "Tami ödeme durumu sorgulanamadı." });
      return;
    }

    const provider = payload as Record<string, unknown>;
    const status = mapProviderStatus(provider);
    await db
      .update(paymentSessionsTable)
      .set({
        status,
        providerPaymentStatus:
          typeof provider.paymentStatus === "string"
            ? provider.paymentStatus
            : null,
        providerOrderStatus:
          typeof provider.orderStatus === "string" ? provider.orderStatus : null,
        errorMessage: readProviderMessage(provider),
        lastCheckedAt: new Date(),
      })
      .where(eq(paymentSessionsTable.orderId, session.orderId));

    res.json({
      orderId: session.orderId,
      amount: Number(session.amount),
      currency: session.currency,
      status,
      providerPaymentStatus:
        typeof provider.paymentStatus === "string"
          ? provider.paymentStatus
          : null,
      providerOrderStatus:
        typeof provider.orderStatus === "string" ? provider.orderStatus : null,
      errorMessage: readProviderMessage(provider),
    });
  } catch (error) {
    req.log?.error({ err: error, orderId: session.orderId }, "Tami payment query failed");
    res.status(502).json({ error: "Tami ödeme durumu sorgulanamadı." });
  }
});

export default router;