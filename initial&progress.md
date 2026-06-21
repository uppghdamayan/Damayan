# DAMAYAN EMR — Phase 8 & 9 Implementation Guide
**Initial Note + Progress Notes**
*For an autonomous coding agent working directly in this repository*

---

## 0. Read This First

You are implementing **Phase 8 (Initial Note)** and **Phase 9 (Progress Notes)** from `DAMAYAN_MVP_V6.docx`, Section 10 (Development Roadmap). These two phases are the clinical-documentation core of the EMR and are tightly coupled — Phase 9 depends on Phase 8, and both depend on three already-completed modules whose integration contracts you must use **as written**, not reinvent.

Do not redesign the database schema, the RBAC model, or the prerequisite modules' public methods. Your job is to fill in five currently-empty NestJS modules and build the corresponding frontend screens, wiring everything to the integration points that already exist in the codebase.

### 0.1 Source of truth

- `backend/prisma/schema.prisma` — `InitialNote`, `ProgressNote`, `Visit`, `Problem`, `Medication`, `VitalSign`, `Attachment` models already exist and are migrated. **Do not alter the schema** unless a field is genuinely missing for something the doc requires (none currently are).
- `DAMAYAN_MVP_V6.docx` Sections 9.3, 9.4, 11.3, 11.4, 12.3, 12.4, and Appendix A are the canonical spec for routes, components, and auto-save behavior. This guide restates and operationalizes them — if anything here ever conflicts with the docx, the docx wins.

### 0.2 Definition of done

Phase 8 is done when a Doctor can create a full SOAP-format Initial Note, have it auto-save as a draft, publish it, and see the Assessment items appear in the Problem List and Medication List section items appear in the Medication List — without manually touching either of those modules.

Phase 9 is done when a Doctor can start a Progress Note from the Note Timeline or the "+ New Note" button, see the patient's *current* problems/medications/non-pharm management pre-filled (copy-forward), edit and publish it, and see the change summary reflected on the Visit History card and inside `visits.problem_changes` / `visits.medication_changes`.

---

## 1. Prerequisite Modules — Read Before Writing Any Code

These modules are **already fully implemented**. Each one exposes specific internal helper methods built *for* Phase 8/9 to call. Using these helpers instead of re-querying Prisma directly is not optional — it's how cross-module consistency (sort order, soft-delete rules, dedupe rules) is preserved.

### 1.1 `ProblemsModule` (`backend/src/problems/problems.service.ts`)

| Method | Signature | Use in Phase 8/9 |
|---|---|---|
| `findActiveForPatient` | `(patientId, client?) => Promise<Problem[]>` | Progress Note copy-forward — fetch current ACTIVE problems to pre-fill `problem_list_snapshot` |
| `upsertFromAssessment` | `(patientId, assessmentTitles: string[], userId, client?) => Promise<void>` | Initial Note publish — feeds Assessment array into the Problem List. Case-insensitive title match: ACTIVE → no-op, RESOLVED → reactivate, no match → create root-level ACTIVE problem |

Both accept an optional `Prisma.TransactionClient` so you can call them **inside the same `$transaction`** used to flip a note to `PUBLISHED`. Always pass the transaction client when publishing — do not call these outside the transaction, or a failed note write could leave orphaned problems.

### 1.2 `MedicationsModule` (`backend/src/medications/medications.service.ts`)

| Method | Signature | Use in Phase 8/9 |
|---|---|---|
| `findActiveForPatient` | `(patientId, client?) => Promise<Medication[]>` | Progress Note copy-forward — pre-fill `medication_snapshot` |
| `upsertFromNoteMedications` | `(patientId, items[], userId, client?) => Promise<void>` | Initial Note publish — seeds the global Medication table. Case-insensitive match on (name, dose, unit): exact match → no-op, name match but different dose/unit → new entry (dose changes are never silently overwritten), no match → create |

Same transaction-client pattern applies. Note explicitly: **medications removed from a note's list are never auto-deactivated** by this helper — that's a deliberate business rule (see comment block in the service). Initial Note publish does not need deactivation logic at all.

### 1.3 `VitalsModule` (`backend/src/vitals/vitals.service.ts`)

| Method | Signature | Use in Phase 8/9 |
|---|---|---|
| `findLatestForPatient` | `(patientId, client?) => Promise<VitalSign \| null>` | Pre-fill the read-only `VitalsSummaryRow` at the top of both note forms |

### 1.4 `VisitsModule` (`backend/src/visits/visits.service.ts`)

