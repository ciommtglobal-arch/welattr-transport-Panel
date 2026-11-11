---
name: Browser translation guard
description: Preventing mobile browser auto-translation from corrupting MMT Global’s own multilingual interface.
---

MMT Global’s four-language interface is the source of truth. Browser translation should be disabled for the app so Safari or Google Translate does not partially translate Turkish copy and create mixed-language screens.

**Why:** The mobile browser translation control was active on the public site and translated some Turkish phrases into Russian while leaving short headings unchanged, making the brand appear inconsistent.

**How to apply:** Keep the document-level no-translate guard enabled and direct users to the in-app TR/EN/AR/RU selector. When the guard changes, publish the web artifact before checking the public domain.