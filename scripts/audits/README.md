# Dorse Dünyası read-only verification audit

This script audits active source code and metadata snapshots of the existing
development and production databases. It never opens a DB connection, reads
credentials or customer rows, changes schemas/data/users/roles, or publishes.

The snapshots are collected through the approved database callback with
`environment: "development"` and `environment: "production"` respectively.
Use **SELECT-only** catalog queries for public tables, columns, indexes,
constraint names/types and enums. The input JSON has `capturedAt`,
`development` and `production`; each environment contains the callback's
`success` and `output` fields. The output is CSV with one `metadata` JSON cell,
containing arrays named `tables`, `columns`, `indexes`, `constraints`, `enums`.
The script rejects unsuccessful/incomplete query output instead of treating
an unavailable database as empty.

Integration context contains only verified deployment metadata, configuration
existence, non-secret shop domain configuration and the read-only publish diff.
Do not place tokens, passwords, HMAC values or customer records in these inputs.
All snapshots/reports belong under the ignored `generated-artifacts/` folder.

```sh
python3 -m unittest discover -s scripts/audits -p 'test_*.py' -v
python3 scripts/audits/dorse_audit.py \
  --metadata generated-artifacts/dorse-audit/database-metadata.json \
  --context generated-artifacts/dorse-audit/context.json \
  --output generated-artifacts/dorse-audit \
  --strict
```

Outputs: `audit.json` and `rapor.txt`. With `--strict`, exit code **2** means
the complete-activation gate is blocked; it is not a script execution failure.
Without `--strict`, exit **0** means the audit ran, not that publication is safe.

The six module assessments are human-reviewed descriptions of the current
implementation, not keyword-based proofs of business readiness. Re-review
them after product changes. The report includes source hashes, mounted API
routes, UI route inventory, Drizzle declarations and actual per-environment
table/column/index/constraint inventories so claims can be checked.

Real-account sign-in, real bank/leasing acceptance, legal authority, merchant
webhook deliveries, production writes, GPS/ERP/inspection-provider connectivity
and physical vehicle ownership are **not** established by this audit.
