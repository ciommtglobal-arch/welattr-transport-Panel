import { afterEach, describe, expect, it } from "vitest";
import { getPaymentMode } from "./tami-payments";

const originalMode = process.env.PAYMENT_MODE;

afterEach(() => {
  if (originalMode === undefined) delete process.env.PAYMENT_MODE;
  else process.env.PAYMENT_MODE = originalMode;
});

describe("payment launch guard", () => {
  it("keeps new payments in mock mode even when a previous environment requests live collection", () => {
    process.env.PAYMENT_MODE = "tami";
    expect(getPaymentMode()).toBe("mock");
  });

  it("uses mock mode without a live setting", () => {
    delete process.env.PAYMENT_MODE;
    expect(getPaymentMode()).toBe("mock");
  });
});