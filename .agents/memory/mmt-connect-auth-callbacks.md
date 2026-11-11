---
name: MMT Connect auth callbacks
description: The authentication flow decision for MMT Connect business onboarding.
---

MMT Connect sign-in and sign-up must use dedicated full-page Clerk routes, not modal auth buttons. Existing-account sign-in returns to the company panel; new-account sign-up returns to business-profile onboarding after email verification. Invitees reach invitation acceptance before membership-gated panel queries.

**Why:** The modal flow did not provide a stable route/callback boundary for verification completion and could send an existing or newly verified user back to another password screen. Sending an existing company member through registration adds an unnecessary step.

**How to apply:** Keep `/sign-in/*?` and `/sign-up/*?` as canonical Clerk routes, preserve the distinct panel/onboarding fallbacks, and retain invitation tokens through both flows.

The user confirmed this full-page flow works in the preview after email verification.

Keep the public B2B network route in the same Clerk provider boundary as the business profile route so mobile back-navigation does not tear down and recreate the auth session between them.

**Why:** Re-entering the profile page from the B2B network could freeze on mobile Safari when the provider was unmounted on the network route and initialized again on the profile route.

**How to apply:** Treat the B2B network and business-profile routes as one navigation group when adjusting route-scoped Clerk mounting.

The user confirmed that the profile screen opens after returning from the B2B network; a brief blank loading frame appears first, then the pending-verification screen renders correctly.

Staff authentication also uses a dedicated full-page route with a return to the verification queue instead of a mobile modal.

**Why:** The mobile staff login modal did not reliably open, leaving the user on the personnel landing screen.

**How to apply:** Keep staff login on its own Clerk route and return authenticated staff to the verification queue after sign-in.