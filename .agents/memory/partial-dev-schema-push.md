---
name: Partial development schema pushes
description: Development schema changes may survive a failed Drizzle push.
---

Treat a failed development schema push as potentially partially applied, not as a rolled-back migration.

**Why:** A push added new columns, then failed while creating an unrelated foreign key before its referenced unique index existed. The new columns remained, while required constraints were still missing.

**How to apply:** After a failed push, inspect the development table's columns and constraints before testing or retrying. Keep any targeted repairs limited to the confirmed development database. Production schema changes still belong to Publish, never startup or deployment scripts.