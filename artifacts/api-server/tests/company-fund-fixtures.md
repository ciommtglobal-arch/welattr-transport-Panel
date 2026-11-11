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

## Private CSV archive verification

For export tests, use a fresh marker and execute `company-export-fixtures.sql`
through the same development SQL callback after `company-fund-fixtures.sql`,
binding that marker as `$1`. It adds synthetic rows spanning three server pages,
three currencies, inclusive Turkish-midnight boundaries, formula-like text,
and a cancellation dated outside the original-record range.

Run:
```sh
TEST_FUND_FIXTURE_TOKEN=<uuid> pnpm --filter @workspace/api-server exec vitest run src/routes/company-record-exports.integration.test.ts
pnpm --filter @workspace/api-server exec vitest run src/lib/companyRecordCsv.test.ts src/routes/company-record-exports.test.ts
```

The integration suite uses real company authorization and repeatable-read
PostgreSQL queries; only the signed-in identity boundary is mocked. The fast
tests cover formula escaping, UTF-8 BOM, date validation, row/byte limits,
late-page failure, and private error responses. These tests never create a
runtime sign-in bypass. Clean up instructions as well as amendments and funds
before deleting the exact marker's members and profiles.