import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import paymentsRouter from "./payments";

const app = express();
app.use(express.json());
app.use(paymentsRouter);

describe("company payment safeguards", () => {
  it("reports that the bank account and provider are not approved", async () => {
    const response = await request(app).get("/payments/readiness");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      bankAccountVerified: false,
      providerApproved: false,
      liveEnabled: false,
      cardDataCollected: false,
    });
  });

  it("rejects valid checkout requests until compliance and provider setup is complete", async () => {
    const payload = {
      invoiceReference: "INV-2026-1042",
      amount: "1250.00",
      currency: "EUR",
      description: "Kurumsal danışmanlık hizmeti",
    };

    const first = await request(app).post("/payments/checkout").send(payload);
    const repeated = await request(app).post("/payments/checkout").send(payload);

    expect(first.status).toBe(503);
    expect(first.body.error).toContain("kapalıdır");
    expect(repeated.status).toBe(503);
    expect(first.body.checkoutUrl).toBeUndefined();
  });

  it("rejects card data and other fields not needed for an invoice checkout", async () => {
    const response = await request(app)
      .post("/payments/checkout")
      .send({
        invoiceReference: "INV-2026-1042",
        amount: "1250.00",
        currency: "EUR",
        description: "Kurumsal danışmanlık hizmeti",
        cardNumber: "4111111111111111",
      });

    expect(response.status).toBe(400);
    expect(response.body.checkoutUrl).toBeUndefined();
  });

  it("rejects zero-value payments", async () => {
    const response = await request(app)
      .post("/payments/checkout")
      .send({
        invoiceReference: "INV-2026-1042",
        amount: "0",
        currency: "TRY",
        description: "Fatura ödemesi",
      });

    expect(response.status).toBe(400);
  });
});