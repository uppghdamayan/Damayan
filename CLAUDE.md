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

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Workflow

- **No agent commits:** Claude, Codex, `.codex/autopilot.js` and the headless verify runs
  never run `git commit`, `git add`, `git stash` or `git push`. Every change stays in the
  working tree, and the user reviews and commits it by hand. Progress is tracked with
  snapshots (git tree objects, which aren't commits and aren't on any branch).
- **Ask first:** Before changing any app code for a new task, Claude asks the user
  (with AskUserQuestion) which role to take. It asks no matter how small the change
  looks, and the answer holds for the rest of that task.
  - **Implement directly:** Claude edits the code itself, runs the checks below, and
    fixes failures.
  - **Orchestrator (planner):** Claude doesn't edit app code. It writes a phased plan
    to `plans/<short-task-name>.md` (see **Plans** below). In plan mode, Claude saves
    the approved plan to `plans/`, because the plan-mode file lives outside the repo
    and Codex can't see it. Then it hands off with **one paste** (the default).
  - **One-paste handoff (default):** once the user approves the plan (ExitPlanMode
    approval, or an explicit "go"), Claude saves it to `plans/<slug>.md`, runs
    `node .codex/autopilot.js check plans/<slug>.md`, and fixes the plan until it's
    runnable. Claude **always** ends that reply with the paste line for Codex, alone in
    a code block so it's one click to copy:

    ```
    Execute plans/<slug>.md
    ```

    Claude doesn't start autopilot or Codex itself. Pasted into Codex, that line runs
    the whole task (AGENTS.md "Full plan execution"): the optional plan review, every
    phase (Codex implements, `autopilot.js verify` runs the gate and the Claude
    verification, Codex reworks up to 2 times), and the task summary. Progress is in
    `.codex/autopilot/status.json`. If the user brings back a `stuck` or `failed` run,
    Claude explains the reason, fixes the plan if needed, and ends with the same paste
    line. When it's done, the user reviews and commits the changes.
  - **Manual handoff:** if the user says "manual", Claude ends its reply with
    `Execute phase 1 of plans/<slug>.md` instead, and the user hands it off one phase at
    a time.

  Claude doesn't ask when the task only reads code, answers questions, or edits docs
  and config (`*.md`, `plans/`, `.claude/`, `.codex/`), or in the headless verify run
  below, which can't ask.
- **Plans:** Orchestrator plans follow `plans/_template.md`.
  - Phases are small enough to review as one diff. Prefer 3 to 6 phases.
  - Every phase has a gate: a runnable command, not a description.
  - A phase may suggest a commit message for the user (`**Suggested commit:**`).
  - Backend phases list expected files and dependents from `graphify query`.
  - UI phases name the Impeccable command to run, and the Playwright spec if the
    project has one.
  - Set `risk: high` in the frontmatter for schema, auth, payments, or cross-layer
    contract changes. It switches the alignment review to Opus.
  - Phases apply to orchestrator plans only. Implement-directly tasks don't use them.
  - **Optional Codex review:** set `review: codex` for a second opinion before any code
    is written. It's on by default for `risk: high`, and skipped for small, low-risk
    tasks. The one-paste run does it first and has Claude triage the findings. In a manual handoff,
    Claude saves a copy as `plans/.<slug>.orig.md`, then ends its reply with
    `Review plans/<slug>.md` (to paste into a fresh Codex session) instead of the
    execute line. Codex appends `## Codex Findings`, and the user accepts or rejects them.
- **Verify:** Runs automatically. When the working tree changed since the last verified
  snapshot, Codex's Stop hook (`.codex/hooks/claude-verify.js`) starts two headless
  Claude runs in the background. In a one-paste run, `autopilot.js verify` calls the same
  script after each phase instead, and the Stop hook stays quiet. The
  change under review is written to `.codex/verify/phase.diff`.
  - **Step A, checks** (Sonnet, low effort): runs the project's checks (auto-detected,
    or `checks` in `.codex/verify.json`). It fixes only lint, formatting and type
    errors, and reports other failures. Report: `.codex/verify/last.log`.
  - **Step B, alignment** (Sonnet, medium effort, or Opus when the plan has `risk: high`
    or the diff touches `alignment.riskPaths` in `.codex/verify.json`): report-only, with no
    write tools. It lists DONE / PARTIAL / MISSING / OUT OF SCOPE / GATE / RISKS for
    the phase and ends with `VERDICT: PASS | NEEDS REWORK`. Report:
    `.codex/verify/alignment.md`.
  - The verified snapshot only advances on PASS. When the user commits, HEAD becomes
    the new starting point.
- **Fix:** In an interactive session, Claude fixes type, lint and build failures
  directly instead of sending them back to Codex, and re-runs the checks until they
  pass. Behavior failures and NEEDS REWORK findings go back into the plan as rework
  for Codex.
- **Design:** For UI work, Claude uses the impeccable skill (`/impeccable <command>`).
  `PRODUCT.md` and `DESIGN.md` are the design context. As orchestrator, Claude's UI plans
  name the impeccable command Codex should run and the DESIGN.md sections to follow.
  Never commit impeccable's live-mode block (`impeccable-live-start` …
  `impeccable-live-end` in the root layout).

Functional/manual testing stays with the user. By default Claude doesn't log in, drive the
browser preview, or ask for credentials.

Exception: when the user explicitly asks for it (for example, screenshots for the user
manual), Claude may drive the browser preview, with these limits:
- The user signs in themselves. Claude never asks for, types, or stores credentials.
- Use a test or demo patient only. The app runs against a live medical database, so no real
  patient data goes into screenshots or docs.
- Read-only navigation and screenshots. Don't create, edit, publish or delete records.
- The permission covers that one request, not later tasks.

### Closing a task

A one-paste run closes the task itself (`autopilot.js close`). In a manual handoff, when the user says "close <task>":
1. Read `plans/<task>.md`, `.codex/verify/alignment.md`, and the task's changes
   (`git status` and `git diff`).
2. Write `docs/tasks/<YYYY-MM-DD>-<task>.md` from the template below. 25 lines max.
3. Fill "Deviations from the plan" by comparing the plan with the actual diff, not
   from memory.
4. Don't edit app code, and don't commit. The user commits the summary with the work.

```md
# <Task title>

- Date: <YYYY-MM-DD>
- Risk: normal | high
- Plan reviewed by Codex: yes | no
- Final verdict: PASS | PASS WITH NOTES

## What shipped
- Phase 1: <title> (<main files changed>)

## Deviations from the plan
- <what changed and why, or "none">

## Review findings that mattered
- <Codex plan findings or alignment issues that changed the work, or "none">

## Follow-ups
- <deferred work, known gaps, or "none">
```
- After all code edits for a task are complete, run `graphify update .` once at the end
  of the coding session. Do not run it between file edits.
