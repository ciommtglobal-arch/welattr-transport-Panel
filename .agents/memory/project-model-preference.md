---
name: Project model preference
description: The user's preferred Agent model when working on the MMT Global project.
---

The user prefers Gemini for MMT Global work because Gemini understands their context and has contributed extensively to the project.

For product features, Gemini is limited to suggestions and drafts. The user selected load–carrier matching and approved storing generated advisory drafts in a founder-only review queue. Gemini must not approve, publish, message people, or change operational records automatically. The user chose a sendless TEST notification queue as the first Telegram integration stage; actual external messages require separate explicit approval and verified founder-only chat binding.

**Why:** The user explicitly requested Gemini for this project, chose persistent founder review for its drafts, and selected a no-send Telegram test before enabling real notifications.

**How to apply:** Honor this project-specific preference when the user selects the Agent model; do not claim to have changed the active model unless the user or workspace confirms it. Persist Gemini outputs only as unsent founder-review drafts. For the Telegram test, record `dry_run` only and make no Bot API send call. Keep approvals, publication, external messages, and operational record changes under explicit human control.