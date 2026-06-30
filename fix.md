# Initial Note — Visual Polish Pass

## Problem

The published/read-only view of the Initial Consultation Note (`InitialNoteForm.tsx`, read-only branch starting ~line 520) is visually loud. Looking at the current screenshot, two things are doing the damage:

1. **Out-of-range vital cards use full-strength solid fills.** `bg-amber-bg` and `bg-red-bg` are applied at 100% opacity on the mini vital cards (Blood Pressure, Oxygen Saturation in the screenshot). Next to the neutral `bg-surface-2` cards around them, these read as hard yellow/red blocks rather than "flagged values inside a clinical note."
2. **Section header washes are inconsistent in strength.** Some section headers use a light tint (`bg-blue-bg/40`, `bg-purple-bg/40`, `bg-accent-light/40` at 40% opacity), but the Vitals header uses solid `bg-accent-light` and the chip badges inside sections (Chief Complaint, PMH, etc.) use `bg-blue-bg/60` and `bg-amber-bg` at full or near-full strength. The result is a page where every block is shouting at a different volume.

The fix is not to remove contrast — flagged vitals and section headers SHOULD stand out. The fix is to make every saturated surface consistent in intensity, and reserve full-strength color for the one or two things that genuinely need to alarm the reader (critical vitals), while everything else (section identity, warn-level vitals, info chips) uses a quieter, consistent tint.

## Design Rule

Two-tier color intensity system, applied everywhere in the note:

- **Tier 1 — Structural / identity color** (section headers, info badges, normal-state UI): tint at **8–12% opacity** of the brand color against `bg-surface` or `bg-surface-2`. Text stays at full saturation for the label (e.g. `text-blue`, `text-purple`) so headers stay legible and "noticeable" without the background fighting for attention.
- **Tier 2 — Clinical alert color** (warn/critical vital states only): keep two distinct strengths —
  - `warn`: tint at **15–20% opacity** (`bg-amber-bg/20` instead of solid `bg-amber-bg`), border at full `border-amber-border`, text at full `text-amber`. This keeps the warning visible via border + text weight, not a flat color block.
  - `critical`: tint at **25–30% opacity** (`bg-red-bg/25`), border full strength, text full strength + bold. This is the only state allowed to look "alarmed," and it should look distinctly more alarmed than `warn` so the hierarchy between the two is obvious.

This preserves contrast for headers (text stays saturated, borders stay full strength) while removing the "wall of solid color" effect that's causing eye strain.

## Implementation Steps

### 1. Vital mini-cards (`InitialNoteForm.tsx`, lines ~530–662)

For each of the 5 vital cards (BP, HR, Temp, SpO2, RR), change the background classes:

```
// Before
bpStatus === "critical" ? "bg-red-bg border-red-border" :
bpStatus === "warn"     ? "bg-amber-bg border-amber-border" :
"bg-surface-2 border-border"

// After
bpStatus === "critical" ? "bg-red-bg/25 border-red-border" :
bpStatus === "warn"     ? "bg-amber-bg/20 border-amber-border" :
"bg-surface-2 border-border"
```

Apply this same `/25` and `/20` opacity suffix to all five status-driven `cn()` blocks (BP, HR, Temp, SpO2, RR). Leave `text-red`, `text-amber`, the dot indicators, and border colors untouched — those are what carry the alert meaning, not the fill.

Do the same in `VitalsSummaryRow.tsx` if equivalent solid status fills exist there (check `getStatusColor`; if it only sets text color, no change needed there — confirm before editing).

### 2. Vitals card header (lines ~520–521)

```
// Before
<div className="bg-surface border border-accent-mid/30 rounded-card shadow-card overflow-hidden border-l-[3px] border-l-accent-mid">
  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-accent-light border-b border-accent-mid">

// After
<div className="bg-surface border border-accent-mid/30 rounded-card shadow-card overflow-hidden border-l-[3px] border-l-accent-mid">
  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-accent-light/40 border-b border-accent-mid/40">
```

This brings it in line with the other section headers (Initial History, Assessment, etc. already use `/40`).

### 3. Inline info chips/badges inside sections

Search `InitialNoteForm.tsx` for all instances of badge-style spans with full or high-opacity backgrounds:

- `bg-blue-bg/60 text-blue` → `bg-blue-bg/15 text-blue`
- `bg-amber-bg text-amber` (no opacity suffix) → `bg-amber-bg/15 text-amber`
- `bg-purple-bg text-purple` (no opacity suffix) → `bg-purple-bg/15 text-purple`
- `bg-accent-light text-accent-hover` (no opacity suffix, line ~823) → `bg-accent-light/40 text-accent-hover`

Keep the border and text color full strength on every one of these (e.g. if a chip has `border border-blue-border`, do not touch it). Only soften the fill.

Apply the identical search-and-replace to `NoteFormattedSections.tsx` and `NoteCard.tsx` if they contain the same chip patterns (they reuse similar badge styling for diagnostics/medications "Removed"/"New" pills via the shadcn `Badge` component — check `variant="removed"`, `variant="active"`, `variant="saved"` definitions in `@/components/ui/badge` and apply the same `/15`–`/20` opacity rule to their background classes if they're currently solid).

### 4. Section header consistency sweep

Grep `InitialNoteForm.tsx` for `bg-surface-2 border-b border-border` (used as the plain/neutral header style, e.g. Vitals card alt., line ~682) versus colored headers like `bg-blue-bg/40`, `bg-purple-bg/40`, `bg-amber-bg/40`. Confirm every colored section header in the published view uses the same `/40` opacity suffix — none should be unsuffixed (full opacity). Sections currently identified using full-strength headers that need fixing:

- Any `bg-[color]-bg` header without a trailing `/NN` opacity modifier.

### 5. Do not touch

- Border colors (`border-amber-border`, `border-red-border`, `border-blue-border`, etc.) — these stay at full strength, they're doing the contrast work now instead of the fill.
- Text colors (`text-amber`, `text-red`, `text-blue`, `text-purple`) inside headers and chips — full strength, unchanged.
- The left accent border strips (`border-l-[3px] border-l-blue`, etc.) on each section card — these stay solid, they're a thin enough element that they read as a label, not a wall of color.
- `NoteStatusBadge.tsx` (`DRAFT`/`PUBLISHED` pills) — these are already using `bg-amber-bg`/`bg-purple-bg` without explicit opacity but are small enough (badge-sized, not full-width header bars) that they don't contribute to the eye-strain issue. Leave as-is unless visual QA says otherwise.

## Acceptance Criteria

- No section header or info chip in the published Initial Note view uses an unsuffixed (100% opacity) colored background. Only `border-l-*` accent strips and badge borders/text remain full strength.
- Critical vital cards are visibly more intense than warn vital cards (verify `/25` vs `/20` reads as a clear step, adjust by ±5% if they look too similar on screen).
- Normal-state vital cards (`bg-surface-2`) are unchanged.
- After the change, the page should visually separate into: white/neutral background → soft color washes marking sections → bold text/borders marking what's flagged. No solid color blocks larger than a small badge anywhere in the read-only note view.
- Re-render the Initial Note page for a patient with at least one out-of-range and one critical vital to visually confirm the two-tier alert hierarchy still reads clearly at a glance.