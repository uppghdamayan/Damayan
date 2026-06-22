# FIX: Note Timeline must use the persistent right-hand Documentation Panel (per wireframe3.html)

## Audience
This file is written for a coding agent (e.g. Claude Code) to execute directly. Do not ask the human
for clarification on anything covered below — the spec is complete. If you discover a contradiction
with the live codebase that this document does not address, stop and report it instead of guessing.

## Context — what's broken right now

Open `/dashboard/[patientId]/notes`. Today the page looks like this:

```
┌─────────────┬──────────────────────────────────────────┬───────────────────────┐
│  Sidebar    │  TIMELINE  +  PROGRESS NOTE FORM          │  DocumentationPanel   │
│             │  (both rendered inline in notes/page.tsx) │  (dead placeholder)   │
└─────────────┴──────────────────────────────────────────┴───────────────────────┘
```

Two things are wrong:

1. **`ProgressNoteForm` is rendered inline inside `notes/page.tsx`**, next to the timeline, in the
   *middle column*. It is not using the app's global right-hand `DocumentationPanel`.
2. **`DocumentationPanel.tsx` is a static, non-functional placeholder.** It always renders the same
   hardcoded text — "Progress Note Workspace... Form is rendered in the Notes tab. (Global panel
   integration pending context provider)" — regardless of what's selected. It has no knowledge of
   `patientId` or the selected note.

The net effect (visible in the bug screenshot): the timeline card and the note-editing UI both end up
crammed into the main content column, and the actual right-hand documentation panel sits empty/inert
beside them. This does **not** match `wireframe3.html`, which has exactly ONE right-hand panel
(`#documentation-panel`) that is global, persistent across screens, and is where ALL note editing
(Initial Note workspace fields AND Progress Note fields) happens. The Note Timeline (`#screen-note-timeline`
in the wireframe) is a **read-only list of past notes** — clicking an entry expands an inline
read-only preview *within the timeline card itself* (see `.nt-dropdown` in wireframe3.html). The
wireframe never puts an editable form next to or inside the timeline. New/active note editing always
happens in `#documentation-panel` on the right.

## Target architecture (must match wireframe3.html intent)

```
┌─────────────┬──────────────────────────┬───────────────────────────────┐
│  Sidebar    │  Note Timeline           │  Documentation Panel (global) │
│             │  (read-only list;        │  - shows the ACTIVE note      │
│             │   click entry = inline   │    (new draft OR an existing  │
│             │   read-only preview,     │    draft being edited)        │
│             │   NOT an editable form)  │  - Subjective / Objective /   │
│             │                          │    Problem snapshot / Med     │
│             │                          │    snapshot / Diagnostics /   │
│             │                          │    Save / Publish             │
└─────────────┴──────────────────────────┴───────────────────────────────┘
```

- The Note Timeline column only ever shows a list + (optionally) a read-only expanded preview of a
  past note when a timeline row is clicked, matching `.nt-entry` / `.nt-dropdown` behavior in
  `wireframe3.html`.
