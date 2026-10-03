import { describe, expect, it } from "vitest";
import {
  amountToCents,
  centsToAmount,
  hasSignedRefundTransaction,
  mapTamiPaymentStatus,
  normalizePhone,
  resolveVerifiedPaymentStatus,
  signedRefundOutcome,
} from "../lib/payment-domain";
import {
  signTamiRequestBody,
  verifyTamiResponse,
  type TamiCredentials,
} from "../lib/tami-gateway";

const credentials: TamiCredentials = {
  merchantNumber: "123456",
  terminalNumber: "654321",
  secretKey: "test-only-secret",
  jwkKid: "test-only-kid",
  jwkKey: Buffer.from("test-only-key-with-enough-entropy").toString("base64url"),
  environment: "sandbox",
};

describe("Tami payment verification", () => {
  it("signs request bodies and verifies the provider's HS512 response token", () => {
    const signed = signTamiRequestBody(
      { orderId: "order-123", amount: "12.50" },
      credentials,
    );
    expect(signed).toBeTruthy();
    const verified = verifyTamiResponse({ securityHash: signed }, credentials);
    expect(verified).toEqual({ orderId: "order-123", amount: "12.50" });

    const [header, payload, signature] = signed!.split(".");
    const tampered = `${header}.${payload}.${signature!.startsWith("A") ? "B" : "A"}${signature!.slice(1)}`;
    expect(verifyTamiResponse({ securityHash: tampered }, credentials)).toBeNull();
  });

  it("converts currency amounts without floating-point rounding", () => {
    expect(amountToCents("12.30")).toBe(1230n);
    expect(amountToCents("12.345")).toBeNull();
    expect(centsToAmount(1230n)).toBe("12.30");
    expect(normalizePhone("+90 (555) 123-45-67")).toBe("905551234567");
  });

  it("accepts only provider-confirmed success, failure, or cancellation states", () => {
    expect(mapTamiPaymentStatus({ paymentStatus: "SUCCESS" })).toBe("success");
    expect(mapTamiPaymentStatus({ paymentStatus: "FAIL" })).toBe("failed");
    expect(mapTamiPaymentStatus({ paymentStatus: "TIME_OUT" })).toBe("failed");
    expect(mapTamiPaymentStatus({ paymentStatus: "CANCELLED" })).toBe("cancelled");
    expect(mapTamiPaymentStatus({ paymentStatus: "NOT_COMPLETE" })).toBe("pending");
  });

  it("does not regress a successful provider result when repeated or contradicted later", () => {
    expect(resolveVerifiedPaymentStatus("pending", "success")).toBe("success");
    expect(resolveVerifiedPaymentStatus("success", "success")).toBe("success");
    expect(resolveVerifiedPaymentStatus("success", "failed")).toBe("success");
    expect(resolveVerifiedPaymentStatus("failed", "pending")).toBe("failed");
    expect(resolveVerifiedPaymentStatus("failed", "success")).toBe("success");
  });

  it("requires a matching signed order, amount, currency, and request correlation for refunds", () => {
    const response = {
      orderId: "order-123",
      amount: "5.00",
      currency: "TRY",
      correlationId: "request-456",
      success: true,
    };
    expect(
      signedRefundOutcome(response, "order-123", 500n, "TRY", "request-456"),
    ).toBe("success");
    expect(
      signedRefundOutcome(response, "order-123", 500n, "TRY", "old-request"),
    ).toBeNull();
    expect(
      signedRefundOutcome(response, "order-123", 500n, "EUR", "request-456"),
    ).toBeNull();
  });

  it("reconciles a refund only when the signed detail shows the expected reduced net amount", () => {
    const providerResult = {
      orderId: "order-123",
      amount: 0,
      transactions: [
        {
          amount: 5,
          transactionType: "AUTH",
          transactionStatus: "SUCCESS",
        },
        {
          amount: 5,
          transactionType: "REVERSE",
          transactionStatus: "SUCCESS",
        },
      ],
    };
    expect(
      hasSignedRefundTransaction(providerResult, "order-123", "5.00", "0.00"),
    ).toBe(true);
    expect(
      hasSignedRefundTransaction(providerResult, "order-123", "5.00", "5.00"),
    ).toBe(false);
    expect(
      hasSignedRefundTransaction(providerResult, "another-order", "5.00", "0.00"),
    ).toBe(false);
  });
});