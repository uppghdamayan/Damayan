# DAMAYAN EMR — Design Standards

**Version 1.0 · Based on Wireframe3 + Compiled Requirements v02**
*Problem-Oriented Dynamic Clinical Note Interface for Primary Care*

---

## 1. Guiding Principles

DAMAYAN is used primarily by doctors and medical personnel in a clinical setting. The interface must be designed with the following priorities:

1. **Clarity over cleverness.** Every label, button, and section should be immediately understandable without prior training. Doctors — including senior physicians who may not be accustomed to digital tools — should never need to guess what something does.
2. **Reduce cognitive load.** The system organizes information by problem, not by visit. Users should never have to scroll through previous notes to understand the current state of a patient.
3. **Large, readable text.** Minimum body font size of 13px, with all critical values (vitals, problem names) rendered at 15–18px. The interface must support browser zoom up to 150% without breaking layouts.
4. **High contrast.** Text colors against backgrounds must meet WCAG 2.2 AA contrast ratios at all times. Never use light-on-light or muted-on-muted color combinations for clinical data.
5. **Keyboard navigability.** All forms should be completable using only the keyboard. Tab order must be logical and match the visual reading flow of the form.
6. **Single-page, no multi-window.** Each patient's workspace is contained in one screen. Doctors should never need to open multiple tabs to cross-reference data.
7. **Auto-save always on.** Doctors should never lose note progress. Drafts are saved continuously in the background.

---

## 2. Design Tokens

All visual properties derive from these CSS custom properties. Never hardcode color or size values in components.

### 2.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#F0F2F5` | Page background |
| `--surface` | `#FFFFFF` | Cards, sidebar, topbar |
| `--surface-2` | `#F7F8FA` | Card headers, input fields, muted areas |
| `--surface-3` | `#EFF1F5` | Hover states, selected rows |
| `--border` | `#D1D5E0` | Default borders |
| `--border-strong` | `#9BA3B5` | Focus rings on non-accent elements, hover borders |
| `--text-primary` | `#0D1117` | Page titles, patient names, primary labels |
| `--text-secondary` | `#374151` | Body text, form values, card content |
| `--text-muted` | `#6B7280` | Meta labels, timestamps, helper text |
| `--accent` | `#0A6E5F` | Primary action color (teal-green) |
| `--accent-hover` | `#085A4E` | Hover state of primary actions |
| `--accent-light` | `#D4EDE9` | Accent backgrounds, role pills |
| `--accent-mid` | `#0D9E8C` | Screen nav labels, secondary accent |
| `--amber` | `#92400E` | Warning text |
| `--amber-bg` | `#FEF3C7` | Warning backgrounds (draft, caution) |
| `--amber-border` | `#F59E0B` | Warning borders |
| `--red` | `#991B1B` | Error/critical text |
| `--red-bg` | `#FEE2E2` | Error/critical backgrounds |
| `--red-border` | `#EF4444` | Error/critical borders |
| `--blue` | `#1E3A8A` | Info text |
| `--blue-bg` | `#DBEAFE` | Info backgrounds |
| `--blue-border` | `#3B82F6` | Info borders |
| `--green` | `#14532D` | Success/normal-range text |
| `--green-bg` | `#DCFCE7` | Success/saved backgrounds |
| `--green-border` | `#22C55E` | Success/saved borders |
| `--purple` | `#4C1D95` | Published/inherited text |
| `--purple-bg` | `#EDE9FE` | Published/inherited backgrounds |
| `--purple-border` | `#8B5CF6` | Published/inherited borders |

### 2.2 Spacing Scale

Use multiples of 4px. Common values:

| Name | Value | Usage |
|---|---|---|
| xs | 4px | Icon-to-label gap, tight inline gaps |
| sm | 8px | Compact padding, between-row gaps |
| md | 12px | Standard padding for cards and form fields |
| lg | 14–16px | Section padding, form group spacing |
| xl | 24px | Between major sections |

### 2.3 Layout Dimensions

| Token | Value | Usage |
|---|---|---|
| `--topbar-h` | `56px` | Fixed top navigation bar |
| `--sidebar-w` | `280px` | Patient list sidebar (collapsible) |
| `--documentation-panel-width` | `420px` | Right-side documentation panel |
| `--timeline-w` | `260px` | Note timeline rail |

### 2.4 Border Radius

| Usage | Value |
|---|---|
| Cards, containers | `8px` |
| Buttons, inputs, small badges | `6px` |
| Pill badges (role, allergy, status) | `20px` |
| Avatar circles | `50%` |
| Icon containers | `5–6px` |

---

## 3. Typography

