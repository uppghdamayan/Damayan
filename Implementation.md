# DAMAYAN — Database Index Optimization

**Repo:** `uppghdamayan/Damayan` (backend: `backend/`, NestJS + Prisma + Supabase Postgres)
**Based on:** current `main` as of this guide — `backend/prisma/schema.prisma`, migrations `20260612131311_init_full_schema` and `20260613034747_add_requires_password_change`, and the actual service files under `backend/src/**`.
**Goal:** the data in DAMAYAN is small — this isn't about shaving milliseconds off a query plan for its own sake, it's about making fetches feel instant. That means three things have to happen together: (1) close every unindexed hot-path query so Postgres never falls back to a sequential scan, (2) stop the frontend from treating every navigation as a mandatory loading state when the data is already cached, and (3) stop the Next.js route system from forcing a full-page skeleton on every single tab click regardless of cache. On top of that, adding a Problem or Medication needs an optimistic placeholder so the new item appears the instant it's submitted instead of waiting on the round trip. §1–5 cover the indexing. §6 covers the query-cache side. §7 covers the actual root cause of "every tab always loads up" — a Next.js route-level Suspense boundary that fires on every navigation independent of cache. §8 covers the add-item placeholders.

This version supersedes any earlier draft. Two corrections versus the earlier general pass:

1. **The `attachments` dual-FK bug does not exist in this codebase.** `schema.prisma` already models `Attachment` as polymorphic-by-convention (`noteType` + `noteId` plain columns, no `@relation` to `InitialNote`/`ProgressNote`), and `AttachmentsService.upload()` (`backend/src/attachments/attachments.service.ts`) already validates `noteId` exists against the correct table before insert, and also checks that `note.visit.patientId === dto.patientId`. No fix needed here — skip straight to indexing.
2. **`Problem.parentId` and `VitalSign.visitId` are not queried directly** anywhere in `backend/src/problems/problems.service.ts` or `backend/src/vitals/vitals.service.ts`. The problem tree is built in-memory from a single `WHERE patientId = ?` fetch, not per-node `WHERE parentId = ?` calls, and vitals never filters by `visitId`. Indexing those columns speculatively would just be write overhead with zero read benefit today — dropped from this guide unless that access pattern changes later.

---

## 1. What the real queries need

Grounded directly in the service files, here's what's actually unindexed or index-misaligned:

| File | Query | Current index coverage | Gap |
|---|---|---|---|
| `attachments.service.ts` → `findByNote()` | `WHERE noteType, noteId` | **none** | needs `[noteType, noteId]` |
| `attachments.service.ts` → `findByPatient()` | `WHERE patientId ORDER BY uploadedAt desc` | **none** | needs `[patientId, uploadedAt(desc)]` |
| `documents.service.ts` → `findByPatient()` | `WHERE patientId ORDER BY generatedAt desc` | **none** | needs `[patientId, generatedAt(desc)]` |
| `audit-logs.service.ts` → `findAll()` | `WHERE action?, tableName?, userId?, patientId?, createdAt range?` (any combination, offset pagination) | `[patientId, createdAt]`, `[userId, createdAt]` | needs coverage for the unscoped/action/tableName filter paths — see §2.3 |
| `medications.service.ts` → `findByPatient()` | `WHERE patientId, isActive? ORDER BY isActive desc, createdAt desc` | `[patientId, isActive]` | index doesn't cover the `createdAt` sort tiebreaker — see §2.4 |
| `problems.service.ts`, `vitals.service.ts` | `WHERE patientId ORDER BY sortOrder/measuredAt` | already covered | no change needed |

---

## 2. Schema changes

Open `backend/prisma/schema.prisma` and apply these.

### 2.1 `Attachment` — currently zero indexes, two distinct access patterns

```prisma
model Attachment {
  // ...existing fields...

  @@index([noteType, noteId])              // AttachmentsService.findByNote()
  @@index([patientId, uploadedAt(sort: Desc)]) // AttachmentsService.findByPatient()
  @@map("attachments")
}
```

### 2.2 `Document` — `findByPatient()` sorts by `generatedAt`, no index exists

```prisma
model Document {
  // ...existing fields...

  @@index([patientId, generatedAt(sort: Desc)])  // DocumentsService.findByPatient()
  @@map("documents")
}
```

