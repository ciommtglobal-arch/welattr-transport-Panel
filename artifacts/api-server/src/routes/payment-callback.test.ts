import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as Record<string, unknown> | null,
  invoice: null as Record<string, unknown> | null,
  events: [] as Record<string, unknown>[],
  payload: {} as Record<string, unknown>,
  query: vi.fn(),
  readiness: { liveEnabled: false, sandboxEnabled: true },
  failDatabase: false,
}));

vi.mock("../lib/tami-gateway", async (original) => {
  const real = await original<typeof import("../lib/tami-gateway")>();
  return {
    ...real,
    getPaymentReadiness: () => state.readiness,
    queryTamiPayment: state.query,
  };
});

vi.mock("@workspace/db", async (original) => {
  const real = await original<typeof import("@workspace/db")>();
  const { getTableName } = await import("drizzle-orm");
  const db = {
    select: () => ({
      from: (table: Parameters<typeof getTableName>[0]) => {
        const chain = {
          where: () => chain,
          for: () => chain,
          limit: async () => {
            if (state.failDatabase) throw new Error("Database unavailable");
            const name = getTableName(table);
            if (name === "payment_sessions") return state.session ? [state.session] : [];
            if (name === "service_invoices") return state.invoice ? [state.invoice] : [];
            return [];
          },
        };
        return chain;
      },
    }),
    update: (table: Parameters<typeof getTableName>[0]) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          if (getTableName(table) === "payment_sessions") {
            state.session = { ...state.session, ...values };
          } else {
            state.invoice = { ...state.invoice, ...values };
          }
          return { returning: async () => [state.session] };
        },
      }),
    }),
    insert: () => ({
      values: async (value: Record<string, unknown>) => { state.events.push(value); },
    }),
    transaction: async (run: (tx: unknown) => unknown) => run(db),
  };
  return { ...real, db };
});

import callbackRouter from "./payment-callback";
import { signTamiRequestBody, verifyTamiResponse, TamiGatewayError } from "../lib/tami-gateway";

const app = express();
app.use(express.json());
app.use("/api", callbackRouter);
const path = "/api/payment/callback";
const credentials = {
  merchantNumber: "123456", terminalNumber: "654321",
  secretKey: "test-only-secret", jwkKid: "test-only-kid",
  jwkKey: Buffer.from("test-only-signing-key").toString("base64url"),
  environment: "sandbox" as const,
};
let sequence = 0;
let orderId = "";
const send = (fields: Record<string, unknown> = {}) =>
  request(app).post(path).send({ merchant_oid: orderId, ...fields });

beforeEach(() => {
  orderId = `test-order-${++sequence}`;
  state.readiness = { liveEnabled: false, sandboxEnabled: true };
  state.failDatabase = false;
  state.session = {
    orderId, invoiceReference: "test-invoice", amount: "12.50", currency: "TRY",
    provider: "tami_sandbox", status: "pending", lastCheckedAt: null,
    providerPaymentStatus: null, providerOrderStatus: null, errorMessage: null,
  };
  state.invoice = { amount: "12.50", currency: "TRY", refundedAmount: "0.00", status: "issued" };
  state.payload = { orderId, amount: "12.50", currency: "TRY", paymentStatus: "SUCCESS" };
  state.events = [];
  state.query.mockReset();
  state.query.mockImplementation(async () => {
    const securityHash = signTamiRequestBody(state.payload, credentials);
    const payload = verifyTamiResponse({ securityHash }, credentials);
    if (!payload) throw new TamiGatewayError("Invalid signature");
    return { payload, correlationId: "test-query" };
  });
});

