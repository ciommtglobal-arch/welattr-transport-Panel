# Copied market advertisements

`POST /api/incoming-feed` is a protected alias of `/api/ingest/market-feed`.
It accepts copied WhatsApp/Facebook text; it does not read those services itself.

Body: `{ "sourceId": "<consented source UUID>", "eventId": "<stable original event identifier>", "occurredAt": "<original ISO timestamp>", "text": "<advertisement>" }`.

Use the source-specific `X-MMT-Market-Secret` header configured by the existing
market feed setup. Source must be enabled and consented. Never put secrets in
browser code. Keep original timestamps and event IDs when retrying.

Telegram `/api/telegram/webhook` and this endpoint use the same batch parser.
Explicit route lines are separate candidates. Following detail lines stay with
their own route; ambiguous shared information is not distributed across loads.
Route-only ads require role, weight, body and date confirmation before matching.
Part IDs are deterministic within an event, and retries skip already saved parts.
A failure may leave earlier parts saved; retry the unchanged event to complete it.
No outbound message, payment or commercial approval is performed.