`visitId` is read via `findUnique({ where: { id: visitId } })` in `generate()` (charge slip path) — that's a PK lookup on `Visit`, already covered, no separate index needed on `documents.visit_id` for current code.

### 2.3 `AuditLog` — the admin query filters on almost anything, independently

`QueryAuditLogsDto` (`backend/src/audit-logs/dto/query-audit-logs.dto.ts`) allows `userId`, `patientId`, `action`, `tableName`, and a `from`/`to` date range — all optional and independently combinable, confirmed in `AuditLogsService.findAll()`. This means the admin page can legitimately query by `action` alone, `tableName` alone, or nothing but a date range, none of which the existing two composite indexes cover.

```prisma
model AuditLog {
  // ...existing fields...

  @@index([patientId, createdAt(sort: Desc)])  // existing — keep
  @@index([userId, createdAt(sort: Desc)])     // existing — keep
  @@index([action, createdAt(sort: Desc)])     // NEW — action filter without patient/user
  @@index([tableName, createdAt(sort: Desc)])  // NEW — tableName filter without patient/user
  @@index([createdAt(sort: Desc)])             // NEW — date-range-only browsing
  @@map("audit_logs")
}
```

Note: `findAll()` always adds `action: { not: 'DRAFT' }` as a baseline filter even when no `action` param is passed — this is a negative filter (`!=`) which indexes handle poorly regardless (Postgres will still need to scan every non-DRAFT row matching other conditions). The `[action, createdAt]` index still helps once a *specific* action is selected in the UI; it won't help the default "all actions except DRAFT" case. If that default view becomes a bottleneck, consider excluding DRAFT at write time into a separate table, or accept the `[createdAt]` fallback index for that case.

Also worth flagging separately from indexing: `findAll()` uses `skip`/`take` offset pagination (`backend/src/audit-logs/audit-logs.service.ts` lines with `skip = (page - 1) * limit`). Offset pagination gets progressively slower on later pages regardless of indexing, because Postgres still has to walk and discard `skip` rows before returning results. Not something to fix in this pass, but worth knowing if page 40+ of the audit log ever feels slow even after these indexes land — that's a pagination-strategy problem (cursor-based), not an index problem.

### 2.4 `Medication` — sort order isn't fully covered by the existing index

`findByPatient()` in `medications.service.ts` does:

```typescript
orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
```

The existing `@@index([patientId, isActive])` covers the `WHERE patientId, isActive` filter but Postgres still has to sort the matched rows by `createdAt` separately since it's not part of the index. Extend it:

```prisma
model Medication {
  // ...existing fields...

  @@index([patientId, isActive, createdAt(sort: Desc)])  // replaces [patientId, isActive]
  @@map("medications")
}
```

This new composite index still serves the plain `WHERE patientId, isActive` case (leading columns), so you can safely replace rather than add alongside.

### 2.5 What NOT to add right now

- `Problem.parentId` — not queried directly (tree built in-memory from one `patientId` fetch). Skip.
- `VitalSign.visitId` — not queried directly anywhere in `vitals.service.ts`. Skip.
- `InitialNote.authorId`, `ProgressNote.authorId`, `Problem.addedBy`/`updatedBy`, `Medication.addedBy`/`updatedBy` — none of these appear as a `WHERE` filter in the current services; they're only ever included/selected via relation. Skip until a "notes by this author" or similar direct-filter feature exists.

---

## 3. Generate and apply the migration

```bash
cd backend
npx prisma migrate dev --name add_missing_query_indexes
```

Review the generated SQL in `backend/prisma/migrations/<timestamp>_add_missing_query_indexes/migration.sql` — it should contain only `CREATE INDEX` statements (plus one `DROP INDEX` for the `medications_patient_id_is_active_idx` being replaced in §2.4). Confirm no unrelated `ALTER TABLE` shows up before applying.

For Supabase production, don't run `migrate dev` directly against it:

```bash
npx prisma migrate deploy
```

