---
name: Clerk test subjects
description: Binding development-only role fixtures to the actual identity returned by the browser test helper.
---

Do not assume the Clerk browser test helper honors an explicit `sub` or `userId` override. Bind temporary development role fixtures to the actual session subject of the unique test-only account it creates.

**Why:** During Kasa browser verification, the helper accepted explicit subject overrides but produced a different session subject. Fixtures keyed to the requested subject would test only the no-access screen, not the protected workflow.

**How to apply:** Keep test name/email claims unique, confirm that the actual subject belongs to that generated test account, and scope any role fixture to that account only. Never grant a founder or existing real account for convenience, weaken runtime authentication, or leave demonstration business records behind. Clean up only the test's own role, branch, request and audit records.

When role changes are forbidden, a helper that ignores the founder subject cannot complete a founder-only UI check. Report that journey as NOT TESTED; the helper's 403 does not establish a regression in the user's separately authenticated Safari session.

**Why:** The helper can create a different synthetic identity even when given the correct development founder subject. Correctly denying that identity and displaying the founder's saved draft are separate acceptance criteria.

**How to apply:** Do not change founder mappings to make the test pass. Keep the no-mutation boundary and distinguish the user's confirmed preview access from the automated browser's missing authorized session.

Use a unique synthetic address on an example.com subdomain for programmatic Clerk browser sign-in, rather than an `.invalid` address.

**Why:** The helper's Clerk validation rejected `.invalid` as an invalid email before creating any session; a non-deliverable fixture address that PostgreSQL accepts is not necessarily accepted by Clerk.

**How to apply:** Keep database-only fixture addresses separate from browser sign-in claims. Do not repeatedly retry the rejected email or alter authentication validation.