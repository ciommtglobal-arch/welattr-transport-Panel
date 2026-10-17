---
name: Tami hosted payment
description: Tami Common Payment Page authentication and status-query signing requirements
---

MMT's hosted payment flow must keep card data on Tami's hosted page. Creating the one-time hosted token uses a `PG-Auth-Token` built from merchant number, terminal number, and a Base64 SHA-256 hash of those values plus the merchant secret. Tami's payment-status query additionally signs the request body as an HS512 JWS using the terminal-specific JWK `kid` and `k` values.

**Why:** The official Tami developer documentation separates header authentication from the body `securityHash`; reusing the header hash for status queries would produce invalid or unverifiable payment results.

**How to apply:** Keep merchant number, terminal number, secret key, JWK kid, and JWK k in workspace Secrets only. Never accept card fields in MMT API requests, and do not mark an order as paid from the browser callback alone; reconcile it with Tami's query response.

Diagnose header authentication separately from JWK response verification. Tami's
official error-code documentation identifies `4003` as a `PG-Auth-Token` mismatch.

**Why:** The merchant/terminal/secret triple builds header authentication, while
terminal JWK material signs the body. Changing JWK values or replacing the header
with a generic Bearer secret does not establish correct header authentication.

**How to apply:** On this provider error, first verify that the three header
credentials belong to the same approved sandbox POS through the secure secrets
flow. Keep raw provider bodies, computed authentication values and signatures out
of logs, and keep collection disabled until provider verification succeeds.

The current Tami merchant account supports TRY only. Foreign-currency amounts are converted to TRY by Tami, so MMT must reject USD/EUR live requests instead of presenting them as true multi-currency payments.

**Why:** Tami technical support confirmed that the current account has no multi-currency support.

**How to apply:** Keep USD/EUR available only in mock/test mode until a provider with genuine multi-currency settlement is approved.

Payment integration scope is MMT service invoices only; do not change the construction store's Shopify checkout. Tami sandbox must be explicitly enabled outside production, and live collection must run only in production after all approval, 3D Secure, test-evidence, callback, and verified-credential gates pass.

**Why:** Service billing and physical-product commerce use separate providers and legal/payment controls. A development misconfiguration must not create a real charge.

**How to apply:** Keep the invoice payment routes separate from Shopify, verify test and production modes independently, and leave live collection disabled until written company/provider authorization is recorded.

A lookup for a deliberately nonexistent sandbox order is not sufficient evidence
that merchant credentials or signed reconciliation work.

**Why:** Such probes can return an unsigned error rather than an authenticated
business result. Neither a response from the sandbox host nor the presence of
stored secrets proves the test account is valid.

**How to apply:** Report connectivity, verified signatures, and completed sandbox
payment/refund evidence separately. Do not approve payment readiness from an
unsigned error or weaken signature verification to make the probe pass.

Treat a generic payment callback as an untrusted lookup hint, not as an authenticated Tami notification. Tami's public hosted-payment documentation describes browser redirects and Query reconciliation; it does not establish a signed server-notification contract.

**Why:** A generic Flask example accepted `status: success` without authenticating the sender. Reusing that shape as a Tami webhook would invent a provider contract and allow unsupported confirmation claims.

**How to apply:** Trust only a verified provider query matching the stored order, invoice amount and currency. Keep notification-driven Telegram/operation automation disabled until Tami confirms its signature, acknowledgement and retry requirements. Collection never substitutes for the company owner's operation approval.

Telegram payment messages must distinguish a verified Tami card collection from money credited to the Garanti bank account. A card-payment success is not evidence of bank settlement or an EFT/havale receipt.

**Why:** Confusing these events would give the owner an incorrect financial confirmation.

**How to apply:** Label a verified card payment as a Tami collection, not a bank-account credit. Bank-credit messages require a separately verified bank source. Before enabling any financial Telegram notification, confirm the owner's authorized private recipient; do not reuse a public media channel.