# Market ingestion — disabled until an authorized source is configured

POST `/api/logistics/market/telegram/:sourceId` accepts Telegram Bot API messages from one consented group.
No webhook is registered automatically. Existing polling bots are untouched.
Use a dedicated bot or explicitly coordinate polling/webhook ownership before activation.

## Configuration
1. Founder uses the existing pool source-create action with consentConfirmed=true,
   a meaningful source name and `telegram://group/-100...` as URL.
2. Configure a separate random 32–256 character Telegram-compatible webhook secret
   in Secrets: `MMT_MARKET_TELEGRAM_SECRET_<SOURCE_UUID_UPPERCASE_WITH_UNDERSCORES>`.
   Never use a bot token as this secret.
3. Only after source permission and bot ownership are checked, configure Telegram
   setWebhook to the published route with the matching secret_token.
   Group administrator permission and bot visibility/privacy settings must permit messages.

This skeleton accepts structured JSON text messages only, not arbitrary free-text ads,
attachments, edited posts or private chats. Unsupported messages return an explicit ignored
reason. Bot membership alone does not establish permission to store participant data.

Example message (illustrative, never seeded):
```json
{"role":"load","name":"Consented load","origin":"Mersin","destination":"Adana","transportMode":"road","requiredKg":20000,"requiredDate":"2026-12-01","products":["citrus"],"quotedPriceMinor":100000,"currency":"TRY","commissionBps":500}
```
Carrier uses role=carrier, capacityKg and availableDate. Minor-unit prices are integers;
500 basis points means 5%. Commission is a declared proposal, not an authorized charge.
No missing price is invented. Gross sale/cost difference is not commission or net profit.

## Persistence and worker
Reuse logistics_pool_entries with load/carrier roles, not parallel competing tables.
Source/message unique key deduplicates retries; transaction and existing pool advisory
lock cover insert and match rebuild. Source disable/version changes block races.
Replay does not refresh freshness. Messages older than 24h are ignored.
Webhook sources are never HTTP-polled; JSON marketplace feeds keep the existing
consent-controlled HTTPS polling service. Telegram source evidence expires after 24h;
entry freshness and worker review-cap checks still apply.

The existing Gemini worker consumes compatible pending matches on its next enabled
cycle and saves pending_review drafts. Deterministic price notes appear in missingChecks
on the founder draft view. No model call occurs in the webhook request.
No payment, external notification, commercial approval, worker enablement, production
migration or publication is performed by installing this module.

Operational limits: existing 10,000-entry pool ceiling; body parser limit; only allowlisted
authenticated messages can write. Free-text extraction, message deletion/retraction,
durable rejection monitoring and production delivery verification remain outside this skeleton.
