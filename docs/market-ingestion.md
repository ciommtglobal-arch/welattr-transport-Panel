# Market ingestion — disabled until an authorized source is configured

## Automatic administrator-group discovery
`POST /api/telegram/webhook` is the unified receiver for @mmt33_bot.
It requires `MMT_TELEGRAM_WEBHOOK_SECRET` in the Telegram secret header, then
checks getMe and getChatMember through the existing Telegram connector on every
fresh group/supergroup text message. Only administrator/creator status qualifies.
Privacy disabled alone does not authorize automatic enrollment.
The first accepted group message registers its chat ID under the founder-authorized
auto-enrollment policy; a founder-disabled source is never reactivated.
The existing source cap (10) still applies.

This route and /api/ingest/market-feed call the same internal processing function,
not a loopback HTTP request. Raw text is not logged or persisted.
Source registration can occur for a non-logistics first message, but that message
is not turned into a load/carrier. Missing/ambiguous logistics fields remain ineligible.

Activation order: configure a separate webhook secret using Secrets; publish;
confirm the production receiver responds 401 without the secret; stop the old
normal bot polling receiver (VIP is separate); setWebhook with secret_token,
allowed_updates=["message"], drop_pending_updates=false; read getWebhookInfo.
Do not register a webhook against an unpublished route. New webhook ownership
also changes private-command delivery: this receiver deliberately ignores private
chat updates and does not implement the old bot's private pilot commands.
No setWebhook call or automatic publishing is performed by this module.

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
Direction supports -> / →, explicit Çıkış/Varış labels, and Turkish directional
suffixes such as İstanbul Tuzla'dan Ankara Ostim'e (including curly apostrophes).
Ambiguous/missing fields save an ineligible pool record with parserMissing and
status needs_review in the API response, not an AI-approved match.
Unclassifiable/mixed messages are rejected. Original raw messages are not stored.
Only explicit Turkish mobile numbers are extracted; the source/event reference remains
available when no contact is given. Bugün, yarın and hemen yükleme are resolved
against the original message timestamp in Europe/Istanbul (UTC+3), not retry time.
Conflicting dates stay missing. ISO and DD.MM.YYYY / DD/MM/YYYY dates are supported.
Unlabelled prices are not inferred.
is_market_feed is a payload tag in the existing JSONB pool, so no physical migration or
parallel loads/carriers tables are introduced. Vehicle compatibility is mandatory for
market matches; no declared commission means no invented commission amount.

Natural-ad example accepted by the regression tests:
`İstanbul Tuzla'dan Ankara Ostim'e 20 ton paletli kuru yük. Tır (Tenteli/Kapalı Kasa). Hemen yükleme`
Tenteli and kapalı kasa are preserved as alternatives for a load, not silently
collapsed to one body type. The carrier must have exactly one compatible declared
body. Negated/uncertain body descriptions are held for review. This deterministic
parser is not a universal language model; unsupported prose remains ignored or
ineligible rather than fabricating route, date, capacity, price or authority.

### Founder-designated TEST source quarantine

WelatTR Core is explicitly designated TEST. Intake forces `isTest: true` and
`eligible: false` from its immutable source identity, regardless of submitted
flags. Existing entries are excluded by the matching engine, review handlers,
and AI draft guards even before persisted reconciliation. The workspace projects
the TEST flags immediately. The next normal pool rebuild persists corrected
flags/fingerprints under the existing pool transaction lock and stales prior
matches; no custom production migration or startup DDL is used.

Natural route handling also normalizes mobile apostrophes, nonbreaking spaces
and invisible direction marks. Tests cover a TEST-label prefix, spaced suffixes,
İstanbul Tuzla → Ankara Ostim and district / province order. Previously ignored
messages cannot be reconstructed without their original text; no historical
route or consent is invented.
