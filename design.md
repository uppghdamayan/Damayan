# Rework Spec — Initial Consultation Note Form

**Target file:** `frontend/src/components/notes/InitialNoteForm.tsx`
**Reference:** `frontend/design-standard.md` (all tokens, spacing, and component patterns below MUST come from this file — no new colors, radii, shadows, or font sizes)
**Goal:** Eliminate the double-scroll layout, balance the two-column rhythm, and make the form scannable in one continuous pass.

This document is the spec an agentic coding AI should follow exactly. Do not introduce new design tokens. Do not change the data layer (`useInitialNoteForm` hooks, schema, mutations) — this is a **layout-only** rework of the DRAFT (interactive form) view. The PUBLISHED (read-only) view is out of scope unless explicitly noted in §7.

---

## 1. Root cause of the double scroll

Currently there are **two nested scroll containers**:

1. `DashboardLayout` → `#middle-column` → `<main>` area (from `ScreenNav` / patient workspace layout) already scrolls the page vertically.
2. `InitialNoteForm` wraps its own body in a second `overflow-y-auto` div (`<div className="flex-1 overflow-y-auto p-6 w-full">`), with its own `sticky top-0` header above it.

This produces a scrollbar-within-scrollbar: the inner form scrolls independently of the outer page, and the sticky header re-sticks inside an already-scrolled context, which reads as broken/disorienting.

### Fix

`InitialNoteForm` must **NOT** own a scroll container or a sticky header. It renders as normal in-flow content inside the page's existing scroll region (the same pattern every other tab — `ProblemListScreen`, `MedicationsScreen`, `VitalsScreen` — already uses: a `flex flex-col gap-6` block with no internal `overflow-y-auto`, no `h-full`, no sticky header).

- Remove `h-full` wrapper div and the `flex flex-col h-full bg-bg` outer shell.
- Remove the inner `<div className="flex-1 overflow-y-auto p-6 w-full">` — body content flows directly.
- Remove `sticky top-0 z-10` from the header bar. It becomes a normal block at the top of the page content, matching the `[patientId]/layout.tsx` page-header pattern (title + subtitle) used by every other tab.
- Page-level title/subtitle ("Create Initial Consultation Note" / "Required before progress notes can be added") is **already rendered by `[patientId]/layout.tsx`** (`getHeaderInfo` → `h1` + subtitle, Section 4.1 of design-standard). `InitialNoteForm` must stop duplicating this title — delete the duplicate `<h1>` block entirely and rely on the shared layout header.
- Save Draft / Publish actions move out of the (deleted) sticky header into a single **action bar** at the page level — see §4.

---

## 2. Page shell (replaces current outer wrapper)

```tsx
// InitialNoteForm.tsx — top-level return for the DRAFT state
return (
  <div className="flex flex-col gap-6">
    {publishError && <PublishErrorBanner message={publishError} />}
    {note?.status !== 'PUBLISHED' && <NoteActionBar ... />}  {/* §4 */}
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      {/* LEFT: primary clinical narrative column — §3 */}
      {/* RIGHT: compact rail — §3 */}
    </div>
  </div>
);
```

Notes:
- `max-w-7xl mx-auto` is removed — the page container in `[patientId]/layout.tsx` already constrains width consistently with every other tab (none of them re-constrain width). Do not re-add a max-width here.
- `p-6` is removed — page-level padding (`px-6 py-5`) is already applied by `[patientId]/layout.tsx`.
- The grid is **not** a 50/50 split (`grid-cols-2`) like today. Use an asymmetric `1fr / 380px` split: left column carries the heavy free-text clinical narrative (Subjective + Objective + Assessment text), right column becomes a **narrow, vertically compact rail** (Vitals snapshot + Management plan + Medications), not a second stack of full-width cards. This fixes the height-imbalance that made the two columns scroll at different visual rates.

---

## 3. Column re-balancing (fixes "left column short, right column tall")

**Current problem:** Left column = 1 card (Subjective, with collapsibles). Right column = 4 full-size cards stacked (Vitals, Objective, Assessment, Plan) → right column ends up far taller, breaking visual rhythm and making the eye track two different scroll speeds even within one scroll container.

**New grouping — by clinical section, not by current arbitrary split:**

