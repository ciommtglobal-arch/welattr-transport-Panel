# Payment callback adapter

`POST /api/payment/callback` accepts a JSON **lookup hint**:

```json
{"merchant_oid":"existing-tami-order-id","status":"success","total_amount":"1250"}
```

`merchant_oid` maps to an existing MMT service-invoice payment order. The
optional `status` and `total_amount` are untrusted and are ignored, including
their currency/amount conventions. Other fields, card data, missing references
and invalid references are rejected. This endpoint is **not** a PayTR,
iyzico or Stripe integration and must not be registered as their webhook.

The adapter uses the configured Tami environment to make a fresh payment query.
The existing gateway verifies the query response's HS512 signature. Its signed
order, amount and currency must match the stored payment and service invoice.
Missing invoices, mock payments and environment mismatches are rejected.
Provider failure or an unverifiable result never produces payment confirmation.

A `200` response's `status` is the verified payment state. It can be `pending`,
`success`, `failed` or `cancelled`; HTTP 200 alone does not mean payment succeeded.
`operationApproved` is always false. Successful collection marks only the
service invoice as paid and records the existing payment audit event. It does
not approve company work, transfer money, dispatch an operation or send a
Telegram message. The company owner's separate affirmative approval remains
required.

Repeated successful results do not create another payment-success event.
Concurrent or rapid retries for an order receive `429` and `Retry-After: 5`.
The bounded limiter is per process, not a distributed provider-delivery
deduplication guarantee.

## Provider notification boundary

Tami's public hosted-payment documentation describes browser redirects via
`successCallbackUrl` / `failCallbackUrl`, and a Query call when the result is
not received:
https://dev.tami.com.tr/tami-ortak-odeme-sayfasi

Those hosted redirect URLs remain unchanged. This adapter does not claim that
a callback sender is authenticated; it trusts only the server-to-server signed
query result. A genuine signed notification receiver still needs Tami's
confirmed payload, signature, acknowledgement and retry contract. Do not
enable notification-driven Telegram/operation automation on this hint endpoint.

Live collection approval gates and Shopify checkout are unchanged. No database
schema migration is needed for this adapter. It must be published before the
new route exists on the live site; automated tests are not proof of a real
sandbox transaction or accepted production notification.