| Method | Signature | Use in Phase 8/9 |
|---|---|---|
| `createForNote` | `(patientId, physicianId, visitType, visitDatetime) => Promise<Visit>` | Called first, inside the creation transaction, before creating the `InitialNote`/`ProgressNote` row (the note has a `UNIQUE NOT NULL visit_id`) |
| `updateChangeSummary` | `(visitId, problemChanges?, medicationChanges?) => Promise<Visit>` | Called on Progress Note publish to persist the diff JSONB shown in Visit History |

`VisitsModule` already exports `VisitsService` — import `VisitsModule` into both new modules.

### 1.5 Auth / RBAC primitives (already built, reuse as-is)

- `JwtAuthGuard` (`backend/src/auth/guards/jwt-auth.guard.ts`) — attaches `request.user` (a full `User` row).
- `RolesGuard` + `@Roles(Role.DOCTOR, Role.ADMIN)` (`backend/src/auth/decorators/roles.decorator.ts`) — role-level gate.
- `@CurrentUser()` (`backend/src/auth/decorators/current-user.decorator.ts`) — injects the authenticated `User`.
- **There is no `AuthorGuard` class yet.** The docx (Section 8.2) specifies one for note mutations: *"an additional AuthorGuard verifies that the requesting user's ID matches the author_id of the note record (or the user is Admin)."* You must build this — see Section 4.4 below. Do not gate edit/publish routes with `RolesGuard` alone; `RolesGuard` cannot see `author_id`.

---

## 2. Database — No Migration Needed

Confirm before starting (do not re-run `prisma migrate`): `InitialNote` and `ProgressNote` models in `schema.prisma` already have every field the docx specifies — `status: NoteStatus` (`DRAFT`/`PUBLISHED`), `lastEditedBy`, `lastEditedAt`, `assessment: Json`, `diagnostics: Json?`, `problemListSnapshot: Json?`, `medicationSnapshot: Json?`, etc. `Visit.problemChanges` / `Visit.medicationChanges` (`Json?`) already exist for the diff summaries.

If you find a genuine gap while implementing (you should not), add a migration with `npx prisma migrate dev --name <description>` rather than editing `schema.prisma` by hand — never hand-edit `migrations/*/migration.sql`.

---

## 3. Phase 8 — Initial Note

### 3.1 Backend: `InitialNotesModule`

Replace the empty stub at `backend/src/initial-notes/initial-notes.module.ts`.

**Routes** (docx §9.3 — base path `/patients/:patientId/initial-note`, singular per the docx, even though the table is `initial_notes`):

| Method | Route | Guard | Notes |
|---|---|---|---|
| GET | `/patients/:patientId/initial-note` | `JwtAuthGuard` | All roles. Returns the note if it exists, else `404` (frontend treats 404 as "no note yet, show empty form"). **Enforce draft-visibility here** (see 3.1.1). |
| POST | `/patients/:patientId/initial-note` | `JwtAuthGuard`, `RolesGuard(DOCTOR, ADMIN)` | Creates `Visit` (`visitType: INITIAL`) + `InitialNote` atomically. One initial note per patient — if one already exists, throw `ConflictException`. |
| PATCH | `/patients/:patientId/initial-note/:id` | `JwtAuthGuard`, `AuthorGuard` | Partial update — this is the auto-save endpoint. Sets `lastEditedBy`/`lastEditedAt` only when status is already `PUBLISHED` (see 3.1.3). |
| POST | `/patients/:patientId/initial-note/:id/publish` | `JwtAuthGuard`, `AuthorGuard` | Validates required fields, sets `status: PUBLISHED`, runs problem/medication upserts inside a transaction. |

#### 3.1.1 Draft visibility rule (docx §2.5, §8.2 — critical, do not skip)

> *"Draft is not visible to Non-Author Doctors... Author and Non-Author status is per-note, not per-role."*

In the `GET` and any read path, if `note.status === 'DRAFT'` and `currentUser.role === 'DOCTOR'` and `currentUser.id !== note.authorId` and `currentUser.role !== 'ADMIN'`, return `404` (not `403` — do not reveal that a draft exists). Nurses and Admins are unaffected by this rule on read because they're not authors of clinical notes at all, but check the RBAC matrix in docx §8.1 for view rights — Nurses do **not** have Initial/Progress Note view rights per the matrix (`Create/Edit Initial Note: ✗` for Nurse, and the matrix's Notes view row should be cross-checked against the live RBAC table in the docx before exposing this to Nurse role in the controller's `@Roles` — when in doubt, default GET to all three roles per §9.3's "All roles" annotation, and rely on the draft-visibility check above for actual filtering).

#### 3.1.2 Create — DTO and transaction

`CreateInitialNoteDto` (new file `backend/src/initial-notes/dto/create-initial-note.dto.ts`) fields, all `class-validator`-decorated per docx table definitions and `design-standard.md` §11/13 conventions already used elsewhere in this repo (mirror the style of `CreateMedicationDto`/`CreateVitalsDto`):

