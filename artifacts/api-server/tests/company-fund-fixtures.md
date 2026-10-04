# Development-only fund record integration tests

The fast route tests use an in-memory database. The opt-in integration suite uses
real PostgreSQL locks, constraints and real company authorization with synthetic
identities. It refuses to write unless it can see the exact development marker
seeded separately. Do not seed fixtures through a shell connection or use real
accounts.

1. Generate a fresh UUID. Read `company-fund-fixtures.sql` and execute it through
   `executeSql({ environment: "development", sqlQuery, params: [uuid] })`.
2. Run:
   ```sh
   TEST_FUND_FIXTURE_TOKEN=<uuid> pnpm --filter @workspace/api-server exec vitest run src/routes/company-fund-records.integration.test.ts
   ```
   The UUID is a synthetic fixture selector, not a credential. The suite is skipped
   when it is absent. A missing/mismatched development marker fails before writes.
3. Clean up only those synthetic fixture companies through the development SQL
   callback after the run. In one transaction, select profiles by
   `internal_note = 'TEST FUND DEVELOPMENT ' || <uuid>`, delete their amendments,
   then fund records, then members, then profiles. Validate the UUID before using
   it in a multi-statement transaction. Never match by a broad `TEST` prefix.

The tests cover active and revoked owners, fake-owner membership, manager/admin
read-only access, member refusal, cross-company isolation, concurrent retry
deduplication, exact decimal storage, retained originals, paginated history,
cancellation and database foreign-key/unique constraints. Clerk itself is mocked
only at the user identity boundary; the application has no test-auth bypass.