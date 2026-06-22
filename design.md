# DAMAYAN — Initial Note Module UI/UX Improvement

**Scope:** `frontend/src/components/notes/InitialNoteForm.tsx`  
**Related:** `frontend/src/components/notes/CollapsibleSection.tsx`, `frontend/src/app/globals.css`  
**Design Reference:** `frontend/design-standard.md`

---

## Problem Statement

The current Initial Note form is text-heavy with poor visual contrast between section containers and input fields. Input fields are nearly invisible on white backgrounds — they blend into the surface. For doctors (including older clinicians), this creates friction during data entry. The form also lacks clear visual hierarchy to guide the eye through a long clinical document.

---

## Goals

1. Make input fields clearly visible and easy to target — stronger border contrast, consistent height, and generous padding.
2. Establish a clear visual grouping hierarchy: Page → Card → Section → Field.
3. Reduce cognitive load by using section color-coding and icons that match clinical groupings (Subjective, Objective, Assessment, Plan).
4. Keep all existing field logic, validation, autosave, and publish behavior unchanged.
5. Strictly follow design tokens from `design-standard.md` and `globals.css`.

---

## Design Decisions

### Field Contrast & Visibility

All text inputs and textareas must use the following base class. Replace any existing input `className` strings on fields inside `InitialNoteForm.tsx` with this standard:

**Standard text input:**
```
h-[36px] w-full px-3 bg-white border-[1.5px] border-[#9BA3B5] rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150
focus:bg-white focus:border-accent focus:shadow-accent-focus
placeholder:text-[#9BA3B5]
```

**Standard textarea:**
```
w-full px-3 py-2.5 bg-white border-[1.5px] border-[#9BA3B5] rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[90px] leading-[1.65] transition-all duration-150
focus:bg-white focus:border-accent focus:shadow-accent-focus
placeholder:text-[#9BA3B5]
```

