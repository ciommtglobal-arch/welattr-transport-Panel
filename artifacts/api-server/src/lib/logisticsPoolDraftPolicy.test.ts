import { describe, expect, it } from "vitest";
import { logisticsDraftMode } from "./logisticsPoolDraftPolicy";

const credentials = {
  AI_INTEGRATIONS_GEMINI_API_KEY: "TEST-PLACEHOLDER",
  AI_INTEGRATIONS_GEMINI_BASE_URL: "https://gemini.example.com",
};
describe("explicit draft-only activation", () => {
  it("preserves local TEST behavior", () => {
    expect(logisticsDraftMode({ ...credentials, NODE_ENV: "test" })).toBe("test_drafts");
  });
  it("defaults production to disabled even with credentials", () => {
    expect(logisticsDraftMode({ ...credentials, NODE_ENV: "production", REPLIT_DEPLOYMENT: "1" })).toBe("disabled");
  });
  it("requires both actual deployment context and exact opt-in", () => {
    for (const value of ["", "1", "TRUE", "false"]) {
      expect(logisticsDraftMode({
        ...credentials, NODE_ENV: "production", REPLIT_DEPLOYMENT: "1",
        MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED: value,
      })).toBe("disabled");
    }
    expect(logisticsDraftMode({
      ...credentials, NODE_ENV: "production", MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED: "true",
    })).toBe("disabled");
  });
  it("permits production advisory drafts only after explicit activation", () => {
    expect(logisticsDraftMode({
      ...credentials, NODE_ENV: "production", REPLIT_DEPLOYMENT: "1",
      MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED: "true",
    })).toBe("production_drafts");
  });
  it("fails closed without credentials or with a deployed TEST environment", () => {
    expect(logisticsDraftMode({ NODE_ENV: "test" })).toBe("disabled");
    expect(logisticsDraftMode({ ...credentials, NODE_ENV: "test", REPLIT_DEPLOYMENT: "1" })).toBe("disabled");
  });
});