If any of these tables already carry meaningful row counts in production (most likely for `audit_logs`, given it's write-heavy via the interceptor), a plain `CREATE INDEX` takes a table lock for its duration. Edit the migration SQL to use `CONCURRENTLY` if that's a concern:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);
```

`CONCURRENTLY` can't run inside a transaction, so `prisma migrate deploy` (which wraps migrations transactionally) won't apply it correctly — run that specific statement via `psql` or the Supabase SQL editor directly instead, and mark the migration as applied afterward with `npx prisma migrate resolve --applied <migration_name>`.

---

## 4. Verify with `EXPLAIN ANALYZE`

Run these against Supabase (SQL editor or `psql`) with real UUIDs from your data, before and after applying, ideally on a staging branch first.

```sql
-- Attachments by note (AttachmentsService.findByNote)
EXPLAIN ANALYZE
SELECT * FROM attachments
WHERE note_type = 'INITIAL_NOTE' AND note_id = '<uuid>'
ORDER BY uploaded_at ASC;

-- Attachments by patient (AttachmentsService.findByPatient)
EXPLAIN ANALYZE
SELECT * FROM attachments
WHERE patient_id = '<uuid>'
ORDER BY uploaded_at DESC;

-- Documents by patient (DocumentsService.findByPatient)
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE patient_id = '<uuid>'
ORDER BY generated_at DESC;

-- Audit logs filtered by action only, no patient/user (AuditLogsService.findAll)
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE action = 'UPDATE' AND action != 'DRAFT'
ORDER BY created_at DESC
LIMIT 50;

