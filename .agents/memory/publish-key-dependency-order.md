---
name: Publish key dependency ordering
description: Managed Publish diffs can be non-destructive yet fail when foreign keys precede referenced unique keys.
---

Treat schema-diff safety flags as data-loss warnings, not proof that its SQL can execute. Rehearse the actual statement order against empty development-only structures in a transaction that always rolls back.

**Why:** A diff with neither removals nor backwards-compatibility warnings still attempted a new composite foreign key before creating its parent unique key. PostgreSQL rejected the sequence.

**How to apply:** Verify referenced keys exist before dependent foreign keys. If the supported Publish flow cannot establish that order in one release, prepare staged Publish steps and keep affected new write operations closed until all required relationships exist. Never replace this with direct production DDL, startup migrations, or deployment-build schema pushes.

Foreign-key-backed standalone unique indexes may be treated as implicit during introspection and spuriously omitted from a schema diff.

**Why:** A physical index existed in both databases but the diff proposed removing it after a development foreign key began relying on it. Declaring a unique constraint, attaching the referenced index to it, and retaining the legacy standalone index resolved that false removal without changing records.

**How to apply:** Compare diff output to the actual PostgreSQL catalog before removing apparently redundant indexes. Preserve compatibility while changing key ownership.

Use a SELECT result before ROLLBACK to report rehearsal failures; do not rely solely on RAISE NOTICE.

**Why:** The database query callback returned command statuses but omitted PostgreSQL notices, hiding a caught rehearsal failure.

**How to apply:** Capture outcome, failing step and SQLSTATE in a transaction-local temporary result table, SELECT it, then roll back. A successful callback alone does not mean the rehearsal passed.
