---
name: Background worker proof
description: Distinguish real independent worker completion from service-only or rollback-isolated tests.
---

For an unattended-work claim, observe the already running worker processing a newly committed, clearly labelled synthetic development fixture without a browser request or direct invocation by the verifier.

**Why:** A rollback-only transaction can prove model generation and database serialization, but a separate worker cannot see its uncommitted fixtures. Such tests do not establish that the actual scheduler processed anything.

**How to apply:** Verify the development target before inserting synthetic evidence, preserve existing records, set a bounded observation window, and check both the background origin and the founder queue response. Keep sendless evidence separate from approval or payment. Report this as development-process proof, not continuous production availability or successful mobile authentication.