-- Medications by patient, active-first then newest (MedicationsService.findByPatient)
EXPLAIN ANALYZE
SELECT * FROM medications
WHERE patient_id = '<uuid>' AND is_active = true
ORDER BY is_active DESC, created_at DESC;
```

You're looking for `Index Scan` (or `Index Only Scan`) in the plan, not `Seq Scan`. On small tables (a few hundred rows) Postgres may still choose a sequential scan even with the index present — that's the planner correctly deciding the index isn't worth it yet, not a failure. Re-check once tables have realistic production volume.

---

## 6. The index alone won't make it *feel* instant — the frontend caching layer has to stop forcing a loading state too

The indexes in §2 fix the actual query cost — on a dataset this size, once they're in place, the database round-trip for any of these lookups drops to low single-digit milliseconds. But "instant" is a perceived-latency problem, not just a query-plan problem, and right now the frontend throws away that speed by treating every navigation as a **mandatory** full loading state, even when the data either hasn't changed or was already fetched seconds ago.

Concretely, checked against `frontend/src/hooks/*.ts`:

| Hook | Has `staleTime`/`gcTime` tuned | Has `placeholderData: keepPreviousData` | Effect |
|---|---|---|---|
| `usePatients.ts` | yes (30s / 5min) | **yes** | sidebar search doesn't blank while typing |
| `useVisits.ts` | yes (30s / 3min) | **yes** | expanding visit list (5→20) doesn't flash |
| `useAttachmentsByNote` / `usePriorLabs` (`useAttachments.ts`) | **no** — falls back to the 20s/10min global default | **no** | switching notes/tabs always shows `LabResultsSectionSkeleton`, even for a note you already viewed this session |
| `useDocuments` (`useDocuments.ts`) | **no** | **no** | opening the Documents tab always shows three `CardSkeleton`s, even if you were just there |
| `useAuditLogs` (`useAuditLogs.ts`) | yes (30s) | **no** | changing a filter or page always blanks the table while the new page loads, because `filters` is part of the query key and each new filter combination looks like a brand-new, never-fetched query |

The pattern already exists correctly in `usePatients.ts` and `useVisits.ts` — `placeholderData: keepPreviousData` tells TanStack Query to keep rendering the last successful result while a new query key resolves in the background, instead of dropping straight to `isLoading: true` and swapping in a skeleton. The other three hooks just never got the same treatment. This is the actual fix for "loading is mandatory" — it makes the loading state conditional on *actually not having anything to show yet*, which after the first visit in a session is rarely true for data this size.

### 6.1 `useAttachments.ts` — apply the same pattern as `useVisits.ts`

```typescript
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export function useAttachmentsByNote(noteType: 'INITIAL_NOTE' | 'PROGRESS_NOTE', noteId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', noteType, noteId],
    queryFn: () => apiRequest<any[]>(`/attachments?noteType=${noteType}&noteId=${noteId}`),
    enabled: !!noteId,
    staleTime: 1000 * 20,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData, // keep showing the previous note's attachments while the new noteId resolves
  });
}

export function usePriorLabs(patientId: string) {
  return useQuery({
    queryKey: ['attachments', 'patient', patientId],
    queryFn: () => apiRequest<any[]>(`/attachments?patientId=${patientId}`),
    enabled: !!patientId,
    staleTime: 1000 * 20,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
```

One thing to watch: `placeholderData: keepPreviousData` on `useAttachmentsByNote` means that for a fraction of a second after switching notes, the UI can show the *previous* note's attachments labeled under the new note's context before the real data swaps in. For most UIs this tradeoff is worth it (no flash beats a technically-more-correct blank state), but since this is clinical attachment/lab data, pair it with an `isFetching` indicator (not `isLoading`) so the person can tell a refresh is in flight even though old data is still on screen:

```typescript
const { data: attachments, isLoading, isFetching } = useAttachmentsByNote(noteType, noteId);
// isLoading: true only on a genuinely first, uncached fetch — show the skeleton
// isFetching && !isLoading: true while placeholder data is showing and the real fetch is in flight — show a subtle inline indicator instead of a full skeleton
```

### 6.2 `useDocuments.ts` — same treatment

```typescript
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export function useDocuments(patientId: string) {
  return useQuery({
    queryKey: ['documents', patientId],
    queryFn: () => apiRequest<any[]>(`/patients/${patientId}/documents`),
    enabled: !!patientId,
    staleTime: 1000 * 20,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
```

### 6.3 `useAuditLogs.ts` — needed most here, since filters/page are part of the query key

Every filter change or page click currently produces a brand-new query key with no cached entry, so `isLoading` goes true and the table blanks. Add `keepPreviousData` so the previous page's rows stay visible while the next page loads:

```typescript
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return apiRequest<AuditLogsResponse>(`/audit-logs?${params.toString()}`);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData, // keep current page/filter results visible while the next combination loads
  });
}
```

### 6.4 Component-side: gate the skeleton on `isLoading`, not `isFetching`

Confirmed `AttachmentsSection.tsx` and `DocumentsScreen.tsx` already do this correctly (`if (isLoading && noteId) return <LabResultsSectionSkeleton />`) — `isLoading` is only `true` when there is no data at all yet, whereas `isFetching` is `true` on every background refetch too, including the silent ones. Don't change this gating; just confirm any new loading UI you add elsewhere follows the same rule (`isLoading` for skeletons, `isFetching` for inline "refreshing…" hints). Once §6.1–6.3 land, `isLoading` will only be `true` on a person's genuinely first visit to a given note/patient/filter combination in that session — everything after that is served from cache instantly while any actual staleness is fetched quietly in the background.

### 6.5 Optional stretch: prefetch on tab hover

`ScreenNav.tsx` renders the tab list (Vitals, Documents, Problem List, etc.) with plain `Link`s. Since the indexed queries will be cheap, you can prefetch a tab's data on hover so that by the time the click registers and the route changes, the query is already resolved and `isLoading` never fires at all:

```typescript
import { useQueryClient } from '@tanstack/react-query';

// inside ScreenNav, per-tab:
const queryClient = useQueryClient();

const prefetchHandlers: Record<string, () => void> = {
  documents: () => queryClient.prefetchQuery({
    queryKey: ['documents', patientId],
    queryFn: () => apiRequest<any[]>(`/patients/${patientId}/documents`),
  }),
  // add one per tab whose data is cheap to prefetch
};

// on the <Link>:
<Link href={...} onMouseEnter={() => prefetchHandlers[tab.id]?.()}>
```

This is genuinely optional — §6.1–6.3 already remove the *mandatory* loading state for repeat visits within a session. Prefetch-on-hover additionally removes it for the *first* visit to a tab, at the cost of firing more requests than the person may end up using. Given the dataset size here, that tradeoff is cheap; add it only if first-visit latency still feels noticeable after the indexes and `keepPreviousData` changes land.

---

## 7. Why every tab still "loads up" even after §6 — the route-level `loading.tsx` files

§6 fixes the client-side query cache, but there's a second, independent cause behind "every time I open Vital Signs / Problem List / etc. it always loads." Every tab is its own Next.js App Router route segment, and every one of them ships its own `loading.tsx`:

```
[patientId]/loading.tsx           → TabContentSkeleton   (Dashboard)
[patientId]/vitals/loading.tsx    → TabContentSkeleton
[patientId]/notes/loading.tsx     → NoteTimelineSkeleton
[patientId]/initial-note/loading.tsx → NoteFormSkeleton
[patientId]/problems/loading.tsx  → ProblemListSkeleton
[patientId]/medications/loading.tsx → MedicationListSkeleton
[patientId]/documents/loading.tsx → TabContentSkeleton
```

In the App Router, a route segment's `loading.tsx` wraps that segment in a `<Suspense>` boundary that Next.js re-triggers **on every navigation to that segment** — this is independent of whether the underlying page needs to fetch anything. All eight tab pages (`vitals/page.tsx`, `problems/page.tsx`, etc.) are `'use client'` components that render a screen component (`VitalsScreen`, `ProblemListScreen`, …) which fetches its own data via TanStack Query. There's no server-side data fetching in these routes to justify a Suspense fallback — but Next shows the `loading.tsx` fallback anyway, purely because it's a route transition, every single time, even though `ScreenNav.tsx`'s tabs already use `prefetch={true}` and the destination JS is already loaded.

The result: even with a fully warmed TanStack Query cache (after §6), clicking between tabs still flashes the *route-level* skeleton (`ProblemListSkeleton`, `TabContentSkeleton`, etc.) on every click, layered on top of — and independent from — whatever the component's own `isLoading` state would show. This is the actual mechanism behind "always loads up."

### 7.1 Fix — remove the per-tab `loading.tsx` files

Since none of these routes do server-side data fetching (everything happens client-side via the hooks from §6), the route-level Suspense boundary isn't buying anything except a guaranteed flash on every navigation. Delete these seven files:

```bash
rm "frontend/src/app/dashboard/[patientId]/loading.tsx"
rm "frontend/src/app/dashboard/[patientId]/vitals/loading.tsx"
rm "frontend/src/app/dashboard/[patientId]/notes/loading.tsx"
rm "frontend/src/app/dashboard/[patientId]/initial-note/loading.tsx"
rm "frontend/src/app/dashboard/[patientId]/problems/loading.tsx"
rm "frontend/src/app/dashboard/[patientId]/medications/loading.tsx"
rm "frontend/src/app/dashboard/[patientId]/documents/loading.tsx"
```

With these gone, navigating to a tab just swaps in the client component directly. The skeleton logic already inside each screen component (`if (isLoading) return <ProblemListSkeleton />;` in `ProblemListScreen.tsx`, same pattern in `MedicationsScreen.tsx`, `VitalsScreen.tsx`, etc.) takes over completely — and per §6, `isLoading` will only be `true` on a genuinely first, uncached visit. Every repeat visit within a session renders instantly with no skeleton at all, because there's no longer a route-level Suspense boundary forcing one regardless of cache state.

### 7.2 The tradeoff, and when to keep a `loading.tsx`

Removing `loading.tsx` means there's no fallback while Next.js loads the route's JS chunk, if it somehow wasn't prefetched (e.g. a person pastes a tab URL directly instead of clicking through `ScreenNav`). In this app that's a non-issue in practice — the tabs are always reached by clicking through `ScreenNav`, which already prefetches on render (`prefetch={true}` is Next's default-on behavior for in-viewport links, and it's set explicitly here too) — so the chunk is essentially always already cached by the time someone clicks. If you ever add a tab that *does* need real server-side data fetching in the route itself (not client-side via a hook), keep a `loading.tsx` for that one specific route — the fix here is "don't use route Suspense for client-only screens," not "never use `loading.tsx` at all."

---

## 8. Optimistic placeholders for adding a Problem or Medication

Confirmed in `useProblems.ts` and `useMedications.ts`: `useUpdateProblem`, `useReorderProblems`, and `useUpdateMedication` all already do optimistic updates correctly — each has an `onMutate` that writes the change into the TanStack Query cache immediately, with `onError` rolling back to the previous snapshot. `useCreateProblem` and `useCreateMedication` are the two exceptions — both only have `onSuccess: () => invalidate(...)`, so after submitting the "Add Problem" or "Add Medication" form, nothing appears in `ActiveProblemTable` / `MedicationListCard` until the full request round-trip finishes and the list refetches. That gap is what needs a placeholder.

### 8.1 `useCreateProblem` — insert an optimistic row, then reconcile

```typescript
export function useCreateProblem(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProblemInput) =>
      apiRequest<Problem>(`/patients/${patientId}/problems`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['problems', patientId] });
      const previous = qc.getQueryData<ProblemsResponse>(['problems', patientId]);

      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      const optimisticProblem: Problem = {
        id: optimisticId,
        patientId,
        parentId: input.parentId ?? null,
        title: input.title,
        icdCode: input.icdCode ?? null,
        status: 'ACTIVE',
        sortOrder: (previous?.data.length ?? 0) + 1,
        addedBy: null,
        diagnosisDate: input.diagnosisDate ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (previous) {
        qc.setQueryData<ProblemsResponse>(['problems', patientId], {
          data: [...previous.data, optimisticProblem],
        });
      }

      return { previous, optimisticId };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(['problems', patientId], context.previous);
    },
    onSuccess: () => invalidateProblems(qc, patientId),
  });
}
```

`crypto.randomUUID()` is available in all modern browsers without a polyfill — no new dependency needed.

### 8.2 `useCreateMedication` — same pattern

```typescript
export function useCreateMedication(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMedicationInput) =>
      apiRequest<Medication>(`/patients/${patientId}/medications`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['medications', patientId, false] });
      await qc.cancelQueries({ queryKey: ['medications', patientId, true] });

      const previousFalse = qc.getQueryData<MedicationsResponse>(['medications', patientId, false]);
      const previousTrue = qc.getQueryData<MedicationsResponse>(['medications', patientId, true]);

      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      const optimisticMedication: Medication = {
        id: optimisticId,
        patientId,
        name: input.name,
        dose: input.dose,
        formulation: input.formulation ?? null,
        instructions: input.instructions ?? null,
        quantity: input.quantity ?? null,
        isActive: true,
        addedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: null,
      };

      if (previousFalse) {
        qc.setQueryData<MedicationsResponse>(['medications', patientId, false], {
          ...previousFalse,
          data: [...previousFalse.data, optimisticMedication],
        });
      }
      if (previousTrue) {
        qc.setQueryData<MedicationsResponse>(['medications', patientId, true], {
          ...previousTrue,
          data: [...previousTrue.data, optimisticMedication],
        });
      }

      return { previousFalse, previousTrue, optimisticId };
    },
    onError: (_err, _input, context) => {
      if (context?.previousFalse) qc.setQueryData(['medications', patientId, false], context.previousFalse);
      if (context?.previousTrue) qc.setQueryData(['medications', patientId, true], context.previousTrue);
    },
    onSuccess: () => invalidateMedications(qc, patientId),
  });
}
```

### 8.3 Style the optimistic row as a placeholder, not a normal row

The `id` prefix (`optimistic-…`) is the marker the UI uses to render the row differently while the real request is in flight — reduced opacity plus a small spinner, similar to how `saving={createProblem.isPending}` already disables the modal's submit button. In `ActiveProblemTable.tsx` (and the equivalent in `MedicationListCard.tsx`), wherever the row is rendered:

```typescript
const isOptimistic = problem.id.startsWith('optimistic-');

<tr className={cn('...', isOptimistic && 'opacity-50 pointer-events-none')}>
  {/* existing row content */}
  {isOptimistic && <Spinner className="w-3 h-3 ml-2 inline" />}
