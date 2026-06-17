# DAMAYAN EMR — Roadmap Sync Instructions (Aligning to MVP V6)

**Purpose of this file:** The source-of-truth spec document (`DAMAYAN_MVP_V6.docx`) was updated after Phases 1–3 were already implemented and while Phase 4 is in progress. This file exists so an agentic coding assistant (e.g. GitHub Copilot, Claude Code) can bring the **already-completed and in-progress work** (Phases 1–4) into alignment with the V6 spec **before** continuing forward into Phase 5+. Treat this as a retroactive sync checklist, not a new feature request — the goal is linearity, not scope creep.

Do not start any Phase 5+ work until every checklist item below is verified or completed.

---

## 0. What Changed in V6 (Context for the Agent)

The V6 docx introduced one connected concept across multiple sections: **a new Admin Analytics Dashboard that reads existing clinical tables (no schema changes), plus an RBAC relaxation that gives all Doctors (Author and Non-Author) read-only access to a patient's audit log.** Everything else in the spec is unchanged.

Affected sections and what moved:

| Section | What changed |
| --- | --- |
| 3.3 Database Architecture | Documents the linear ownership chain (`users → patients → visits → notes → attachments`, clinical data branching off `patients`); confirms Admin Analytics Dashboard requires **no new tables**; adds the per-patient audit log rule for Doctors. |
| 6.1 ERD Overview | Makes the linear chain explicit in prose; confirms `AdminAnalyticsModule` aggregates from `problems`, `medications`, `vital_signs`. |
| 8.1 RBAC Matrix | "Audit Logs — view" row: Author Doctor and Non-Author Doctor both flip from ✗ to **✓ (per-patient)**. New row added: **Admin Analytics Dashboard** (Admin only). |
| 8.2 Implementation | Clarifies `GET /audit-logs/patient/:patientId` is open to all Doctor roles (read-only); system-wide list stays Admin-only; `GET /admin/analytics/*` guarded exclusively by `RolesGuard(Role.ADMIN)`. |
| 9.10 Audit Logs API | `GET /audit-logs/patient/:patientId` roles changed from "Admin" to **"Doctor (Author & Non-Author), Admin"**. |
| 10. Roadmap | Phase 3 deliverables now explicitly include the analytics dashboard tab. **New Phase 14: Admin Analytics Dashboard** added (depends on Phase 13). |
| 11.10 Admin Panel | Renamed to **"Admin Panel (Account Management + Analytics Dashboard)"**; two-tab architecture (Accounts / Dashboard); `AdminDashboard` component and `useAdminAnalytics()` hook added. |
| 12.11 (new) | Full `AdminAnalyticsModule` backend spec: controller (3 GET endpoints) + service (`getProblemSummary`, `getMedicationSummary`, `getVitalsSummary`). |

**Net effect on Phases 1–4 specifically:** Phase 3's deliverable text now mentions the analytics dashboard tab, but the actual *build* of that dashboard is **deferred to Phase 14** (after Phase 13). Phase 3 only needs its Admin UI shell to anticipate a two-tab layout (Accounts / Dashboard) instead of a single accounts-only page. Phase 4 is functionally unaffected by V6 — no action items there beyond the audit noted below.

---

## 1. Phase 1 — Project Setup — ✅ Re-verify, no changes needed

Status per docx: complete. No V6 changes touch Phase 1. Confirm only:

- [ ] Monorepo (`frontend/`, `backend/`) structure intact.
- [ ] ESLint/Prettier configured in both apps (confirmed present: `backend/eslint.config.mjs`, `backend/.prettierrc`, `frontend/eslint.config.mjs`).
- [ ] CORS, global `ValidationPipe`, Swagger configured in `backend/src/main.ts` (confirmed present).
- [ ] Supabase project, Auth, Storage bucket, RLS policies exist (verify in Supabase dashboard — not visible from repo).

No code changes required for Phase 1.

---

## 2. Phase 2 — Database Foundation & Full Schema Initialization — ✅ Re-verify, no changes needed

Status per docx: schema fully defined. V6 does **not** add or modify any Prisma models, enums, or migrations — Section 3.3 and 6.1 explicitly state the Admin Analytics Dashboard introduces **zero new tables**.

- [ ] `schema.prisma` matches Section 7 (already confirmed: `User`, `Patient`, `Visit`, `InitialNote`, `ProgressNote`, `Problem`, `Medication`, `VitalSign`, `Document`, `Attachment`, `AuditLog`, all enums).
- [ ] Migrations applied: `20260612131311_init_full_schema`, `20260613034747_add_requires_password_change` — both already present, no new migration needed for V6.
- [ ] `PrismaModule` / `PrismaService` wired with `onModuleInit` — confirmed present.

