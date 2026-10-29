# Dependency security verification

Verified 2026-10-29. Dependency remediation only; no production publish,
schema migration, commercial approval, payment or outbound notification was performed.

## Updated dependency families

- Pillow: 12.3.0 → 13.0.0.
- certifi: 2026.7.22 → 2026.10.23 (minimum 2026.10.19).
- Zod: catalog 3.25.76 and direct 4.5.4 → 4.6.7.
- Vite: 7.3.6 → 7.3.7, including Vitest's transitive instance.
- Vitest / @vitest/mocker: 4.1.11 → 4.1.12.
- Express: 5.2.1 → 5.3.0; compatible body-parser constrained to 2.4.0.
- qs: 6.16.0 → 6.16.1.
- markdown-it: 14.3.1 → 14.3.3.
- fast-uri: 3.1.8 → 3.1.9.
- Additional audit finding: postcss-selector-parser 6.x constrained to 6.1.5.

Compatible transitive constraints are necessary because parent updates retained
vulnerable but semver-satisfying lock entries. The one-day package release-age
protection remains enabled. Python package tooling also updated required Nix
image-library dependencies.

## Evidence

- Fresh platform dependency audit (Node and Python): **zero findings** at all severities.
- `pnpm audit`: **zero findings**.
- `pnpm run typecheck`: shared libraries, all artifacts and scripts passed.
- All artifact production builds passed.
- Python: PNG/JPEG/TIFF/WebP roundtrips, ReportLab PDF generation, certificate
  store loading and Telegram/Flask/document-library imports passed without network calls.
- Python Telegram unit tests: 9 passed.
- API suite: 583 passed, 3 failed, 31 skipped. Real model smoke tests excluded.
  The broad default discovery also picked up the Node-native supervisor test
  file, which Vitest reports as an empty suite; its four tests pass with
  `node --test artifacts/api-server/scripts/start-logistics-services.test.mjs`.

## Separate existing development-schema blocker

The three failed API assertions concern Kasa cancellation. Read-only catalog
inspection shows `public.kasa_requests` constraint `kasa_status_valid` still
allows only `PENDING` and `COMPLETED`, while the existing application supports
`CANCELLED`. Do not attribute a successful cancellation test to this update.
No database constraint was changed to make the test green.

No signed-in browser journey or load-capacity certification is claimed.
Dependency updates reach production only through the user's next publish.

## Runtime checks

- Restarted development services with the updated dependencies. Website, Kasa,
  sandbox and API started; `/api/healthz` returned HTTP 200 and the website
  preview rendered without browser errors.
- Telegram processes started, but both reported polling conflicts. VIP's error
  explicitly says another `getUpdates` request is active. This does not prove
  successful Telegram operation; polling ownership needs a separate check
  across development and production. No test message was sent.