### LEFT COLUMN (`flex flex-col gap-6`, wide)
1. **Subjective card** — Chief Complaint, HPI (always-open, no collapsible — these are the two required fields, they must be visible immediately)
2. **History card** — PMH, Family History, Social History, OB History (conditional), Psychosocial History — combined into **one card** with internal tabbed or accordion sub-sections (see §5), not 4 separate `CollapsibleSection` cards. Use **shadcn `Tabs`** here is explicitly disallowed by design-standard §9 ("Do **not** use shadcn Tabs — screen nav needs..." — that restriction is scoped to screen nav only, so plain history sub-tabs inside this card ARE allowed, but to stay simplest and within already-used patterns, use **`Collapsible`** sub-rows inside a single bordered card instead, per §5).
3. **Objective card** — Physical Examination (always open, required), Labs & Imaging tag input, Attachment uploader.
4. **Assessment card** — Active Problems tag input.

### RIGHT COLUMN (`flex flex-col gap-4`, narrow, `380px` fixed)
1. **Vitals snapshot card** — compact: show only the 5 vital values as a tight label/value grid (re-use the vital-cell pattern from `VitalsCard.tsx` §7.2 design-standard, NOT the 6-column table currently used). No table, no horizontal scroll. "Update Vitals ↗" stays as a small ghost button in the card header.
2. **Management Plan card** — Non-Pharmacologic Management textarea + Prescribed Medications editor (`MedicationListEditor`). This was previously in a separate full-width-ish card at the bottom of the right column; it now anchors the rail directly under vitals since it's the natural "next step after assessment" content and keeps the rail height proportionate to the left column's 4 cards.

This produces **2 right-column cards of moderate height** sitting next to **4 left-column cards**, which is a far closer height match than the current 1-vs-4 split, removing the lopsided scroll feel.

---

## 4. Action bar (replaces sticky header buttons)

Add one new lightweight component, **not** a sticky element:

```tsx
function NoteActionBar({ isSaving, isPublishing, onSaveDraft, onPublish, onClear }: { ... }) {
  return (
    <div className="flex items-center justify-between bg-surface border border-border rounded-card shadow-card px-4 py-2.5">
      <span className="text-[11px] text-text-muted">
        {isSaving ? 'Saving…' : 'Draft auto-saves every 30s'}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClear} className="sec-btn destructive">Clear Form</button>
        <button type="button" onClick={onSaveDraft} disabled={isSaving} className="sec-btn">
          <SaveIcon className="w-3.5 h-3.5" /> Save Draft
        </button>
        <button type="button" onClick={onPublish} disabled={isPublishing} className="sec-btn primary">
          <SendIcon className="w-3.5 h-3.5" /> Publish Note
        </button>
      </div>
    </div>
  );
}
```

- Sits as the **first child** inside the `flex flex-col gap-6` page shell, above the two-column grid (per §2 layout). It scrolls away with the page — this is intentional and consistent with every other screen in the app (no tab currently pins a floating action bar).
- This single action bar replaces **both** the old header buttons and the old bottom-of-form duplicate buttons ("Clear Form / Save as Draft / Publish..." block at the end of the right column). Remove the bottom duplicate entirely.
- Uses existing `.sec-btn` / `.sec-btn.primary` / `.sec-btn.destructive` classes already defined in `globals.css` — no new button styles.

---

## 5. History card internal structure (replaces 4 stacked `CollapsibleSection`s)

Single card, header per Section 6.1 pattern (`🏥` icon, "History"), body contains 4 `Collapsible` rows **inside the card** (not 4 separate cards):

```tsx
<div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
    <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px]">🏥</div>
    <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">History</span>
  </div>
  <div className="divide-y divide-border">
    {/* Each sub-section is a row, not a card: */}
    <HistorySubSection title="Past Medical History" defaultOpen> ... </HistorySubSection>
    <HistorySubSection title="Family Medical History"> ... </HistorySubSection>
    <HistorySubSection title="Personal & Social History"> ... </HistorySubSection>
    {isFemale && <HistorySubSection title="OB / Menstrual History"> ... </HistorySubSection>}
    <HistorySubSection title="Psychosocial History"> ... </HistorySubSection>
  </div>
</div>
```

