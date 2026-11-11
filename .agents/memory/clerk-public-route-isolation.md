---
name: Clerk public route isolation
description: Replit-managed Clerk behavior in development previews and the route-boundary rule that keeps public pages available.
---

Public pages must not depend on Clerk loading successfully. Mount the Clerk provider only around routes that actually use authentication, such as sign-in, sign-up, and staff-only screens; keep landing pages and public intake flows outside it.

**Why:** Replit-managed Clerk development previews can load the browser SDK from a generated `clerk.<dev-domain>` host while the development proxy is intentionally disabled. A certificate or host issue there can otherwise block the entire public site even when the public page needs no authentication.

**How to apply:** Preserve the canonical Clerk client wiring and auto-provisioned secrets. Do not hand-edit keys or enable the production proxy in development. Use a route boundary around auth-dependent screens, restart both web and API workflows after Clerk changes, and verify public and auth routes separately. Development-key warnings are expected; a failed SDK load is not.