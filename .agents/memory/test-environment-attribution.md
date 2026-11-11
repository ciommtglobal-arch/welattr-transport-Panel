---
name: Test environment attribution
description: Avoid confusing browser-worker environment values with the managed app/database target.
---

Do not use NODE_ENV from a Playwright worker, serialized navigation response, or unrelated shell process as proof that the managed API or its connected database is production.

**Why:** A tester stopped a development-only journey after reading a worker's production value, although the managed API explicitly ran in development and its database matched the platform's development target. Production was a different database.

**How to apply:** Before any fixture write, verify the preview origin, the actual managed service configuration, and a read-only database fingerprint against an explicitly targeted development query. Stop if these do not match. Keep production checks read-only and never print connection strings or credentials.