- The "+ New Note" action (whether triggered from the Topbar's "+ New Note" button or from the
  Timeline's own "+ New Note" button) opens the **same global `DocumentationPanel`** on the right,
  pre-populated with copy-forward data for a brand-new Progress Note draft.
- Clicking an existing **draft** note in the timeline also opens it for editing in the same
  `DocumentationPanel` (not inline, not in a separate column).
- Clicking an existing **published** note in the timeline shows its read-only content inline in the
  timeline (current `NoteCard` expand behavior is fine for this — published notes are NOT edited in
  the panel).

## Root cause

There is no shared state connecting "which note is being actively edited" between:
- the Topbar's "+ New Note" button (`frontend/src/components/layout/Topbar.tsx`),
- the Note Timeline's own "+ New Note" button and row clicks (`frontend/src/components/notes/NoteTimeline.tsx`),
- and the global `DocumentationPanel` (`frontend/src/components/layout/DocumentationPanel.tsx`).

`notes/page.tsx` currently owns this state locally (`selectedNoteId`) and renders `ProgressNoteForm`
itself, completely bypassing `DocumentationPanel`. That's the bug.

## Fix plan

### Step 1 — Add active-note state to a store the DocumentationPanel can read

Edit `frontend/src/stores/uiStore.ts`. Add state for which note is actively being edited in the panel:

```ts
interface ActiveNoteEditorState {
  patientId: string | null;
  noteId: string | null;       // null = new note, set = editing existing draft
  mode: 'new' | 'edit' | null; // null = panel idle / nothing being edited
}
```

Add to the `UiState` interface and the store implementation:

```ts
activeNoteEditor: ActiveNoteEditorState;
openNewProgressNote: (patientId: string) => void;
openExistingProgressNote: (patientId: string, noteId: string) => void;
closeNoteEditor: () => void;
```

Implementation notes:
- `openNewProgressNote(patientId)` sets `activeNoteEditor = { patientId, noteId: null, mode: 'new' }`
  AND sets `documentationPanelOpen = true`.
- `openExistingProgressNote(patientId, noteId)` sets
  `activeNoteEditor = { patientId, noteId, mode: 'edit' }` AND sets `documentationPanelOpen = true`.
- `closeNoteEditor()` sets `activeNoteEditor = { patientId: null, noteId: null, mode: null }`. Do NOT
  force `documentationPanelOpen` to false here — closing the editor and collapsing the panel are
  separate concerns; let the existing panel-toggle button control visibility.
- Do **not** persist `activeNoteEditor` to localStorage (don't add it to the existing `partialize`
  for this store) — it's session/navigation state, not a UI preference.

### Step 2 — Rewrite `DocumentationPanel.tsx` to be the real Progress Note workspace

Replace the placeholder body in `frontend/src/components/layout/DocumentationPanel.tsx` with the
actual editing UI, reusing the existing `ProgressNoteForm` component
(`frontend/src/components/notes/ProgressNoteForm.tsx`) rather than rewriting form logic from scratch.

Required behavior:

- Read `activeNoteEditor` from `useUiStore()`.
- **If `activeNoteEditor.mode` is `null`:** render the current idle placeholder (the existing
  "Progress Note Workspace" icon + copy), but make the copy generic and accurate — it should say
  something like "Select a note from the timeline, or start a new note, to begin documenting." Do NOT
  claim a context-provider limitation; once this fix lands there is no such limitation.
- **If `activeNoteEditor.mode` is `'new'` or `'edit'`:** render
  `<ProgressNoteForm patientId={activeNoteEditor.patientId!} noteId={activeNoteEditor.noteId ?? undefined} onClose={() => closeNoteEditor()} />`
  inside the panel body, replacing the placeholder. Remove the hardcoded header badges ("Saved",
  "Draft") from `DocumentationPanel`'s own header — `ProgressNoteForm` already renders its own header
  with live status; don't duplicate or shadow it. Keep the panel's pen icon are fine to leave for the
  idle state's header, but when a note is active just let `ProgressNoteForm`'s own internal header
  render (you may need to pass a prop to `ProgressNoteForm` to suppress its sticky top header
  duplication if it conflicts visually with the panel chrome — check render output and remove
  whichever header is redundant so there is exactly one header row).
- The panel must continue to support resize and collapse exactly as it does today — do not touch the
  resize handle or width logic, only the body content.

### Step 3 — Make `ProgressNoteForm` callable standalone (already true — verify only)

`frontend/src/components/notes/ProgressNoteForm.tsx` already accepts `patientId`, optional `noteId`,
and `onClose`. Confirm it has no dependency on being a sibling of `NoteTimeline` (e.g. no assumption
about parent flex layout, no shared local state lifted from `notes/page.tsx`). If you find any, lift
that state into the component itself or into `useProgressNotes.ts` hooks — it must be fully
self-contained when rendered from `DocumentationPanel`.

### Step 4 — Strip the inline form out of the Notes page; Timeline becomes read-only-first

Rewrite `frontend/src/app/dashboard/[patientId]/notes/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { NoteTimeline } from '@/components/notes/NoteTimeline';

export default function NotesPage() {
  const params = useParams();
  const patientId = params.patientId as string;

  return (
    <div className="flex h-full bg-bg overflow-hidden">
      <NoteTimeline patientId={patientId} />
    </div>
  );
}
```

- Remove the `selectedNoteId` state and the `<ProgressNoteForm>` render entirely from this file.
  The timeline no longer takes an `onSelectNote` callback prop for opening an editor in-column.
- The timeline itself should now span the available width of the middle column (it can drop its fixed
  `w-[var(--timeline-w)]` constraint here since it's no longer sharing the column with a form — but
  see Step 5; the wireframe's `#screen-note-timeline` shows the timeline as a single full-width card,
  so prefer `w-full` over a fixed narrow rail in this standalone context).

### Step 5 — Rewire `NoteTimeline.tsx` to drive the global panel, not local state

Edit `frontend/src/components/notes/NoteTimeline.tsx`:

- Drop the `onSelectNote` prop entirely.
- Import `useUiStore` and use `openNewProgressNote` / `openExistingProgressNote` / `closeNoteEditor`.
- The "+ New Note" button's `onClick` (currently `handleNewNote`) keeps its existing guard logic
  (if no published Initial Note exists, `router.push` to `/initial-note` instead) but for the
  progress-note branch, call `openNewProgressNote(patientId)` instead of `onSelectNote('new')`.
- Each `<NoteCard>`'s `onClickEdit` currently does one of:
  - `router.push(.../initial-note)` for the Initial Note card — **keep this unchanged**.
  - `onSelectNote(note.id)` for a Progress Note card — **change this to**
    `openExistingProgressNote(patientId, note.id)`.
- Add a lightweight visual indicator on whichever timeline row corresponds to
  `activeNoteEditor.noteId` (when `activeNoteEditor.patientId === patientId`) so the person can see
  which note is currently open in the right panel — reuse the existing `.selected` / `border-accent`
  treatment pattern already used elsewhere in this codebase (see `.nt-entry.selected` in
  `wireframe3.html` and the `isActive` styling pattern in `Sidebar.tsx` for reference), applied to the
  matching `NoteCard`'s wrapper `div`.
- Do not change `NoteCard.tsx` itself in this step unless the "open in panel" affordance requires a
  prop you don't already have (e.g. an `isActive` boolean) — if so, add that one prop, nothing more.

### Step 6 — Sanity-check the Topbar's "+ New Note" entrypoint

`frontend/src/components/layout/Topbar.tsx` currently does:
```ts
router.push(`/dashboard/${activePatient.id}/notes`);
```
This is fine to leave as-is (it's reasonable for "+ New Note" to land you on the Notes/Timeline
screen first), **but** after this fix the person still has to click the Timeline's own "+ New Note"
button to actually open the panel — that's two clicks for one intent. Improve it minimally:

- Add `openNewProgressNote` from `useUiStore` to `Topbar.tsx`.
- In the click handler, after the route guard logic mirroring `NoteTimeline.handleNewNote` (you'll
  need the patient's Initial Note status — reuse `useInitialNote(activePatient.id)` the same way
  `NoteTimeline` does), either `router.push(.../initial-note)` (no published Initial Note yet) or
  `router.push(.../notes)` **and** `openNewProgressNote(activePatient.id)` together (Initial Note is
  published). This makes the Topbar button open the panel directly in one click, exactly like the
  Timeline's own button, while still navigating to the Notes tab so the Timeline is visible alongside
  the now-open panel.
- If this introduces meaningful duplicated logic between `Topbar.tsx` and `NoteTimeline.tsx`, extract
  a small shared hook, e.g. `useNewProgressNoteAction(patientId)` returning a single `trigger()`
  function, and use it from both call sites. Use your judgment on whether the duplication is small
  enough to leave inline — prefer the hook if the guard logic exceeds ~5 lines in either site.

## Out of scope — do not touch

- Do not modify `InitialNoteForm.tsx`, `initial-note/page.tsx`, or any Initial Note routing/behavior.
  The Initial Note continues to live on its own full-page route, exactly as today. Only Progress
  Notes move into the global panel.
- Do not modify `ProgressNoteForm.tsx`'s internal field logic, validation, auto-save, or publish flow
  — only verify/adjust its outer chrome per Step 2/3 if a duplicate header is found.
- Do not change `DocumentationPanel`'s resize/collapse mechanics, width CSS variables, or its presence
  in `dashboard/layout.tsx`.
- Do not change any backend/NestJS code. This is a frontend-only state-wiring fix.

## Acceptance criteria

1. Navigate to a patient's Notes tab. The middle column shows ONLY the timeline (full width), no
   inline form, no duplicate panel.
2. Click "+ New Note" in the Timeline (with a published Initial Note already present for that
   patient): the right-hand Documentation Panel switches from its idle placeholder to a live, editable
   Progress Note form pre-filled with copy-forward problems/medications. The timeline itself does not
   change.
3. Click "+ New Note" in the Topbar: same result as #2, in one click, and you land on the Notes tab.
4. Click an existing **draft** Progress Note card in the timeline: the right panel loads that draft
   for editing. The corresponding timeline card shows an active/selected visual state.
5. Click an existing **published** Progress Note card in the timeline: it expands inline within the
   timeline as read-only (current behavior preserved) — the right panel is NOT triggered for
   published notes.
6. Click the Initial Note card in the timeline (any status): routes to `/initial-note` as today —
   unaffected by this fix.
7. Toggling the Documentation Panel closed/open via the existing panel-toggle button in `ScreenNav`
   continues to work and does not clear `activeNoteEditor` state — reopening the panel while a note
   is active shows that note again, not the idle placeholder.
8. No console errors; no TypeScript errors; `npm run lint` and `npm run build` (frontend) both pass.