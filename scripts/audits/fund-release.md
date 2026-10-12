# Two-stage managed Publish

This is a release procedure, not a production migration script. Production DDL
is owned by Replit Publish. Never copy development data over production.

## Phase 1: keys first

The schema stage in `lib/db/src/schema/fund-release-stage.ts` is `keys-first`.
The real development schema must match that stage before Publish.

- Keep all existing live relationships and unique indexes.
- Establish parent keys and the ten missing tables.
- Defer only the two new composite fund amendment relationships.
- Keep `company_fund_amendments_release_closed` validated. Its non-null primary
  key cannot differ from itself, so it blocks even an old application during
  rollout. A literal `CHECK(false)` is misrendered by the managed diff.
- The API checks real, validated relationship semantics and fence absence inside
  the write transaction, holding table locks to prevent a check/write DDL race.
- The UI displays `FUND_SCHEMA_PENDING` without clearing the user's draft.

Before offering Publish, obtain a fresh supported schema diff, reject unrelated
removals, verify existing production rows against new restrictions using
read-only queries, and rehearse the actual SQL against empty development-only
structures with unconditional ROLLBACK. Report failures with SELECT, not NOTICE.
Generated proof files belong in ignored `generated-artifacts/schema-release/`.

## Phase 2: only after the user completes phase 1 Publish

1. Read production metadata through the approved read-only database callback.
   Confirm the ten tables, referenced unique keys and the validated release
   fence actually exist. Do not rely on a registry row or a deployment label.
   Compare actual index ownership and foreign-key index bindings as well:
   introspection can hide a referenced standalone index. A proposed CREATE for
   an index that physically exists is a blocker, not permission to run it.
   Where production's legacy index is FK-backed but development's equivalent
   is unused beside a validated unique constraint, reconcile the redundant
   development index and its source declaration only after explicit approval.
   Do not remove production's referenced index or recreate the refund FK.
2. Only after that confirmation, change the source stage to `relationships`.
   Apply the corresponding change to **development only**, atomically restoring
   both composite foreign keys and removing the temporary fence. Preflight all
   existing amendment edges; never delete history to make a constraint pass.
3. Inspect the new supported Publish diff. The only intended removal is the
   temporary release fence; both required composite FKs must be added. If
   anything else is removed or required keys are absent, stop.
4. Rehearse its actual order in a rollback-only development test and confirm
   the application guard remains closed until both validated relationships
   exist and the fence is absent. The guard does not trust the source stage,
   user input, roles, environment flags or a cached readiness result.
5. Offer the second Publish to the user. Afterwards, confirm production
   metadata again before reporting fund amendments active.

No automatic publication, startup-time DDL, production connection script,
role grants, test-data transfer or banking operation is part of this procedure.
Schema completion does not prove Shopify credentials, real-provider payments,
leasing or other unimplemented business modules are active.