Key changes from current:
- `border` → `border-[1.5px]` (thicker, more visible)
- `border-border` (#D1D5E0) → `border-[#9BA3B5]` (border-strong, higher contrast)
- `bg-surface` → `bg-white` (pure white so field lifts off surface-2 backgrounds)
- Height `h-[34px]` → `h-[36px]` (more finger/click target area)
- Padding `px-2.5` → `px-3` (roomier feel)

### Field Label Standard

All field labels must follow this class:
```
text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] mb-1.5 block
```

Required asterisk: `<span className="text-red font-bold ml-[2px] align-top">*</span>`

### Section Card Color Coding

Each major clinical card (Subjective, History, Objective, Assessment, Plan) gets a distinct left-border accent and a lightly tinted header to visually separate it. This follows Section 6.1 of design-standard.md (`card.updated` variant with `border-l-[3px]`).

| Card | Left Border Color | Header Tint |
|---|---|---|
| Subjective | `border-l-blue` (`#3B82F6`) | `bg-blue-bg` (`#DBEAFE`) |
| History | `border-l-amber` (`#F59E0B`) | `bg-amber-bg` (`#FEF3C7`) |
| Objective | `border-l-purple` (`#8B5CF6`) | `bg-purple-bg` (`#EDE9FE`) |
| Assessment | `border-l-accent` (`#0A6E5F`) | `bg-accent-light` (`#D4EDE9`) |
| Plan / Management | `border-l-green-border` (`#22C55E`) | `bg-green-bg` (`#DCFCE7`) |

### Card Header Label Color

Match left-border color for the section title text to reinforce grouping:
- Subjective → `text-blue`
- History → `text-amber`
- Objective → `text-purple`
- Assessment → `text-accent-hover`
- Plan → `text-green`

---

## Implementation Instructions

### 1. CollapsibleSection Component

**File:** `frontend/src/components/notes/CollapsibleSection.tsx`

Update the inner `<button>` trigger inside `CollapsibleSection` (when `variant === 'row'`) to use a heavier label weight and visible hover state:

```tsx
// Replace the trigger button's className for variant === 'row':
className={cn(
  "w-full flex items-center justify-between px-3.5 py-2.5 transition-colors rounded-[4px]",
  "hover:bg-surface-2",
  isRow ? "" : "bg-surface-2 hover:bg-surface-3 border-b border-border"
)}
```

Replace the title `<span>` inside CollapsibleSection:
```tsx
<span className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.6px]">
  {title}
</span>
```

Keep chevron icon as-is.

---

### 2. InitialNoteForm — Draft (Interactive) View Only

The following changes apply **only inside the `else` branch** (the `// ==================== INTERACTIVE FORM DRAFT ====================` block). The published read-only view is not changed.

#### 2a. Layout Change: Two-Column to Full-Width Primary

Change the form's outer grid from the current `lg:grid-cols-[minmax(0,1fr)_380px]` layout to a **single-column full-width layout**. The Vitals snapshot and Management Plan cards move from a right sidebar into the main flow, inserted between Objective and Assessment.

Replace:
```tsx
<form className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 w-full items-start" ...>
  {/* LEFT COLUMN */}
  <div className="flex flex-col gap-6">
    ...
  </div>
  {/* RIGHT COLUMN */}
  <div className="flex flex-col gap-4">
    ...
  </div>
</form>
```

With:
```tsx
<form className="flex flex-col gap-5 w-full" onSubmit={(e) => e.preventDefault()}>
  {/* Cards render in this order, all full-width: */}
  {/* 1. Subjective Card */}
  {/* 2. History Card */}
  {/* 3. Objective Card */}
  {/* 4. Latest Vitals Snapshot (moved from right column) */}
  {/* 5. Assessment Card */}
  {/* 6. Management Plan Card (includes non-pharm + medications) */}
</form>
```

#### 2b. Subjective Card

Replace current card wrapper and header with:

```tsx
<div className="bg-surface border border-border border-l-[3px] border-l-blue rounded-card shadow-card overflow-hidden">
  {/* Card Header */}
  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-blue-bg border-b border-border">
    <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
      <MessageSquare className="w-3.5 h-3.5 text-blue" />
    </div>
    <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-blue flex-1">
      Subjective
    </span>
    <span className="text-[10px] text-blue/70 font-medium">Patient's reported complaints and history</span>
  </div>
  {/* Card Body */}
  <div className="p-4 flex flex-col gap-4 bg-surface">
    {/* Chief Complaint field */}
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
        Chief Complaint <span className="text-red font-bold ml-[2px] align-top">*</span>
      </label>
      <input
        {...form.register('chiefComplaint')}
        className="h-[36px] w-full px-3 bg-white border-[1.5px] border-[#9BA3B5] rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:bg-white focus:border-accent focus:shadow-accent-focus placeholder:text-[#9BA3B5]"
        placeholder="e.g. Persistent headaches and dizziness for 2 weeks"
        maxLength={50}
      />
      <p className="text-[10px] text-text-muted">Max 50 characters. Required to publish.</p>
    </div>

    {/* HPI field */}
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
        History of Present Illness (HPI) <span className="text-red font-bold ml-[2px] align-top">*</span>
      </label>
      <textarea
        {...form.register('hpi')}
        className="w-full px-3 py-2.5 bg-white border-[1.5px] border-[#9BA3B5] rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[110px] leading-[1.65] transition-all duration-150 focus:bg-white focus:border-accent focus:shadow-accent-focus placeholder:text-[#9BA3B5]"
        placeholder="Describe onset, character, duration, associated symptoms, relieving/aggravating factors…"
      />
    </div>
  </div>
</div>
```

#### 2c. History Card

Replace card wrapper and header with:

```tsx
<div className="bg-surface border border-border border-l-[3px] border-l-amber rounded-card shadow-card overflow-hidden">
  {/* Card Header */}
  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-bg border-b border-border">
    <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
      <History className="w-3.5 h-3.5 text-amber" />
    </div>
    <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-amber flex-1">
      History
    </span>
    <span className="text-[10px] text-amber/70 font-medium">Medical, family, personal, and social background</span>
  </div>
  {/* Card Body — keep the divide-y with CollapsibleSection rows */}
  <div className="divide-y divide-border bg-surface">
    {/* All existing CollapsibleSection rows remain here — see 2c field updates below */}
  </div>
</div>
```

Inside each `CollapsibleSection` row in History, update all `<input>` and `<textarea>` elements to the standard field classes defined in the Design Decisions section above. Apply them consistently to: Comorbidities, Surgeries, Hospitalizations, Allergies, Family History, Social History, OB History, Psychosocial History.

Each input inside History sections: `h-[36px] w-full px-3 bg-white border-[1.5px] border-[#9BA3B5] rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:bg-white focus:border-accent focus:shadow-accent-focus placeholder:text-[#9BA3B5]`

Each textarea inside History sections: `w-full px-3 py-2.5 bg-white border-[1.5px] border-[#9BA3B5] rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[90px] leading-[1.65] transition-all duration-150 focus:bg-white focus:border-accent focus:shadow-accent-focus placeholder:text-[#9BA3B5]`

Update all sub-labels inside CollapsibleSection rows:
```tsx
<label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block mb-1">
  {labelText}
</label>
```

#### 2d. Objective Card

Replace card wrapper and header with:

```tsx
<div className="bg-surface border border-border border-l-[3px] border-l-purple rounded-card shadow-card overflow-hidden">
  {/* Card Header */}
  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-purple-bg border-b border-border">
    <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
      <Microscope className="w-3.5 h-3.5 text-purple" />
    </div>
    <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-purple flex-1">
      Objective
    </span>
    <span className="text-[10px] text-purple/70 font-medium">Physical exam and diagnostic results</span>
  </div>
  <div className="p-4 flex flex-col gap-4 bg-surface">
    {/* Physical Examination textarea */}
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
        Physical Examination <span className="text-red font-bold ml-[2px] align-top">*</span>
      </label>
      <textarea
        {...form.register('physicalExam')}
        className="w-full px-3 py-2.5 bg-white border-[1.5px] border-[#9BA3B5] rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[110px] leading-[1.65] transition-all duration-150 focus:bg-white focus:border-accent focus:shadow-accent-focus placeholder:text-[#9BA3B5]"
        placeholder="General: Conscious, coherent, not in acute distress…&#10;HEENT: Anicteric sclerae, pink conjunctivae…&#10;Lungs: Clear to auscultation bilaterally…"
      />
    </div>

    {/* Labs and Imaging */}
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
        Labs and Imaging Results
      </label>
      {/* TagInputField and AttachmentUploader remain unchanged */}
    </div>
  </div>
</div>
```

#### 2e. Latest Vitals Snapshot (moved inline between Objective and Assessment)

Remove from the right column. Render it between the Objective and Assessment cards as a compact horizontal strip:

```tsx
{/* Vitals Snapshot Strip */}
<div className="bg-surface border border-border border-l-[3px] border-l-accent-mid rounded-card shadow-card overflow-hidden">
  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-accent-light border-b border-accent-mid">
    <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
      <Heart className="w-3.5 h-3.5 text-accent" />
    </div>
    <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-hover flex-1">
      Latest Vital Signs
    </span>
    <span className="font-mono text-[10px] text-text-muted mr-2">
      {measuredAt ? `Recorded ${measuredAt} · by ${measuredBy}` : 'No vitals recorded'}
    </span>
    <button
      type="button"
      onClick={() => router.push(`/dashboard/${patientId}/vitals`)}
      className="h-[26px] px-3 rounded-btn text-[10px] font-semibold bg-accent text-white border border-accent-hover hover:bg-accent-hover transition-all cursor-pointer"
    >
      Update ↗
    </button>
  </div>
  {/* Vitals grid — horizontal, compact */}
  <div className="px-4 py-3 grid grid-cols-5 gap-3 bg-surface-2/50">
    <VitalMiniCell label="BP" value={...} unit="mmHg" status={bpStatus} />
    <VitalMiniCell label="HR" value={...} unit="bpm" status={hrStatus} />
    <VitalMiniCell label="Temp" value={...} unit="°C" status={tempStatus} />
    <VitalMiniCell label="SpO2" value={...} unit="%" status={o2Status} />
    <VitalMiniCell label="RR" value={...} unit="/min" status={rrStatus} />
  </div>
  {!latestVitals && (
    <div className="px-4 pb-3 text-[11px] text-amber font-medium text-center">
      ⚠ No vitals on record. Record vitals before publishing this note.
    </div>
  )}
</div>
```

Update `VitalMiniCell` to also display the vitals value using the existing classification color logic. No logic changes — only layout/color token alignment.

#### 2f. Assessment Card

Replace card wrapper and header with:

```tsx
<div className="bg-surface border border-border border-l-[3px] border-l-accent rounded-card shadow-card overflow-hidden">
  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-accent-light border-b border-border">
    <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
      <ClipboardList className="w-3.5 h-3.5 text-accent-hover" />
    </div>
    <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-hover flex-1">
      Assessment (Active Problems)
    </span>
    <span className="text-[10px] text-accent-hover/70 font-medium">Required to publish</span>
  </div>
  <div className="p-4 flex flex-col gap-3 bg-surface">
    <p className="text-[11px] text-text-secondary leading-relaxed">
      Add the active problems or diagnoses for this visit. Press <kbd className="px-1 py-0.5 bg-surface-2 border border-border rounded text-[10px] font-mono">Enter</kbd> after each entry.
    </p>
    {/* TagInputField remains unchanged */}
  </div>
</div>
```

#### 2g. Management Plan Card

Replace card wrapper and header. Internally use a **two-column grid** for non-pharm vs medications — this is the only section that benefits from side-by-side layout on a wider screen since both fields are relatively short:

```tsx
<div className="bg-surface border border-border border-l-[3px] border-l-green-border rounded-card shadow-card overflow-hidden">
  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-green-bg border-b border-border">
    <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
      <Stethoscope className="w-3.5 h-3.5 text-green" />
    </div>
    <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-green flex-1">
      Plan / Management
    </span>
    <span className="text-[10px] text-green/70 font-medium">Non-pharmacologic and pharmacologic treatment</span>
  </div>
  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-surface">
    {/* Left: Non-Pharmacologic */}
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
        Non-Pharmacologic Management
      </label>
      <textarea
        {...form.register('mgmtNonpharm')}
        className="w-full px-3 py-2.5 bg-white border-[1.5px] border-[#9BA3B5] rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[100px] leading-[1.65] transition-all duration-150 focus:bg-white focus:border-accent focus:shadow-accent-focus placeholder:text-[#9BA3B5]"
        placeholder="e.g. Low-sodium DASH diet. Daily home BP monitoring. Regular aerobic exercise 30 min/day."
      />
    </div>
    {/* Right: Prescribed Medications */}
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
        Prescribed Medications
      </label>
      <p className="text-[11px] text-text-muted -mt-0.5">
        Medications added here are saved to the patient's cumulative medication list.
      </p>
      {/* MedicationListEditor remains unchanged */}
      <MedicationListEditor patientId={patientId} />
    </div>
  </div>
</div>
```

#### 2h. NoteActionBar

The existing `NoteActionBar` component stays unchanged. Keep it above the form cards.

---

### 3. Published (Read-Only) View

**No changes required.** Leave the `note?.status === 'PUBLISHED'` read-only view exactly as it is.

---

### 4. globals.css Additions

Add the following utility class to `globals.css` under `@layer base` to support the `bg-white` field treatment inside surface-2 card bodies. This ensures white inputs read correctly even in the `bg-surface-2/50` panels:

```css
/* Ensures input/textarea bg-white is respected inside surface-2 wrappers */
.field-input {
  background-color: #FFFFFF;
  border: 1.5px solid var(--border-strong);
  border-radius: var(--radius-btn);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.field-input:focus {
  border-color: var(--accent);
  box-shadow: var(--shadow-accent-focus);
  background-color: #FFFFFF;
}
.field-input::placeholder {
  color: var(--border-strong);
}
```

This class is optional to apply — the Tailwind inline classes defined above are sufficient and preferred. Only add this CSS if the agent finds it cleaner to apply a single class across many elements.

---

## What Must Not Change

- All `form.register(...)` bindings and `Controller` wrappers — no form logic changes.
- `useAutoSave`, `handleSave`, `handlePublish` functions — untouched.
- `TagInputField`, `AttachmentUploader`, `MedicationListEditor` — rendered as-is, only their label elements above them are updated.
- `CollapsibleSection` internal toggle state — only the trigger styling is updated.
- `VitalMiniCell` component logic — values and classification functions unchanged.
- `NoteActionBar` — unchanged.
- Published (read-only) view — completely untouched.
- All import statements — no new packages required.
- RBAC logic — no changes.

---

## Verification Checklist

After implementing, verify:

- [ ] All text inputs have a clearly visible `border-[1.5px] border-[#9BA3B5]` border when unfocused.
- [ ] All fields turn `border-accent` with a green focus glow on click.
- [ ] Each of the five clinical cards (Subjective, History, Objective, Assessment, Plan) has its correct left-border color and tinted header.
- [ ] The Vitals strip is displayed between Objective and Assessment, horizontal, compact.
- [ ] The Management Plan card shows two columns on `lg:` screens.
- [ ] The published read-only view is pixel-identical to before.
- [ ] No TypeScript errors or missing imports.
- [ ] The form scrolls smoothly and field labels are readable at browser zoom 125%.