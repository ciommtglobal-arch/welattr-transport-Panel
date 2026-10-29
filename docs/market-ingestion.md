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

This module accepts structured JSON and a conservative Turkish free-text subset.
It does not accept attachments, edited posts or private chats. Unsupported messages return an explicit ignored
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
authenticated messages can write. Broad multilingual extraction, message deletion/retraction,
durable rejection monitoring and production delivery verification remain outside this skeleton.

## Free-text market feed
POST `/api/ingest/market-feed` with `X-MMT-Market-Secret` and JSON:
`{sourceId,eventId,occurredAt,text}`. Founder must first consent to a source URL
`market://source/provider-name`; configure its separate
`MMT_MARKET_FEED_SECRET_<SOURCE_UUID_UPPERCASE_WITH_UNDERSCORES>` in Secrets.
No secret was created automatically.

Supported example text:
```
Yük var
Mersin -> Adana
24 ton tenteli komple
2026-12-01
Fiyat: 12000 TL
```
Carrier example uses "Boş araç", declared capacity, trailer type and ISO date.
The direction must be a separate line or semicolon-delimited field with -> or →.
Ambiguous/missing fields save an ineligible pool record with parserMissing and
status needs_review in the API response, not an AI-approved match.
Unclassifiable/mixed messages are rejected. Original raw messages are not stored.
Only explicit Turkish mobile numbers are extracted; the source/event reference remains
available when no contact is given. Relative dates and unlabelled prices are not inferred.
is_market_feed is a payload tag in the existing JSONB pool, so no physical migration or
parallel loads/carriers tables are introduced. Vehicle compatibility is mandatory for
market matches; no declared commission means no invented commission amount.
