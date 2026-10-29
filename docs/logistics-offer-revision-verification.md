# Offer revision verification — 2026-10-29

## Implemented scope

Existing logistics offers, communications audit, founder guard and timestamp-based optimistic version contract are retained. Revision locks shipment then offer, retires the previous row as `revised`, inserts a new `pending_approval` row with empty approval/send fields, and appends the old/new identifiers, timestamps, prices, terms and actor-attributed audit entry in the same transaction. No parallel offer table or route was introduced.

The panel retains old cards, labels retired offers, hides their action buttons, and requires a revision reason. The API accepts an omitted reason for older clients and explicitly labels that absence in the audit rather than inventing a reason. New revision identities use existing offer IDs and timestamps, not a newly introduced numeric revision column.

Only the development enum received `revised`; no production migration or Publish was performed. Future publishing must include the enum change before executing the new revision code.

## Evidence

| Check | Result | Evidence / limitation |
|---|---|---|
| Workflow and route unit tests | PASS | 48 tests across logisticsWorkflow.test.ts and logistics-operations.test.ts; mocked database/auth |
| API and website TypeScript | PASS | Both tsc --noEmit commands succeeded |
| Old-version approval rejection | PASS | Mocked service regression test |
| Repeat revision rejection | PASS | Sequential repeat request; not concurrent database proof |
| Nonfounder and forged founder flag | PASS | Mocked service tests; no actual accounts or roles altered |
| Audit failure rolls back revision | PASS | Mock transaction restores old row and removes replacement |
| Actual form components in browser | PASS | Isolated Vite components, synthetic records, intercepted PATCH; reason and expectedUpdatedAt checked |
| Revised/pending cards | PASS | Synthetic browser fixtures; retired card has no actions |
| Real founder end-to-end mutation/refetch | NOT TESTED | Protected page requires login; no authentication bypass or role changes |
| Concurrent real PostgreSQL revisions | NOT TESTED | Row locks are implemented; mock tests do not prove PostgreSQL scheduling |
| New margin/commission/VAT calculation model | NOT IMPLEMENTED | Existing flow accepts explicit carrier cost and customer price, not margin/VAT inputs; sample pricing code was not silently activated |

## Safety

No external notifications, model calls, payments, commercial approvals or publishing were triggered by this verification. The logistics sending worker remains disabled per development startup logs. Existing separate Telegram workflows were not changed; this is not a claim that every unrelated bot in the workspace is stopped.