```
chiefComplaint      string,  required, maxLength 50
hpi                  string,  required
pmhComorbidities     string?, optional
pmhSurgeries         string?, optional
pmhHospitalizations  string?, optional
allergies            string?, optional
familyHistory        string?, optional
socialHistory        string?, optional
obHistory            string?, optional
psychosocialHistory  string?, optional
physicalExam         string,  required
assessment           array,   required — array of { title: string, icdCode?: string }
mgmtNonpharm         string?, optional
diagnostics          array?,  optional — array of string tags
visitDatetime        ISO date string, required
```

`UpdateInitialNoteDto extends PartialType(CreateInitialNoteDto)` — used for auto-save PATCH. **Auto-save must accept partial/incomplete data** (e.g., empty `chiefComplaint` while the clinician is still mid-sentence) because publish-blocking validation (docx `design-standard.md` §11: *"Required fields block publishing but not auto-save as draft"*) is enforced **only** in the `publish` step, not in the PATCH/create-as-draft step. Do not put `@IsNotEmpty()` style hard requirements on the DTO used for PATCH — keep PATCH permissive and validate required-for-publish fields explicitly inside `publish()`.

Service `create()`:
```ts
async create(patientId: string, dto: CreateInitialNoteDto, userId: string) {
  const existing = await this.prisma.initialNote.findFirst({
    where: { visit: { patientId } },
  });
  if (existing) throw new ConflictException('Patient already has an Initial Note.');

  return this.prisma.$transaction(async (tx) => {
    const visit = await this.visitsService.createForNote(
      patientId, userId, VisitType.INITIAL, new Date(dto.visitDatetime),
    );
    return tx.initialNote.create({
      data: {
        visitId: visit.id,
        authorId: userId,
        chiefComplaint: dto.chiefComplaint ?? '',
        hpi: dto.hpi ?? '',
        physicalExam: dto.physicalExam ?? '',
        assessment: dto.assessment ?? [],
        // ...remaining optional fields
        status: NoteStatus.DRAFT,
      },
    });
  });
}
```

Note `visitsService.createForNote` takes `PrismaService`, not the transaction client, in its current signature — check `VisitsService` before assuming it participates in your `$transaction`. If it does not accept a tx client, either (a) extend `VisitsService.createForNote` to accept an optional `PrismaTx | PrismaService` parameter (consistent with the pattern already used in `MedicationsService`/`ProblemsService`), or (b) accept that Visit-then-Note is two sequential writes and add compensating cleanup on note-creation failure. **Prefer (a)** — it matches the established codebase pattern and keeps the operation atomic.

#### 3.1.3 Auto-save / edit-indicator behavior

Docx §11.3 + §7.3 of `design-standard.md`:
- PATCH is called every 30 seconds (frontend-driven, see §3.2.5) **and** is the same endpoint used for manual saves.
- "Edit indicator: color change + 'Last edited by X at Y' on published note edits" — meaning `lastEditedBy`/`lastEditedAt` should **only** be set on a PATCH when `note.status === 'PUBLISHED'`. Before publish, the note is just a draft being authored — there's no "edit of a published thing" to flag yet. Implement:

```ts
async update(patientId: string, id: string, dto: UpdateInitialNoteDto, userId: string) {
  const note = await this.findOrThrow(patientId, id);
  const data: Prisma.InitialNoteUpdateInput = { ...mapDtoToData(dto) };
  if (note.status === NoteStatus.PUBLISHED) {
    data.lastEditedBy = { connect: { id: userId } };
    data.lastEditedAt = new Date();
  }
  return this.prisma.initialNote.update({ where: { id }, data });
}
```

#### 3.1.4 Publish — required-field validation + cross-module upserts

```ts
async publish(patientId: string, id: string, userId: string) {
  const note = await this.findOrThrow(patientId, id);
  this.assertPublishable(note); // throws BadRequestException listing missing required fields:
                                  // chiefComplaint, hpi, physicalExam, assessment (non-empty array)

  return this.prisma.$transaction(async (tx) => {
    const published = await tx.initialNote.update({
      where: { id },
      data: { status: NoteStatus.PUBLISHED },
    });

    const assessmentTitles = (note.assessment as { title: string }[]).map(a => a.title);
    await this.problemsService.upsertFromAssessment(patientId, assessmentTitles, userId, tx);

    if (note.medicationList?.length) {
      await this.medicationsService.upsertFromNoteMedications(
        patientId, note.medicationList, userId, tx,
      );
    }

    await tx.visit.update({
      where: { id: note.visitId },
      data: { status: NoteStatus.PUBLISHED },
    });

    return published;
  });
}
```

