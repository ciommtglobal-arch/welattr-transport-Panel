import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTamiHostedToken,
  getTamiCredentials,
  queryTamiPayment,
  signTamiRequestBody,
  verifyTamiResponse,
} from "./tami-gateway";

// This suite never calls Tami or imports the application's database.
// All credentials, tokens, responses and callback domains are synthetic.
const fetchMock = vi.fn<typeof fetch>();
const input = () => ({
  amount: 12.5,
  orderId: "test-order-3ds",
  fullName: "TEST Buyer",
  email: "buyer@example.test",
  phone: "905551234567",
  description: "TEST service invoice",
  callbackBaseUrl: "https://merchant.example.test",
});
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const sentRequest = () => {
  const [url, options] = fetchMock.mock.calls[0]!;
  return {
    url,
    headers: new Headers(options?.headers),
    body: JSON.parse(String(options?.body)) as Record<string, unknown>,
  };
};

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("TAMI_ENVIRONMENT", "sandbox");
  vi.stubEnv("TAMI_MERCHANT_NUMBER", "123456");
  vi.stubEnv("TAMI_TERMINAL_NUMBER", "654321");
  vi.stubEnv("TAMI_SECRET_KEY", "test-only-header-secret");
  vi.stubEnv("TAMI_JWK_KID", "test-only-jwk-kid");
  vi.stubEnv("TAMI_JWK_K", Buffer.alloc(64, 42).toString("base64url"));
  vi.stubEnv("MMT_PAYMENT_CALLBACK_BASE_URL", "");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Tami hosted checkout and bank-return boundary", () => {
  it("uses the hosted sandbox page with HTTPS return URLs and no card fields", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ oneTimeToken: "test-only-token+/=" }));
    const checkout = new URL(await createTamiHostedToken(input()));
    const request = sentRequest();

    expect(request.url).toBe(
      "https://sandbox-paymentapi.tami.com.tr/hosted/create-one-time-hosted-token",
    );
    expect(request.body.amount).toBe(12.5);
    expect(request.body.orderId).toBe("test-order-3ds");
    for (const result of ["success", "failed"] as const) {
      const field = result === "success" ? "successCallbackUrl" : "failCallbackUrl";
      const callback = new URL(String(request.body[field]));
      expect(callback.origin).toBe("https://merchant.example.test");
      expect(callback.pathname).toBe("/odeme/sonuc");
      expect(callback.searchParams.get("orderId")).toBe("test-order-3ds");
      expect(callback.searchParams.get("result")).toBe(result);
    }
    expect(request.body).not.toHaveProperty("card");
    expect(request.body).not.toHaveProperty("cvv");
    expect(request.body).not.toHaveProperty("cardNumber");
    expect(checkout.origin).toBe("https://sandbox-portal.tami.com.tr");
    expect(checkout.pathname).toBe("/hostedPaymentPage");
    expect(checkout.searchParams.get("token")).toBe("test-only-token+/=");
  });

  it("uses the configured HTTPS merchant return URL for a production credential fixture", async () => {
    vi.stubEnv("TAMI_ENVIRONMENT", "production");
    vi.stubEnv("MMT_PAYMENT_CALLBACK_BASE_URL", "https://verified.example.test");
    fetchMock.mockResolvedValue(jsonResponse({ oneTimeToken: "test-only-token" }));
    const checkout = new URL(await createTamiHostedToken(input()));
    const request = sentRequest();
    expect(request.url).toBe(
      "https://paymentapi.tami.com.tr/hosted/create-one-time-hosted-token",
    );
    expect(new URL(String(request.body.successCallbackUrl)).origin).toBe(
      "https://verified.example.test",
    );
    expect(checkout.origin).toBe("https://portal.tami.com.tr");
  });

  it("does not make a production hosted request without a configured callback", async () => {
    vi.stubEnv("TAMI_ENVIRONMENT", "production");
    await expect(createTamiHostedToken(input())).rejects.toThrow(
      "A verified HTTPS payment callback URL is required.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["http://merchant.example.test", "not-a-url"])(
    "rejects an unsafe callback before contacting Tami: %s",
    async (callbackBaseUrl) => {
      await expect(createTamiHostedToken({
        ...input(),
        callbackBaseUrl,
      })).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("does not invent a checkout token after a provider error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errorCode: "TEST_DECLINED" }, 400));
    await expect(createTamiHostedToken(input())).rejects.toThrow(
      "Tami hosted checkout could not be created.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not confuse a direct 3DS challenge response with a hosted checkout token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      success: true,
      threeDSHtmlContent: Buffer.from("<html>TEST BANK</html>").toString("base64"),
    }));
    await expect(createTamiHostedToken(input())).rejects.toThrow(
      "Tami hosted checkout response was invalid.",
    );
  });
});

describe("signed Tami payment query", () => {
  it("uses PG authentication and a signed query, not a Bearer secret or browser result", async () => {
    const credentials = getTamiCredentials()!;
    const signedPayload = {
      orderId: "test-order-3ds",
      amount: "12.50",
      currency: "TRY",
      paymentStatus: "NOT_COMPLETED",
    };
    fetchMock.mockResolvedValue(jsonResponse({
      ...signedPayload,
      paymentStatus: "SUCCESS",
      securityHash: signTamiRequestBody(signedPayload, credentials),
    }));
    const result = await queryTamiPayment("test-order-3ds", true);
    const request = sentRequest();
    const headerHash = createHash("sha256")
      .update("123456654321test-only-header-secret", "utf8")
      .digest("base64");
    expect(request.url).toBe("https://sandbox-paymentapi.tami.com.tr/payment/query");
    expect(request.headers.get("PG-Auth-Token")).toBe(`123456:654321:${headerHash}`);
    expect(request.headers.has("Authorization")).toBe(false);
    expect(request.headers.get("PG-Api-Version")).toBe("v3");
    expect(request.headers.get("correlationId")).toBeTruthy();
    expect(verifyTamiResponse(request.body, credentials)).toEqual({
      orderId: "test-order-3ds",
      isTransactionDetail: "true",
    });
    expect(result.payload).toEqual(signedPayload);
  });

  it("rejects an unsigned claimed success instead of falling back to simulation", async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      orderId: "test-order-3ds",
      amount: "12.50",
      currency: "TRY",
      paymentStatus: "SUCCESS",
    }));
    await expect(queryTamiPayment("test-order-3ds")).rejects.toThrow(
      "Tami response signature could not be verified.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