**Primary typeface:** IBM Plex Sans (all UI text)
**Monospace typeface:** IBM Plex Mono (timestamps, patient IDs, lab values)

Both are loaded from Google Fonts. Never substitute with system fonts in production.

### 3.1 Type Scale

| Role | Size | Weight | Usage |
|---|---|---|---|
| Page Title | 20px | 700 | Screen headings (e.g., "Patient Dashboard") |
| Section Title | 15px | 700 | Card-level section names |
| Vital Value | 18px | 500 | Large vitals display (BP, HR, Temp) |
| Body | 13px | 400 | Default text, notes content |
| Label | 12px | 500–600 | Form labels, sidebar items, nav tabs |
| Meta / Caption | 11px | 400–600 | Timestamps, patient meta row |
| Badge / Uppercase Label | 9–10px | 700 | Card headers (ALL CAPS), badges |

**Minimum body text: 13px.** Do not use anything smaller than 9px anywhere. Timestamps and meta labels at 11px are the practical minimum for dense layouts.

### 3.2 Text Color Hierarchy

- **Critical clinical data** (vital values, problem names, patient names): `--text-primary` (`#0D1117`)
- **Body and form text**: `--text-secondary` (`#374151`)
- **Supporting info** (dates, section labels, metadata): `--text-muted` (`#6B7280`)

Never use `--text-muted` for mandatory fields or primary data. Never display clinical values in muted color.

---

## 4. Layout Structure

### 4.1 Application Shell

```
┌─────────────────────────────────────────────┐
│ TOPBAR (56px, fixed)                        │
├──────────────┬──────────────────────────────┤
│              │ SCREEN NAV TABS (52px)       │
│  SIDEBAR     ├──────────────────────────────┤
│  (280px)     │                              │
│  Patient     │  MAIN CONTENT AREA           │
│  List        │  (scrollable)                │
│              │                              │
│  (collapsed  ├──────────────────────────────┤
│  = 0px)      │ DOCUMENTATION PANEL (420px,  │
│              │ right, toggleable)           │
└──────────────┴──────────────────────────────┘
```

- The **topbar** is always visible and never scrolls.
- The **sidebar** is collapsible. When collapsed, it reduces to `0px` width and the main area expands.
- The **screen nav tabs** sit just below the topbar and above the main area. They represent the current patient's available views.
- The **documentation panel** is a resizable right panel that can be toggled open for document generation.

### 4.2 Main Content Area

The main area uses a single-column layout with a maximum content width. Content is padded `16–20px` from the container edges. Sections stack vertically with `16px` between major cards.

The main area scrolls independently. The topbar, sidebar, and screen nav do not scroll with the content.

### 4.3 Responsive Behavior

DAMAYAN supports a minimum viewport of **1280×800px** (smallest common laptop resolution). No horizontal scrolling is ever introduced on the main content area at any supported size.

#### Breakpoints

| Name | Viewport Width | Target Device |
|---|---|---|
| `desktop-lg` | ≥ 1440px | Large monitors, external displays |
| `desktop` | 1280px – 1439px | Standard laptops (13"–14"), minimum supported |

> No support is required below 1280px. If the viewport is narrower, display a fullscreen notice: *"DAMAYAN is designed for laptop or desktop screens. Please use a device with a screen width of at least 1280px."*

#### Layout Tokens at 1280px

At the minimum supported width, the following dimension reductions apply automatically:

| Token | Default (≥1440px) | At 1280px |
|---|---|---|
| `--sidebar-w` | 280px | 220px |
| `--documentation-panel-width` | 420px | 340px |
| `--timeline-w` | 260px | 200px |
| `--topbar-h` | 56px | 52px |
| Main content padding | 20px | 14px |

#### Component Adaptations at 1280px

**Sidebar (220px):**
- Patient name truncates with ellipsis at 130px max-width
- Meta row (sex · age · ID) clips to sex · age only; ID hidden
- "Add New Patient" button text shortens to "New Patient"
- Sidebar section label padding reduces to `10px 10px 4px`

**Screen Nav Tabs:**
- Tab labels shorten: "Note Timeline ★" → "Timeline", "Medications" → "Meds", "Documents" → "Docs"
- Overflow tabs scroll horizontally (no wrapping, no clipping)

**Vitals Strip:**
- At 1280px with sidebar open: `grid-template-columns: repeat(3, 1fr)` for first 3 vitals, `repeat(2, 1fr)` for the remaining 2 (wraps into 2 rows)
- At 1280px with sidebar collapsed: `repeat(5, 1fr)` — single row is restored
- Vital value font size reduces from 18px to 16px; vital label from 9px to 8px

**Patient Banner:**
- Switches from a horizontal multi-column layout to a 2-column layout: avatar + name/DOB on the left, address + tags on the right