**Action:** None. Do not run `prisma migrate dev` for V6 — there is nothing to migrate.

---

## 3. Phase 3 — Authentication, RBAC & Admin Provisioning — ⚠️ Sync Required

This is the phase whose **deliverable description** changed in V6, even though the heavy backend lifting (`AccountsModule`, `JwtAuthGuard`, `RolesGuard`, JWT strategy, seed logic) is already built and correct. What's missing is the **two-tab shell** on the Admin Panel that the rest of the roadmap (Phase 14) will plug into later.

### 3.1 Backend — already correct, just confirm

- [x] `JwtStrategy`, `JwtAuthGuard`, `RolesGuard` implemented (`backend/src/auth/`).
- [x] `AccountsService.seedAdminAccount()` implemented with multi-admin env support (`ADMIN_EMAIL`/`ADMIN_EMAIL_2`/`ADMIN_EMAIL_3`).
- [x] `POST /accounts` provisioning flow with 16-char temp password generation — implemented in `AccountsService.create()`.
- [x] `requiresPasswordChange` / `temporaryPassword` flow on `User` model and enforced in `JwtAuthGuard` and `change-password` flow.

No backend changes required here — this part of Phase 3 was unaffected by V6.

### 3.2 Frontend — sync the Admin shell to anticipate two tabs

The current `frontend/src/app/admin/` structure is a single-purpose Accounts page with no tab concept:

- `frontend/src/app/admin/layout.tsx` — topbar/shell, no tabs.
- `frontend/src/app/admin/page.tsx` — redirects straight to `/admin/accounts`.
- `frontend/src/app/admin/accounts/page.tsx` — the only real screen.

V6 Section 11.10 now describes the admin workspace as having **two tabs: Accounts and Dashboard**, with `AdminPage` as the shell and `AdminDashboard` as the second tab's component (built in Phase 14). To stay linear without jumping ahead into Phase 14's actual analytics work, do the following **structural-only** prep now:

- [ ] Introduce a tab-aware layout inside `frontend/src/app/admin/` (e.g. a `TabsNav` or simple `<Tabs>` using shadcn `Tabs` component, consistent with Section 9 of `components.json`) with two entries: **Accounts** (`/admin/accounts`, existing) and **Dashboard** (`/admin/dashboard`, route placeholder only).
- [ ] Create `frontend/src/app/admin/dashboard/page.tsx` as a placeholder page (e.g. `<div className="p-5 text-[13px] text-text-muted">Analytics Dashboard — Phase 14</div>`), mirroring the existing placeholder pattern already used for `vitals/page.tsx`, `problems/page.tsx`, etc. in the patient workspace.
- [ ] Update `frontend/src/app/admin/page.tsx` to redirect to `/admin/accounts` by default (unchanged behavior — Accounts remains the landing tab).
- [ ] Do **not** build `AdminDashboard`, `useAdminAnalytics()`, or the `AdminAnalyticsModule` backend yet — those belong to Phase 14 per the dependency chain (`Phase 14` depends on `Phase 13`, which is not yet reached). Building them now would break linearity.

**Rationale:** This keeps the Admin Panel's navigational shape consistent with where the spec says it's headed, without front-loading Phase 14 work out of order.

---

## 4. Phase 4 — Patient Management — ⚠️ Audit Only, No Spec Changes

V6 introduced no changes to Patient Management requirements. This phase is in progress in the current codebase. Use this section purely as a **completion audit** against the *unchanged* Phase 4 deliverables, so that Phase 5 can start from a verified-complete baseline.

### 4.1 Backend — confirm against Section 10, Phase 4

- [x] `PatientsModule` — controller, service exist (`backend/src/patients/`).
- [x] `CreatePatientDto`, `UpdatePatientDto` implemented with validation rules matching Section 11 of the design standard (name max 30 chars, DOB validation, address fields optional).
- [x] Patient code auto-generation (`PT-XXXX` sequential) implemented in `PatientsService.generatePatientCode()`.
- [ ] **Verify:** `PatientsController.findAll()` and `findOne()` correctly strip the raw `visits` array and surface only `allergies` — confirmed in code, but re-test after any Phase 3 admin shell changes to ensure no regression in shared Prisma client usage.

