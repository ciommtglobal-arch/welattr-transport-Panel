# MMT Global / WelatTR Official Connection Bridge

## Purpose

Provide one controlled digital integration layer for corporate and official workflows. MMT Connect coordinates work; WelatTR presents status and work queues; the API service owns integrations, authorization checks, validation, and audit events.

This document is an implementation plan, not proof of legal compliance or an authorization to connect to an institution. Institution-specific requirements must be confirmed from that institution's official documentation and, where needed, qualified counsel.

## Operating rules

- Start with offline preparation and read-only integrations.
- Treat each institution as a separate adapter with its own documented API, approved account type, scopes, and data-retention rules.
- Use least privilege, server-side secrets, rotation, revocation, and separate test/production credentials.
- Never store passwords, one-time codes, e-signature PINs, private keys, or session cookies in the app, logs, GitHub, or chat.
- Never represent that the system is the company's legal representative.
- Do not submit, sign, pay, create an account, or send an external message unless the institution supports the operation, the authorization is verified, and the required CIO approval is recorded.
- Fail closed: missing, expired, or ambiguous authorization blocks the operation.

## Workflow states

| State | Meaning | Permitted automation |
| --- | --- | --- |
| RECEIVED | A document or request entered the workspace | Virus scan, metadata extraction, receipt record |
| PREPARED | Required fields and documents are assembled | Validation, checklist, draft generation |
| WAITING_CIO | Business approval is required | Notify and present evidence |
| WAITING_SIGNATURE | A legal or identity-bound signature is required | Prepare a review packet; never sign for the user |
| READY_FOR_AUTHORIZED_OPERATOR | Institution requires a named, authorized operator | Show the exact institution step and approved account |
| SUBMITTED | Institution confirms receipt with a reference | Store receipt and timestamp |
| REJECTED | Institution rejected or returned the request | Capture reason and create a correction task |
| BLOCKED | API, authority, or policy is unclear | Stop and request documented resolution |

A workflow cannot move to SUBMITTED on the basis of an HTTP success alone; it needs an institution response/reference that can be retained as evidence.

## Adapter contract

Every institution adapter must declare:

- institution and service name;
- official documentation URL and verification date;
- supported environment (sandbox or production);
- supported actions and whether each is read-only, draft, or externally committing;
- authentication method, approved account type, and exact scopes;
- data categories handled and retention/deletion requirements;
- idempotency and retry behavior;
- evidence returned by the institution;
- human/CIO gates and rollback or correction process.

Adapters must not infer permissions from a user's login to another provider. App sign-in (including Clerk) is separate from institution authorization.

## Initial connection register

No institution integration is enabled by this plan. Fill this register only from official sources and owner-approved account settings.

| System | Current status | First safe mode | Enablement evidence |
| --- | --- | --- | --- |
| Clerk app identity | Sign-in issue reported; support response pending | App authentication only | Successful owner login and production key/domain check |
| Render / API | Existing app services identified; service boundaries require implementation review | Read-only operations and health checks | Service mapping and API route/security review |
| GitHub | Repository connection available | Branches and draft pull requests | CIO review before merge; merge may trigger production deployment |
| Meta / WhatsApp | No live send authorization verified | No webhook or outbound send | Official Meta app setup, test-number validation, approved templates/recipients, and explicit activation decision |
| Government / corporate institutions | Institution not yet selected | Offline checklist and document preparation | Official API or delegation documentation for the named institution |

## Release gates

1. Review the actual repository and production/test service map.
2. Implement the shared gateway with request IDs, actor, scope, approval state, and append-only audit events.
3. Add one institution adapter at a time, beginning with read-only or sandbox access.
4. Verify authorization boundaries, input validation, idempotency, retries, and secret redaction.
5. Run typecheck/build and appropriate tests in an isolated environment.
6. Demonstrate the complete workflow with synthetic or redacted data.
7. Obtain CIO approval before any production configuration, merge that can deploy, production write, external communication, or official submission.
8. Keep e-signature and identity verification with the legally authorized person wherever the institution requires it.

## Next work item

Select the first institution/service from an official source, then record its documented API or delegated-access requirements. Until then, build and review the gateway shell without connecting credentials or enabling outbound actions.
