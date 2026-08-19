# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

DAMAYAN is a Problem-Oriented Dynamic Clinical Note Interface (an EMR-style app). It's a monorepo with two independent apps:

- `backend/` — NestJS 11 API, PostgreSQL via Prisma (hosted on Supabase), Supabase Auth for identity.
- `frontend/` — Next.js 16 (App Router) + React 19, Tailwind v4, shadcn/radix-ui components, Zustand for client state, TanStack Query for server state.

There is no root-level package.json — run all commands from inside `backend/` or `frontend/`.

## Commands

### Backend (`backend/`)
```bash
npm run start:dev      # nest start --watch
npm run build          # nest build
npm run lint           # eslint --fix
npm run format         # prettier --write
npm test               # jest (unit specs, *.spec.ts)
npm run test:e2e       # jest --config ./test/jest-e2e.json
npx jest src/patients/patients.service.spec.ts   # run a single test file
```
Prisma:
```bash
npx prisma generate    # regenerate client after schema.prisma changes
npx prisma validate    # sanity-check schema.prisma
```
**Never run `prisma migrate dev` or `prisma db push`** — see Prisma/migrations note below.

### Frontend (`frontend/`)
```bash
npm run dev            # next dev
npm run build          # next build
npm run lint           # eslint
```

## Architecture

### Backend: NestJS feature modules
Each domain lives under `backend/src/<feature>/` with a consistent `*.module.ts` / `*.controller.ts` / `*.service.ts` / `dto/*.ts` shape (patients, visits, initial-notes, progress-notes, problems, medications, vitals, documents, attachments, audit-logs, accounts). `app.module.ts` wires them all together; `PrismaModule` must be imported first (after `ConfigModule`).

Clinical note structure follows a problem-oriented model:
- `Patient` → `Visit` (INITIAL or PROGRESS type) → `InitialNote` or `ProgressNote`.
- `Problem` records track diagnoses per patient with status (ACTIVE/RESOLVED/REMOVED) and have their own `ProblemLog` history.
- `Medication` similarly has `MedicationLog` history.
- `Document` generation (medical certificates, lab requests, prescriptions, referral letters) is templated in `backend/src/documents/templates/` and rendered with `pdfkit`.
- `AuditLog` records CREATE/UPDATE/DELETE/VIEW/GENERATE/DRAFT actions; `common/interceptors/audit-log.interceptor.ts` is how these get written automatically.

### Backend: Auth
- Identity is Supabase Auth, not a local users table for login. `JwtStrategy` (`backend/src/auth/strategies/jwt.strategy.ts`) verifies the bearer token against Supabase's JWKS endpoint, then cross-checks the `sub` claim against the local `User` table (`isActive` must be true) — the local `User` row is authorization/profile data, not the credential store.
- `RolesGuard` + `@Roles()` decorator enforce role checks (`DOCTOR` / `NURSE` / `ADMIN`) from `payload.user_role`, injected into the JWT by a Supabase `custom_access_token_hook`.
- `AuthorGuard` + `@NoteModel()` decorator enforce "only the author or an ADMIN can modify this note" on `InitialNote`/`ProgressNote` routes — it looks up `authorId` dynamically via `noteModel` so it works for either note type.

### Backend: Prisma / migrations — read before touching schema.prisma
**The `prisma/migrations/` history is known to be out of sync with the live Supabase database.** Several columns/enums exist in production that were applied via `prisma db push` with no corresponding migration file. Running `prisma migrate dev` would diff against this incomplete migration history and could generate destructive DDL (dropped columns, type changes) against a shared production medical database.

Rules when changing the schema:
1. Edit `schema.prisma` to the desired end state.
2. Hand-write an **additive-only** migration SQL file (`CREATE INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc. — never destructive DDL). Precedent: `prisma/migrations/20260723140000_add_relationship_and_query_indexes/`.
3. Run `prisma validate` and `prisma generate` locally to confirm the client builds.
4. Do not run `prisma migrate deploy` or otherwise touch the live database yourself — leave that for the user to run manually.
5. Do not push commits to GitHub yourself — the user deploys manually.

### Frontend structure
- App Router routes under `frontend/src/app/`: `(auth)/login`, `(admin)/admin/*` and a parallel non-grouped `admin/*`, `dashboard/[patientId]`, `change-password`. Check both `(admin)/admin` and `admin` before assuming which is live.
- `frontend/src/components/` is organized by domain (patients, visits, problems, medications, vitals, documents, attachments, notes, layout) plus `ui/` for shadcn primitives.
- Client state: `frontend/src/stores/` (Zustand) — `authStore`, `patientStore`, `uiStore`.
- Server state/data fetching goes through TanStack Query; validation schemas live in `frontend/src/lib/validation/`.
- Supabase client setup is in `frontend/src/lib/supabase/`.
- Philippine address selection (region → province → city/municipality → barangay) uses the free PSGC Cloud API (`https://psgc.cloud/api`), not hardcoded data — see `Implementation.md` for the full endpoint/flow reference if extending `AddressCombobox`.

## Working conventions specific to this repo

- This is a shared production system with a live Supabase database — treat schema and data changes as high blast-radius. When in doubt about a migration or prod-affecting change, hand off to the user instead of applying it yourself.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

**Always use `/graphify` instead of grep or manual file-finding — it's faster and saves tokens.** graphify is the first and default tool for any codebase search: finding files, connections, callers/callees, or "what depends on X". Never reach for grep/Grep/Glob/find as a first move — only fall back to them when graphify doesn't surface what's needed (e.g. plain-text/string searches unrelated to code structure, or graphify-out/ is missing/stale).

Rules:
- For codebase questions, always run `graphify query "<question>"` first when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
