---
name: Market ingestion scope
description: Structured consented messages before free-text market extraction.
---
Market ingestion uses consented sources, not arbitrary group scraping or guessed facts from advertisements. User requested free-text advertisements as well as structured feeds.

**Why:** Market text may contain instructions and incomplete commercial terms; false prices or implied consent would contaminate founder decisions.

**How to apply:** Free-text extraction must keep uncertain records ineligible with missing-field evidence. Keep bot receiver ownership separate from route installation. Do not claim source activation or real load discovery from implementing a webhook.

Relative market dates must use the original event timestamp in Turkey's local day,
not the time the webhook happens to process or retry the message.

**Why:** “Hemen yükleme” and “yarın” can otherwise shift dates across midnight or
on redelivery, creating a different commercial meaning without a new advertisement.

**How to apply:** Pass Telegram message.date / feed occurredAt through all parsing
paths; preserve ambiguous dates for review rather than guessing.

The founder subsequently authorized new real market advertisements from WelatTR
Core. Historical test advertisements must remain TEST; do not bulk-convert them
into real commercial loads.

**Why:** Real-intake permission followed a successful TEST, not verification that
the earlier synthetic loads were real shipments.

**How to apply:** Respect original event time at activation and explicit TEST
labels. Newly eligible real messages may enter matching, but Gemini only prepares
founder-review drafts; automatic approval, payment and outbound dispatch remain
outside this authorization.
