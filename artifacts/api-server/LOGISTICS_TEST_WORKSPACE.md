# Read-only logistics TEST workspace

- Existing route: `/staff/operasyon-masasi` (Clerk and existing desk permissions).
- Read-only API: `GET /api/logistics/test-pilot/readiness`.
- Fixed pilot: `UKR-MERSİN-NARENCİYE-001`; Turkish İ is preserved.
- Enabled only when the server's NODE_ENV is development/test and no
  REPLIT_DEPLOYMENT marker is present. No environment flag is changed.
- Existing operations permission or the existing founder allowlist is required.
  Nonfounder operators must be the TEST request's owner or assigned shipment
  operator. Founder can see that a TEST record is missing without creating one.
- Database access uses the existing Drizzle connection and two existing tables,
  SELECT only, filtering the request by reference AND isTest=true.
- This is a browser/Clerk read endpoint, not the X-MMT service integration.
  A service HMAC never grants a user session or file access.
- Cache-Control: no-store; the UI isolates query data by Clerk identity.

## Interpretation

PASS means only the individual scope described in that row. The endpoint does
not execute signup/login/browser tests. It reports known pilot implementation
gaps separately from things not tested. A successful HTTP 200 does not mean
the pilot is finished or ready for a real shipment.

No invitations, tasks, output revisions or audits are fabricated. No geofence
verification, shipment transition or commercial approval occurs. The existing
TEST `/approve` endpoint is unchanged and remains 501. No database schema,
native data, accounts, roles, environment or publication settings are changed.

## Verification

`src/routes/logistics-test-pilot.test.ts` uses only synthetic identities, mock
Clerk and an in-memory Drizzle query double. It verifies production closure,
authentication and role boundaries, file assignment, TEST-only query filters,
the Turkish reference, no mutations, truthful gap statuses, and generic failure
responses. This is not a real PostgreSQL or bank/shipment test.

Run the new tests alongside existing logistics, invitation and MMT TEST
integration tests; run API and website typechecks. UI checks must not seed
native records or grant a real user additional roles.

Verified commands:

```sh
pnpm --filter @workspace/api-server exec vitest run \
  src/routes/logistics-test-pilot.test.ts \
  src/routes/mmt-test-integration.test.ts \
  src/routes/logistics-operations.test.ts \
  src/lib/logisticsWorkflow.test.ts \
  src/routes/b2b-company-management-invitations.test.ts \
  src/routes/staff-trial.test.ts \
  src/routes/b2b-company-task-reports.test.ts
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/mmt-global-website run typecheck
```

Result: 7 files / 135 tests PASS, API and website TypeScript checks PASS.
The anonymous development HTTP request returns 401. Neither this nor fixture
tests proves that the pilot lifecycle is complete or ready for publication.
