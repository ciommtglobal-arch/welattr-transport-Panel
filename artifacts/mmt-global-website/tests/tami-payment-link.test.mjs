import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(
  new URL("../src/components/tami-payment-link.tsx", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../src/pages/payment.tsx", import.meta.url),
  "utf8",
);

// Source-guard regression checks, not provider checkout or payment tests.
test("shared Tami link stays behind the development-only guard", () => {
  assert.match(component, /if \(!import\.meta\.env\.DEV\) return null;/);
  assert.match(
    component,
    /https:\/\/portal\.tami\.com\.tr\/paymentLink\/8464fcf1-6216-4163-abff-760794b2c854/,
  );
});

test("external checkout opens without referrer or window.opener access", () => {
  assert.match(component, /href=\{TAMI_HOSTED_PAYMENT_URL\}/);
  assert.match(component, /target="_blank"/);
  assert.match(component, /rel="noopener noreferrer"/);
  assert.doesNotMatch(component, /onClick=|fetch\(|localStorage|sessionStorage/);
});

test("standalone links are hidden during invoice entry and lookup", () => {
  assert.match(
    page,
    /!lookupRequested && !normalizedReference && \(\s*<>\s*<TamiHostedPaymentLink \/>/,
  );
});

test("preview does not claim verified amounts or automated paid status", () => {
  assert.match(component, /tekrar kullanılabilirlik burada/);
  assert.match(component, /doğrulanmadı/);
  assert.match(component, /Bu bir demo ödeme değildir/);
  assert.match(component, /yeniden ödeme yapmayın/);
  assert.match(component, /otomatik ödeme kaydı/);
  assert.match(component, /Yabancı kart kabulü ve zorunlu 3DS/);
  assert.doesNotMatch(component, /<input|<form|useMutation|onSubmit|\/api\//);
});
