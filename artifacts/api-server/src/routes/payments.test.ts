import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import paymentsRouter from "./payments";
import tamiPaymentsRouter from "./tami-payments";

const app = express();
app.use(express.json());
app.use(paymentsRouter);
app.use(tamiPaymentsRouter);

const sameOriginPost = (path: string) =>
  request(app)
    .post(path)
    .set("Origin", "http://127.0.0.1")
    .set("Host", "127.0.0.1");

const readinessKeys = [
  "MMT_BANK_ACCOUNT_VERIFIED",
  "TAMI_PROVIDER_APPROVED",
  "TAMI_PRODUCTION_CREDENTIALS_VERIFIED",
  "TAMI_3DS_VERIFIED",
  "MMT_PAYMENT_TESTS_VERIFIED",
  "MMT_PAYMENT_WRITTEN_AUTHORIZATION_REFERENCE",
  "MMT_PAYMENT_CALLBACK_BASE_URL",
  "MMT_PAYMENT_LIVE_ENABLED",
  "MMT_PAYMENT_TEST_MODE",
  "TAMI_SANDBOX_TEST_ENABLED",
  "TAMI_MERCHANT_NUMBER",
  "TAMI_TERMINAL_NUMBER",
  "TAMI_SECRET_KEY",
  "TAMI_JWK_KID",
  "TAMI_JWK_K",
  "TAMI_ENVIRONMENT",
] as const;

const previousEnvironment = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of readinessKeys) {
    previousEnvironment.set(key, process.env[key]);
    delete process.env[key];
  }
  previousEnvironment.set("NODE_ENV", process.env.NODE_ENV);
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  for (const key of readinessKeys) {
    const value = previousEnvironment.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const nodeEnv = previousEnvironment.get("NODE_ENV");
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  previousEnvironment.clear();
});

const checkoutInput = {
  invoiceReference: `MMT-${"A".repeat(32)}`,
  fullName: "Test Customer",
  email: "customer@example.test",
  phone: "+90 555 123 4567",
  idempotencyKey: "test-idempotency-key-001",
};

describe("company payment safeguards", () => {
  it("keeps live checkout disabled until every approval and credential gate is verified", async () => {
    process.env.MMT_PAYMENT_LIVE_ENABLED = "true";
    process.env.MMT_BANK_ACCOUNT_VERIFIED = "true";
    process.env.TAMI_PROVIDER_APPROVED = "true";
    process.env.TAMI_3DS_VERIFIED = "true";
    process.env.MMT_PAYMENT_TESTS_VERIFIED = "true";
    process.env.MMT_PAYMENT_WRITTEN_AUTHORIZATION_REFERENCE = "approval-reference";
    process.env.MMT_PAYMENT_CALLBACK_BASE_URL = "https://payments.example.test";
    process.env.TAMI_ENVIRONMENT = "production";
    process.env.TAMI_MERCHANT_NUMBER = "123456";
    process.env.TAMI_TERMINAL_NUMBER = "123456";
    process.env.TAMI_SECRET_KEY = "test-secret";
    process.env.TAMI_JWK_KID = "test-kid";
    process.env.TAMI_JWK_K = Buffer.from("test-jwk-key").toString("base64url");

    const blocked = await request(app).get("/payments/readiness");
    expect(blocked.status).toBe(200);
    expect(blocked.body.liveEnabled).toBe(false);
    expect(blocked.body.productionCredentialsVerified).toBe(false);

    process.env.TAMI_PRODUCTION_CREDENTIALS_VERIFIED = "true";
    const developmentWithAllApprovalFlags = await request(app).get("/payments/readiness");
    expect(developmentWithAllApprovalFlags.body.liveEnabled).toBe(false);

    process.env.NODE_ENV = "production";
    const verified = await request(app).get("/payments/readiness");
    expect(verified.body.liveEnabled).toBe(true);
  });

  it("reports development and live readiness separately", async () => {
    const response = await request(app).get("/payments/readiness");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      bankAccountVerified: false,
      providerApproved: false,
      productionCredentialsVerified: false,
      sandboxEnabled: false,
      threeDSecureVerified: false,
      testingEvidenceVerified: false,
      writtenAuthorizationConfigured: false,
      liveEnabled: false,
      testEnabled: false,
      cardDataCollected: false,
    });
  });

  it("allows Tami sandbox tests only with sandbox credentials and an explicit test flag", async () => {
    process.env.TAMI_ENVIRONMENT = "sandbox";
    process.env.TAMI_MERCHANT_NUMBER = "123456";
    process.env.TAMI_TERMINAL_NUMBER = "654321";
    process.env.TAMI_SECRET_KEY = "test-only-secret";
    process.env.TAMI_JWK_KID = "test-only-kid";
    process.env.TAMI_JWK_K = Buffer.from("test-only-key").toString("base64url");
    process.env.TAMI_SANDBOX_TEST_ENABLED = "true";

    const response = await request(app).get("/payments/readiness");
    expect(response.status).toBe(200);
    expect(response.body.sandboxEnabled).toBe(true);
    expect(response.body.liveEnabled).toBe(false);
    expect(response.body.testEnabled).toBe(false);

    process.env.NODE_ENV = "production";
    const production = await request(app).get("/payments/readiness");
    expect(production.body.sandboxEnabled).toBe(false);
    expect(production.body.liveEnabled).toBe(false);
  });

  it("rejects arbitrary amounts, currencies, descriptions, and card data", async () => {
    const response = await request(app)
      .post("/payments/checkout")
      .set("Origin", "http://127.0.0.1")
      .set("Host", "127.0.0.1")
      .send({
        ...checkoutInput,
        amount: "1250.00",
        currency: "EUR",
        description: "Client supplied total",
        cardNumber: "4111111111111111",
      });

    expect(response.status).toBe(400);
    expect(response.body.checkoutUrl).toBeUndefined();
  });

  it("does not start a valid invoice checkout until readiness allows it", async () => {
    const response = await request(app)
      .post("/payments/checkout")
      .set("Origin", "http://127.0.0.1")
      .set("Host", "127.0.0.1")
      .send(checkoutInput);

    expect(response.status).toBe(503);
    expect(response.body.error).toContain("onay");
    expect(response.body.checkoutUrl).toBeUndefined();
  });

  it("rejects invoice checkout without a retry key", async () => {
    const { idempotencyKey: _ignored, ...input } = checkoutInput;
    const response = await sameOriginPost("/payments/checkout").send(input);
    expect(response.status).toBe(400);
  });

  it("rejects cross-origin payment and refund mutations", async () => {
    const checkout = await request(app)
      .post("/payments/checkout")
      .set("Origin", "https://attacker.invalid")
      .set("Host", "127.0.0.1")
      .send(checkoutInput);
    const refund = await request(app)
      .post(`/payments/tami/${"a".repeat(36)}/refunds`)
      .set("Origin", "https://attacker.invalid")
      .set("Host", "127.0.0.1")
      .send({});

    expect(checkout.status).toBe(403);
    expect(refund.status).toBe(403);
  });
});