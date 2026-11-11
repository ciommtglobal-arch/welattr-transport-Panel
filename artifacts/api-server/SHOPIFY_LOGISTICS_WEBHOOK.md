# Shopify logistics receiver — development only

Endpoint: `POST /api/mmt/secure-sync`.

This adds a receiver, not a Shopify webhook subscription or an activated
production integration. No payment, fulfillment, approval, or publication
request is sent to Shopify. Existing Nexus and company authorization remains.

## Existing configuration

Uses `SHOPIFY_NEXUS_SHOP_DOMAIN` and `SHOPIFY_NEXUS_WEBHOOK_SECRET`, server-side
only. Missing configuration returns 503. Never place secrets in the payload,
browser, logs, documentation, or tests. Variant mappings are optional for this
logistics receiver; configured finance variants remain finance-interest
records, not bank applications. Other merchandise enters the existing
reservation intake category.

## Signature and metadata

The production raw parser captures an untouched Buffer as `req.rawBody`
before `express.json()`. No parsed-JSON signature fallback is permitted.
Verification decodes the supplied base64 HMAC and compares digest bytes with
`crypto.timingSafeEqual`. Bodies are limited to 1 MiB; compressed bodies are
rejected.

Required headers: `X-Shopify-Hmac-Sha256`, `X-Shopify-Shop-Domain`,
`X-Shopify-Topic`, `X-Shopify-Webhook-Id`. Allowed topics: `orders/create`,
`orders/paid`, `orders/updated`, `orders/cancelled`.

## Real order data and existing schema limits

Requires a complete Shopify order snapshot, not a partial list of line items.
Required order fields: `id`, `name`, `currency`, `financial_status`,
`updated_at`, `line_items`. Provide exactly one consistent corridor, either
top-level `corridor` or Shopify `note_attributes` with name `corridor`
(the `koridor` attribute alias is also recognized). All supplied definitions,
including aliases, must agree; empty/null values and malformed attributes
reject the complete delivery.
Allowed values: `Samsun-Irak-Proje`, `Samsun-Gurcistan`. No corridor is assumed.

All line items are processed, including variants outside configured product
mappings. Required line fields: `id`, `variant_id`, `title`, `quantity`, `price`.
Zero quantity is retained. When present, validated `current_quantity` supplies
the effective quantity. Missing/invalid fields reject the entire snapshot,
without partially writing lines or substituting fake IDs/titles/prices.

Numeric IDs must be safe positive integers; large textual IDs stay textual.
Prices are normalized with decimal-string arithmetic, never float rounding.
Timestamps require a timezone and actual calendar dates; normalized-invalid
dates such as February 30 and 24:00 are rejected for updates and cancellations.

**Existing schema limitation:** the current Nexus table requires a non-null
variant ID. Custom/deleted-product lines with `variant_id: null` are explicitly
rejected, never silently skipped. Supporting those needs a separately approved
nullable-schema change; this implementation does not migrate any database.

The real corridor is recorded as `Koridor: <value>` in the existing `warning`
column, avoiding an unapproved new column/table. New rows use
`PENDING_FOUNDER_APPROVAL`, displayed as “Kurucu Onayı Bekliyor”.

## Atomic snapshots and approval boundary

Existing PostgreSQL unique indexes cover `(shop_domain, webhook_id)` and
`(shop_domain, order_id, line_id)`. The receiver namespaces its retry key with
`logistics:` so legacy Nexus receipt does not consume its delivery identity.
Each transaction locks its shop/order with a transaction-scoped PostgreSQL
advisory lock, then inserts the event, reads the previous snapshot and upserts
every line. Rollback includes the event identity so a failed delivery can retry.

Older snapshots are acknowledged without reverting current records. Different
contents with the same source timestamp return 409 without committing: their
order cannot safely be inferred. Removed lines remain as historical records
with zero quantity and an explicit removal warning; no record is deleted.
Material changes return records to pending founder review. Unchanged contents
retain existing founder decisions, even if a new webhook/timestamp arrives.
Nothing is approved or published automatically.

## Verification scope

Parser and HTTP tests use an in-memory transactional DB double and the real
Drizzle schema definitions. They do not connect to or alter a database.
They cover signature tampering, all-line validation, both corridors, retries,
concurrent duplicate deliveries, quantity/price/status changes, zero quantity,
line addition/removal, cancellation, stale/equal-version snapshots and rollback.
They also cover failure after saving an earlier line and its event followed by
retry of the same event, approval retention for equivalent prices, malformed
dates/IDs/attributes, missing/null variants, and body-size/compression limits.

Real PostgreSQL concurrency and actual merchant deliveries require an explicitly
approved isolated test environment. No merchant webhook has been registered,
no credentials changed, and no publishing step is part of this implementation.
