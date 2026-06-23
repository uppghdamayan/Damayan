# DAMAYAN — Note Timeline Module Revamp (Wireframe Parity Pass)

**Phase type:** Frontend refactor (parity pass, not a new backend phase)
**Target:** `frontend/src/components/notes/NoteTimeline.tsx` and its supporting pieces
**Source of truth for behavior/look:** `wireframe/wireframe3.html` → `#screen-note-timeline`, `.note-timeline`, `.nt-entry`, `formatNoteForTimeline()`, `toggleTimelineNote()`, `closeAllTimelineNotes()`
**Source of truth for code conventions:** existing `frontend/src/components/notes/*.tsx` and `frontend/src/hooks/useInitialNote.ts`

> **Agent note before starting:** This repo is expected to have a `design-standards` doc (Tailwind tokens, shadcn/ui conventions, spacing scale, etc.). Locate it — likely `frontend/DESIGN_STANDARDS.md`, `frontend/src/styles/design-standards.md`, or similar — and read it in full before writing any component. If genuinely absent, fall back to the conventions explicitly demonstrated in `InitialNoteForm.tsx` / `NoteTimeline.tsx` / `NoteTimelineSkeleton.tsx` (CSS custom-property color tokens like `var(--text-muted)`, `cn()` from `@/lib/utils`, `lucide-react` icons, `rounded-card` / `rounded-btn` radius classes, `sec-btn` / `sec-btn primary` button classes). Do not invent a new visual language — match what's already there.

---

## 1. Goal

The current `NoteTimeline.tsx` is a bare-bones list: a column of `NoteCard`s with no expand/collapse, no inline SOAP-section formatting, and no diff-aware diagnostics/medications rendering. The wireframe's Note Timeline screen has a materially richer interaction model that the product is supposed to follow. Port that mechanic and visual treatment into the real TypeScript + shadcn/ui component, using real data from `useInitialNote` and `useProgressNotes` instead of the wireframe's hardcoded `noteData` object.

This is **not** a new feature — it's bringing `NoteTimeline.tsx` up to parity with what the wireframe already specifies. Do not invent new behavior beyond what's in `wireframe3.html`'s timeline section unless a real-data constraint forces a decision (documented in §6).

---

## 2. What "parity" means, concretely

Reproduce these wireframe mechanics, translated to React/TypeScript/shadcn idioms:

