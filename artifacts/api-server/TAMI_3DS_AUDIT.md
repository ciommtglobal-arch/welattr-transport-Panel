# Tami 3DS readiness review

## Scope and safety

This review covers the existing hosted invoice-payment flow, not a new direct
card-processing integration. No card data, real Tami credentials, live provider
calls, native database writes, schema migrations or publication are needed by
the regression tests. Fixtures and fetch/database doubles are used instead.

## Confirmed implementation

- Checkout uses Tami's one-time hosted token and Tami's hosted payment page.
  PAN, CVV and SMS verification codes are not collected by this application.
- Hosted return URLs use HTTPS. Production uses the explicitly configured
  merchant callback base rather than a caller-supplied replacement.
- The result page reads payment status from the API. Its `result=success` query
  parameter is not payment evidence.
- Callback bodies are lookup hints only. The server queries Tami, validates the
  HS512 signature, and matches the order, invoice amount and currency before
  recording success.
- A 3DS challenge response or successful authentication without a completed
  payment is not a collected payment.
- A successful `PRE_AUTH` is an authorization hold, not a completed sale. It now
  remains pending rather than marking the invoice paid.
- Provider errors and unsigned results do not trigger a simulated success.
- Existing live-approval, verified-credential, 3DS-evidence and environment gates
  remain unchanged.

## Hosted checkout versus direct 3DS

Tami documents two distinct products:

1. **Hosted payment page:** the provider owns the payment/card-entry page.
   The public token contract does not document a client flag to require 3DS.
   Its production/Masterpass enablement requires Tami's confirmation.
2. **Direct 3DS sale:** `/payment/auth` returns `threeDSHtmlContent`; bank
   authentication must subsequently be completed using the documented 3D Complete
   service before it becomes a sale. This contract includes card fields and is
   not implemented here. Adding a direct card-data endpoint would change the
   security/compliance scope and is not part of this review.

Do not add an undocumented `force3DS` field or call direct completion against a
hosted checkout. Do not equate the POS's “3D'siz İşlem” being disabled with 3DS
being disabled. Foreign-card acceptance is a separate merchant/POS permission.

## External checks: NOT TESTED

- Hosted/Masterpass production entitlement and provider-enforced 3DS for this POS.
- Actual bank challenge, successful sale/capture, rejection, abandoned challenge
  and timeout on a provider-issued test account.
- End-to-end provider return into the published merchant HTTPS callback.
- Foreign-issued-card acceptance and supported settlement currencies.
- Real payment/refund or bank settlement.

These must not be marked PASS from synthetic tests or a signed error returned by
a read-only provider query. This review does not enable live collection.

## Verification commands

Review execution: **5 test files, 57 tests PASS**. API TypeScript checks PASS.
These results cover synthetic tests only; the external checks above remain
**NOT TESTED**.

```sh
pnpm --filter @workspace/api-server exec vitest run \
  src/lib/tami-gateway.test.ts \
  src/routes/payments.test.ts \
  src/routes/tami-payments.test.ts \
  src/routes/payment-callback.test.ts \
  src/lib/paymentSchema.test.ts
pnpm --filter @workspace/api-server run typecheck
```

## Official references

- https://dev.tami.com.tr/tami-ortak-odeme-sayfasi
- https://dev.tami.com.tr/tami-satis-islemi-3dli
- https://dev.tami.com.tr/tami-sanal-pos-security-hash-hesaplama
