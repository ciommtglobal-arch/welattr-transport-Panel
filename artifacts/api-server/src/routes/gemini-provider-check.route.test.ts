import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({
  generateContent: vi.fn(),
  getAuth: vi.fn((req: { get(name: string): string | undefined }) => ({
    userId: req.get("x-test-user-id") ?? null,
  })),
}));

vi.mock("@clerk/express", () => ({
  getAuth: provider.getAuth,
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(() => ({
    models: { generateContent: provider.generateContent },
  })),
}));

import providerCheckRouter from "./gemini-provider-check";

describe("Gemini provider-check route authorization", () => {
  const app = express().use(providerCheckRouter);

  beforeEach(() => {
    process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID = "founder-test-user";
    process.env.NODE_ENV = "test";
    process.env.GEMINI_PROVIDER_CHECK_ENABLED = "false";
    provider.generateContent.mockReset();
    provider.getAuth.mockClear();
  });

  it("rejects a non-founder GET before the lock or Gemini provider can run", async () => {
    const response = await request(app)
      .get("/gemini/provider-check")
      .set("x-test-user-id", "other-test-user");

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/kurucu/i);
    expect(provider.generateContent).not.toHaveBeenCalled();

    // A subsequent authorized request proves the rejected request did not consume the one-shot lock.
    process.env.NODE_ENV = "production";
    process.env.GEMINI_PROVIDER_CHECK_ENABLED = "true";
    process.env.GEMINI_FREE_TIER_ONLY_CONFIRMED = "true";
    process.env.GEMINI_API_KEY = "test-only-key";
    provider.generateContent.mockResolvedValue({ text: "MMT-GEMINI-PING-OK" });

    const authorized = await request(app)
      .get("/gemini/provider-check")
      .set("x-test-user-id", "founder-test-user");

    expect(authorized.status).toBe(200);
    expect(provider.generateContent).toHaveBeenCalledTimes(1);
  });

  it("requires a signed-in user before the provider-check route", async () => {
    const response = await request(app).get("/gemini/provider-check");

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/oturum/i);
    expect(provider.generateContent).not.toHaveBeenCalled();
  });

  it("returns 405 with Allow: GET for an authorized HEAD without calling Gemini", async () => {
    const response = await request(app)
      .head("/gemini/provider-check")
      .set("x-test-user-id", "founder-test-user");

    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe("GET");
    expect(provider.generateContent).not.toHaveBeenCalled();
  });

  it("returns 405 with Allow: GET for an authorized POST without calling Gemini", async () => {
    const response = await request(app)
      .post("/gemini/provider-check")
      .set("x-test-user-id", "founder-test-user");

    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe("GET");
    expect(provider.generateContent).not.toHaveBeenCalled();
  });
});
