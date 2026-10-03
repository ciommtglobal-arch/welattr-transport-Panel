import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export interface TamiCredentials {
  merchantNumber: string;
  terminalNumber: string;
  secretKey: string;
  jwkKid: string;
  jwkKey: string;
  environment: "sandbox" | "production";
}

export interface TamiReply {
  payload: Record<string, unknown>;
  correlationId: string;
}

export class TamiGatewayError extends Error {
  constructor(message: string, readonly ambiguous = true) {
    super(message);
    this.name = "TamiGatewayError";
  }
}

const isTrue = (key: string) => process.env[key]?.trim().toLowerCase() === "true";

export function getTamiCredentials(): TamiCredentials | null {
  const merchantNumber = process.env.TAMI_MERCHANT_NUMBER?.trim();
  const terminalNumber = process.env.TAMI_TERMINAL_NUMBER?.trim();
  const secretKey = process.env.TAMI_SECRET_KEY?.trim();
  const jwkKid = process.env.TAMI_JWK_KID?.trim();
  const jwkKey = process.env.TAMI_JWK_K?.trim();
  if (!merchantNumber || !terminalNumber || !secretKey || !jwkKid || !jwkKey) {
    return null;
  }

  return {
    merchantNumber,
    terminalNumber,
    secretKey,
    jwkKid,
    jwkKey,
    environment:
      process.env.TAMI_ENVIRONMENT?.trim().toLowerCase() === "production"
        ? "production"
        : "sandbox",
  };
}

export function getPaymentReadiness() {
  const credentials = getTamiCredentials();
  const bankAccountVerified = isTrue("MMT_BANK_ACCOUNT_VERIFIED");
  const providerApproved = isTrue("TAMI_PROVIDER_APPROVED");
  const productionCredentialsVerified = isTrue("TAMI_PRODUCTION_CREDENTIALS_VERIFIED");
  const sandboxEnabled =
    process.env.NODE_ENV !== "production" &&
    credentials?.environment === "sandbox" &&
    isTrue("TAMI_SANDBOX_TEST_ENABLED");
  const threeDSecureVerified = isTrue("TAMI_3DS_VERIFIED");
  const testingEvidenceVerified = isTrue("MMT_PAYMENT_TESTS_VERIFIED");
  const writtenAuthorizationConfigured = Boolean(
    process.env.MMT_PAYMENT_WRITTEN_AUTHORIZATION_REFERENCE?.trim(),
  );
  const callbackBaseUrl = process.env.MMT_PAYMENT_CALLBACK_BASE_URL?.trim();
  let callbackIsSecure = false;
  try {
    callbackIsSecure = new URL(callbackBaseUrl ?? "").protocol === "https:";
  } catch {
    callbackIsSecure = false;
  }
  const liveEnabled =
    isTrue("MMT_PAYMENT_LIVE_ENABLED") &&
    process.env.NODE_ENV === "production" &&
    credentials?.environment === "production" &&
    productionCredentialsVerified &&
    bankAccountVerified &&
    providerApproved &&
    threeDSecureVerified &&
    testingEvidenceVerified &&
    writtenAuthorizationConfigured &&
    callbackIsSecure;

  return {
    bankAccountVerified,
    providerApproved,
    productionCredentialsVerified,
    sandboxEnabled,
    threeDSecureVerified,
    testingEvidenceVerified,
    writtenAuthorizationConfigured,
    liveEnabled,
    testEnabled:
      process.env.NODE_ENV !== "production" && isTrue("MMT_PAYMENT_TEST_MODE"),
    cardDataCollected: false as const,
  };
}

function getTamiEndpoint(path: string, credentials: TamiCredentials) {
  const host =
    credentials.environment === "production"
      ? "https://paymentapi.tami.com.tr"
      : "https://sandbox-paymentapi.tami.com.tr";
  return `${host}${path}`;
}

