---
name: Mobile business-profile URL handling
description: Why optional website values in the MMT Connect verification form are normalized before validation.
---

Optional website values in the business verification form must be trimmed and stripped of invisible Unicode characters before URL validation; bare domains may be normalized to HTTPS.

**Why:** A mobile submission produced an invalid-URL response even though the visible address was a valid live domain, consistent with hidden input characters or mobile autofill formatting.

**How to apply:** Preserve the website as optional, normalize it at the API boundary, and never reject a valid `https://` domain because of mobile-only formatting artifacts.