> **Important schema note:** `InitialNote` has no dedicated `medicationList` column in `schema.prisma` — the docx's "Medication List section in Initial Note seeds global medications table" (§Phase 8) is implemented by reading medication entries the clinician adds **directly through the existing `MedicationsModule` CRUD endpoints** (`POST /patients/:patientId/medications`) during the Initial Note session, not by storing a medication array on the note row itself. Do not add a new JSONB column for this — wire the frontend `MedicationListEditor` (§3.2) to call the Medications API directly, scoped to the same patient, while the Initial Note is open. This keeps a single source of truth in the `medications` table and avoids the upsert collision the prerequisite module already guards against.

Re-check this against the live UI: the `MedicationListEditor` should behave like the existing `MedicationsScreen` component (`frontend/src/components/medications/MedicationsScreen.tsx`) but embedded inline in the note, using the same `useCreateMedication`/`useUpdateMedication`/`useDeleteMedication` hooks already in `frontend/src/hooks/useMedications.ts`. **Reuse these hooks — do not duplicate medication mutation logic inside the notes feature.**

#### 3.1.5 Module wiring

```ts
// backend/src/initial-notes/initial-notes.module.ts
@Module({
  imports: [ProblemsModule, MedicationsModule, VitalsModule, VisitsModule],
  controllers: [InitialNotesController],
  providers: [InitialNotesService],
})
export class InitialNotesModule {}
```
`ProblemsModule`, `MedicationsModule`, and `VisitsModule` already `export` their services — confirm the exports array in each before importing (`ProblemsModule` exports `ProblemsService`; `MedicationsModule` exports `MedicationsService`; `VisitsModule` exports `VisitsService`).

### 3.2 Frontend: Initial Note screen

Replace the placeholder at `frontend/src/app/dashboard/[patientId]/initial-note/page.tsx` (currently `<div>Initial Note — Phase 6</div>`).

#### 3.2.1 Components (docx §11.3) — create under `frontend/src/components/notes/`

| Component | Responsibility |
|---|---|
| `InitialNoteForm.tsx` | Master form — React Hook Form + Zod, owns all SOAP sections |
| `VitalsSummaryRow.tsx` | Read-only strip pre-filled from `useLatestVitals(patientId)` (hook already exists — `frontend/src/hooks/useVitals.ts`) |
| `CollapsibleSection.tsx` | Wrapper using shadcn `Collapsible` (already installed, pattern in `design-standard.md` §7.3) for PMH, Family Hx, Social Hx, OB Hx, Psychosocial Hx |
| `TagInputField.tsx` | Dynamic add/remove tag list — used for Assessment (`{title, icdCode?}` pairs) and Diagnostics (plain string tags) |
| `MedicationListEditor.tsx` | Thin wrapper around the existing medication hooks (see §3.1.4) — list + inline add/edit/delete, **not** a new mutation path |
| `AttachmentUploader.tsx` | File upload with tag labeling — **mock-first** per docx (§Phase 8: *"Labs/imaging upload section using AttachmentsModule (Phase 11 prerequisite — mock first)"*). Build the UI (drag/drop zone, tag input, file list with remove) against a local in-memory array; stub the actual upload call behind a function you can swap for the real `POST /attachments/upload` call once Phase 11 lands. Do not block Phase 8 completion on a working AttachmentsModule. |
| `NoteStatusBadge.tsx` | `Draft` / `Published` badge + "Last edited by X at Y" text — variants already defined in `design-standard.md` §6.3 (`draft`, `published`) |

#### 3.2.2 Form schema

`frontend/src/lib/validation/initial-note-schema.ts` (new) — Zod schema mirroring the backend DTO. Two schemas: a lenient `initialNoteDraftSchema` (everything optional, used for auto-save payloads) and a strict `initialNotePublishSchema` (chief complaint, HPI, physical exam, non-empty assessment array required) used **client-side only to enable/disable the Publish button** — the server is still the authority and re-validates in `publish()`.

#### 3.2.3 Hooks — create under `frontend/src/hooks/`

```ts
// useInitialNote.ts
export function useInitialNote(patientId: string | null) {
  return useQuery({
    queryKey: ['initial-note', patientId],
    queryFn: () => apiRequest<InitialNote>(`/patients/${patientId}/initial-note`),
    enabled: !!patientId,
    retry: false, // 404 = no note yet; don't retry-storm
  });
}

export function useCreateInitialNote(patientId: string) { /* useMutation → POST, invalidate ['initial-note', patientId] */ }
export function useUpdateInitialNote(patientId: string) { /* useMutation → PATCH */ }
export function usePublishInitialNote(patientId: string) { /* useMutation → POST .../publish, invalidate problems+medications+visits queries too */ }
```