**Dashboard Cards:**
- Medication List and Problem List side-by-side columns (`repeat(2, 1fr)`) stack to single column at 1280px with sidebar open; restore to 2 columns when sidebar is collapsed

**Documentation Panel:**
- Reduces to 340px at 1280px
- When open at 1280px with sidebar open: sidebar auto-collapses to give the panel room
- A visual notice appears: "Sidebar hidden while document panel is open" with a link to re-open

**Topbar:**
- Patient search input max-width reduces from 400px to 280px
- "New Note" button text shortens to "+ Note" at 1280px

**Form fields (Initial Note / Progress Note):**
- `.field-row` (2 columns) reduces column gap from 12px to 8px
- `.field-row-3` (3 columns) collapses to 2 columns at 1280px with sidebar open; stays 3 columns when collapsed

**Modal:**
- Max-width reduces from 520px to 460px

#### Sidebar Collapse Behavior

The sidebar toggles between expanded and collapsed via the topbar hamburger button. Collapsed state is `width: 0px` with `overflow: hidden`. The toggle state is persisted in `localStorage` so the last state is restored on page reload.

At 1280px viewport, the sidebar defaults to **collapsed** on initial load (first visit only). After that, the user's last preference is used.

#### No Horizontal Scroll Rule

Every layout change at 1280px must be verified to produce zero horizontal overflow. Use `overflow-x: hidden` on `#body` as a safeguard, but never rely on it to mask a broken layout — fix the source of overflow instead.

---

## 5. Navigation

### 5.1 Topbar

Contains:
- **Sidebar toggle button** (leftmost, transparent, 24×24px)
- **Logo mark** (teal square, 22×22px, `border-radius: 5px`)
- **App name** "DAMAYAN" in 16px/700 weight
- **Role pill** — displays current user role (Doctor / Admin / Nurse)
- **Switch Role button** (demo only; remove in production)
- **+ New Note button** (primary accent button, always visible)
- **User avatar** (32px circle, initials, `--accent-hover` background)

The role pill uses `--accent-light` background and `--accent` border. It is 10px/700/uppercase. This tells users their permission level at a glance.

### 5.2 Patient Sidebar

The sidebar has two zones:

**Search and Add zone** (pinned to top):
- Patient search input (`height: 34px`, `border-radius: 6px`)
- "Add New Patient" button (full-width, primary accent)

**Patient list zone** (scrollable):
- Grouped alphabetically with sticky letter markers
- Each patient row shows: initials avatar (32×32px circle), full name (Last, First format), sex · age · ID, allergy warning icon (⚠ amber), and a status dot

**Patient row states:**
- Default: `--surface`, no left border
- Hover: `--surface-2`
- Active/selected: `--surface-2`, `3px solid --accent` left border, `--text-primary` name color

**Allergy indicator:** An amber ⚠ icon with tooltip showing the allergen name. Must always be visible in the sidebar row when present.

### 5.3 Screen Navigation Tabs

A horizontal strip of tabs below the topbar. For each selected patient:

| Tab | Role Access |
|---|---|
| Dashboard | All |
| Vital Signs | All |
| Note Timeline | All |
| Initial Note | Doctor (create/edit), Nurse (view) |
| Problem List | Doctor (edit), Nurse (view) |
| Medications | Doctor (edit), Nurse (view) |
| Documents | All |
| Logs | Admin only |

**Tab styling:**
- Default: `height: 32px`, `border: 1px solid --border`, `background: --surface-2`, `font-size: 12px/500`, `border-radius: 6px`, `color: --text-secondary`
- Hover: `--surface-3`, `--border-strong`
- Active: `background: --accent`, `color: #fff`, `box-shadow: 0 4px 12px rgba(10,110,95,0.25)`

Tabs scroll horizontally on overflow. No wrapping. The "New Patient" and "Login" tabs are positioned at the far right (`margin-left: auto`).

---

## 6. Components

### 6.1 Cards

Cards are the primary container for all sections on a screen.

```
.card {
  background: --surface;
  border: 1px solid --border;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  overflow: hidden;
}
```

**Card states:**
- `.card.updated` — `border-left: 3px solid --accent` — used when a section was recently modified (within 48 hours)
- `.card.alert` — `border-left: 3px solid --red` — used for allergy alerts or critical flags

**Card header (`.card-header`):**
- Background: `--surface-2`
- Border bottom: `1px solid --border`
- Padding: `10px 14px`
- Contains: icon (26×26px, `--surface-3` background, `border-radius: 6px`), title (10px/700/UPPERCASE, `letter-spacing: 0.6px`), optional badge, optional action button