### 4.2 Frontend — confirm against Section 10, Phase 4 and Section 11.2

- [x] Sidebar patient list (`frontend/src/components/layout/Sidebar.tsx`) with alphabetical grouping (`groupByLetter`) and search — implemented.
- [x] `NewPatientModal` with manual validation (note: spec says "React Hook Form + Zod validation" in Section 10 Phase 4 deliverables — **current implementation uses plain `useState` + manual validation, not RHF/Zod**).
- [x] Modal wired to `POST /patients` via `useCreatePatient()` mutation hook with optimistic sidebar invalidation.
- [x] Patient selection updates `usePatientStore` (Zustand) and loads the Dashboard route.

### 4.3 Gap identified (pre-existing, not V6-caused) — flag for resolution before Phase 5

- [ ] **RHF + Zod migration:** Section 10 Phase 4 explicitly calls for "React Hook Form + Zod validation" on `NewPatientModal`. The current `frontend/src/components/patients/NewPatientModal.tsx` uses raw `useState` and a hand-rolled `validate()` function. `react-hook-form`, `@hookform/resolvers`, and `zod` are already installed (see `frontend/package.json`) but unused in this component. Decide whether to:
  - (a) Migrate `NewPatientModal` to RHF + Zod now, to close out Phase 4 cleanly per spec, **or**
  - (b) Explicitly accept the deviation and proceed, noting it as a documented exception.

  This is **not** a V6 change — it predates the V6 docx update — but since this file's purpose is bringing Phases 1–4 into a verified, linear state before continuing, it should be resolved one way or the other before declaring Phase 4 done.

- [ ] **Styling consistency check:** `NewPatientModal.tsx` and the empty-state cards (`ProblemListCardEmpty`, `MedicationListCardEmpty`, `VitalsStripEmpty`) still use hardcoded hex values (e.g. `#0A6E5F`, `#D1D5E0`) instead of the `text-accent`, `border-border`, etc. CSS-variable-backed Tailwind utility classes used everywhere else (e.g. `AccountsPage`, `PatientBanner`, `Sidebar`). Not a V6 requirement, but flagged for consistency before later phases compound the drift.

### 4.4 No action needed

No RBAC, schema, or API contract changes apply to Phase 4 from V6. Once 4.3's two items are resolved (or explicitly deferred with a note), Phase 4 can be marked complete and the project can proceed to Phase 5 exactly as originally scoped — V6 does not alter Phase 5 onward except for the new Phase 14 appended at the end.

---

## 5. Where Phase 14 Now Sits (Informational — Do Not Build Yet)

For context only, so the dependency chain is clear when you eventually reach it:

- **Phase 14: Admin Analytics Dashboard** — depends on **Phase 13** (UI Refinement & MVP Completion), not Phase 3 or Phase 4.
- It introduces: `AdminAnalyticsModule` (backend, 3 read-only GET endpoints: `/admin/analytics/problems`, `/admin/analytics/medications`, `/admin/analytics/vitals`), the `AdminDashboard` frontend tab, and the per-patient audit log unlock for all Doctor roles (`GET /audit-logs/patient/:patientId`).
- No new Prisma models or migrations — confirmed in Sections 3.3, 6.1, and 12.11.
- The two-tab Admin shell scaffolded in Phase 3 (Section 3.2 above) is the only piece of Phase 14 that should exist before Phase 13 is complete.

---

## 6. Linear Completion Checklist (Summary)

Work through in order. Do not proceed to Phase 5 implementation until all boxes here are checked.

- [ ] Phase 1 re-verified (Section 1) — no changes expected.
- [ ] Phase 2 re-verified (Section 2) — no changes expected, no new migrations.
- [ ] Phase 3 backend re-verified (Section 3.1) — no changes expected.
- [ ] Phase 3 frontend Admin shell updated to two-tab layout with `/admin/dashboard` placeholder route (Section 3.2).
- [ ] Phase 4 backend re-verified (Section 4.1).
- [ ] Phase 4 frontend re-verified (Section 4.2).
- [ ] Phase 4 gap decision made on RHF/Zod migration for `NewPatientModal` (Section 4.3).
- [ ] Phase 4 styling consistency flagged/resolved or explicitly deferred (Section 4.3).
- [ ] Confirmed Phase 14 is *not* started — only the Phase 3 placeholder route exists.

Once every item above is checked, the project is linear with `DAMAYAN_MVP_V6.docx` through Phase 4, and Phase 5 (Visit Management) can begin unchanged from its original spec.