</tr>
```

`pointer-events-none` prevents the person from clicking edit/delete on a row that doesn't have a real database `id` yet. Once the real request resolves, `onSuccess` invalidates the query, the refetch replaces the optimistic row with the real one (real `id`, no `optimistic-` prefix), and the placeholder styling disappears automatically — no manual cleanup needed since the whole row is just cache data.

### 8.4 Why `onSuccess` here instead of `onSettled`

Section 6's optimistic examples for `useUpdateProblem`/`useUpdateMedication` reconcile in `onSettled` (runs on both success and error), which is correct there because the optimistic *edit* already looks like a real row — there's nothing further to distinguish. For *creates*, use `onSuccess` only: if the request fails, `onError`'s rollback already removes the optimistic row from the cache by restoring the previous snapshot, so there's nothing left to invalidate — calling `invalidateProblems`/`invalidateMedications` again in that case is a wasted refetch.

---

## 9. Checklist

**Backend / database (makes the query itself fast):**
- [ ] Confirm the `Attachment` model still has no dual-FK to `initial_notes`/`progress_notes` (it doesn't as of this guide — just re-verify nothing changed)
- [ ] Add `@@index([noteType, noteId])` and `@@index([patientId, uploadedAt(sort: Desc)])` to `Attachment`
- [ ] Add `@@index([patientId, generatedAt(sort: Desc)])` to `Document`
- [ ] Add `@@index([action, createdAt(sort: Desc)])`, `@@index([tableName, createdAt(sort: Desc)])`, `@@index([createdAt(sort: Desc)])` to `AuditLog`
- [ ] Replace `Medication`'s `@@index([patientId, isActive])` with `@@index([patientId, isActive, createdAt(sort: Desc)])`
- [ ] Do **not** add indexes on `Problem.parentId` or `VitalSign.visitId` — not queried directly in current code
- [ ] `npx prisma migrate dev --name add_missing_query_indexes` locally, review SQL diff
- [ ] `npx prisma migrate deploy` to Supabase (or manual `CONCURRENTLY` + `migrate resolve` if tables have real traffic)
- [ ] Run the five `EXPLAIN ANALYZE` queries above, confirm `Index Scan`
- [ ] Separately note (not fixed in this pass): `AuditLogsService.findAll()` uses offset pagination, which will still degrade on deep pages regardless of indexing — a future cursor-pagination pass would need `(createdAt, id)` as a compound cursor key

**Frontend / caching (makes the fast query actually *feel* instant instead of showing a mandatory loading state every time):**
- [ ] Add `staleTime`, `gcTime`, and `placeholderData: keepPreviousData` to `useAttachmentsByNote` and `usePriorLabs` in `useAttachments.ts`
- [ ] Add the same to `useDocuments` in `useDocuments.ts`
- [ ] Add `placeholderData: keepPreviousData` to `useAuditLogs` in `useAuditLogs.ts` so filter/page changes don't blank the table
- [ ] Leave `AttachmentsSection.tsx` / `DocumentsScreen.tsx` skeleton gating as-is (`isLoading`, not `isFetching`) — it's already correct, it just had nothing to work with before
- [ ] If a component adds a new loading indicator, gate the full skeleton on `isLoading` and any background-refresh hint on `isFetching && !isLoading`
- [ ] Optional: prefetch tab data on `ScreenNav` hover once the above lands, if first-visit latency is still noticeable

**Route-level loading (the actual "always loads up on every tab" fix):**
- [ ] Delete the seven per-tab `loading.tsx` files (`[patientId]/loading.tsx`, `vitals/`, `notes/`, `initial-note/`, `problems/`, `medications/`, `documents/`) — none of these routes do server-side data fetching, so the route-level Suspense boundary was just guaranteeing a flash on every navigation regardless of client cache
- [ ] Confirm each screen component's own `isLoading`-gated skeleton still works standalone (`ProblemListScreen.tsx`, `MedicationsScreen.tsx`, `VitalsScreen.tsx`, etc. — no changes needed there, they already gate correctly)
- [ ] Keep `ScreenNav.tsx`'s `prefetch={true}` on tab links as-is — it's what makes removing `loading.tsx` safe

**Optimistic placeholders for adding Problems/Medications:**
- [ ] Add `onMutate` to `useCreateProblem` in `useProblems.ts` inserting an optimistic row with an `optimistic-` prefixed id
- [ ] Add `onMutate` to `useCreateMedication` in `useMedications.ts`, same pattern across both the `includeInactive: false` and `true` cache entries
- [ ] Style rows with `id.startsWith('optimistic-')` as pending (reduced opacity, spinner, `pointer-events-none`) in `ActiveProblemTable.tsx` and `MedicationListCard.tsx`
- [ ] Reconcile in `onSuccess` (not `onSettled`) for creates, since `onError`'s rollback already handles the failure case without needing a wasted refetch