**Card body (`.card-body`):**
- Padding: `12px 14px`

A "last updated" timestamp in `--text-muted` must appear in the card header corner for all time-sensitive sections (Vital Signs, Problem List, Medication List). If updated within 48 hours, apply a visual indicator (green dot or accent border).

### 6.2 Buttons

**Primary button (`.sec-btn.primary`):**
- Background: `--accent`
- Text: `#fff`, 11px/600
- Border: `--accent-hover`
- Shadow: `0 2px 4px rgba(10,110,95,0.15)`
- Hover: `--accent-hover` background, elevated shadow
- Use for: "Save Note", "New Progress Note", "Save as Draft"

**Secondary button (`.sec-btn`):**
- Background: `--surface-2`
- Text: `--text-secondary`, 11px/600
- Border: `--border`
- Hover: `--surface-3`, `--border-strong`
- Use for: "Record Vitals", "Edit", secondary actions

**Destructive button (`.sec-btn.destructive`):**
- Background: `--red-bg`
- Text: `--red`
- Border: `--red-border`
- Use for: "Remove Problem", "Delete Record" — always require a confirmation step

**Ghost button (`.sec-btn.ghost`):**
- Background: transparent
- Border: transparent
- Hover: `--surface-2` background
- Use for: icon-only actions, collapse toggles

**Topbar buttons (`.tb-btn`):**
- Height: 34px (slightly taller than sec-btn for topbar prominence)
- Same color rules as sec-btn

**Button sizing:** All buttons are `height: 28px` for section buttons, `height: 34px` for topbar buttons. Labels are never truncated. Buttons must have a minimum tap width of 80px.

### 6.3 Badges

Badges are `9px/700/UPPERCASE` with `padding: 2px 6px`, `border-radius: 4px`.

| Badge | Background | Text | Border | Usage |
|---|---|---|---|---|
| `.badge-draft` | `--amber-bg` | `--amber` | `--amber-border` | Unsaved/draft note |
| `.badge-active` | `--accent-light` | `--accent-hover` | `--accent` | Active problem |
| `.badge-resolved` | `--surface-2` | `--text-secondary` | `--border` | Resolved problem |
| `.badge-critical` | `--red-bg` | `--red` | `--red-border` | Critical alert |
| `.badge-saved` | `--green-bg` | `--green` | `--green-border` | Saved confirmation |
| `.badge-published` | `--purple-bg` | `--purple` | `--purple-border` | Published/finalized note |
| `.badge-info` | `--blue-bg` | `--blue` | `--blue-border` | Informational (e.g., inherited) |
| `.badge-removed` | `--surface-2` | `--text-muted` | `--border` | Removed/deleted item |

### 6.4 Form Fields

All clinical data input uses a consistent field system.

**Field group (`.field-group`):**
- Vertical stack: label on top, input below
- Gap: `6px`
- Margin bottom between groups: `12px`

**Field label (`.field-label`):**
- Size: 11px/600
- Color: `--text-secondary`
- Required fields are marked with a red asterisk (*) in `--red`

**Text input (`.field-input`):**
- Height: 34px
- Padding: `0 10px`
- Background: `--surface`
- Border: `1px solid --border`
- Border-radius: 6px
- Font: 13px, `--text-primary`
- Focus: `border-color: --accent`, `box-shadow: 0 0 0 3px rgba(10,110,95,0.12)`, no default browser outline

**Textarea (`.field-textarea`):**
- Padding: `8px 10px`
- Min-height: `80px`
- Resize: vertical only
- Same border/focus as `.field-input`
- Free-text clinical fields (HPI, PMH, etc.) should have `min-height: 100px`

**Input with unit addon (`.input-with-addon`):**
- Used for vital signs, medication doses
- The input and unit label share a joined container
- Unit label sits inside the right edge: `11px/500`, `--text-muted`

**Field row layouts:**
- `.field-row` — 2-column grid, `gap: 12px`
- `.field-row-3` — 3-column grid, `gap: 12px`

Use field rows for compact data like vital signs entry (BP systolic / BP diastolic / HR on one row).

### 6.5 Tables

**Data table (`.data-table`):**
- Full width, `border-collapse: collapse`
- Header: 9px/700/UPPERCASE, `--text-secondary`, `padding: 8px 10px`, `--surface-2` background, bottom border
- Rows: 12px, `--text-secondary`, `padding: 8px 10px`, bottom `1px solid --border`
- Last row: no bottom border
- Row hover: `--surface-3` background

**Value coloring in tables:**
- Critical out-of-range value: `--red`, weight 600 (`.val-critical`)
- Warning value: `--amber`, weight 500 (`.val-warn`)
- Normal value: `--green` (`.val-normal`)
- Accent highlight: `--accent`, weight 500 (`.val-teal`)
- Timestamps, IDs: IBM Plex Mono (`.mono`)

