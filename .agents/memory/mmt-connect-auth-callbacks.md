---
name: MMT Connect auth callbacks
description: The authentication flow decision for MMT Connect business onboarding.
---

MMT Connect sign-in and sign-up must use the dedicated full-page Clerk routes, not modal auth buttons. Both flows should have an explicit fallback return to the business-profile route after authentication or email verification.

**Why:** The modal flow did not provide a stable route/callback boundary for the verification completion and could send an existing or newly verified user back to another password screen.

**How to apply:** Keep `/sign-in/*?` and `/sign-up/*?` as the canonical Clerk routes, link to them from `/b2b-agi/katil`, and preserve the profile-route fallback when changing auth UI.

The user confirmed this full-page flow works in the preview after email verification.

Keep the public B2B network route in the same Clerk provider boundary as the business profile route so mobile back-navigation does not tear down and recreate the auth session between them.

**Why:** Re-entering the profile page from the B2B network could freeze on mobile Safari when the provider was unmounted on the network route and initialized again on the profile route.

**How to apply:** Treat the B2B network and business-profile routes as one navigation group when adjusting route-scoped Clerk mounting.