### 2.1 Collapsed entry → expandable entry (`.nt-entry` / `toggleTimelineNote`)
- Each timeline entry is a card showing, when collapsed: date/time, note type label, badges (Draft/Published, "Latest Note", "Inherited" for the initial note), author name, and a 1-line italic preview (first ~65 chars of the subjective/chief-complaint text).
- Clicking the entry (anywhere except inside the expanded dropdown body) toggles an inline expanded panel below it. Only one entry needs to support being open at a time in spirit, but the wireframe in fact allows multiple entries open simultaneously — preserve that (it's `closeAllTimelineNotes()` that collapses everything, not auto-collapse-on-open-another).
- A chevron/indicator rotates 180° when open (`.nt-indicator` → use a lucide `ChevronDown` rotated via `cn()`/Tailwind `rotate-180` state class, not the wireframe's raw `▼` glyph).
- Selected/open entries get an accent left-border + tinted background (`.nt-entry.selected` → `border-l-[3px] border-l-accent bg-accent-light`), matching the same selected-state visual already used elsewhere (see `.visit-row.selected` and `NoteActionBar`'s active states in `InitialNoteForm.tsx` for the established accent/border-left pattern).

### 2.2 "Close All" control
- A small ghost button in the section header ("Close All") that collapses every currently-open entry at once. Implement via component state (`Set<string>` of open note IDs) rather than DOM queries.

### 2.3 Formatted note body inside the expanded panel (`formatNoteForTimeline`)
This is the most important piece of mechanic to port faithfully, **but it must be rewritten as a structured renderer, not a regex-over-freetext parser**, because real data is already structured (see `InitialNote` interface in `useInitialNote.ts` and whatever `ProgressNote` type backs `useProgressNotes`). The wireframe's regex-based section-splitter exists only because the wireframe stores notes as a single flat string. **Do not port the regex parsing logic itself** — port the *visual section model* it produces:

For each expanded note, render a stack of labeled section blocks, each styled exactly like the wireframe's `.nf-section` / `.nf-label` / `.nf-content`:

| Section | Icon | Label color token (wireframe var → use existing token names) |
|---|---|---|
| Latest Vital Signs | ❤️ / `Heart` | `--accent-mid` |
| Subjective (Chief Complaint + HPI, or Interval for progress notes) | 💬 / `MessageSquare` | `--blue` |
| Objective (Physical Exam) | 🔬 / `Microscope` | `--amber` |
| Labs / Imaging | 🧪 / (lucide `FlaskConical` or similar) | `--purple` |
| Assessment | 📊 / `ClipboardList` | `--red` |
| Plan (Non-pharmacologic) | 🩺 / `Stethoscope` | `--green` |
| Diagnostics | 🔍 / (lucide `Search`) | `--green` |
| Medications | 💊 / (lucide `Pill`) | `--green` |

Use real lucide-react icons (the codebase already imports `Heart, MessageSquare, Microscope, ClipboardList, Stethoscope` etc. in `InitialNoteForm.tsx` — reuse those imports, don't introduce emoji into the TSX). Each label row keeps the wireframe's bottom-border-as-underline treatment (`border-b-[1.5px] border-b-{color}` under the label, not under the whole block).

If a structured field is empty/null, render nothing for that section (skip it), matching how `InitialNoteForm.tsx`'s read-only view already conditionally renders sections (`{note.familyHistory && (...)}` pattern — follow that exact convention here).

### 2.4 Diagnostics / Medications diff badges (added / existing / removed)
The wireframe's `formatNoteForTimeline` does a same-name fuzzy match between the current note's diagnostics/medications list and the *previous* note in the sorted timeline, tagging each item as:
- **existing** — plain badge, no tag
- **added** — badge + small green "New" sub-badge
- **removed** — struck-through, muted, dashed border + small red "Removed" sub-badge (this only applies to medications carried over from a prior note that are absent in the current one — i.e. it's showing what changed between consecutive notes, not deletions from the master list)

Port this as a small pure utility function, e.g. `diffListItems(current: string[], previous: string[] | null): { text: string; status: 'existing' | 'added' | 'removed' }[]`, using the wireframe's matching heuristic (case-insensitive, match on leading drug/diagnostic name token, substring-tolerant) — see `isMatch()` in the wireframe script for the exact heuristic to replicate. Put this in `frontend/src/lib/notes/diff-list-items.ts` (or alongside existing note utils if a `lib/notes/` dir doesn't exist, check `@/lib/vitals-utils` for the established "domain-utils-as-flat-file" pattern and mirror it, e.g. `@/lib/notes-utils.ts`).

Render diff badges with shadcn `Badge` variants:
- existing → `<Badge variant="secondary">`
- added → `<Badge variant="secondary">{text}<Badge className="ml-1 ...">New</Badge></Badge>` (nested small badge) — or two adjacent inline-flex badges, whichever matches how badges are already composed elsewhere in the codebase (check for any existing nested-badge pattern in `NoteCard.tsx` before inventing one)
- removed → `<Badge variant="outline" className="border-dashed line-through opacity-70">` + red "Removed" sub-badge

### 2.5 "Inherited" badge on the Initial Note's timeline entry
The wireframe tags the Initial Consultation Note entry with a small purple "📌 Inherited by today's note" badge (`.nt-inherited-badge`) to communicate that its PMH/allergies/etc. flow forward into every subsequent note. Port this as a `Badge` with a lucide `Pin` or `ArrowDownToLine` icon, purple variant, shown only on the entry whose note type is the Initial Note.

### 2.6 Sort order
Same as current `NoteTimeline.tsx` — newest first by `createdAt` — this part doesn't need to change. Just confirm the Initial Note still sorts correctly relative to progress notes (it already does via the existing `allNotes.sort(...)` call); don't reintroduce the wireframe's separate "always put initial note last" logic, since the real component's chronological sort is the more correct behavior and should be kept.

### 2.7 Section header / empty state
- Header row: "Timeline" label (already present) + "+ New Note" button (already present) + add a "Close All" ghost button per §2.2, right-aligned, `sec-btn ghost` sized small, only rendered when at least one entry is currently expanded (avoid showing a no-op button).
- Empty state ("No notes yet. Create an Initial Note to begin.") — keep as-is, already correct.

---

## 3. Component structure to produce

Do not cram all of this into `NoteTimeline.tsx`. Split it the same way the wireframe conceptually separates "the list" from "one row's formatted content":

```
frontend/src/components/notes/
  NoteTimeline.tsx              (existing — orchestrates list, owns open/closed Set<string>, renders TimelineEntry per note)
  TimelineEntry.tsx             (NEW — one collapsible row: header strip + expand/collapse + mounts NoteFormattedSections when open)
  NoteFormattedSections.tsx     (NEW — pure render of the SOAP-style section stack for one note, used inside TimelineEntry)
  NoteTimelineSkeleton.tsx      (existing — no change needed unless the new row height materially differs; check after building TimelineEntry)
frontend/src/lib/
  notes-utils.ts                (NEW or extend — diffListItems() and the section-extraction mapping table)
```

Use shadcn/ui primitives:
- Wrap each `TimelineEntry` in shadcn `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent` (from `@/components/ui/collapsible`) instead of hand-rolled open/close div toggling — this replaces the wireframe's manual `style.display` flipping with the idiomatic React/shadcn equivalent.
- Use shadcn `Badge` (`@/components/ui/badge`) for all status/diff/inherited badges instead of the wireframe's raw `<span class="ch-badge ...">`.
- Use shadcn `Button` with `variant="ghost"` `size="sm"` for "Close All", replacing `sec-btn ghost`.
- If a `ScrollArea` component exists in `@/components/ui/scroll-area`, use it for the timeline's scrollable column instead of the raw `overflow-y-auto` div — check first; if absent, keep the existing raw scroll container (`overflow-y-auto` is already on the wrapping div in `NoteTimeline.tsx`, so no regression either way).

---

## 4. Data contract — what each note needs to expose

`TimelineEntry` needs a normalized shape regardless of whether the underlying note is an `InitialNote` or a progress note. Define (or confirm an existing) discriminated union, e.g.:

```ts
interface TimelineNoteView {
  id: string;
  kind: 'initial' | 'progress';
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
  authorName: string;
  previewText: string;       // first ~65 chars of chief complaint (initial) or subjective (progress)
  isLatest: boolean;
  sections: {
    vitals?: { bp: string; hr: number; temp: string; spo2: number; measuredAt: string; measuredBy: string };
    subjective?: { label: string; body: string }[];   // e.g. [{label: 'Chief Complaint', body: ...}, {label: 'HPI', body: ...}] for initial; [{label: 'Subjective', body}] for progress
    objective?: string;
    labs?: string;
    assessment?: string[];          // problem titles
    nonPharm?: string;
    diagnostics?: string[];
    medications?: string[];
  };
}
```

Write a small mapper (in `notes-utils.ts`) that converts an `InitialNote` (from `useInitialNote.ts`) or a progress-note record (from `useProgressNotes`) into this shape. **Inspect the actual `useProgressNotes` hook and its returned type before writing this mapper** — it is referenced in `NoteTimeline.tsx` but its shape isn't in the files provided to you; read `frontend/src/hooks/useProgressNotes.ts` directly rather than guessing its fields.

For vitals: each entry's "Latest Vital Signs" section in the wireframe is static/global (it shows the patient's *current* latest vitals on every entry, which is a quirk of the wireframe's mock data, not real clinical correctness). For the real component, decide and document explicitly: either (a) show vitals as recorded *at the time of that note* if the data model supports per-note vitals snapshots, or (b) omit the vitals section from historical timeline entries entirely and only show it in the active note editor (which `InitialNoteForm.tsx` already does via `useLatestVitals`). **Default to (b)** unless you find a `vitalsSnapshotId` or similar field linking a note to a specific vitals record — don't fabricate per-note vitals data that doesn't exist in the backend.

---

## 5. Visual tokens to reuse exactly (no new colors)

Pull these directly from the existing CSS variable set already in use across `InitialNoteForm.tsx` / the wireframe `:root` block — do not introduce new hex values:

```
--text-primary, --text-secondary, --text-muted
--surface, --surface-2, --surface-3
--border
--accent, --accent-hover, --accent-light, --accent-mid
--blue, --blue-bg, --blue-border
--amber, --amber-bg, --amber-border
--red, --red-bg, --red-border
--green, --green-bg, --green-border
--purple, --purple-bg, --purple-border
```

Tailwind usage should follow the same arbitrary-value-via-CSS-var convention already established, e.g. `text-[var(--text-muted)]`, `border-l-accent`, `bg-accent-light`, exactly as seen throughout `InitialNoteForm.tsx`. If the project's Tailwind config already maps these to named utilities (e.g. `text-text-muted`, `bg-accent-light` as first-class classes — both forms appear in the provided files, suggesting the config does define them), prefer the named utility form over the `var(--...)` bracket form, matching whichever the *majority* of surrounding code in that same file does.

---

## 6. Explicit decisions the agent must make and document inline (as code comments)

Because the wireframe runs on fabricated mock state and the real app runs on live API data, a few mechanics can't be ported 1:1. Where this happens, leave a one-line comment explaining the deviation:

1. **Per-note vitals** — see §4. Default to omitting unless evidence of a data link exists.
2. **"Inherited" badge condition** — wireframe hardcodes this onto the Initial Note. Keep that same condition (`kind === 'initial'`); do not extend it to progress notes.
3. **Diff baseline for diagnostics/medications** — the wireframe diffs against "the next note older in sorted order." Replicate this same adjacency rule (diff each note against the one immediately preceding it chronologically), not against the master medication list. This means the diff is re-computed per pair as the list renders — fine to do in a `useMemo` over the sorted array.
4. **Multiple notes open simultaneously** — confirmed intentional (§2.1). Don't "fix" this into an accordion-style single-open-at-a-time unless explicitly asked; that would be a behavior change beyond parity scope.

---

## 7. Acceptance checklist (the agent should self-verify before declaring done)

- [ ] `NoteTimeline.tsx` still consumes `useInitialNote` + `useProgressNotes` exactly as before; no new fetch hooks invented.
- [ ] Each timeline row collapses/expands independently using shadcn `Collapsible`, no manual DOM `style.display` mutation anywhere.
- [ ] Expanded content renders labeled sections matching the table in §2.3, each visually distinct by left-icon + colored underline label, skipping empty sections.
- [ ] Diagnostics and Medications sections show added/existing/removed diff badges per §2.4, computed via the new `diffListItems` utility (unit-testable, pure function, no DOM/React dependency).
- [ ] Initial Note's timeline entry — and only that entry — shows the "Inherited" badge.
- [ ] "Close All" button appears only when ≥1 entry is open, and clears the open-set on click.
- [ ] No raw `<span class="ch-badge ...">`, `<button class="sec-btn ...">`, or emoji-as-icon remains in the new TSX — all replaced with shadcn `Badge`/`Button` and lucide-react icons respectively.
- [ ] No new color hex values introduced; everything traces to the token list in §5.
- [ ] `NoteTimelineSkeleton.tsx` reviewed and updated if the new row's collapsed-state height differs meaningfully from its current skeleton block height.
- [ ] TypeScript: no `any` introduced for note shapes; the `TimelineNoteView` union (or equivalent) is fully typed and the mapper functions have explicit return types.

---

## 8. Out of scope (do not touch)

- Backend/API changes — this is a frontend-only visual/interaction parity pass.
- `InitialNoteForm.tsx`'s own published read-only view — already correct and already follows the right conventions; do not refactor it as part of this phase even though it shares visual DNA with what you're building.
- Phase 8 (Initial Note) integration contracts already locked in prior phases — this phase must not alter `useInitialNote.ts`'s public hook signatures.