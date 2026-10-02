# MMT Global

MMT Global; lojistik, uluslararası ticaret, finansal başvurular, inşaat ürünleri, medya ve bölgesel iş geliştirme operasyonlarını tek bir kurumsal sistemde birleştirir.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Replit Publish diffs the development and production database schemas and applies
  production changes there. Never target production with Drizzle CLI or startup DDL.
- Required env: `DATABASE_URL` — Postgres connection string
- `POST /api/storage/uploads/cleanup-orphans` accepts `{ "dryRun": true }` for
  admin/operations staff. Omitting it or asking for real deletion returns 423:
  **real deletion is locked until the owner reviews the dry-run report**.
  Retention defaults to 24 hours (`ORPHAN_UPLOAD_RETENTION_HOURS`). Saved
  application documents, verification documents, listing images, and media
  references are excluded from candidates.
- Automatic orphan scanning is disabled by default in every environment.
  `ORPHAN_UPLOAD_CLEANUP_ENABLED=true` opts into scheduled **dry-run only**:
  five-minute startup delay, then every 24 hours, with retry and a PostgreSQL
  advisory lock. `ORPHAN_UPLOAD_CLEANUP_INTERVAL_HOURS` changes the interval.
  Do not enable deletion or remove its code guard without explicit owner review.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mmt-global-website` — public MMT Global website and user-facing business flows
- `artifacts/api-server` — API routes, authentication boundaries and server-side business logic
- `lib/db` — PostgreSQL schema and persistence source of truth
- `telegram-bot` — operational Telegram bots
- `artifacts/kasa` — standalone Turkish branch/cashier and QR request product, at `/kasa/`; separate Kasa grants, never MMT Connect or staff role grants
- `attached_assets/generated_images` — approved brand and communication assets
- `artifacts/mockup-sandbox` — isolated UI prototypes and visual variants

## Architecture decisions

- Treat finance, logistics, MMT Connect, MMT Media, construction commerce and regional development as first-class business areas, not temporary side features.
- Keep public website content, internal operations, financial review and role-specific data separated through explicit routes, permissions and server-side checks.
- New staff must not receive management access on signup. Evaluate their work and practical test first, then assign narrowly scoped area permissions in stages; a design preview must not change existing accounts or roles.
- Every operational workflow must have an owner, reference ID, status, next action, risk/exception state and approval boundary.
- Financial website flows are pre-application and pre-assessment flows; they must never promise guaranteed credit, funding or approval.
- Sanal POS remains mock-only until the owner explicitly approves live merchant onboarding. Never interpret a simulated successful payment as real collection or fulfillment.
- Kasa is request-only, not mock checkout: no manual or simulated payment completion. QR displays minimal request information; revenue requires provider evidence and stays separated by currency. Daily reports are not fiscal Z reports.
- Kasa's first owner must explicitly complete setup while signed in as the server-allowlisted `KASA_OWNER_CLERK_USER_ID` (falls back to the existing trusted founder allowlist). First signup never grants administration; Kasa grants never change other product roles.
- WhatsApp and Telegram are coordination channels, not systems of record; credentials, bank access, payment card data, verification codes and sensitive personal documents must not be shared there.

## Product

MMT Global is being developed as a modern corporate operating system for:

- company structure, responsibilities and approval boundaries
- finance, risk, limits, company account and payment infrastructure
- high-limit financing pre-application and follow-up
- logistics and international pilot operations
- MMT Connect for international business development and producer/buyer matching
- MMT Media for YouTube, content and brand communications
- construction products, supplier catalog and commerce
- health tourism and regional development initiatives

User-facing applications should make the next action clear, preserve an auditable status history and separate public claims from internal work.

## User preferences

- Work in a detailed, modern and corporate manner across all MMT Global business areas.
- Treat current and planned initiatives as core business work and design them for long-term reuse.
- Include testing as part of every feature, not as a separate afterthought.

## Gotchas

- Use “ön başvuru”, “ön değerlendirme” or equivalent wording for financing; do not describe an application as approved before a financial institution makes the final decision.
- Before a feature is considered complete, verify its happy path, validation and error states, role/permission boundaries, responsive layout and regression impact.
- Public pages must remain usable without internal staff permissions or private credentials.
- Do not seed or publish unverified catalog, finance, logistics or business data as if it were real.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