### 6.6 Status Dots

Used in the patient list and problem list to show at-a-glance status.

| Class | Color | Usage |
|---|---|---|
| `.sd-green` | `#22C55E` | Active / Normal |
| `.sd-amber` | `#F59E0B` | Pending / Warning |
| `.sd-red` | `#EF4444` | Critical / Urgent |
| `.sd-teal` | `--accent` | Recently updated |
| `.sd-gray` | `--border-strong` | Inactive / Resolved |

Status dots are `8×8px` circles. Never rely on color alone — pair with a tooltip or text label.

### 6.7 Modals

Used for confirmations, document generation, and patient registration.

- **Overlay:** `rgba(0,0,0,0.45)`, full-screen, `z-index: 1000`
- **Modal box:** `background: --surface`, `border-radius: 10px`, `max-width: 520px`, `box-shadow: 0 20px 60px rgba(0,0,0,0.2)`
- **Modal header:** `padding: 16px 20px`, bottom border, title 15px/700, close button (ghost, top-right)
- **Modal body:** `padding: 16px 20px`
- **Modal footer:** right-aligned buttons, `gap: 8px`

Always close a modal when clicking the overlay background or pressing Escape. Require explicit confirmation for destructive actions.

---

## 7. Screens

### 7.1 Patient Dashboard (Landing Page)

The dashboard is the first screen a doctor sees when selecting a patient. It must display all current patient information at a glance without requiring navigation to other tabs.

**Required sections, in order:**

1. **Patient Banner** — persistent strip at the top
2. **Vitals Strip** — 5-card grid of latest readings
3. **Problem List** — current active problems, with status and hierarchy
4. **Medication List** — current medications
5. **Non-pharmacologic Management** — free text
6. **Visit History** — 5 most recent visits (expandable)
7. **Initial Note shortcut** — tab link to view the full initial note

**Patient Banner (`.patient-banner`):**
- Background: `--surface`
- Border: `1px solid --border`, `border-radius: 8px`
- Contains: avatar (48×48px circle, initials, `--accent-hover` background), full name (18px/700), DOB + age, address, sex, allergy tags
- Allergy tags use `--red-bg` / `--red` / `--red-border` pill styling
- Padding: `16px`

**Vitals Strip (`.vitals-strip`):**
- Grid: `repeat(5, 1fr)`, `gap: 8px`
- Each vital card shows: label (9px/700/UPPERCASE), value (18px/500, IBM Plex Mono), unit (10px/`--text-muted`), timestamp (9px/`--text-muted`)
- Normal state: `--surface`, `1px solid --border`, `border-radius: 8px`
- Warning state (`.vital-card.warn`): `--amber-bg` background, `--amber-border` border
- Critical state (`.vital-card.critical`): `--red-bg` background, `--red-border` border, text in `--red`
- Vital cards must show the datetime of the last reading. If older than 24 hours, apply warning state to the timestamp.

**Vitals to display:**

| Label | Unit | Field |
|---|---|---|
| Blood Pressure | mmHg | Systolic / Diastolic |
| Heart Rate | bpm | Integer |
| Resp. Rate | breaths/min | Integer |
| Temperature | °C | Float |
| O₂ Sat | % | Integer |

Blood pressure is displayed as `SBP / DBP` on a single card.

### 7.2 Vital Signs Entry

Used by Admin, Doctor, and Nurse to record a new set of vital signs.

- Form displays patient identifiers at the top (read-only): Last name, First name, Middle, Extension, DOB, Age
- Fields use `.field-row` and `.field-row-3` layouts
- Each vital sign input uses `.input-with-addon` with the unit shown inline
- Author and datetime are auto-populated and displayed (read-only) at the bottom
- "Save Vital Signs" is a primary button
- On save, redirect back to Dashboard and refresh the vitals strip

**Validation:**
- Systolic BP: integer, 50–300
- Diastolic BP: integer, 20–200
- Heart rate: integer, 20–300
- Respiratory rate: integer, 5–60
- Temperature: float, 30.0–45.0
- Oxygen saturation: integer, 50–100

Display inline error messages in `--red` directly below the offending field on submit. Never block submission with a modal unless all fields are missing.

### 7.3 Initial Note

The initial SOAP-format note. Only one Initial Note exists per patient. Only the Author/Doctor can create or edit it. Non-author doctors and nurses can view only.

**Sections of the Initial Note (in order):**

