import { describe, expect, it } from "vitest";
import { canReadKasaRequest, normalizeKasaAmount, validKasaDate } from "./kasa";

describe("Kasa exact money and access rules", () => {
  it.each([["0.01", "0.01"], ["1", "1.00"], ["2.5", "2.50"], ["99999999.99", "99999999.99"]])("normalizes %s without float arithmetic", (value, expected) => {
    expect(normalizeKasaAmount(value)).toBe(expected);
  });
  it.each(["0", "0.00", "-1", "NaN", "1e2", "1.001", "100000000", "01", "1,50", " 1.00", "Infinity"])("rejects invalid money %s", value => {
    expect(normalizeKasaAmount(value)).toBeNull();
  });
  it("rejects impossible calendar dates", () => {
    expect(validKasaDate("2026-02-29")).toBe(false);
    expect(validKasaDate("2026-13-01")).toBe(false);
    expect(validKasaDate("2024-02-29")).toBe(true);
    expect(validKasaDate("2026-10-02")).toBe(true);
  });
  it("only active admins or record creators may read details", () => {
    const cashier = { id: 1, clerkUserId: "test", role: "cashier" as const, name: "Test", branchId: 1, active: true, owner: false };
    expect(canReadKasaRequest(cashier, 1)).toBe(true);
    expect(canReadKasaRequest(cashier, 2)).toBe(false);
    expect(canReadKasaRequest({ ...cashier, role: "admin" }, 2)).toBe(true);
    expect(canReadKasaRequest({ ...cashier, active: false }, 1)).toBe(false);
  });
});