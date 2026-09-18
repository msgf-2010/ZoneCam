# ZoneCam

Cloud job-site management for contractors. Phase 10 hardens security, search, and production readiness.

## Stack

- Next.js 15 (App Router) + TypeScript
- Prisma + SQLite for local development (PostgreSQL for production — see `docs/ARCHITECTURE.md`)
- Session cookies, per-company RBAC, server-side tenant checks

## Setup

Requires Node 20+. This machine can use `nvm use 24.18.0`.

```bash
copy .env.example .env
npm.cmd install
npx.cmd prisma migrate dev --name init
npm.cmd run db:seed
npm.cmd run dev
```

Windows PowerShell often blocks `npm.ps1`. Use `npm.cmd` (or double-click `dev.cmd`) instead of `npm`.

Open http://localhost:3001 and create a company.

Email verification and password-reset links are printed to the server console (`EMAIL_DRIVER=console`).

## Phase 4 APIs (tasks, checklists, timeline)

- `GET|POST /api/v1/tasks`
- `GET|PATCH|DELETE /api/v1/tasks/:id`
- `POST /api/v1/tasks/:id/complete`
- `POST /api/v1/tasks/:id/items`
- `GET|POST /api/v1/tasks/:id/comments`
- `PATCH /api/v1/task-items/:id`
- `GET|POST /api/v1/projects/:id/task-lists`
- `GET /api/v1/projects/:id/timeline`
- `GET|POST /api/v1/projects/:id/checklists`
- `PATCH /api/v1/checklist-items/:itemId`
- `GET|POST /api/v1/checklist-templates`
- `PATCH /api/v1/checklist-templates/:id`

Task and checklist changes write `TimelineEvent` rows on the job. Field technicians only see tasks on assigned jobs (or assigned to them). Completing items is authorized with `tasks.complete`.

## Phase 5 APIs (messages + notifications)

- `GET|POST /api/v1/projects/:id/comments`
- `GET /api/v1/messages`
- `GET /api/v1/notifications`
- `POST /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`
- `GET|PATCH /api/v1/notifications/preferences`
- `GET /api/v1/realtime/stream` (SSE; tenant-scoped)

Job messages, mentions (`@First Last`), photo uploads, notes, and task assignments create `Notification` rows. Email follows user preferences and currently prints through the console mail adapter.

## Phase 6 APIs (reports + signatures)

- `GET|POST /api/v1/reports`
- `GET /api/v1/reports/:id`
- `POST /api/v1/reports/:id/generate`
- `POST /api/v1/reports/:id/share` (returns a one-time share URL; only a hash is stored)
- `POST /api/v1/reports/:id/signatures`
- `GET /api/v1/public/reports/:token`
- `POST /api/v1/public/reports/:token/sign`
- `GET /api/v1/public/reports/:token/media/:mediaId`

Shared reports omit internal notes. Signatures use the internal provider and store a PNG in object storage. DocuSign/etc. can replace `SignatureProvider` later.

## Phase 7 APIs (payments)

- `GET|POST /api/v1/payments`
- `GET /api/v1/payments/:id`
- `POST /api/v1/payments/:id/request` (share URL hashed in the database; email uses the console adapter)
- `POST /api/v1/payments/:id/paid`
- `POST /api/v1/payments/:id/cancel`
- `GET /api/v1/public/payments/:token`

This is an internal ledger. Stripe/etc. can replace `PaymentProvider` later. The public page does not collect card numbers.

## Phase 8 APIs (local inspector)

- `POST /api/v1/media/:id/analyze` — caption from real image stats (size, format, exposure)
- `POST /api/v1/projects/:id/ai/summary` — job summary stored as an internal note
- `POST /api/v1/projects/:id/ai/checklist` — suggested checklist from the job type

`AI_DRIVER=internal` uses the on-device inspector. Hosted models and translation stay unconnected (`translateText` fails honestly). New photos enqueue `ai.analyze-media` after thumbnail processing.

## Phase 9 APIs (integrations)

- `GET /api/v1/integrations`
- `GET|PATCH /api/v1/integrations/:provider`
- `POST /api/v1/integrations/:provider/connect`
- `POST /api/v1/integrations/:provider/disconnect`
- `POST /api/v1/integrations/:provider/sync`
- `GET /share/c/:token` — iCalendar feed of dated jobs (hash stored, raw token shown once)

Email uses the existing console mail adapter and writes `IntegrationLog` rows when connected. Calendar publishes job start dates. QuickBooks, Jobber, ServiceTitan, and Google refuse to pretend they are connected.

## Phase 10 (hardening)

- Security headers on HTML and APIs (`nosniff`, frame denial, CSP, `no-store` JSON)
- Login `next` is restricted to same-app paths
- Rate limits on auth, public share/sign/calendar, media, search, and SSE
- JSON bodies capped at 256 KB; unsigned media signatures are checked before the file is loaded
- Tenant search: `GET /api/v1/search?q=` and `/search` (8 hits per type, company-scoped)
- `GET /api/v1/health` for process/database liveness
- Production `AUTH_SECRET` must be 32+ characters and not the dev placeholder
- Project/customer lists cap at 50 rows

## Tests

```bash
npm test
```

## Phase 1 APIs

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/invite`
- `GET|PATCH /api/v1/company`
- `GET /api/v1/company/members`
- `POST /api/v1/company/invites`
- `GET /api/v1/company/roles`
- `GET|PATCH /api/v1/users/me`
- `GET /api/v1/audit-logs`

## Phase 2 APIs

- `GET /api/v1/dashboard`
- `GET|POST /api/v1/customers`
- `GET|PATCH|DELETE /api/v1/customers/:id`
- `POST /api/v1/customers/:id/contacts`
- `GET|POST /api/v1/projects`
- `GET /api/v1/projects/meta`
- `GET|PATCH|DELETE /api/v1/projects/:id`
- `PUT /api/v1/projects/:id/members`
- `POST /api/v1/projects/:id/start|complete|hold`
- `POST /api/v1/projects/:id/notes`

## Phase 3 APIs (media)

- `GET|POST /api/v1/projects/:id/media`
- `GET|POST /api/v1/projects/:id/media/folders`
- `GET|PATCH|DELETE /api/v1/media/:id`
- `GET /api/v1/media/:id/content` (session cookie or signed `exp`+`sig`)
- `GET /api/v1/media/:id/download`
- `POST /api/v1/media/:id/tags`
- `PUT /api/v1/media/:id/annotations`

Login/register JSON now includes `token` for the mobile app (`Authorization: Bearer`). Files live under `STORAGE_LOCAL_DIR` (default `./storage`), not in SQLite. To use S3/Azure/R2 later, set `STORAGE_DRIVER` and provider credentials — adapters are in `src/server/adapters/storage.ts` and currently refuse to pretend they are connected.

Field app: `mobile/` (Expo). See `mobile/README.md`.

## Production (domain + Cloudflare)

Local SQLite and `./storage` are for this machine only. To run on the internet, use Postgres + Cloudflare R2 and put Cloudflare DNS in front of a Node host. Step-by-step: `docs/DEPLOY.md`.