1. **Latest Vital Signs** — pre-filled read-only strip from the vitals table, with datetime. Shows "No vital signs recorded" if absent.
2. **Chief Complaint** *(required)* — single-line text, max 50 characters
3. **History of Present Illness** *(required)* — free text, textarea
4. **Past Medical History** *(required)* — collapsible section containing:
   - Comorbidities — free text
   - Previous Surgeries — free text
   - Previous Hospitalizations — free text
   - Allergies — free text
5. **Medication List** — editable list of entries (see Medication List component below)
6. **Family Medical History** *(required)* — free text, collapsible
7. **Personal and Social History** *(required)* — free text, collapsible
8. **OB/Menstrual History** — free text, collapsible; shown only if patient sex is Female
9. **Psychosocial History** *(required)* — free text, collapsible
10. **Physical Examination** *(required)* — free text, textarea
11. **Labs and Imaging Results** — file upload button (JPEG, PNG, PDF accepted) and/or free text input; each entry tagged by the author
12. **Assessment** *(required)* — list of editable problem entries; feeds into the Problem List
13. **Management** *(required)* — collapsible section containing:
    - Non-pharmacologic — free text
    - Diagnostics — searchable selection list
    - Medication List — copy-forwarded from PMH medication list, editable

Required fields are marked with a red asterisk in the section header label.

**Collapsible sections:**
- Collapsed by default when the patient has no data in that section
- Expanded if content exists
- Use a chevron icon (▶ / ▼) to indicate state, placed before the section title
- Section header uses the `.card-header` style

**Auto-save behavior:**
- Debounced auto-save triggers 3 seconds after the user stops typing
- A `.badge-draft` badge appears in the card header area while unsaved changes exist
- On successful auto-save, replace draft badge with `.badge-saved` briefly (3 seconds), then remove
- If offline, save to localStorage with a visual warning banner: "⚠ Offline — changes saved locally"

**Edit state:**
- Edited sections show a colored left border (`--amber-border`) to indicate uncommitted changes
- The editor name and datetime last edited appear in muted text below the card header
- A history of edits per section is accessible via a "View edits" link (opens a modal or expandable log)

**Save as Draft:**
- Draft notes are not visible to Non-Author/Doctors
- Draft badge appears in the Note Timeline tab

**Publish / Finalize:**
- Replaces the draft badge with `.badge-published`
- Note becomes visible to all authorized users

### 7.4 Progress Notes

Progress notes are created per visit. The first progress note's Problem List is seeded from the Assessment of the Initial Note.

**Sections of the Progress Note (in order):**

1. **Latest Vital Signs** — same as Initial Note, pre-filled read-only
2. **Subjective** *(required)* — free text
3. **Objective** *(required)* — free text
4. **Labs and Imaging Results** — upload or text; displays a table of prior labs grouped by tag with dates
5. **Problem List** — read-only view of current problems with inline edit option
6. **Non-pharmacologic Management** — editable, carries forward from last note
7. **Diagnostics** — pre-filled with tags from the previous consult; author can add, edit, or remove
8. **Medication List** — editable, carries forward from last note's medication list

All auto-save, draft, edit history, and publish behaviors are identical to the Initial Note.

### 7.5 Note Timeline

The Note Timeline is the primary longitudinal view. It shows all notes in reverse chronological order (newest first).

- Each entry shows: date, time, physician name, note type (Initial / Progress), status badge, and a link to view the full note
- Changes to the Problem List and Medication List during that visit are summarized (first line only, expandable on click)
- The timeline rail width is `260px` on large viewports; hidden on collapse
- Clicking a note entry opens the note in the main area (read or edit depending on role and authorship)

### 7.6 Problem List

Each patient has exactly one Problem List. It is shared across all notes and always reflects the latest state.

**Problem entry fields:**
- Problem name (text)
- Status: Active (default) / Resolved / Removed
- Priority order (drag to reorder, or up/down arrow buttons — arrow buttons preferred for older users)
- Hierarchy: a child problem can be nested under a parent; indicated by indentation and a connecting line

**Status behavior:**
- **Active** — shown at the top, `.badge-active`
- **Resolved** — moved to the end of the list, `.badge-resolved`, shown in muted text
- **Removed** — deleted from the list entirely (soft-delete for audit; removed from display)

**Nesting behavior:**
- A child problem is indented `16px` and connected to its parent with a vertical accent line (`--accent-light`)
- A child can be promoted to a standalone problem (removes nesting) or re-nested under a different parent
- Maximum nesting depth: 2 levels (parent → child only; no grandchild nesting)

**Keyboard controls:**
- Tab to move between problem entries
- Arrow Up/Down to change sort order
- Enter to open the edit dialog for that entry

### 7.7 Medication List

Each patient has one Medication List, shared across notes.