export function signTamiRequestBody(
  body: Record<string, unknown>,
  credentials = getTamiCredentials(),
): string | null {
  if (!credentials) return null;
  const header = Buffer.from(
    JSON.stringify({ kid: credentials.jwkKid, typ: "JWT", alg: "HS512" }),
    "utf8",
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signature = createHmac(
    "sha512",
    Buffer.from(credentials.jwkKey, "base64url"),
  )
    .update(signingInput, "utf8")
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

export function verifyTamiResponse(
  response: unknown,
  credentials = getTamiCredentials(),
): Record<string, unknown> | null {
  if (!credentials || !response || typeof response !== "object") return null;
  const compact = (response as Record<string, unknown>).securityHash;
  if (typeof compact !== "string") return null;
  const parts = compact.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return null;

  try {
    const [encodedHeader, encodedPayload, encodedSignature] = parts as [
      string,
      string,
      string,
    ];
    const header = JSON.parse(
      Buffer.from(encodedHeader, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    if (
      header.alg !== "HS512" ||
      header.typ !== "JWT" ||
      header.kid !== credentials.jwkKid
    ) {
      return null;
    }

    const expected = createHmac(
      "sha512",
      Buffer.from(credentials.jwkKey, "base64url"),
    )
      .update(`${encodedHeader}.${encodedPayload}`, "utf8")
      .digest();
    const actual = Buffer.from(encodedSignature, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return null;
    }

    const signedPayload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
    if (!signedPayload || typeof signedPayload !== "object" || Array.isArray(signedPayload)) {
      return null;
    }
    return signedPayload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function authToken(credentials: TamiCredentials) {
  const hash = createHash("sha256")
    .update(
      `${credentials.merchantNumber}${credentials.terminalNumber}${credentials.secretKey}`,
      "utf8",
    )
    .digest("base64");
  return `${credentials.merchantNumber}:${credentials.terminalNumber}:${hash}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function tamiRequest(
  path: string,
  requestBody: Record<string, unknown>,
  credentials = getTamiCredentials(),
  requestCorrelationId: string = randomUUID(),
): Promise<TamiReply> {
  if (!credentials) {
    throw new TamiGatewayError("Tami provider credentials are unavailable.", false);
  }
  const correlationId = requestCorrelationId;
  const securityHash = signTamiRequestBody(requestBody, credentials);
  if (!securityHash) {
    throw new TamiGatewayError("Tami request could not be signed.", false);
  }

  let response: Response;
  try {
    response = await fetch(getTamiEndpoint(path, credentials), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Language": "tr",
        "Content-Type": "application/json",
        correlationId,
        "PG-Auth-Token": authToken(credentials),
        "PG-Api-Version": "v3",
      },
      body: JSON.stringify({ ...requestBody, securityHash }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new TamiGatewayError("Tami did not return a definitive response.");
  }

  const outer = await readJson(response);
  const payload = verifyTamiResponse(outer, credentials);
  if (!payload) {
    throw new TamiGatewayError("Tami response signature could not be verified.");
  }
  if (!response.ok && payload.success !== false) {
    throw new TamiGatewayError("Tami returned an unexpected HTTP response.");
  }
  return { payload, correlationId };
}

export async function createTamiHostedToken(input: {
  amount: number;
  orderId: string;
  fullName: string;
  email: string;
  phone: string;
  description: string;
  callbackBaseUrl: string;
}) {
  const credentials = getTamiCredentials();
  if (!credentials) {
    throw new TamiGatewayError("Tami hosted checkout is not configured.", false);
  }
  if (credentials.environment === "production") {
    const configured = process.env.MMT_PAYMENT_CALLBACK_BASE_URL?.trim();
    if (!configured) {
      throw new TamiGatewayError("A verified HTTPS payment callback URL is required.", false);
    }
    input.callbackBaseUrl = configured;
  }
  let base: URL;
  try {
    base = new URL(input.callbackBaseUrl);
  } catch {
    throw new TamiGatewayError("Payment callback URL is invalid.", false);
  }
  if (base.protocol !== "https:") {
    throw new TamiGatewayError("Payment callback URL must use HTTPS.", false);
  }

  const callback = (result: "success" | "failed") => {
    const url = new URL("/odeme/sonuc", base);
    url.searchParams.set("orderId", input.orderId);
    url.searchParams.set("result", result);
    return url.toString();
  };
  const credentialsHeaders = {
    Accept: "application/json",
    "Accept-Language": "tr",
    "Content-Type": "application/json",
    correlationId: randomUUID(),
    "PG-Auth-Token": authToken(credentials),
    "PG-Api-Version": "v3",
  };
  let response: Response;
  try {
    response = await fetch(
      getTamiEndpoint("/hosted/create-one-time-hosted-token", credentials),
      {
        method: "POST",
        headers: credentialsHeaders,
        body: JSON.stringify({
          amount: input.amount,
          orderId: input.orderId,
          successCallbackUrl: callback("success"),
          failCallbackUrl: callback("failed"),
          mobilePhoneNumber: input.phone,
          data: {
            fullName: input.fullName,
            email: input.email,
            description: input.description.slice(0, 100),
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    throw new TamiGatewayError("Tami hosted checkout did not return a response.");
  }

  const payload = await readJson(response);
  if (!response.ok || !payload || typeof payload !== "object") {
    throw new TamiGatewayError("Tami hosted checkout could not be created.");
  }
  const token = (payload as Record<string, unknown>).oneTimeToken;
  if (typeof token !== "string" || !token || token.length > 2048) {
    throw new TamiGatewayError("Tami hosted checkout response was invalid.");
  }

  const portal =
    credentials.environment === "production"
      ? "https://portal.tami.com.tr"
      : "https://sandbox-portal.tami.com.tr";
  const checkoutUrl = new URL("/hostedPaymentPage", portal);
  checkoutUrl.searchParams.set("token", token);
  return checkoutUrl.toString();
}

export async function queryTamiPayment(
  orderId: string,
  includeTransactions = false,
) {
  return tamiRequest("/payment/query", {
    orderId,
    isTransactionDetail: includeTransactions ? "true" : "false",
  });
}

export async function refundTamiPayment(
  input: { amount: string; orderId: string; reason: string },
  correlationId: string,
) {
  return tamiRequest("/payment/reverse", input, getTamiCredentials(), correlationId);
}