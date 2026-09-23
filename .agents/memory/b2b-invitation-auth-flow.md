---
name: B2B invitation auth flow
description: How invite-only company members must move through Clerk authentication before company membership exists.
---

An authenticated invitee must reach a dedicated invitation-acceptance screen before the normal company-membership query runs; preserve the invite token across Clerk sign-in/sign-up redirects.

**Why:** The normal company panel requires active membership, so loading it first sends a valid invitee to the generic company-registration page instead of allowing the invitation to be accepted.

**How to apply:** When changing B2B auth or onboarding, keep invite-token state through the Clerk callback and bypass the membership-gated profile query until the invitation is accepted.