---
name: MMT Connect auth callbacks
description: The authentication flow decision for MMT Connect business onboarding.
---

MMT Connect sign-in and sign-up must use the dedicated full-page Clerk routes, not modal auth buttons. Both flows should have an explicit fallback return to the business-profile route after authentication or email verification.

**Why:** The modal flow did not provide a stable route/callback boundary for the verification completion and could send an existing or newly verified user back to another password screen.

**How to apply:** Keep `/sign-in/*?` and `/sign-up/*?` as the canonical Clerk routes, link to them from `/b2b-agi/katil`, and preserve the profile-route fallback when changing auth UI.

The user confirmed this full-page flow works in the preview after email verification.