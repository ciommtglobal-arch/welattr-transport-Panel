---
name: B2B invitation auth flow
description: How invite-only company members must move through Clerk authentication before company membership exists.
---

An authenticated invitee must reach a dedicated invitation-acceptance screen before the normal company-membership query runs; preserve the invite token across Clerk sign-in/sign-up redirects.

**Why:** The normal company panel requires active membership, so loading it first sends a valid invitee to the generic company-registration page instead of allowing the invitation to be accepted.

**How to apply:** When changing B2B auth or onboarding, keep invite-token state through the Clerk callback and bypass the membership-gated profile query until the invitation is accepted.

A previously accepted token can remain in browser session storage after older flows; a 404 from the single-use accept endpoint should clear that stale token and return the active member to the normal panel.

**Why:** Replaying an already-consumed token looked like a new onboarding failure even though the member was already active.

**How to apply:** Treat consumed/unknown invite tokens as recoverable client state, not as a reason to block an already active company member.