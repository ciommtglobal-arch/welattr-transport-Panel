---
name: Tami hosted payment
description: Tami Common Payment Page authentication and status-query signing requirements
---

MMT's hosted payment flow must keep card data on Tami's hosted page. Creating the one-time hosted token uses a `PG-Auth-Token` built from merchant number, terminal number, and a Base64 SHA-256 hash of those values plus the merchant secret. Tami's payment-status query additionally signs the request body as an HS512 JWS using the terminal-specific JWK `kid` and `k` values.

**Why:** The official Tami developer documentation separates header authentication from the body `securityHash`; reusing the header hash for status queries would produce invalid or unverifiable payment results.

**How to apply:** Keep merchant number, terminal number, secret key, JWK kid, and JWK k in workspace Secrets only. Never accept card fields in MMT API requests, and do not mark an order as paid from the browser callback alone; reconcile it with Tami's query response.

The current Tami merchant account supports TRY only. Foreign-currency amounts are converted to TRY by Tami, so MMT must reject USD/EUR live requests instead of presenting them as true multi-currency payments.

**Why:** Tami technical support confirmed that the current account has no multi-currency support.

**How to apply:** Keep USD/EUR available only in mock/test mode until a provider with genuine multi-currency settlement is approved.

Payment integration scope is MMT service invoices only; do not change the construction store's Shopify checkout. Tami sandbox must be explicitly enabled outside production, and live collection must run only in production after all approval, 3D Secure, test-evidence, callback, and verified-credential gates pass.

**Why:** Service billing and physical-product commerce use separate providers and legal/payment controls. A development misconfiguration must not create a real charge.

**How to apply:** Keep the invoice payment routes separate from Shopify, verify test and production modes independently, and leave live collection disabled until written company/provider authorization is recorded.