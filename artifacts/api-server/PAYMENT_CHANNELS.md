# MMT Connect payment channels

## Requested scope

Tami, Shopify and Stripe should operate as coordinated channels for international
business. This is not permission to charge a transaction through multiple
providers or to enable production collection.

## Current implementation and blockers

| Channel | Existing scope | Activation requirements |
| --- | --- | --- |
| Tami | MMT service invoices; hosted card page; signed status reconciliation; refund routes and audit records | Approved merchant/test credentials, explicit environment and enablement, then sandbox evidence. Live collection retains all existing approval gates. |
| Shopify | Physical-product catalog/cart and Shopify-hosted checkout | Existing app-scoped connection and merchant checkout readiness verified against the connected shop. Do not charge the Shopify cart separately through Tami. |
| Stripe | Merchant-authorized live 100 USD hosted Payment Link, displayed only in the development `/odeme` preview | This external link is separate from invoices and Shopify orders. Native API/webhook/sync integration remains unimplemented; connection discovery timed out. A working live link does not prove automatic invoice reconciliation or bank settlement. |

The existing Tami account supports TRY collection. USD/EUR invoice fields are not
evidence of supported foreign-currency collection. Do not convert currencies or
route a declined/ambiguous charge to another provider automatically.

## Tami configuration

Sensitive values must be entered through Replit Secrets, never in chat, source
code, logs, or this file:

- `TAMI_MERCHANT_NUMBER`
- `TAMI_TERMINAL_NUMBER`
- `TAMI_SECRET_KEY`
- `TAMI_JWK_KID`
- `TAMI_JWK_K`

Set `TAMI_ENVIRONMENT=sandbox` explicitly for an approved test account.
`TAMI_SANDBOX_TEST_ENABLED=true` permits sandbox collection only in a local
`development`/`test` runtime without `REPLIT_DEPLOYMENT`. Simulated payments use
the existing separate `MMT_PAYMENT_TEST_MODE` gate under the same runtime rule.
Missing or unknown provider environments do not default to sandbox.

No values were configured by adding this document. Production collection keeps
the bank/provider/3DS/test-evidence/written-authorization/HTTPS-callback and
production-credential gates; this document is not evidence those requirements
have been met.

## Coordination boundaries

- An MMT service invoice reads its amount/currency from the server database.
- An active or ambiguous payment attempt must be reconciled before another
  provider can be considered. Never silently retry a charge through a fallback.
- Shopify owns its physical-product order, cart, payment and refund records.
- Future Stripe service-invoice integration must use the same invoice lock,
  pending/success checks and idempotency boundary before creating a session.
- Provider-confirmed collection is not proof of bank settlement and is not
  founder approval of a logistics operation.

There is currently no implemented shared Tami/Stripe selector or combined
three-provider settlement report. Do not describe the channels as fully linked
until connected-account checkout, callbacks, refunds and reconciliation have
been implemented and tested.

## Existing Tami payment link — development preview only

The founder supplied an existing native Tami payment link and reports previous
successful collection through it. The `/odeme` development preview includes an
outbound inspection link only when no invoice reference is being entered or
looked up. The component renders nothing in a production build.

The external page did not render checkout details during inspection. Its current
amount, currency, beneficiary, availability and reusability therefore remain
unverified; do not treat the founder's prior collection as independent evidence
of the link's present state, foreign-card permission or mandatory 3DS.

No customer/invoice parameters are appended. Opening or returning from the link
does not mutate records, mark invoices paid, trigger notifications, authorize
operations, or replace Shopify checkout. Existing Tami API activation gates
remain unchanged. No real payment or refund was executed to add this preview.

## Standalone Stripe Payment Link

The founder explicitly authorized the supplied live link displaying the
beneficiary Parlar Global LLC for MMT Global use. This is a fixed 100 USD service
fee link, not a provider choice for an arbitrary invoice or Shopify cart.
Applicable tax/final total is determined by the hosted Stripe page.

The preview identifies the beneficiary and live-payment nature, opens Stripe
in a separate tab without appending customer or invoice data, and never marks
a local invoice paid from a click/redirect. It is hidden whenever invoice
reference entry/lookup is in progress. The component is development-only so an
unrelated production publication cannot accidentally expose it.

No SDK, new database pool, schema, native record mutation, API key, provider
webhook or real payment was needed to add this outbound link. Native Stripe
invoice checkout remains a separate task with the existing idempotency and
provider-verification requirements.
