# MMT shared memory bridge — review status

This change ports the authenticated bridge and additive schema from the private development repository into the Render-connected repository so that one source can be reviewed.

## What is included
- `/api/ai/health`, task queue records, task history, and append-only searchable memory.
- Bearer authentication using the dedicated `MMT_AI_BRIDGE_TOKEN`; timing-safe comparison.
- Payload bounds and parameterized SQL. Memory records are idempotent on source plus source record ID.
- Additive migration in `migrations/20261117_ai_shared_memory.sql`.

## Explicitly not enabled
- A Gemini worker is mounted in the API service. It is disabled unless `GEMINI_TASK_WORKER_ENABLED=true`, `GEMINI_FREE_TIER_ONLY_CONFIRMED=true`, and `GEMINI_API_KEY` are present. It enforces a global maximum of one worker model request per rolling 24 hours.
- The migration is not run by application startup.
- No Render environment variables, Neon database, secrets, or deployment settings are changed by this PR.
- The existing founder-only Gemini preview remains a separate route and feature.

## Before runtime activation
1. Verify the actual Render `DATABASE_URL` target maps to the intended Neon pilot branch without revealing the URL.
2. Verify and back up the target schema; review and explicitly approve the migration.
3. Configure a dedicated `MMT_AI_BRIDGE_TOKEN` only after the API access boundary is approved.
4. Keep `GEMINI_TASK_WORKER_ENABLED` unset until the Render service's `DATABASE_URL` is confirmed to target the intended Neon branch and the additive migration has been applied there.
5. The dedicated task worker has an internal one-call-per-24-hour ceiling. It does not prove that the Gemini project is Free Tier; check the project's billing tier in AI Studio before setting the free-tier confirmation flag.
6. Run typecheck/build and review this PR before merging; merging to `main` may trigger Render deployments.

The private repository's worker implementation is intentionally not copied here because it polls and calls Gemini automatically once enabled. This PR establishes only the shared record/API layer.


## 2026-11-17 worker integration status

The API service's startup now mounts the task worker behind the dedicated
`GEMINI_TASK_WORKER_ENABLED` opt-in. This name intentionally differs from
`GEMINI_WORKER_ENABLED` so any older environment setting cannot silently start
the new queue consumer. The API bridge health response reports configuration
presence only; it never returns secret values.

The worker claims one queued Gemini task, reads at most eight relevant memory
records, records task events, writes the answer back to the task and appends a
Gemini memory record. Provider errors and prompts are not written to logs. A
database advisory lock serializes workers across service instances. The global
worker call budget is one request per rolling 24 hours. No paid call or live
task was submitted as part of this code preparation.

## 2026-11-17 production-link verification

The earlier note above that the connected production branch lacked the bridge
tables is stale. A controlled one-call attempt from the Render
`welattr-api-test` service created a task record and Gemini event rows on the
Neon `my-first-project` `production` branch. Treat this Render service as
production-database-linked unless its `DATABASE_URL` target is independently
verified in Render. Do not queue further tasks there until database isolation
is confirmed.

The one Gemini request failed with the generic `GEMINI_REQUEST_FAILED`
classification. The response body and secret-bearing request data were not
logged, so the provider cause is still unknown. The task worker enforces one
model request per rolling 24 hours. The follow-up change on
`fix/gemini-safe-provider-diagnostics` records only sanitized error type,
HTTP status, and provider code, never the provider message or key.