On publish success, invalidate `['problems', patientId]`, `['medications', patientId, ...]`, `['patient', patientId]` (banner counts), and `['visits-infinite', patientId]` — the Dashboard cards and Visit History must reflect the new data without a manual refresh.

#### 3.2.4 State

- React Hook Form `useForm` with the Zod draft schema as resolver (lenient — don't block typing).
- Local `isDirty`, `isSaving`, `lastSavedAt` state for the autosave indicator described in `design-standard.md` §7.3 (`Unsaved` / `Saving…` / `Saved` badge states).
- If no note exists yet (`GET` 404), render the empty form; the **first** auto-save tick or explicit "Save Draft" action calls `POST` instead of `PATCH`, then switches the hook's mode to PATCH using the returned `id`.

#### 3.2.5 Auto-save — implement exactly per docx Appendix A

```ts
const { watch } = useForm({ resolver: zodResolver(initialNoteDraftSchema), defaultValues });
const formValues = watch();

useEffect(() => {
  const timer = setTimeout(() => {
    autoSaveMutation.mutate(formValues);
  }, 30000);
  return () => clearTimeout(timer);
}, [formValues]);
```

**Also implement the offline fallback** (Appendix A, easy to miss): *"On network failure, serialize form state to localStorage as `damayan:draft:{patientId}:{noteType}`."* Wrap the mutation's `onError` to `localStorage.setItem(`damayan:draft:${patientId}:initial`, JSON.stringify(formValues))`, and on mount, check for and offer to restore that key if it's newer than the server's `updatedAt`.

> Reminder: per the **CRITICAL BROWSER STORAGE RESTRICTION** for in-chat artifacts, `localStorage` is fine here because this is the real Next.js application running in a real browser, not a claude.ai canvas/artifact — this restriction does not apply to this codebase.

#### 3.2.6 Assessment → Problem List linkage (UI-visible contract)

The `TagInputField` used for Assessment must produce `{ title: string, icdCode?: string }[]`. On publish, this exact array shape is what `InitialNotesService.publish()` reads `title` from to call `problemsService.upsertFromAssessment`. Keep the shape stable — do not let the frontend send bare strings for assessment items, since the backend DTO expects objects.

#### 3.2.7 Role-gating in the UI

Per the RBAC matrix (`design-standard.md` §12 and docx §8.1): only `DOCTOR` (as author) and `ADMIN` can create/edit. Nurses get no edit affordances at all for this screen — if Nurse role reaches this route, render a read-summary-only or redirect, consistent with how `Sidebar.tsx`/`ProblemListScreen.tsx` already gate `canManage` via `useAuthStore().user?.role`.

---

## 4. Phase 9 — Progress Notes

### 4.1 Backend: `ProgressNotesModule`

Replace the empty stub at `backend/src/progress-notes/progress-notes.module.ts`.

**Routes** (docx §9.4 — base path `/patients/:patientId/progress-notes`, plural):

| Method | Route | Guard | Notes |
|---|---|---|---|
| GET | `/patients/:patientId/progress-notes` | `JwtAuthGuard` | List, paginated, newest first — feeds Note Timeline. Apply the same draft-visibility filter as Initial Notes (§3.1.1) per-row. |
| POST | `/patients/:patientId/progress-notes` | `JwtAuthGuard`, `RolesGuard(DOCTOR, ADMIN)` | Creates `Visit` (`visitType: PROGRESS`) + `ProgressNote` with copy-forward snapshots. **Requires an existing published Initial Note** — see 4.1.1. |
| GET | `/patients/:patientId/progress-notes/:id` | `JwtAuthGuard` | Single note; draft-visibility applies. |
| PATCH | `/patients/:patientId/progress-notes/:id` | `JwtAuthGuard`, `AuthorGuard` | Auto-save, same pattern as Initial Note. |
| POST | `/patients/:patientId/progress-notes/:id/publish` | `JwtAuthGuard`, `AuthorGuard` | Sets `PUBLISHED`, diffs problem/medication snapshot against current state, writes `visit.problemChanges`/`visit.medicationChanges`. |

#### 4.1.1 Precondition: Initial Note must exist and be published

Docx §2.4: *"first progress note problem list is based on Initial Note assessment."* Before creating a Progress Note, verify `InitialNote` exists for the patient and `status === 'PUBLISHED'`. If not, throw `BadRequestException('An Initial Note must be published before a Progress Note can be created.')`. Inject `InitialNotesService` into `ProgressNotesModule` (add it to the `imports` array, and export `InitialNotesService` from `InitialNotesModule` if not already) to perform this check — do **not** duplicate Initial Note query logic.

#### 4.1.2 Create — copy-forward transaction

This is the centerpiece of Phase 9 (docx §12.4): *"transaction: fetch current problems + medications → create Visit → create ProgressNote with snapshots."*

```ts
async create(patientId: string, dto: CreateProgressNoteDto, userId: string) {
  await this.assertInitialNotePublished(patientId);

  return this.prisma.$transaction(async (tx) => {
    const [activeProblems, activeMedications, latestVitals] = await Promise.all([
      this.problemsService.findActiveForPatient(patientId, tx),
      this.medicationsService.findActiveForPatient(patientId, tx),
      this.vitalsService.findLatestForPatient(patientId, tx),
    ]);

    // Non-pharm management copy-forward: most recent prior note (Initial or Progress), whichever is latest
    const priorMgmtNonpharm = await this.getLatestNonpharmMgmt(patientId, tx);

    const visit = await this.visitsService.createForNote(
      patientId, userId, VisitType.PROGRESS, new Date(dto.visitDatetime), tx,
    );

    return tx.progressNote.create({
      data: {
        visitId: visit.id,
        authorId: userId,
        subjective: dto.subjective ?? '',
        objective: dto.objective ?? '',
        mgmtNonpharm: dto.mgmtNonpharm ?? priorMgmtNonpharm ?? '',
        diagnostics: dto.diagnostics ?? [],
        problemListSnapshot: activeProblems,
        medicationSnapshot: activeMedications,
        status: NoteStatus.DRAFT,
      },
    });
  });
}
```

`problemListSnapshot` and `medicationSnapshot` are taken **at creation time** and stored as JSONB — this is what the frontend's editable Problem List / Medication List sections in the Progress Note form render from initially (per docx §11.4: *"editable Problem List, editable Medications"*). The clinician edits **the snapshot inside the note**, not the live `problems`/`medications` tables directly, during drafting. Live tables are only touched on publish (§4.1.3).

> If `VisitsService.createForNote` doesn't yet accept a transaction client, extend it now (see §3.1.2 note) — this is required for both phases and should be done once, shared.

#### 4.1.3 Publish — reconcile snapshot edits back into live tables + diff

On publish, the clinician may have added/removed/edited problems and medications **inside the note's snapshot**. Reconcile:

```ts
async publish(patientId: string, id: string, userId: string) {
  const note = await this.findOrThrow(patientId, id);
  this.assertPublishable(note); // subjective, objective required

  return this.prisma.$transaction(async (tx) => {
    const beforeProblems = await this.problemsService.findActiveForPatient(patientId, tx);
    const beforeMeds = await this.medicationsService.findActiveForPatient(patientId, tx);

    // Reconcile: any problem titles present in the edited snapshot but not in
    // the live active list get upserted via the same Phase-8 helper used by
    // Initial Note publish — keeps problem-creation rules (case-insensitive
    // match, RESOLVED reactivation) identical across both note types.
    const snapshotTitles = (note.problemListSnapshot as { title: string }[]).map(p => p.title);
    await this.problemsService.upsertFromAssessment(patientId, snapshotTitles, userId, tx);

    const snapshotMeds = note.medicationSnapshot as MedicationSnapshotItem[];
    await this.medicationsService.upsertFromNoteMedications(patientId, snapshotMeds, userId, tx);

    const afterProblems = await this.problemsService.findActiveForPatient(patientId, tx);
    const afterMeds = await this.medicationsService.findActiveForPatient(patientId, tx);

    const problemChanges = diffByTitle(beforeProblems, afterProblems);
    const medicationChanges = diffByNameDoseUnit(beforeMeds, afterMeds);

    await this.visitsService.updateChangeSummary(note.visitId, problemChanges, medicationChanges, tx);

    return tx.progressNote.update({
      where: { id },
      data: { status: NoteStatus.PUBLISHED },
    });
  });
}
```

Write small pure helper functions `diffByTitle` / `diffByNameDoseUnit` (co-locate in `progress-notes.service.ts` or a `progress-notes.utils.ts`) that produce a shape like `{ added: [...], removed: [...] }` — this is what `VisitHistoryCard`/`VisitRow` on the frontend will eventually render as a "changes summary" (docx §11.2: *"physician, datetime, changes, link to note"*). Keep the diff JSON shape simple and documented in a code comment, since `documents.module` (Phase 11) and the Visit History UI both read it.

> **Important:** `VisitsService.updateChangeSummary` currently does not take a transaction client either — extend its signature the same way as `createForNote` (optional `client?: PrismaTx | PrismaService = this.prisma` parameter), consistent with every other prerequisite service in this codebase.

#### 4.1.4 DTOs

`CreateProgressNoteDto`:
```
subjective     string?, optional (lenient for draft creation, required for publish)
objective      string?, optional
mgmtNonpharm   string?, optional (overrides copy-forward if provided)
diagnostics    array?, optional
visitDatetime  ISO date string, required
```
`UpdateProgressNoteDto extends PartialType(CreateProgressNoteDto)` plus allow `problemListSnapshot` / `medicationSnapshot` to be PATCHed directly (these are edited client-side as the clinician works the note, then auto-saved).

#### 4.1.5 Module wiring

```ts
// backend/src/progress-notes/progress-notes.module.ts
@Module({
  imports: [ProblemsModule, MedicationsModule, VitalsModule, VisitsModule, InitialNotesModule],
  controllers: [ProgressNotesController],
  providers: [ProgressNotesService],
})
export class ProgressNotesModule {}
```
Add `ProgressNotesModule` to `AppModule`'s imports (it's already listed in `app.module.ts` — just confirm the import path resolves once the module file is filled in).

