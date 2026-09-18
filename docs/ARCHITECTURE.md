# ZoneCam Architecture (Phase 1)

ZoneCam is a multi-tenant job-site management platform. This repository started empty (git only, no application code, database, or auth). The stack below is the established foundation going forward.

## Repository findings

| Area | Finding |
| --- | --- |
| Tech stack | None. Greenfield. |
| Frontend | None. |
| Backend/API | None. |
| Database | None. |
| Auth | None. |
| Config | None. |
| Reusable components | None. |
| Conventions | None. |
| Runtime on this machine | Node 24 available via nvm; Docker and PostgreSQL are not installed. |

## Chosen stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js (App Router) + TypeScript | One deployable unit for web UI + HTTP API; good for later mobile clients against the same `/api/v1` surface. |
| UI | Tailwind CSS + original ZoneCam design tokens | Consistent, responsive field/office UI without copying another product. |
| Database | Prisma ORM. **SQLite locally** so the app runs without Docker. **PostgreSQL in production.** | Same Prisma models; production should set `DATABASE_URL` to Postgres and change the Prisma provider when Postgres is available. |
| Auth | First-party sessions (httpOnly cookie, hashed token in DB) | Full control over company switching, revoke, email verify, password reset. |
| Authorization | Per-company roles + permission keys, enforced in server services | Configurable RBAC; never trust the client. |
| Tenancy | `companyId` on every tenant-owned row + membership check on every request | Defense in depth. |
| Object storage | `ObjectStorage` interface (local disk adapter now; S3/Azure/R2 later) | Media bytes never live in the relational DB. |
| Jobs | `JobQueue` interface (inline/dev adapter now) | Thumbnails, video, AI, mail. |
| Email | `EmailService` (console adapter now) | Verification/reset/invites work in development. |
| Realtime | `RealtimePublisher` interface (no-op/in-memory now) | Phase 5 can add SSE/WebSocket without rewriting domain services. |
| Search | `SearchService` interface (SQL adapter now) | Later swap in a dedicated engine. |
| AI / payments / e-sign / integrations | Provider interfaces + explicit “not connected” implementations | No fake providers. |

## Frontend architecture

- `src/app` — routes (auth screens, authenticated shell).
- `src/components` — design-system primitives and feature widgets.
- `src/lib` — env, HTTP client, date/format helpers (no secrets).
- Authenticated layout loads `/api/v1/auth/session` and renders navigation.
- Field layout later: larger controls, fewer fields, same APIs.

Main nav (Phase 1 enables Dashboard, Team, Settings; other items are real routes that read the database and show empty states — no hardcoded demo data):

Dashboard · Projects · Customers · Calendar · Tasks · Reports · Team · Messages · Integrations · Settings

## Backend architecture

- Versioned REST under `/api/v1/...`.
- Route handlers parse/validate (Zod), then call services.
- Services own transactions, tenant checks, audit writes, and domain rules.
- No Prisma calls from React components.

Request pipeline:

1. Rate limit (auth routes).
2. Load session from cookie.
3. Resolve active `companyId` (session or membership).
4. Load role permissions.
5. Authorize permission + tenant ownership of the resource.
6. Execute service.
7. Write audit log for sensitive actions.

## Database architecture

Relational model with:

- UUID/cuid primary keys
- `companyId` on tenant data
- `createdAt` / `updatedAt`
- `deletedAt` soft delete where recovery matters (users, companies, customers, projects, media, etc.)
- Indexes on tenant keys, foreign keys, and common filters
- Unique constraints scoped to company where needed (`project.number`, role `key`, etc.)

Identity (`User`) is global. Tenancy is via `CompanyMembership`. A user may belong to multiple companies; the session stores `currentCompanyId`.

## Multi-tenancy

- Every query for company data **must** include `companyId` from the trusted session, never from an unverified client-supplied id alone.
- Resource access: load by id **and** `companyId`. If missing → 404 (do not leak existence).
- Cross-company IDs are treated as not found.
- Customer portal (later) uses a separate principal type and never receives internal notes, internal messages, or staff-only fields.

## File / media storage

```
Media row (metadata, keys, status)
  + ObjectStorage object (bytes)
  + optional derivatives (thumbnail, preview)
```

Access via short-lived signed URLs. Public guessable paths are not sufficient to read private media.

## Background processing

Upload returns as soon as the object and `Media` row exist (`processingStatus = pending`). A job generates thumbnails/metadata. Optional AI analysis is another job against `AiService`.

## Notifications

`Notification` rows for in-app. `NotificationPreference` per user/company/event. `EmailService` / later `PushService` honor preferences. No silent continuous GPS tracking; arrival/departure is explicit and disclosed.

## Audit logging

`AuditLog` is append-only. Auth, membership, permission, media deletion, payments, and settings changes are logged with actor, company, action, entity, IP, metadata.

## Phase 1 implementation scope

In this phase: schema + migrations, auth (register/login/logout/verify/reset), profile, company, memberships/invites, roles/permissions, audit log, app shell, adapter interfaces, tests.

Later phases add project UX, media pipeline, timeline, tasks, communications, reports, signatures, payments, AI, and third-party sync — against this schema and these interfaces.
