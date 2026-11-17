# MMT shared memory bridge — review status

This change ports the authenticated bridge and additive schema from the private development repository into the Render-connected repository so that one source can be reviewed.

## What is included
- `/api/ai/health`, task queue records, task history, and append-only searchable memory.
- Bearer authentication using the dedicated `MMT_AI_BRIDGE_TOKEN`; timing-safe comparison.
- Payload bounds and parameterized SQL. Memory records are idempotent on source plus source record ID.
- Additive migration in `migrations/20261117_ai_shared_memory.sql`.

## Explicitly not enabled
- No Gemini worker is mounted or started. Creating a task only stores it as `QUEUED`; no model request is made.
- The migration is not run by application startup.
- No Render environment variables, Neon database, secrets, or deployment settings are changed by this PR.
- The existing founder-only Gemini preview remains a separate route and feature.

## Before runtime activation
1. Verify the actual Render `DATABASE_URL` target maps to the intended Neon pilot branch without revealing the URL.
2. Verify and back up the target schema; review and explicitly approve the migration.
3. Configure a dedicated `MMT_AI_BRIDGE_TOKEN` only after the API access boundary is approved.
4. Keep the Gemini worker disabled until free-tier/billing behavior and hard-stop handling are verified.
5. Run typecheck/build and review this PR before merging; merging to `main` may trigger Render deployments.

The private repository's worker implementation is intentionally not copied here because it polls and calls Gemini automatically once enabled. This PR establishes only the shared record/API layer.