### 4.2 Frontend: Progress Notes + Note Timeline

Replace placeholders at:
- `frontend/src/app/dashboard/[patientId]/notes/page.tsx` (currently `Note Timeline — Phase 7`)
- The `DocumentationPanel.tsx` "Progress Note Workspace" placeholder block (currently hardcoded "available in Phase 6" message) — this is the right-side panel where the active Progress Note is actually edited, per `design-standard.md` §7.5.

#### 4.2.1 Components (docx §11.4) — under `frontend/src/components/notes/`

| Component | Responsibility |
|---|---|
| `NoteTimeline.tsx` | Chronological list of `NoteCard`s — merges Initial Note (1, if published) + all Progress Notes, sorted by `visitDatetime` desc |
| `NoteCard.tsx` | Date, physician, `NoteStatusBadge`, expand/collapse, "View full note" link |
| `ProgressNoteForm.tsx` | Subjective, Objective, editable Problem List (reuse problem-editing UI patterns from `ProblemListScreen`/`ActiveProblemTable` where sensible, but scoped to the note's snapshot state, not live mutations), editable Medications (same relationship to `MedicationsScreen`), Diagnostics tags, Non-pharm Mgmt |
| `PriorLabsTable.tsx` | Grouped-by-tag attachment list with dates — **mock-first**, same caveat as `AttachmentUploader` in Phase 8, since it depends on `AttachmentsModule` (Phase 11) |

#### 4.2.2 Hooks — under `frontend/src/hooks/`

```ts
useProgressNotes(patientId)         // list query → Note Timeline
useProgressNote(noteId)             // single note query
useCopyForwardData(patientId)       // GET current active problems + medications,
                                     // used only for a *preview* before the clinician
                                     // commits to creating the note (the actual
                                     // snapshot is taken server-side in create())
useCreateProgressNote(patientId)
useUpdateProgressNote(patientId)
usePublishProgressNote(patientId)
```

`useCopyForwardData` can simply compose the existing `useProblems(patientId)` and `useMedications(patientId)` hooks filtered to active items — there's no need for a new backend endpoint; it's a read-only preview using data already fetchable.

#### 4.2.3 "+ New Note" topbar button (docx §11.4, §Phase 9)

`Topbar.tsx` currently has a non-functional `+ New Note` button (`onClick={() => {/* Phase 6+ — note creation flow */}}`). Implement the flow:
1. Requires an `activePatient` (from `usePatientStore`) — disable/hide if none selected (it's already only meaningfully clickable within a patient workspace; confirm this against current layout — the button lives in the global `Topbar`, so guard the click handler with a null check and redirect to patient selection if no active patient).
2. Check whether the active patient has a published Initial Note (`useInitialNote(patientId)`).
   - No Initial Note yet → navigate to `/dashboard/{patientId}/initial-note`.
   - Initial Note exists and is published → navigate to `/dashboard/{patientId}/notes` and trigger the "create new Progress Note" action (open the `DocumentationPanel` in create mode, or navigate with a query param the Notes page reads to auto-open the form).
3. Wire the same logic into the Note Timeline screen's own "New Progress Note" affordance, since docx specifies both entry points.

#### 4.2.4 Auto-save — identical pattern to Initial Note

Reuse the exact `useEffect` + `setTimeout(30000)` pattern from §3.2.5, parameterized by note type so the `localStorage` key becomes `damayan:draft:{patientId}:progress`. Consider extracting a shared `useAutoSave(formState, patchFn, draftKey)` hook (docx §11.3 already names this hook — `useAutoSave(formState, patchFn)` — build it once under `frontend/src/hooks/useAutoSave.ts` and use it from **both** `InitialNoteForm` and `ProgressNoteForm`, rather than duplicating the timer logic Phase 8 may have inlined).

#### 4.2.5 Visit History change-summary rendering

`VisitHistoryCard.tsx` / `VisitRow.tsx` already render `visit.problemChanges` / `visit.medicationChanges` as `unknown` in the `Visit` type (`frontend/src/types/visit.ts`). Once Phase 9's `publish()` populates real diff JSON (§4.1.3), tighten that type to match your diff shape and extend `VisitRow` to render a short "+2 problems, 1 medication changed" summary line, consistent with docx §11.2 (*"changes"* column) and §Phase 10 (*"problem_changes and medication_changes JSONB snapshot on visit save"* — Phase 10/Visit Management is itself a light wrapper around what Phase 9 already writes, so this UI piece can be built now even though Visit Management is nominally a separate phase).

---

## 5. Shared Backend Work Required by Both Phases

### 5.1 `AuthorGuard` (new)

Create `backend/src/auth/guards/author-guard.ts` (or `note-author.guard.ts`). It must:
1. Read `request.user` (set by `JwtAuthGuard`, which must run first — order guards as `@UseGuards(JwtAuthGuard, AuthorGuard)`).
2. Read the note ID from `request.params.id`.
3. Look up the note (Initial or Progress — make the guard generic via a constructor-injected "note type" or by checking the route prefix) and compare `note.authorId === user.id`.
4. Allow if `user.role === Role.ADMIN` regardless of authorship.
5. Throw `ForbiddenException` otherwise.

Because this guard needs DB access, it cannot be a pure metadata-reflecting guard like `RolesGuard` — inject `PrismaService` into it. Two reasonable implementations: a single generic guard parameterized via `@SetMetadata` for which Prisma model to check, or two near-identical guards (`InitialNoteAuthorGuard`, `ProgressNoteAuthorGuard`). Prefer the generic version to avoid duplication, following the existing `Roles`/`RolesGuard` decorator+guard pattern already in this codebase as your template.

### 5.2 Extend `VisitsService` to accept a transaction client

Both `createForNote` and `updateChangeSummary` need an optional trailing `client?: Prisma.TransactionClient | PrismaService` parameter (default `this.prisma`), matching the established pattern in `ProblemsService`/`MedicationsService`/`VitalsService`. This is a small, additive change — do not change existing call signatures' required parameters or break any current callers (there are none yet outside what you're about to add).

### 5.3 Swagger tags

`main.ts` already declares `.addTag('Initial Notes', ...)` and `.addTag('Progress Notes', ...)` — make sure your new controllers use `@ApiTags('Initial Notes')` / `@ApiTags('Progress Notes')` respectively so they group correctly in `/api` docs.

---

## 6. Verification Checklist

Work through this in order; each step assumes the previous one passed.

1. `npx prisma generate` runs clean (no schema changes expected, but confirm client is current).
2. Backend boots (`npm run start:dev`) with `InitialNotesModule` and `ProgressNotesModule` no longer empty, no DI errors in console (a circular-import between `InitialNotesModule` and `ProgressNotesModule` is possible since Progress depends on Initial — only `ProgressNotesModule` should import `InitialNotesModule`, never the reverse).
3. As a seeded Doctor (`backend/.env.example` admin credentials, or a Doctor account created via `/accounts`):
   - `POST /patients/:id/initial-note` with a minimal body succeeds, returns `DRAFT`.
   - `PATCH .../initial-note/:id` as the same Doctor succeeds; as a **different** Doctor returns `403`.
   - `GET .../initial-note` as the different Doctor returns `404` while still `DRAFT`.
   - `POST .../initial-note/:id/publish` with required fields present succeeds; the patient's `GET /patients/:id/problems` now contains the assessment titles as `ACTIVE` problems.
   - `GET .../initial-note` as the different Doctor now succeeds (note is published).
4. `POST /patients/:id/progress-notes` **before** the Initial Note is published → `400`. After publish → `201`, with `problemListSnapshot`/`medicationSnapshot` populated from current state.
5. Edit the snapshot via `PATCH`, then `publish` — confirm the live `problems`/`medications` tables reflect additions, and `GET /patients/:id/visits/:visitId` shows non-empty `problemChanges`/`medicationChanges`.
6. Frontend: `/dashboard/[patientId]/initial-note` renders the real form (not the placeholder), auto-saves silently every 30s (check Network tab for periodic PATCH), and the Dashboard's `ProblemListCard`/`MedicationListCard` update after publish without a manual page reload.
7. Frontend: `/dashboard/[patientId]/notes` renders a real timeline (not the placeholder), "+ New Note" in the Topbar correctly routes to Initial Note (if none) or opens a new Progress Note (if one exists).
8. Confirm Nurse-role accounts cannot reach create/edit affordances for either note type anywhere in the UI, and get `403` if they hit the API directly.