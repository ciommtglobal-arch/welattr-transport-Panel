---
name: Publish key dependency ordering
description: Managed Publish diffs can be non-destructive yet fail when foreign keys precede referenced unique keys.
---

Treat schema-diff safety flags as data-loss warnings, not proof that its SQL can execute. Rehearse the actual statement order against empty development-only structures in a transaction that always rolls back.

**Why:** A diff with neither removals nor backwards-compatibility warnings still attempted a new composite foreign key before creating its parent unique key. PostgreSQL rejected the sequence.

**How to apply:** Verify referenced keys exist before dependent foreign keys. If the supported Publish flow cannot establish that order in one release, prepare staged Publish steps and keep affected new write operations closed until all required relationships exist. Never replace this with direct production DDL, startup migrations, or deployment-build schema pushes.

Foreign-key-backed standalone unique indexes may be treated as implicit during introspection and spuriously omitted from a schema diff.

**Why:** Catalog comparisons found identical valid unique indexes in both environments, but their foreign keys depended on different backing indexes. Depending on which side has that dependency, introspection can produce either a false DROP or a false CREATE. An extra unique constraint plus a retained legacy index fixed a pre-release false DROP, but did not guarantee matching bindings after publication.

**How to apply:** Compare actual index definitions, owning constraints and foreign-key backing-index dependencies in both environments. Never assume the earlier repair is universally sufficient or blindly add IF NOT EXISTS. If a redundant unreferenced development index is the mismatch, ask before removing it and align the Drizzle declaration; preserve validated uniqueness, foreign keys and records. Leave production's referenced physical index alone and verify the supported Publish diff afterwards.

Use a SELECT result before ROLLBACK to report rehearsal failures; do not rely solely on RAISE NOTICE.

**Why:** The database query callback returned command statuses but omitted PostgreSQL notices, hiding a caught rehearsal failure.

**How to apply:** Capture outcome, failing step and SQLSTATE in a transaction-local temporary result table, SELECT it, then roll back. A successful callback alone does not mean the rehearsal passed.

The user requires MMT release progression to be system-controlled: “Herşey sistemsel olacak hata istemiyorum”.

**Why:** The user explicitly required this when approving staged publication.

**How to apply:** Base advancement on actual production metadata and rollback-tested SQL, not a manually asserted success state. Stop on failed checks; do not promise zero errors or automatically publish.