`HistorySubSection` = the existing `CollapsibleSection` component **restyled** to render as a flush row (no own border/rounded-card/mb-4 — those become the parent card's job) — i.e. add a `variant="row"` prop to `CollapsibleSection` that drops `border rounded-card mb-4 bg-surface` and instead just uses `border-b border-border last:border-b-0` (handled by the `divide-y` wrapper above, so the trigger itself needs no border).

**Default open state:** Only "Past Medical History" defaults open (`defaultOpen`). This surfaces the most clinically load-bearing optional section without forcing the user to scan 4 collapsed rows blind, while keeping the card compact on first paint.

---

## 6. Vitals snapshot card (right column, replaces 6-col table)

Replace the `<table>` markup in the DRAFT view's vitals card with a compact grid matching the dashboard `VitalsCard.tsx` cell pattern (design-standard §7.2), scaled to a single narrow column:

```tsx
<div className="bg-surface border border-accent-mid/30 rounded-card shadow-card overflow-hidden border-l-[3px] border-l-accent-mid">
  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-accent-light border-b border-accent-mid">
    <div className="w-[26px] h-[26px] rounded-icon bg-surface flex items-center justify-center text-[12px] text-accent">🫀</div>
    <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-hover flex-1">Latest Vitals</span>
    <button type="button" onClick={...} className="sec-btn primary !h-6 !text-[10px] !px-2.5">Update ↗</button>
  </div>
  <div className="p-3 grid grid-cols-2 gap-2">
    {/* 5 cells: BP, HR, Temp, SpO2, (timestamp+by spans full width below) */}
    <VitalMiniCell label="BP" value={formatBloodPressure(...)} unit="mmHg" status={bpStatus} />
    <VitalMiniCell label="HR" value={latestVitals?.heartRate ?? '—'} unit="bpm" status={hrStatus} />
    <VitalMiniCell label="Temp" value={formatTemperature(...)} unit="°C" status={tempStatus} />
    <VitalMiniCell label="SpO₂" value={latestVitals?.oxygenSaturation ?? '—'} unit="%" status={o2Status} />
    <div className="col-span-2 font-mono text-[10px] text-text-muted pt-1 border-t border-border mt-1">
      {measuredAt} · by {measuredBy}
    </div>
  </div>
  {!latestVitals && (
    <div className="px-3 pb-3 text-[11px] text-text-secondary bg-surface-2 mx-3 mb-3 rounded-btn px-2 py-1.5 text-center">
      No vitals recorded. Please update vitals first.
    </div>
  )}
</div>
```

`VitalMiniCell` reuses the color logic already in `vitals-utils.ts` (`getStatusColor` already defined inline in `InitialNoteForm.tsx` — keep it, just apply to the new cell markup) and the `bg-surface-2 border border-border rounded-card` cell shell from §7.2 of the design standard, at reduced padding (`px-2.5 py-2`) to fit two-per-row in a 380px rail.

This removes the only horizontally-scrolling element in the form (the old 6-column table required `overflow-x-auto` at narrower widths) — another contributor to the "double scroll" feeling, since it added a *horizontal* scrollbar inside a *vertically* double-scrolling page.

---

## 7. What stays unchanged

- `useForm` / `zodResolver` / `useAutoSave` / mutation hooks — no changes.
- Field names, validation schema (`initialNoteDraftSchema`, `initialNotePublishSchema`) — no changes.
- `TagInputField`, `MedicationListEditor`, `AttachmentUploader` — reused as-is, only their containing card/position changes.
- The **PUBLISHED read-only view** (the long `note?.status === 'PUBLISHED'` branch) is unchanged in this pass. It does not have the double-scroll problem (it's already plain in-flow content with no nested scroll container) — only its `max-w-7xl mx-auto` wrapper should be removed for consistency with §2, nothing else.
- All copy/placeholder text stays identical.
- All Tailwind tokens used must already exist in `design-standard.md` / `globals.css` (`bg-surface`, `border-border`, `rounded-card`, `shadow-card`, `text-text-muted`, `.sec-btn`, etc.) — introduce zero new custom values.

---

## 8. Acceptance checklist

- [ ] `InitialNoteForm` root has no `overflow-y-auto`, no `h-full`, no `sticky`.
- [ ] Page scrolls exactly once (verify by inspecting DOM: only one ancestor with `overflow-y-auto` between `<body>` and the form fields, which is `[patientId]/layout.tsx`'s content div).
- [ ] No duplicate page title — `<h1>Create Initial Consultation Note</h1>` block is deleted from `InitialNoteForm.tsx`; the layout-level header is the only title shown.
- [ ] Save Draft / Publish / Clear Form appear exactly once, in the new `NoteActionBar`, not in two places.
- [ ] Right column width is fixed at `380px` (not 50%), left column is `minmax(0,1fr)`.
- [ ] History fields (PMH, Family, Social, OB, Psychosocial) live in one card with internal row-style collapsibles, not 4 separate bordered cards.
- [ ] Vitals card in the right rail has no `<table>` and no `overflow-x-auto`.
- [ ] No new colors/radii/shadows/font-sizes outside `design-standard.md` tokens.
- [ ] `lg:grid-cols-2` is replaced by `lg:grid-cols-[minmax(0,1fr)_380px]`.