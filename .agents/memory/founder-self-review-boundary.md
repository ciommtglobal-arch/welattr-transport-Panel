---
name: Founder self-review boundary
description: Security boundary for the founder-approved business verification path.
---

The founder self-review exception must be tied to an explicitly allowlisted Clerk identity and limited to that identity's own business profile; ordinary staff review remains separate.

**Why:** The founder chose to approve the initial company verification, but allowing any profile owner to self-approve would bypass business verification and could grant trust to unrelated accounts.

**How to apply:** Keep the allowlist environment-specific, expose only the B2B verification review path, and reject founder attempts to change another owner's profile.