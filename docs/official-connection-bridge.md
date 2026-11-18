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

## Priority for the requested institutions

Official source pages checked on 2026-11-18. These findings establish the safe workflow design; they do not establish that a public API or production integration is available.

1. **MERSİS — first digital workflow.** The Ministry's current notice describes a “Yetkilendirme İşlemleri” area where company-authorized users may grant a third party permission to initiate changes and/or send them for approval. E-signature login actions have the legal effect stated by the portal. Begin with document preparation and read-only status tracking; keep the final approval/signature with the person authorized in MERSİS. No unattended portal automation.
   - [MERSİS login and e-signature notice](https://mersis.ticaret.gov.tr/Portal/KullaniciIslemleri/GirisIslemleri)
   - [MERSİS official announcements](https://mersis.ticaret.gov.tr/Common/Duyurular/DuyuruIslemleri)

2. **GİB / Dijital Vergi Dairesi — second.** GİB publishes a form for granting another identified person/entity authority for specified Internet Tax Office actions. Its FAQ says legal-entity forms are signed by a representative authorized to bind the entity, and describes delivery of the authority form to the tax office. Because these pages include legacy Internet Tax Office naming, verify the current Digital Tax Office path and exact scope with GİB before any delegation. Use only a named accountant or other officially accepted person with narrowly scoped authority; do not give the panel or AI the taxpayer's primary login.
   - [GİB authority form](https://intvrg.gib.gov.tr/basvuru_form/yetki_formu.html)
   - [GİB official Internet Tax Office FAQ](https://intvrg.gib.gov.tr/sss_ivd_tr.html)
   - [GİB forms](https://intvrg.gib.gov.tr/formlar_tr.html)

3. **UYAP — case workflow only; no automated portal connector.** UYAP's official Avukat Portal terms explicitly prohibit robot software/hardware for login, querying, or similar access and prohibit using another person's e-signature. The panel may organize deadlines, evidence, drafts, and status notes from files the authorized user provides. A lawyer or the authorized person must access and act in the portal under their own credentials and authority; the panel must not scrape or drive the portal.
   - [UYAP Avukat Portal information and terms](https://vatandas.uyap.gov.tr/main/avukat.jsp)
   - [UYAP Citizen Portal FAQ](https://vatandas.uyap.gov.tr/main/vatandas/sss.jsp)

This sequence prioritizes a supported named-delegate workflow, then a scoped tax authority that requires current procedure confirmation, and treats UYAP as an offline case-management workflow because of the portal's stated restriction. It is not a legal determination that a particular user is authorized.

## Additional institutional dependencies

Do not connect every government service by default. Add another institution only when a specific corporate process requires it and an official source confirms a permitted integration path. Potential dependencies such as e-Devlet identity, UETS/KEP notifications, a qualified e-signature provider, or Ulaştırma/UETDS must each be separately scoped and approved. e-Devlet is an identity gateway; a user's e-Devlet password is not an integration credential for this panel.

## Current technical boundary

- The repository contains a Clerk sign-in proxy, but no verified public API contract for direct MERSİS, GİB, or UYAP integration was identified in this review.
- The main website service and API service have separate service boundaries; connect them through a reviewed, authenticated API design rather than assuming they are already integrated.
- Existing WhatsApp webhook code can create a non-test logistics request and attempt an automatic reply when configured. Keep it isolated from official submissions and disabled until its live configuration and behavior are explicitly reviewed.
- No institution integration is enabled by this plan. No external credentials, official submissions, or messages are used.

## Release gates

1. Review the actual repository and production/test service map.
2. Implement the shared internal gateway with request IDs, actor, scope, approval state, and append-only audit events.
3. Add only permitted read-only or sandbox adapters after official API documentation and authorization are confirmed. For MERSİS/GİB portal-only tasks, use a named human operator's official delegation and keep the panel at preparation/status tracking unless an approved API exists.
4. Keep UYAP access manual in the authorized portal; automate only the internal case checklist, reminders, and document preparation.
5. Verify authorization boundaries, input validation, idempotency, retries, and secret redaction.
6. Run typecheck/build and appropriate tests in an isolated environment.
7. Demonstrate the complete workflow with synthetic or redacted data.
8. Obtain CIO approval before production configuration, a merge that can deploy, production writes, external communication, or official submission.
9. Keep e-signature and identity verification with the legally authorized person wherever required.

## Next work item

Build the internal gateway shell and audit model, then configure the MERSİS workflow as document preparation plus owner-controlled approval tracking. Do not connect account credentials or enable unattended actions. Confirm GİB's current delegation procedure before setting up its workflow. Keep UYAP as offline case management.
