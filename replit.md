# MMT Global

MMT Global; lojistik, uluslararası ticaret, finansal başvurular, inşaat ürünleri, medya ve bölgesel iş geliştirme operasyonlarını tek bir kurumsal sistemde birleştirir.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- `POST /api/storage/uploads/cleanup-orphans` — scheduled maintenance endpoint for
  removing unreferenced uploads. It defaults to a 24-hour retention window;
  set `ORPHAN_UPLOAD_RETENTION_HOURS` to increase it. Admin or operations staff
  can call it with `{ "dryRun": true }` to inspect candidates before deletion.

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
- `attached_assets/generated_images` — approved brand and communication assets
- `artifacts/mockup-sandbox` — isolated UI prototypes and visual variants

## Architecture decisions

- Treat finance, logistics, MMT Connect, MMT Media, construction commerce and regional development as first-class business areas, not temporary side features.
- Keep public website content, internal operations, financial review and role-specific data separated through explicit routes, permissions and server-side checks.
- Every operational workflow must have an owner, reference ID, status, next action, risk/exception state and approval boundary.
- Financial website flows are pre-application and pre-assessment flows; they must never promise guaranteed credit, funding or approval.
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