**Each medication entry contains:**
- **Name** — selected from a standardized drug list (searchable dropdown)
- **Dose** — float input
- **Unit** — dropdown: mg (default), g, mcg, ml, units
- **Instructions** — free text, max 50 characters
- **Quantity** — integer input

**List behavior:**
- Entries can be added, edited, and deleted by Doctor; Admin has full access; Nurse can view only
- In the Initial Note and Progress Note, the Medication List is pre-filled (copy-forward) from the most recent prior list; the author can modify it
- Deleted entries are soft-deleted (retained for audit log)

### 7.8 Document Generation

Available to all roles. Generates PDF files from the patient record.

**Document types:**

| Document | Roles |
|---|---|
| Medical Certificate | Doctor, Admin |
| Lab Test Request List | Doctor, Admin |
| Prescription | Doctor, Admin |
| Charge Slip (Diagnostics) | Nurse, Admin |
| Charge Slip (Medications) | Nurse, Admin |

Doctor role cannot generate Charge Slips. Nurse role can generate all including Charge Slips. Admin can generate all types.

Document generation opens in the Documentation Panel (right side, 420px wide, toggleable). The panel shows a preview before downloading. Output is a downloadable PDF.

### 7.9 Audit Logs

Available to Admin only. Accessible via the Logs tab.

- Shows all create, edit, and delete actions across all patient records
- Columns: DateTime, User, Role, Action, Patient, Section affected
- Filterable by date range, user, and action type
- Rendered as a `.data-table` with monospace timestamps

---

## 8. Role-Based Access

| Action | Admin | Doctor | Nurse |
|---|---|---|---|
| View Dashboard | ✓ | ✓ | ✓ |
| Add/Edit Vital Signs | ✓ | ✓ | ✓ |
| Delete Vital Signs | ✓ | ✓ | ✗ |
| View Notes | ✓ | ✓ | ✓ |
| Create/Edit Initial Note | ✓ | ✓ (author only) | ✗ |
| Create/Edit Progress Note | ✓ | ✓ (author only) | ✗ |
| Edit Problem List | ✓ | ✓ | ✗ |
| Edit Medication List | ✓ | ✓ | ✗ |
| Generate Medical Certificate | ✓ | ✓ | ✗ |
| Generate Lab Request / Prescription | ✓ | ✓ | ✓ |
| Generate Charge Slip | ✓ | ✗ | ✓ |
| View Audit Logs | ✓ | ✗ | ✗ |
| New Patient Registration | ✓ | ✓ | ✗ |

The active role is always displayed in the **role pill** in the topbar. UI elements that the current role cannot access are hidden entirely — not disabled/grayed out — unless the visibility of the control itself communicates important state to the user.

---

## 9. New Patient Form

**Patient registration fields:**

| Field | Type | Constraint |
|---|---|---|
| Last Name | Text | 30 characters |
| First Name | Text | 30 characters |
| Middle Name | Text | 30 characters |
| Extension (Jr., Sr., III) | Text | 3 characters |
| Date of Birth | Date picker | |
| Age | Derived (read-only) | Auto-calculated from DOB |
| Sex | Select | Male / Female |
| Street Address | Free text | |
| Barangay | Searchable list | |
| City / Municipality | Searchable list | |
| Region | Searchable list | |
| Country | Read-only | Philippines (fixed) |

Physician fields (same name format constraints) are auto-populated from the logged-in user's profile. Visit date and time default to current datetime.

---

## 10. Accessibility

### 10.1 Focus States

All interactive elements (buttons, inputs, tabs, sidebar items) must have a visible focus ring:

