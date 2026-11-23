import { describe, expect, it } from "vitest";
import { isCorsOriginAllowed, parseCorsAllowedOrigins } from "./corsOriginPolicy";

describe("API CORS origin policy", () => {
  it("parses a comma-separated list of exact HTTPS origins", () => {
    expect([...parseCorsAllowedOrigins(" https://panel.mmtglobal.com.tr,https://welattr-transport-panel.onrender.com ")])
      .toEqual(["https://panel.mmtglobal.com.tr", "https://welattr-transport-panel.onrender.com"]);
  });

  it("defaults to no cross-origin browser origins", () => {
    expect(parseCorsAllowedOrigins(undefined).size).toBe(0);
    expect(isCorsOriginAllowed("https://panel.mmtglobal.com.tr", parseCorsAllowedOrigins(undefined))).toBe(false);
  });

  it("rejects invalid, non-HTTPS, and non-origin configuration", () => {
    expect(() => parseCorsAllowedOrigins("not a url")).toThrow();
    expect(() => parseCorsAllowedOrigins("http://example.com")).toThrow();
    expect(() => parseCorsAllowedOrigins("https://panel.mmtglobal.com.tr/path")).toThrow();
  });

  it("matches origins exactly and allows originless server requests", () => {
    const allowed = parseCorsAllowedOrigins("https://panel.mmtglobal.com.tr,http://localhost:5173");
    expect(isCorsOriginAllowed("https://panel.mmtglobal.com.tr", allowed)).toBe(true);
    expect(isCorsOriginAllowed("https://sub.panel.mmtglobal.com.tr", allowed)).toBe(false);
    expect(isCorsOriginAllowed("https://panel.mmtglobal.com.tr.attacker.example", allowed)).toBe(false);
    expect(isCorsOriginAllowed(undefined, allowed)).toBe(true);
  });
});
