---
name: Market ingestion scope
description: Structured consented messages before free-text market extraction.
---
Market ingestion starts with consented structured Telegram messages and existing HTTPS feeds, not arbitrary group scraping or guessed facts from advertisements.

**Why:** Market text may contain instructions and incomplete commercial terms; false prices or implied consent would contaminate founder decisions.

**How to apply:** Expand free-text extraction only with explicit uncertainty/review handling. Keep bot receiver ownership separate from route installation. Do not claim source activation or real load discovery from implementing a webhook.
