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