describe("untrusted payment callback hints", () => {
  it("uses only the signed provider result and retains separate owner approval", async () => {
    const result = await send({ status: "failed", total_amount: "1" });
    expect(result.status).toBe(200);
    expect(result.body.status).toBe("success");
    expect(result.body.operationApproved).toBe(false);
    expect(result.body).not.toHaveProperty("invoiceReference");
    expect(state.query).toHaveBeenCalledWith(orderId, true);
    expect(state.invoice?.status).toBe("paid");
    expect(state.events).toHaveLength(1);
  });

  it.each(["NOT_COMPLETE", "FAILED", "CANCELLED"])(
    "does not confirm a claimed success when Tami reports %s",
    async (paymentStatus) => {
      state.payload.paymentStatus = paymentStatus;
      const result = await send({ status: "success", total_amount: "1250" });
      expect(result.status).toBe(200);
      expect(result.body.status).not.toBe("success");
      expect(state.invoice?.status).toBe("issued");
    },
  );

  it.each([
    { orderId: "different-order" },
    { amount: "99.00" },
    { currency: "EUR" },
    { amount: undefined },
  ])("rejects signed data that does not match the recorded payment: %j", async (change) => {
    Object.assign(state.payload, change);
    const result = await send({ status: "success" });
    expect(result.status).toBe(502);
    expect(state.session?.status).toBe("pending");
    expect(state.invoice?.status).toBe("issued");
    expect(state.events).toHaveLength(0);
  });

  it("rejects a tampered provider signature without changing payment state", async () => {
    state.query.mockImplementation(async () => {
      const compact = signTamiRequestBody(state.payload, credentials)!;
      const [header, payload, signature] = compact.split(".");
      const tampered = `${header}.${payload}.${signature!.startsWith("A") ? "B" : "A"}${signature!.slice(1)}`;
      expect(verifyTamiResponse({ securityHash: tampered }, credentials)).toBeNull();
      throw new TamiGatewayError("Invalid signature");
    });
    expect((await send({ status: "success" })).status).toBe(502);
    expect(state.events).toHaveLength(0);
    expect(state.invoice?.status).toBe("issued");
  });

  it("fails closed when the provider or database is unavailable", async () => {
    state.query.mockRejectedValue(new TamiGatewayError("Timeout"));
    expect((await send()).status).toBe(502);
    orderId = `test-order-${++sequence}`;
    state.failDatabase = true;
    expect((await send()).status).toBe(503);
    expect(state.events).toHaveLength(0);
  });

  it("rejects disabled environments and mock payments", async () => {
    state.readiness.sandboxEnabled = false;
    expect((await send()).status).toBe(503);
    orderId = `test-order-${++sequence}`;
    state.readiness.sandboxEnabled = true;
    state.session!.provider = "mock";
    expect((await send()).status).toBe(404);
    expect(state.query).not.toHaveBeenCalled();
  });

  it("does not query production orders using a sandbox environment", async () => {
    state.session!.provider = "tami";
    expect((await send()).status).toBe(503);
    expect(state.query).not.toHaveBeenCalled();
  });

  it("rejects unknown orders and invalid, missing or extra fields", async () => {
    state.session = null;
    expect((await send()).status).toBe(404);
    expect((await request(app).post(path).send({ status: "success" })).status).toBe(400);
    expect((await send({ merchant_oid: "../order" })).status).toBe(400);
    expect((await send({ cardNumber: "not-accepted" })).status).toBe(400);
    expect((await request(app).post(path).set("Content-Type", "application/json").send("null")).status).toBe(400);
    expect(state.query).not.toHaveBeenCalled();
  });

  it("throttles duplicate callbacks and does not repeat a successful payment event", async () => {
    expect((await send()).body.status).toBe("success");
    const repeat = await send();
    expect(repeat.status).toBe(429);
    expect(repeat.headers["retry-after"]).toBe("5");
    expect(state.query).toHaveBeenCalledTimes(1);
    expect(state.events).toHaveLength(1);
  });

  it("does not create a second success event for an already confirmed payment", async () => {
    state.session!.status = "success";
    state.invoice!.status = "paid";
    expect((await send()).body.status).toBe("success");
    expect(state.query).toHaveBeenCalledWith(orderId, true);
    expect(state.events).toHaveLength(0);
  });

  it("rejects a missing invoice or an invoice with a different currency", async () => {
    state.invoice = null;
    expect((await send()).status).toBe(502);
    expect(state.events).toHaveLength(0);
    orderId = `test-order-${++sequence}`;
    state.session!.orderId = orderId;
    state.payload.orderId = orderId;
    state.invoice = { amount: "12.50", refundedAmount: "0.00", currency: "EUR" };
    expect((await send()).status).toBe(502);
    expect(state.events).toHaveLength(0);
  });
});