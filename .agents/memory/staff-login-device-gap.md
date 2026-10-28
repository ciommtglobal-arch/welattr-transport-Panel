---
name: Staff login device gap
description: What the controlled browser checks do and do not establish about the reported mobile sign-in failure.
---

Treat the staff sign-in form as a mitigation for a reported silent mobile submit, not proof that the affected device can complete authentication. Preserve an alternative Clerk-managed route for social login, password recovery, and additional verification.

**Why:** In controlled mobile browsers, the original Clerk button was an enabled native submit, reached Clerk, and displayed errors. The user reported no visible response on their own device, whose browser/network console was unavailable. The replacement form was checked with nonexistent addresses only: it displayed validation and Clerk errors, but an existing-account transition to the password step was not verified.

**How to apply:** Do not infer the original button was type=button or claim a real login succeeded from a nonexistent-account test. If sign-in still stalls on the affected device, use its visible form state and redacted network/error information to distinguish a blocked Clerk request from a submit failure, without requesting passwords or codes.

For real-account panel navigation, obtain the published URL from deployment metadata rather than handing the founder a workspace preview link.

**Why:** A preview link was given during real-account panel navigation, followed by a reported password/email-verification failure. The root cause was not established, but isolated development and production accounts make that link misleading.

**How to apply:** Use the published site's sign-in route for normal business use; reserve preview links for explicitly identified development testing. Do not claim that changing the link proves successful authentication.

Keep browser-only simulated password submissions and programmatic test authentication separate from real email/password authentication in reports.

**Why:** A simulated submission can confirm autofill handling and visible errors, and programmatic sign-in can confirm the destination, without exercising the user's actual password, additional verification, or mobile production cookies. The reported device-specific failure remains unverified by those checks.

**How to apply:** State exactly which parts were checked, require publishing before claiming a live fix, and never treat a simulated sign-in, programmatic sign-in, or successful website-server startup as proof that the affected real account can log in. Hosting configuration and account access are separate checks.

Prefer same-tab Google OAuth on the staff and company sign-in screens rather than relying on a popup.

**Why:** The user reported an inert Google button on mobile. A controlled browser opened a separate Google popup while the original form waited; that waiting state alone was not proof of a broken request. Same-tab handoff removes the separate-window dependency without changing accounts, passwords, or roles.

**How to apply:** Preserve the existing callback and destination routes. Report reaching Google's credential screen separately from completing authentication, and do not equate a mobile viewport in a non-WebKit browser with verification on the user's iPhone.