```css
*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

Never remove focus outlines entirely. The default browser outline is replaced by the accent-colored outline above.

### 10.2 ARIA Labels

- All icon-only buttons must have `title` and `aria-label` attributes
- All form inputs must have corresponding `<label>` elements linked via `for`/`id`
- Collapsible sections must use `aria-expanded` to indicate open/closed state
- Status badges must include a text equivalent (tooltip or visually hidden span) when color is the only differentiator
- Allergy warning icons must have `title` attributes with the allergen name

### 10.3 Contrast

All text/background combinations must meet WCAG 2.2 AA (4.5:1 for body text, 3:1 for large text). The color palette defined in Section 2.1 is pre-validated for these ratios. Do not introduce custom colors without running a contrast check.

### 10.4 Text Zoom Support

The layout must remain usable when the browser is zoomed to 150%. Use relative units (`rem`, `em`, `%`) for font sizes in accessible components. Fixed pixel values for layout dimensions (`--topbar-h`, `--sidebar-w`) are acceptable as long as they do not clip zoomed text.

### 10.5 Keyboard Navigation

- Tab order must follow visual reading order (left-to-right, top-to-bottom)
- Screen nav tabs are keyboard-accessible with arrow keys
- Problem list reordering supports keyboard via arrow-key buttons (not drag-only)
- Modal focus must be trapped within the modal when open; restores focus to the trigger on close
- Pressing Escape closes modals, dropdowns, and the documentation panel

---

## 11. Validation Rules

All validation errors must be displayed inline, directly below the offending field. Never use alert() dialogs for validation. Errors use `--red` text (12px/400) with a `--red-border` field border highlight.

| Field | Rule |
|---|---|
| Patient / Physician names | Last, First, Middle: 30 chars max; Extension: 3 chars max |
| Date of Birth | Valid date, must be in the past |
| Age | Auto-derived from DOB, not editable |
| Address | Barangay/City/Region from dropdown lists; Country fixed to Philippines |
| Visit datetime | Valid datetime, not in the future |
| Systolic BP | Integer, 50–300 |
| Diastolic BP | Integer, 20–200 |
| Heart Rate | Integer, 20–300 |
| Respiratory Rate | Integer, 5–60 |
| Temperature | Float, 30.0–45.0 |
| O₂ Saturation | Integer, 50–100 |
| Chief Complaint | Free text, max 50 characters |
| Medication Dose | Float, greater than 0 |
| Medication Unit | One of: mg, g, mcg, ml, units |
| Medication Instructions | Free text, max 50 characters |
| Medication Quantity | Integer, greater than 0 |
| Lab/Imaging attachments | JPEG, PNG, PDF only |

Required fields (marked with *) block note publishing but not auto-save as draft.

---

## 12. Scrollbar Styling

```css
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: var(--surface); }
::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
```

Thin scrollbars keep the interface clean. Never hide scrollbars from scrollable areas — this disorients older users who rely on them as wayfinding cues.

---

## 13. Notifications and Feedback

### 13.1 Auto-save States

| State | Visual | Duration |
|---|---|---|
| Unsaved changes | `.badge-draft` in card header | Until saved |
| Saving in progress | Spinner + "Saving…" text, muted | During request |
| Saved | `.badge-saved` briefly | 3 seconds, then removed |
| Offline | Amber banner at top of note workspace: "⚠ Offline — changes saved locally" | Until reconnected |

### 13.2 Toast Notifications

Use for non-blocking feedback: successful publishes, errors, and system messages. Toasts appear in the bottom-right corner. Maximum 3 stacked toasts at once.

| Type | Background | Border | Usage |
|---|---|---|---|
| Success | `--green-bg` | `--green-border` | "Note published successfully" |
| Warning | `--amber-bg` | `--amber-border` | "Vital signs not recorded today" |
| Error | `--red-bg` | `--red-border` | "Failed to save — check connection" |
| Info | `--blue-bg` | `--blue-border` | "Viewing note authored by Dr. Reyes" |

Toasts auto-dismiss after 5 seconds. Include an × close button.

### 13.3 48-Hour Visual Indicator

On the Dashboard, sections that were edited within the last 48 hours display:
- A teal status dot (`.sd-teal`) next to the section title
- A `.card.updated` left border (3px accent teal)
- The "Last updated" timestamp in `--text-secondary` (not muted) for emphasis

---

## 14. Shadcn/UI Component Mapping

Since the production stack uses shadcn/ui with Tailwind CSS, below are the recommended mappings from this design system to shadcn components:

| Design Element | Shadcn Component | Notes |
|---|---|---|
| `.card` | `Card`, `CardHeader`, `CardContent` | Override border-radius to 8px |
| `.sec-btn` | `Button` variant="outline" | Match sizing and font weight |
| `.sec-btn.primary` | `Button` variant="default" | Override to `--accent` color |
| `.sec-btn.destructive` | `Button` variant="destructive" | Use as-is |
| `.field-input` | `Input` | Match height to 34px |
| `.field-textarea` | `Textarea` | Match resize behavior |
| Dropdowns | `Select`, `Combobox` | Use for Barangay, Medication Name |
| `.modal` | `Dialog` | Match sizing and overlay |
| `.badge-*` | `Badge` | Custom variants per color |
| Collapsible sections | `Collapsible` | Pair with ChevronDown icon |
| Date inputs | `Popover` + `Calendar` | Use for DOB and visit datetime |
| Toasts | `Sonner` or `Toast` | Configure position to bottom-right |
| Tables | `Table` | Override header size to 9px |

All shadcn components must have their default colors overridden in `tailwind.config.ts` to use the design token values from Section 2.1.

---

*End of DAMAYAN Design Standards v1.0*
*Prepared for DAMAYAN project at UP-PGH · Primary Care Clinical Note Interface*