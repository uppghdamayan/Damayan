# DAMAYAN EMR — Design Standards

**Version 2.1 · Tailwind CSS + shadcn/ui + Next.js**  
*Aligned with Wireframe3 · Problem-Oriented Dynamic Clinical Note Interface for Primary Care*  
*v2.1: extends minimum supported viewport from 1280px down to 768px (small tablets) — see §4.2–§4.4.*

---

## 1. Guiding Principles

DAMAYAN is used primarily by doctors and medical personnel in a clinical setting. The interface must be designed with the following priorities:

1. **Clarity over cleverness.** Every label, button, and section must be immediately understandable without prior training.
2. **Reduce cognitive load.** The system organizes information by problem, not by visit. Users should never scroll through previous notes to understand the current state of a patient.
3. **Large, readable text.** Minimum body font size of `text-[13px]`, with all critical values (vitals, problem names) at `text-[15px]` to `text-lg`. The interface must support browser zoom up to 150% without breaking layouts. **This floor never drops further at smaller breakpoints** — down to the minimum supported width of 768px, body text stays at `13px` and form inputs stay at `13px`/`h-[34px]` or larger. When space is tight, remove or icon-ify chrome (labels, wordmarks, secondary text) rather than shrinking readable content below these floors.
4. **High contrast.** All text/background combinations must meet WCAG 2.2 AA (4.5:1 for body, 3:1 for large text).
5. **Keyboard navigability.** All forms must be completable using only the keyboard. Tab order must match the visual reading flow.
6. **Single-page, no multi-window.** Each patient's workspace is contained in one screen.
7. **Auto-save always on.** Drafts are saved continuously in the background. Doctors should never lose note progress.

---

## 2. Tailwind Configuration

### 2.1 `tailwind.config.ts`

Extend Tailwind's theme to map all design tokens as CSS custom properties. Use `hsl()` values with Tailwind's standard `<alpha-value>` convention so opacity modifiers work (e.g. `bg-accent/20`).

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surface hierarchy
        bg:         "var(--bg)",
        surface:    "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",

        // Borders
        border:        "var(--border)",
        "border-strong": "var(--border-strong)",

        // Text hierarchy
        "text-primary":   "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted":     "var(--text-muted)",

        // Brand / accent
        accent:       "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-light": "var(--accent-light)",
        "accent-mid":   "var(--accent-mid)",

        // Semantic palettes
        amber:        "var(--amber)",
        "amber-bg":   "var(--amber-bg)",
        "amber-border": "var(--amber-border)",

        red:          "var(--red)",
        "red-bg":     "var(--red-bg)",
        "red-border": "var(--red-border)",

        blue:         "var(--blue)",
        "blue-bg":    "var(--blue-bg)",
        "blue-border": "var(--blue-border)",

        green:        "var(--green)",
        "green-bg":   "var(--green-bg)",
        "green-border": "var(--green-border)",

        purple:       "var(--purple)",
        "purple-bg":  "var(--purple-bg)",
        "purple-border": "var(--purple-border)",
      },
      fontFamily: {
        sans:  ["IBM Plex Sans", "sans-serif"],
        mono:  ["IBM Plex Mono", "monospace"],
      },
      borderRadius: {
        card:   "8px",
        btn:    "6px",
        pill:   "20px",
        avatar: "50%",
        icon:   "6px",
      },
      height: {
        topbar:  "var(--topbar-h)",
        "snav":  "52px",
        "tb-btn": "34px",
        "sec-btn": "28px",
      },
      width: {
        sidebar:   "var(--sidebar-w)",
        "doc-panel": "var(--documentation-panel-width)",
        timeline:  "var(--timeline-w)",
      },
      boxShadow: {
        card:   "0 4px 12px rgba(0,0,0,0.05)",
        "btn-primary": "0 2px 4px rgba(10,110,95,0.15)",
        "btn-primary-hover": "0 4px 8px rgba(10,110,95,0.20)",
        "accent-focus": "0 0 0 3px rgba(10,110,95,0.12)",
        modal:  "0 20px 60px rgba(0,0,0,0.20)",
      },
      fontSize: {
        "page-title":    ["20px", { fontWeight: "700" }],
        "section-title": ["15px", { fontWeight: "700" }],
        "vital-value":   ["18px", { fontWeight: "500" }],
        "body":          ["13px", { fontWeight: "400" }],
        "label":         ["12px", { fontWeight: "500" }],
        "meta":          ["11px", { fontWeight: "400" }],
        "badge":         ["9px",  { fontWeight: "700" }],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

### 2.2 CSS Custom Properties (`globals.css`)

```css
/* app/globals.css */
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Surface */
    --bg:          #F0F2F5;
    --surface:     #FFFFFF;
    --surface-2:   #F7F8FA;
    --surface-3:   #EFF1F5;

    /* Borders */
    --border:        #D1D5E0;
    --border-strong: #9BA3B5;

    /* Text */
    --text-primary:   #0D1117;
    --text-secondary: #374151;
    --text-muted:     #6B7280;

    /* Accent */
    --accent:       #0A6E5F;
    --accent-hover: #085A4E;
    --accent-light: #D4EDE9;
    --accent-mid:   #0D9E8C;

    /* Semantic */
    --amber:        #92400E;
    --amber-bg:     #FEF3C7;
    --amber-border: #F59E0B;

    --red:          #991B1B;
    --red-bg:       #FEE2E2;
    --red-border:   #EF4444;

    --blue:         #1E3A8A;
    --blue-bg:      #DBEAFE;
    --blue-border:  #3B82F6;

    --green:        #14532D;
    --green-bg:     #DCFCE7;
    --green-border: #22C55E;

    --purple:       #4C1D95;
    --purple-bg:    #EDE9FE;
    --purple-border:#8B5CF6;

    /* Layout dimensions */
    --topbar-h:                   56px;
    --sidebar-w:                  280px;
    --documentation-panel-width:  420px;
    --timeline-w:                 260px;
  }

  /* Desktop / compact (1280px–1439px) */
  @media (max-width: 1439px) {
    :root {
      --sidebar-w:                 220px;
      --documentation-panel-width: 340px;
      --timeline-w:                200px;
      --topbar-h:                  52px;
    }
  }

  /* Tablet landscape (1024px–1279px) — sidebar becomes an overlay drawer,
     doc panel becomes a full overlay, topbar right-zone labels start
     collapsing into icons */
  @media (max-width: 1279px) {
    :root {
      --sidebar-w:                 240px;  /* overlay width, not in-flow */
      --documentation-panel-width: 100%;   /* full overlay, see §4.4 */
      --timeline-w:                180px;
      --topbar-h:                  50px;
    }
  }

  /* Small tablet / minimum supported viewport (768px–1023px) — header is
     fully icon-driven, single-column layouts throughout */
  @media (max-width: 1023px) {
    :root {
      --sidebar-w:                 260px;  /* overlay width */
      --documentation-panel-width: 100%;
      --timeline-w:                160px;
      --topbar-h:                  48px;
    }
  }

  html, body { height: 100%; }

  body {
    @apply font-sans text-[13px] leading-[1.5] bg-bg text-[var(--text-primary)] overflow-hidden;
    height: 100vh;
  }

  /* WCAG 2.2 AA focus ring */
  *:focus-visible {
    @apply outline-2 outline-offset-2 outline-accent;
  }

  /* Thin scrollbars */
  ::-webkit-scrollbar { @apply w-[5px] h-[5px]; }
  ::-webkit-scrollbar-track { @apply bg-surface; }
  ::-webkit-scrollbar-thumb { @apply bg-border-strong rounded-[10px]; }
  ::-webkit-scrollbar-thumb:hover { @apply bg-text-muted; }
}
```

---

## 3. Typography

**Primary:** IBM Plex Sans · **Monospace:** IBM Plex Mono

Both loaded via Google Fonts. Never substitute with system fonts in production.

| Role | Tailwind Class | Size | Weight |
|---|---|---|---|
| Page Title | `text-[20px] font-bold` | 20px | 700 |
| Section Title | `text-[15px] font-bold` | 15px | 700 |
| Vital Value | `font-mono text-[18px] font-medium` | 18px | 500 |
| Body | `text-[13px] font-normal` | 13px | 400 |
| Label / Nav Tab | `text-[12px] font-medium` | 12px | 500 |
| Meta / Caption | `text-[11px]` | 11px | 400–600 |
| Badge / Uppercase Label | `text-[9px] font-bold uppercase tracking-[0.5px]` | 9px | 700 |

**Text color hierarchy:**
- Critical clinical data: `text-[var(--text-primary)]`
- Body and form text: `text-[var(--text-secondary)]`
- Meta / timestamps: `text-[var(--text-muted)]`

Never use `text-muted` for mandatory fields or primary clinical data.

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
│  = 0px)      │ DOC PANEL (420px, right,     │
│              │ toggleable + resizable)      │
└──────────────┴──────────────────────────────┘
```

```tsx
// app/dashboard/layout.tsx — structural shell
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="shell" className="h-screen bg-bg font-sans flex flex-col overflow-hidden">
      <Topbar />
      <div id="body" className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div id="middle-column" className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
        <DocumentationPanel />
      </div>
      <NarrowScreenNotice />
    </div>
  );
}

// app/dashboard/[patientId]/layout.tsx — patient workspace wrapper
export default function PatientWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <ScreenNav patientId={patientId} />
      <div className="flex-1 overflow-y-auto px-5 py-4 max-[1439px]:px-[14px] max-[1023px]:p-3">
        <div className="flex flex-col gap-3">
          {/* Page title and subtitle rendered here */}
          {children}
        </div>
      </div>
    </div>
  );
}
```

### 4.2 Responsive Breakpoints

DAMAYAN supports a **minimum viewport of 768×1024px** (small tablets, e.g. iPad Mini in portrait) up through desktop. The layout progressively converts persistent chrome — sidebar, doc panel, navigation labels — into space-saving states rather than shrinking content. Readable text (body, inputs, clinical values) never drops below the floors set in §1.3, at any breakpoint.

| Breakpoint | Width | Notes |
|---|---|---|
| `desktop-lg` | ≥ 1440px | Default layout. Sidebar and doc panel are in-flow columns. Both can be open simultaneously. |
| `desktop` | 1101px–1439px | Reduced sidebar/panel widths, compact padding. Sidebar and doc panel still in-flow and can both be open. |
| `tablet-lg` | 768px–1100px | Sidebar and doc panel remain **in-flow columns** (inline) and push the content rather than overlaying the navbar/dashboard. To prevent screen crowding, **they are mutually exclusive** (opening one automatically closes the other). ScreenNav tabs collapse into icons when any panel is open (with fluid hover expansion). |
| `mobile` | < 768px | Fullscreen overlay drawers are used for side panels on phones (or fullscreen notice). |

Below 768px, show a fullscreen notice (phones are not supported):

```tsx
// components/layout/NarrowScreenNotice.tsx
export function NarrowScreenNotice() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg p-8 text-center hidden max-[767px]:flex">
      <div className="max-w-sm">
        <p className="text-[15px] font-bold text-text-primary mb-2">
          Screen too narrow
        </p>
        <p className="text-[13px] text-text-muted">
          DAMAYAN is designed for tablet, laptop, or desktop screens.
          Please use a device with a screen width of at least 768px.
        </p>
      </div>
    </div>
  );
}
```

#### Responsive Adaptations at 1280px (Desktop / Compact)

**Sidebar (220px at 1280px):**
- Patient name: `max-w-[130px] truncate`
- Meta row: hide patient ID (`hidden` on `#ID` span)
- "Add New Patient" → "New Patient"
- Sidebar defaults to **collapsed on first load** at 1280px

**Screen Nav Tabs at 1280px:**
- Labels shorten: "Note Timeline ★" → "Timeline", "Medications" → "Meds", "Documents" → "Docs"
- Tabs scroll horizontally: `overflow-x-auto` with hidden scrollbar

**Vitals Strip at 1280px:**
- Sidebar open: `grid-cols-3` (row 1) + `grid-cols-2` (row 2)
- Sidebar collapsed: `grid-cols-5` (single row restored)
- Vital value: `text-[16px]`, vital label: `text-[8px]`

**Dashboard Cards at 1280px:**
- Medication + Problem List: `grid-cols-2` → `grid-cols-1` (sidebar open), restore `grid-cols-2` when collapsed

**Documentation Panel at 1280px:**
- Reduces to 340px
- When open with sidebar open: sidebar auto-collapses; show notice: "Sidebar hidden while document panel is open"

**Form fields at 1280px:**
- `.field-row` gap: `gap-3` → `gap-2`
- `.field-row-3`: `grid-cols-3` → `grid-cols-2` (sidebar open)

**Modal at 1280px:** `max-w-[460px]` (default `max-w-[520px]`)

#### Responsive Adaptations at 1024px (Tablet Landscape)

This tier introduces the first structural shift: **the sidebar and documentation panel stop taking up in-flow width** and become overlay drawers so the main content area keeps a usable minimum width.

- **Sidebar** → overlay drawer (`fixed`, slides in from the left over a scrim), triggered by the topbar menu icon. Never pushes content; closes on scrim click, `Escape`, or patient selection.
- **Documentation panel** → overlay drawer (`fixed`, slides in from the right, `w-full max-w-[420px]`), same dismiss behavior. See §4.4.
- **Topbar right zone:** "New Note" button becomes icon-only (`+` icon, `w-9 h-9`) with a tooltip and `aria-label="New Note"`. Doctor name/role text block hides; only the avatar remains, revealing name/role in a dropdown on tap.
- **Screen Nav Tabs:** icon + short label (`Timeline`, `Meds`, `Docs`) as at 1280px, still horizontally scrollable.
- **Vitals Strip:** `grid-cols-3` regardless of sidebar state (sidebar no longer competes for width since it's an overlay).
- **Dashboard Cards:** Medication + Problem List stay `grid-cols-2` down to this tier since the sidebar no longer takes width; drop to `grid-cols-1` only at 1023px.
- **Modal:** `max-w-[420px]`.

#### Responsive Adaptations at 768px (Small Tablet — icon-driven header)

This is the minimum supported width. The header is fully icon-driven and every grid collapses to a single column so nothing gets cramped or illegible. See §4.3 for the icon-only header spec and §4.4 for overlay panel behavior.

- **Topbar:** wordmark text ("DAMAYAN EMR") hides — only the logo mark icon remains. Active-patient chip shrinks to avatar + initials only (full name in a tap-to-expand popover). "New Note" stays icon-only. Doctor avatar only, no name/role text, no divider.
- **Sidebar:** overlay drawer widens to `w-[260px]` (comfortable touch target list); patient row meta keeps ID visible since there's no competing width constraint.
- **Screen Nav Tabs:** collapse to **icon-only** buttons (`w-9 h-9`) with `aria-label` + tooltip; active tab keeps its label visible (`icon + label`) so context is never fully hidden. See §4.3.
- **Vitals Strip:** `grid-cols-2`; vital value stays at `text-[16px]` (does not shrink further — see §1.3 readability floor).
- **Dashboard Cards:** all grids (`grid-cols-2` / `grid-cols-3`) collapse to `grid-cols-1`, including Medication + Problem List and any field-row layouts.
- **Form fields:** `.field-row` and `.field-row-3` both collapse to `grid-cols-1`; inputs grow to `h-[38px]` (from `h-[34px]`) for touch accuracy while keeping `text-[13px]`.
- **Modal:** `max-w-[92vw]`, capped at `380px`.
- **Documentation panel:** full-screen overlay (`w-full`), not a fixed-width drawer.

#### Sidebar Behavior Across Breakpoints

```tsx
// Sidebar mode — persisted to localStorage, recalculated on resize
type SidebarMode = "inline-open" | "inline-collapsed" | "overlay";

function useSidebarMode() {
  const [width, setWidth] = useState(
    typeof window === "undefined" ? 1440 : window.innerWidth
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ≥1280px: in-flow column (open/collapsed, persisted preference)
  // <1280px: overlay drawer, closed by default, never reflows content
  const mode: SidebarMode =
    width >= 1280
      ? (localStorage.getItem("damayan-sidebar") === "closed" ? "inline-collapsed" : "inline-open")
      : "overlay";

  return mode;
}
```

```tsx
// ≥1280px — in-flow column
<aside
  className={cn(
    "bg-surface border-r border-border flex-shrink-0 overflow-y-auto overflow-x-hidden transition-[width] duration-300 ease-in-out",
    "hidden min-[1280px]:block",
    sidebarOpen ? "w-[var(--sidebar-w)]" : "w-0 border-r-transparent"
  )}
>
  <div className="w-[var(--sidebar-w)]">{/* sidebar content */}</div>
</aside>

// <1280px — overlay drawer
<>
  <div
    onClick={closeSidebar}
    className={cn(
      "fixed inset-0 bg-black/40 z-[300] transition-opacity max-[1279px]:block hidden",
      sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
    )}
  />
  <aside
    className={cn(
      "fixed top-[var(--topbar-h)] left-0 bottom-0 z-[310] bg-surface border-r border-border overflow-y-auto",
      "w-[var(--sidebar-w)] transition-transform duration-200 ease-out",
      sidebarOpen ? "translate-x-0" : "-translate-x-full"
    )}
  >
    {/* sidebar content */}
  </aside>
</>
```

### 4.3 Header Text → Icon Transition

Below `1024px`, topbar and screen-nav labels progressively convert to icons rather than shrinking text. The rule of thumb: **anything with an unambiguous icon becomes icon-only + tooltip + `aria-label`; anything without one (patient name, page title) truncates instead of disappearing.**

| Element | ≥1280px | 1024–1279px | 768–1023px |
|---|---|---|---|
| Logo wordmark | "DAMAYAN EMR" text | "DAMAYAN EMR" text | Logo mark icon only |
| "New Note" button | Icon + "New Note" label | Icon only + tooltip | Icon only + tooltip |
| Doctor name/role | Name + role text + avatar | Avatar only (tap for dropdown) | Avatar only (tap for dropdown) |
| Active patient chip | Avatar + full name + meta | Avatar + full name + meta | Avatar + initials (tap to expand) |
| Screen nav tab labels | Full label | Short label (`shortLabel`) | Icon only + tooltip (active tab keeps label) |
| Sidebar toggle | Icon | Icon | Icon |

```tsx
// Generic icon-collapsing button used across the topbar
function HeaderAction({
  icon,
  label,
  compact,
}: { icon: React.ReactNode; label: string; compact: boolean }) {
  return (
    <Button
      variant="ghost"
      size={compact ? "icon" : "default"}
      aria-label={label}
      title={label}
      className={cn(
        "h-9",
        compact ? "w-9 px-0 justify-center" : "px-3 gap-1.5"
      )}
    >
      {icon}
      {!compact && <span className="text-[12px] font-medium whitespace-nowrap">{label}</span>}
    </Button>
  );
}

// compact = viewport < 1024px, driven by a shared useBreakpoint() hook
```

Every icon-only control keeps its `aria-label` and a native `title` tooltip — icon-only is a visual simplification, not an accessibility reduction.

### 4.4 Overlay Panels (Sidebar & Documentation Panel below 1280px)

Below `1280px`, both the patient sidebar and the documentation panel switch from in-flow columns to `fixed` overlays so the main content column never gets squeezed below a usable width:

- **1024–1279px:** doc panel overlay is `w-full max-w-[420px]`, anchored right, with the same scrim/`Escape`/focus-trap behavior as a modal.
- **768–1023px:** doc panel overlay is `w-full` (true full-screen), since 420px would leave almost no room for the note fields on a small-tablet viewport.
- Opening the sidebar overlay while the doc panel overlay is open (or vice versa) closes the other — only one overlay panel is shown at a time below 1280px.
- Both overlays use `role="dialog"` semantics: focus trap while open, restore focus to the trigger on close, `Escape` closes.

```tsx
// Documentation panel — overlay variant used below 1280px
<div
  onClick={closePanel}
  className={cn(
    "fixed inset-0 bg-black/40 z-[400] max-[1279px]:block hidden",
    panelOpen ? "opacity-100" : "opacity-0 pointer-events-none"
  )}
/>
<aside
  role="dialog"
  aria-modal="true"
  className={cn(
    "fixed top-0 right-0 bottom-0 z-[410] bg-surface flex flex-col",
    "w-full max-[1023px]:max-w-none max-[1279px]:max-w-[420px]",
    "transition-transform duration-200 ease-out",
    panelOpen ? "translate-x-0" : "translate-x-full"
  )}
>
  {/* same header + scrollable body as the in-flow variant in §7.5 */}
</aside>
```

---

## 5. Navigation

### 5.1 Topbar

```tsx
// components/layout/Topbar.tsx
// Below 1280px the sidebar is an overlay, so the logo no longer needs to
// match --sidebar-w; below 1024px the wordmark hides; below 768px the
// patient chip shrinks to avatar-only and the doctor block loses its text.
<header className="h-[var(--topbar-h)] bg-surface border-b border-border flex items-center px-4 max-[1023px]:px-3 gap-3 sticky top-0 z-[200] shrink-0">
  {/* Sidebar toggle — always visible; opens overlay drawer below 1280px */}
  <button
    onClick={toggleSidebar}
    aria-label="Toggle sidebar"
    title="Toggle sidebar"
    className="w-8 h-8 bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center rounded-btn cursor-pointer shrink-0"
  >
    <Menu className="w-[18px] h-[18px] text-text-secondary" />
  </button>

  {/* Logo — fixed width only ≥1280px (matches in-flow sidebar); auto width below that */}
  <div className="flex items-center gap-2 min-[1280px]:w-[var(--sidebar-w)] flex-shrink-0 overflow-hidden">
    <div className="w-[22px] h-[22px] bg-accent rounded-[5px] flex items-center justify-center flex-shrink-0">
      <PlusCircle size={12} color="white" strokeWidth={3} />
    </div>
    {/* wordmark hides below 1024px; icon mark alone is enough to identify the app */}
    <span className="text-[16px] font-bold tracking-[0.5px] whitespace-nowrap text-text-primary max-[1023px]:hidden">
      DAMAYAN <small className="text-[9px] font-semibold text-text-muted tracking-[1px] uppercase mt-[3px]">EMR</small>
    </span>
  </div>

  {/* Active patient chip (centered) */}
  <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface-2 border border-accent rounded-full px-3.5 py-1 max-[767px]:px-1.5 max-[767px]:py-1 cursor-pointer shadow-sm z-10">
    <div className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[9px] font-bold">
      MC
    </div>
    {/* full name + meta hide below 768px — tap the chip to expand a popover with the same info */}
    <span className="text-[11px] font-semibold text-text-primary max-[767px]:hidden">
      Cruz, Maria Santos
    </span>
    <span className="font-mono text-[9px] text-text-muted max-[767px]:hidden">
      #PT-0012
    </span>
  </div>

  <div className="flex-1" />

  {/* Right zone */}
  <div className="flex items-center gap-2 shrink-0">
    {/* "New Note" — label hides below 1024px, icon + tooltip remains */}
    <button
      aria-label="New Note"
      title="New Note"
      className="h-[34px] px-3.5 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center justify-center gap-[5px] whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50 max-[1023px]:w-9 max-[1023px]:px-0"
    >
      <Plus className="w-3.5 h-3.5" />
      <span className="max-[1023px]:hidden">New Note</span>
    </button>
    {/* Doctor name + avatar — text hides below 1024px, avatar opens a dropdown with name/role on tap */}
    <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border shrink-0 max-[1023px]:pl-0 max-[1023px]:ml-0 max-[1023px]:border-l-0">
      <div className="flex flex-col items-center leading-tight justify-center max-[1023px]:hidden">
        <span className="text-[12px] font-semibold text-text-primary mb-1">Dr. Ana M. Reyes</span>
        <span className="inline-flex items-center justify-center px-1.5 py-[2px] rounded text-[9px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-200">Doctor</span>
      </div>
      <div className="w-8 h-8 rounded-full bg-accent-hover text-white text-[11px] font-bold border-2 border-border flex items-center justify-center shrink-0 cursor-default">
        AR
      </div>
    </div>
    {/* Sign out */}
    <button className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center justify-center gap-[5px] whitespace-nowrap cursor-pointer shrink-0">
      Sign Out
    </button>
  </div>
</header>
```

**Role pill:**
```tsx
<span className="inline-flex items-center justify-center px-1.5 py-[2px] rounded text-[9px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-200">
  Doctor
</span>
```

### 5.2 Patient Sidebar

```tsx
// components/layout/Sidebar.tsx
<div className="sticky top-0 z-10 flex flex-col gap-2 p-3 border-b border-border bg-surface shrink-0">
  <div className="flex items-center gap-2 h-[34px] bg-surface-2 border border-border rounded-btn px-3 focus-within:border-accent focus-within:shadow-accent-focus transition-all">
    <Search className="w-4 h-4 text-text-muted shrink-0" strokeWidth={2} />
    <input
      className="flex-1 bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted font-sans"
      placeholder="Search patients…"
    />
  </div>
  <button className="w-full h-[28px] bg-accent hover:bg-accent-hover text-white text-[11px] font-semibold justify-center gap-1 inline-flex items-center rounded-btn cursor-pointer transition-colors duration-150">
    <Plus className="w-3 h-3" /> New Patient
  </button>
</div>

{/* Patient rows */}
<Link
  className={cn(
    "flex items-center gap-2.5 mx-3.5 my-[6px] px-3 py-2.5 rounded-card border cursor-pointer transition-all duration-150 text-left w-[calc(100%-28px)] font-sans",
    isActive
      ? "bg-accent-light border-accent shadow-sm"
      : "bg-surface border-border hover:bg-surface-2 hover:border-border-strong"
  )}
>
  <div
    className={cn(
      "w-8 h-8 text-[11px] font-bold flex-shrink-0 rounded-full flex items-center justify-center border transition-colors duration-150",
      isActive
        ? "bg-accent text-white border-accent"
        : "bg-surface-2 text-text-secondary border-border"
    )}
  >
    MC
  </div>
  <div className="flex-1 min-w-0">
    <div className="text-[12px] font-semibold text-text-primary truncate">
      Cruz, Maria Santos
    </div>
    <div className="font-mono text-[10px] text-text-muted truncate mt-0.5">
      F · 34 yrs · #PT-0012
    </div>
  </div>
  <div className="flex flex-col items-end gap-1 flex-shrink-0">
    {hasAllergy && (
      <span className="text-red text-[12px] font-bold" title="Allergies: Penicillin">
        ⚠
      </span>
    )}
    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
  </div>
</Link>
```

**Active state:** replace `border-border` with `border-accent`, `bg-surface` with `bg-accent-light`.

### 5.3 Screen Navigation Tabs

```tsx
<nav className="flex items-center gap-1.5 bg-surface border-b border-border px-4 max-[1023px]:px-2.5 h-[52px] flex-shrink-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
  {/* patient name hides below 768px — already shown in the topbar chip */}
  <span className="text-[11px] font-bold text-accent-mid uppercase tracking-[1px] mr-3.5 whitespace-nowrap flex-shrink-0 max-[767px]:hidden">
    {patientName}
  </span>
  {tabs.map((tab) => {
    const isActive = activeTab === tab.id;
    return (
      <Link
        key={tab.id}
        href={`${basePath}${tab.path}`}
        aria-label={tab.label}
        title={tab.label}
        className={cn(
          "h-8 text-[12px] font-medium rounded-btn border whitespace-nowrap transition-all duration-150 flex-shrink-0 cursor-pointer flex items-center justify-center inline-flex gap-1.5",
          // ≥1024px: label always shown (short label at 1024–1279px via shortLabel prop)
          // <1024px: icon-only unless the tab is active, in which case the label stays for context
          isActive || "min-[1024px]:px-3.5",
          !isActive && "max-[1023px]:w-9 max-[1023px]:justify-center max-[1023px]:px-0",
          isActive && "px-3.5",
          isActive
            ? "bg-accent text-white border-accent shadow-[0_4px_12px_rgba(10,110,95,0.25)]"
            : "bg-surface-2 text-text-secondary border-border hover:bg-surface-3 hover:border-border-strong hover:text-text-primary"
        )}
      >
        {tab.icon}
        <span className={cn(isActive ? "inline" : "max-[1023px]:hidden")}>{label}</span>
      </Link>
    );
  })}
  {/* Toggle doc panel button — far right */}
  <button
    onClick={toggleDocPanel}
    className="ml-auto h-8 px-3 rounded-btn border border-border bg-surface-2 hover:bg-surface-3 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-150"
    aria-label="Toggle documentation panel"
    title={panelOpen ? "Close documentation panel" : "Open documentation panel"}
  >
    {panelOpen ? (
      <PanelRightClose className="w-3.5 h-3.5 text-text-secondary" />
    ) : (
      <PanelRightOpen className="w-3.5 h-3.5 text-text-secondary" />
    )}
  </button>
</nav>
```

Every tab needs an `icon` field so it degrades gracefully at small-tablet width — this is a **required** field on the tab config, not optional:
```tsx
// { id, label, shortLabel, icon } — icon is required starting at this tier
const tabs = [
  { id: "timeline",   label: "Note Timeline ★", shortLabel: "Timeline", icon: <ClockIcon className="w-3.5 h-3.5" /> },
  { id: "medications", label: "Medications",     shortLabel: "Meds",     icon: <PillIcon className="w-3.5 h-3.5" /> },
  { id: "documents",   label: "Documents",       shortLabel: "Docs",     icon: <FileIcon className="w-3.5 h-3.5" /> },
];

// Label resolution by breakpoint:
// ≥1280px → tab.label
// 1024–1279px → tab.shortLabel
// ≤1023px → icon only (active tab shows shortLabel alongside the icon)
const label = width >= 1280 ? tab.label : tab.shortLabel;
```

---

## 6. Components

### 6.1 Cards

```tsx
// Base card
<div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
  {/* card.updated variant */}
  {/* add: border-l-[3px] border-l-accent */}

  {/* card.alert variant */}
  {/* add: border-l-[3px] border-l-red */}
</div>

// Card Header
<div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
  {/* Icon container */}
  <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
    🫀
  </div>
  <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">
    Latest Vital Signs
  </span>
  {/* optional badge or action */}
</div>

// Card Body
<div className="p-3 px-3.5">
  {/* content */}
</div>
```

**Last-updated timestamp** on time-sensitive cards (Vital Signs, Problem List, Medication List):

```tsx
<span className="font-mono text-[9px] text-[var(--text-muted)]">Jun 3, 2026 · 09:14</span>
```

If updated within 48 hours: prepend a `<span className="w-2 h-2 rounded-full bg-accent-mid inline-block mr-1" />` dot and upgrade text to `text-[var(--text-secondary)]`.

### 6.2 Buttons

```tsx
// cn() utility assumed available

// Primary
<button className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer">
  Save Note
</button>

// Secondary (default)
<button className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer">
  Record Vitals
</button>

// Destructive
<button className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-red-bg text-red border border-red-border hover:bg-red/15 hover:border-red/80 transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer">
  Remove Problem
</button>

// Ghost (icon-only or toggles)
<button className="h-[28px] px-2 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center gap-[5px] cursor-pointer">
  <ChevronIcon />
</button>

// Topbar button (taller)
<button className="h-[34px] px-3.5 rounded-btn ...">
  ...
</button>
```

All buttons: min tap width `min-w-[80px]`. Labels never truncate.

### 6.3 Badges

```tsx
// Base badge class
const badgeBase = "text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border inline-flex items-center";

const variants = {
  draft:     "bg-amber-bg text-amber border-amber-border",
  active:    "bg-accent-light text-accent-hover border-accent",
  resolved:  "bg-surface-2 text-[var(--text-secondary)] border-border",
  critical:  "bg-red-bg text-red border-red-border",
  saved:     "bg-green-bg text-green border-green-border",
  published: "bg-purple-bg text-purple border-purple-border",
  info:      "bg-blue-bg text-blue border-blue-border",
  removed:   "bg-surface-2 text-[var(--text-muted)] border-border",
};

// Usage
<span className={cn(badgeBase, variants.draft)}>Draft</span>
```

With shadcn/ui `Badge`, override variants in `components/ui/badge.tsx`:

```tsx
const badgeVariants = cva(
  "text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border inline-flex items-center",
  {
    variants: {
      variant: {
        draft:     "bg-[var(--amber-bg)] text-[var(--amber)] border-[var(--amber-border)]",
        active:    "bg-[var(--accent-light)] text-[var(--accent-hover)] border-[var(--accent)]",
        resolved:  "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]",
        critical:  "bg-[var(--red-bg)] text-[var(--red)] border-[var(--red-border)]",
        saved:     "bg-[var(--green-bg)] text-[var(--green)] border-[var(--green-border)]",
        published: "bg-[var(--purple-bg)] text-[var(--purple)] border-[var(--purple-border)]",
        info:      "bg-[var(--blue-bg)] text-[var(--blue)] border-[var(--blue-border)]",
        removed:   "bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]",
      },
    },
    defaultVariants: { variant: "info" },
  }
);
```

### 6.4 Form Fields

```tsx
// Field group
<div className="flex flex-col gap-1.5 mb-3">
  {/* Label */}
  <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
    Chief Complaint <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
  </label>

  {/* Text input — height grows for touch below 1024px; text size never changes */}
  <input
    className="w-full h-[34px] max-[1023px]:h-[38px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150
      focus:bg-surface focus:border-accent focus:shadow-accent-focus
      placeholder:text-text-muted"
    placeholder="e.g. Persistent headaches for 2 weeks"
  />

  {/* Textarea */}
  <textarea
    className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[80px] leading-[1.6] transition-all duration-150
      focus:bg-surface focus:border-accent focus:shadow-accent-focus"
  />
</div>

// Input with unit addon (vitals)
<div className="flex items-center border border-border rounded-[6px] bg-surface h-[34px] focus-within:border-accent focus-within:shadow-accent-focus transition-all">
  <input className="w-full bg-transparent px-3 text-[13px] text-text-primary outline-none" />
  <span className="text-[11px] text-text-muted pr-3">mmHg</span>
</div>

// Field row layouts
<div className="grid grid-cols-2 gap-3 max-[1439px]:gap-2 max-[767px]:grid-cols-1">…</div>             // .field-row
<div className="grid grid-cols-3 gap-3 max-[1439px]:grid-cols-2 max-[767px]:grid-cols-1">…</div>        // .field-row-3 (compact at 1280px with sidebar open; single column at 768px)
```

**Shadcn/ui `Input` override** in `components/ui/input.tsx`:
```tsx
// Replace className defaults to match above field-input styles
```

**Validation errors** appear inline directly below the field:
```tsx
<p className="text-[12px] text-red mt-1">Field is required.</p>
// also add: border-red-border on the input
```

### 6.5 Tables

```tsx
<table className="w-full border-collapse">
  <thead>
    <tr>
      <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] px-2.5 py-2 text-left bg-surface-2 border-b border-border">
        Medication
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="hover:bg-surface-3 transition-colors">
      <td className="px-2.5 py-2 text-[12px] text-[var(--text-secondary)] border-b border-border last:border-b-0">
        {/* value */}
      </td>
    </tr>
  </tbody>
</table>

// Value coloring utilities (apply to <td> or <span>):
// Critical: text-red font-semibold
// Warning:  text-amber font-medium
// Normal:   text-green
// Accent:   text-accent font-medium
// Mono:     font-mono
```

### 6.6 Status Dots

```tsx
const dotColors = {
  green:  "bg-[#22C55E]",
  amber:  "bg-[var(--amber)]",
  red:    "bg-[var(--red)]",
  teal:   "bg-accent-mid",
  gray:   "bg-border-strong",
};

<span className={cn("w-2 h-2 rounded-full flex-shrink-0", dotColors.green)} title="Active" />
```

Always pair color with a tooltip or text label. Never rely on color alone.

### 6.7 Modals

```tsx
// Overlay
<div className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center animate-in fade-in duration-150">
  {/* Modal box */}
  <div className="bg-surface border border-border rounded-[10px] w-[500px] max-[1439px]:w-[460px] max-[1279px]:w-[420px] max-[767px]:w-[92vw] max-[767px]:max-w-[380px] max-h-[80vh] overflow-y-auto shadow-modal">
    {/* Header */}
    <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border">
      <h2 className="text-[15px] font-bold flex-1 text-text-primary">Modal Title</h2>
      <button onClick={onClose} aria-label="Close modal"
        className="w-6 h-6 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
    {/* Body */}
    <div className="px-[18px] py-[18px]">{children}</div>
    {/* Footer */}
    <div className="flex justify-end gap-2 px-[18px] py-3 border-t border-border">{actions}</div>
  </div>
</div>
```

Closes on overlay click or `Escape`. Focus trapped within while open; restores to trigger on close (use shadcn `Dialog` — it handles this automatically).

---

## 7. Screens

### 7.1 Patient Dashboard

```tsx
// Patient Banner
<div className="relative bg-surface border border-border rounded-card p-4 flex gap-5 items-stretch flex-wrap shadow-card">
  {/* Left Column: Avatar + Name */}
  <div className="flex gap-3.5 items-center flex-[1.2] min-w-[250px] border-r border-border pr-5">
    <div className="w-11 h-11 rounded-full bg-accent-light border-2 border-accent flex items-center justify-center text-[15px] font-bold text-accent-hover flex-shrink-0">
      MC
    </div>
    <div className="text-[12px] flex flex-col gap-1 min-w-0">
      <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px]">Patient Name</span>
      <span className="text-[18px] font-bold text-text-primary leading-tight truncate">
        Cruz, Maria Santos
      </span>
      <span className="font-mono text-[10px] text-text-muted mt-1 bg-surface-2 border border-border rounded px-1.5 py-[1px] w-fit">
        #PT-0012
      </span>
    </div>
  </div>

  {/* Middle Column: Demographics */}
  <div className="flex flex-col gap-1 flex-1 min-w-[220px] border-r border-border pr-5 text-[12px] text-text-secondary justify-center">
    <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px] mb-1 block">Demographics</span>
    <div className="grid grid-cols-2 gap-x-2 gap-y-1">
      <div>Sex: <strong className="text-text-primary">Female</strong></div>
      <div>Age: <strong className="text-text-primary">34 yrs</strong></div>
      <div className="col-span-2 truncate">DOB: <strong className="text-text-primary">October 15, 1991</strong></div>
      <div className="col-span-2 truncate text-text-muted">Address: <span className="text-text-secondary">Brgy. 669, Ermita, Manila</span></div>
    </div>
  </div>

  {/* Right Column: Clinical Profile */}
  <div className="flex flex-col gap-1 flex-[0.8] min-w-[180px] text-[12px] text-text-secondary justify-center">
    <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px] mb-1 block">Clinical Profile</span>
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-[11px] font-medium text-text-muted">Allergies:</span>
        <span className="text-[9px] font-bold bg-red-bg text-red border border-red-border px-[7px] py-[2px] rounded-[4px] inline-flex items-center gap-[3px]" title="Allergy: Penicillin">
          ⚠ Penicillin
        </span>
      </div>
      <div className="flex gap-2 flex-wrap text-[11px] text-text-muted mt-1">
        <span>Problems: <strong className="text-text-secondary font-mono">3</strong></span>
        <span>·</span>
        <span>Meds: <strong className="text-text-secondary font-mono">2</strong></span>
        <span>·</span>
        <span>Visits: <strong className="text-text-secondary font-mono">5</strong></span>
      </div>
    </div>
  </div>
</div>
```

### 7.2 Vitals Strip

```tsx
<div className={cn(
  "grid gap-2",
  // ≥1280px: sidebar (in-flow) competes for width, so drop to 3 cols when open
  // 1024–1279px: sidebar is an overlay, so 3 cols regardless of sidebarOpen
  // ≤1023px: single column of cards is too sparse, 2 cols keeps it scannable
  sidebarOpen
    ? "grid-cols-5 max-[1439px]:grid-cols-3"
    : "grid-cols-5",
  "max-[1279px]:grid-cols-3 max-[767px]:grid-cols-2"
)}>
  {/* Individual Vital Cell */}
  <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 flex flex-col gap-0.5">
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-bold uppercase tracking-[0.5px] text-text-muted">Blood Pressure</span>
    </div>
    <div className="flex items-baseline gap-1 mt-0.5">
      {/* value floors at 16px per the §1.3 readability floor — never shrinks further at 768px */}
      <span className="font-mono text-[18px] max-[1439px]:text-[16px] text-red font-semibold leading-none">
        152/94
      </span>
      <span className="text-[11px] text-text-muted">mmHg</span>
    </div>
    <div className="text-[10px] text-text-muted font-mono mt-0.5">
      09:14 AM
    </div>
  </div>
</div>
```

Vitals cards show the datetime of the last reading. If older than 24 hours, apply `warn` state to the timestamp.

### 7.3 Initial Note & Progress Notes

Auto-save behavior:

```tsx
// Debounced 3s auto-save
useEffect(() => {
  const timer = setTimeout(() => {
    saveDraft();
  }, 3000);
  return () => clearTimeout(timer);
}, [formValues]);
```

Auto-save states:

| State | Component |
|---|---|
| Unsaved | `<Badge variant="draft">Draft</Badge>` in card header |
| Saving | Spinner + `text-[10px] text-[var(--text-muted)]` "Saving…" |
| Saved | `<Badge variant="saved">Saved</Badge>` for 3s then remove |
| Offline | Amber banner: `bg-amber-bg border border-amber-border text-amber text-[11px] px-3 py-1.5 rounded-btn` |

**Collapsible sections** use shadcn `Collapsible`:

```tsx
// components/notes/CollapsibleSection.tsx
export function CollapsibleSection({ title, children, defaultOpen = false, icon }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-card bg-surface mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-surface-2 hover:bg-surface-3 border-b border-border transition-all duration-200 rounded-[4px] cursor-pointer outline-none"
      >
        <div className="flex items-center gap-2.5 flex-1">
          {icon && <div className="text-text-muted">{icon}</div>}
          <span className="text-[11.5px] font-bold uppercase tracking-[0.6px] text-text-secondary text-left">
            {title}
          </span>
        </div>
        <ChevronDownIcon className={cn(
          "w-4 h-4 text-text-muted transition-transform duration-250 ease-out flex-shrink-0",
          isOpen && "transform rotate-180"
        )} />
      </button>
      {isOpen && (
        <div className="p-3.5 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}
```

Required fields block **publishing** but not auto-save as draft.

### 7.4 Problem List

```tsx
// Problem row inside ActiveProblemTable
<div
  className={cn(
    "grid items-center gap-4 px-[14px] py-3 bg-surface transition-all duration-150",
    canManage && "cursor-grab active:cursor-grabbing",
    isDragging && "relative z-10 opacity-40 shadow-sm dragging",
    isReorderHover && "bg-accent-light border-t-2 border-t-accent",
    isMergeHover && "bg-green-bg border-2 border-dashed border-green-border relative"
  )}
  style={{ gridTemplateColumns: "22px 14px 2.5fr 1.2fr 2.2fr 1.1fr 1.8fr 120px" }}
>
  {/* Column 1: Drag handle */}
  <div className="flex items-center justify-center">
    <span className="text-border-strong flex-shrink-0 select-none text-[15px] font-bold">⠿</span>
  </div>

  {/* Column 2: Status dot */}
  <div className="flex items-center justify-center">
    <div className="w-2 h-2 rounded-full flex-shrink-0 bg-accent-mid" title="Active" />
  </div>

  {/* Column 3: Name & code with nested child indentation */}
  <div 
    className="flex items-center gap-2 truncate text-text-primary"
    style={depth > 0 ? { paddingLeft: `${depth * 24}px` } : undefined}
  >
    {depth > 0 && <span className="font-mono text-text-muted mr-1 select-none">↳</span>}
    <span className="text-[13px] font-semibold truncate">{problem.title}</span>
    {problem.icdCode && (
      <span className="font-mono text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">
        {problem.icdCode}
      </span>
    )}
  </div>

  {/* Column 4: Date added */}
  <div className="text-[12px] font-mono text-text-secondary whitespace-nowrap text-left">
    {new Date(problem.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
  </div>

  {/* Column 5: Creator */}
  <div className="flex flex-col text-[11px] leading-tight text-text-secondary text-left min-w-0">
    <span className="font-semibold text-text-primary truncate">{creatorName}</span>
    <span className="text-[10px] text-text-muted font-mono whitespace-nowrap mt-0.5">{formattedAddedDateTime}</span>
  </div>
</div>
```

Keyboard: Arrow Up/Down to reorder; Enter to open edit dialog.

### 7.5 Documentation Panel

This in-flow variant applies at `≥1280px` only. Below that, use the overlay variant from §4.4 (same header/body markup, `fixed` positioning instead of an in-flow column).

```tsx
<aside
  style={{
    width: panelOpen ? 'var(--documentation-panel-width, 420px)' : 0,
  }}
  className={cn(
    "bg-surface flex flex-col shrink-0 relative overflow-hidden h-full",
    panelOpen ? "border-l border-border" : "border-l border-transparent",
    "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
  )}
>
  {/* Resize handle */}
  <div
    onMouseDown={startResize}
    className="absolute top-0 left-0 w-[5px] h-full cursor-ew-resize z-10 transition-colors hover:bg-accent"
  />
  {/* Inner content wrapper with static width to prevent reflow */}
  <div className="w-[var(--documentation-panel-width,420px)] min-w-[var(--documentation-panel-width,420px)] flex flex-col h-full overflow-hidden">
    {/* Panel header */}
    <div className="flex items-center gap-2 px-4 py-3 bg-accent-light border-b border-accent-mid flex-shrink-0">
      <Pen className="w-3.5 h-3.5 text-accent-hover" strokeWidth={2.5} />
      <span className="font-bold text-accent-hover flex-1 text-[13px]">
        Progress Note
      </span>
    </div>
    {/* Scrollable body */}
    <div className="flex-1 overflow-hidden bg-surface-2 flex flex-col relative">
      <div className="absolute inset-0 overflow-y-auto p-4 flex flex-col gap-4">
        {/* note form fields */}
      </div>
    </div>
  </div>
</aside>
```

Resize is client-side only:

```tsx
function useResizablePanel(defaultWidth: number, min = 300, max = 0.6) {
  const [width, setWidth] = useState(defaultWidth);
  const startResize = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = width;
    const onMove = (e: MouseEvent) => {
      const newWidth = startWidth - (e.clientX - startX);
      const maxW = window.innerWidth * max;
      setWidth(Math.min(maxW, Math.max(min, newWidth)));
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  return { width, startResize };
}
```

---

## 8. Notifications & Feedback

### 8.1 Toast Notifications

Use **Sonner** (shadcn/ui recommended):

```tsx
// In layout:
<Toaster position="bottom-right" richColors />

// Usage:
toast.success("Note published successfully");
toast.warning("Vital signs not recorded today");
toast.error("Failed to save — check connection");
toast.info("Viewing note authored by Dr. Reyes");
```

Max 3 stacked toasts. Auto-dismiss after 5s. Include `×` close button.

### 8.2 RBAC Banner

```tsx
<div className="flex items-center gap-2 px-3 py-1.5 bg-blue-bg border border-blue-border rounded-btn text-[11px] text-blue font-medium mb-0.5">
  <LockIcon className="w-3.5 h-3.5 flex-shrink-0" />
  <span>
    You are viewing as <strong>Doctor</strong> — showing clinical note fields only.
  </span>
</div>
```

---

## 9. shadcn/ui Component Mapping

| Design Element | Shadcn Component | Key Override |
|---|---|---|
| `.card` | `Card`, `CardHeader`, `CardContent` | `rounded-[8px]`, remove default shadow, add `shadow-card` |
| Primary button | `Button` (default variant) | bg → `--accent`, border → `--accent-hover` |
| Secondary button | `Button` (outline variant) | Match `h-[28px]`, `text-[11px]`, `font-semibold` |
| Destructive button | `Button` (destructive variant) | bg → `--red-bg`, text → `--red`, border → `--red-border` |
| Ghost button | `Button` (ghost variant) | Use as-is, adjust sizing |
| Text input | `Input` | `h-[34px]`, `text-[13px]`, `border-border`, `rounded-btn`, focus ring → `--accent` |
| Textarea | `Textarea` | `min-h-[80px]`, `resize-y`, match input border/focus |
| Select / Combobox | `Select`, `Command + Popover` | Barangay lists, medication name search |
| Modal | `Dialog` | `max-w-[520px]` desktop → `460px` at 1280 → `420px` at 1024 → `92vw`/`380px` cap at 768, overlay `bg-black/45 backdrop-blur-[4px]` |
| Badges | `Badge` | Custom variants per Section 6.3 |
| Collapsible | `Collapsible` | Chevron rotate transition via `data-[state]` |
| Date input | `Popover` + `Calendar` | DOB, visit datetime |
| Toasts | `Sonner` | `position="bottom-right"`, `richColors` |
| Tables | `Table` | TH `text-[9px]` uppercase, row hover `bg-surface-3` |
| Tabs (screen nav) | Custom `<button>` | Do **not** use shadcn Tabs — screen nav needs horizontal scroll + custom styling |
| Drag handles | Native HTML5 drag or `@dnd-kit/core` | Problem list reordering |

Override shadcn defaults in `components/ui/` files. Never touch the CSS variables shadcn uses internally — use `[var(--token)]` references in Tailwind classes instead so both systems coexist.

---

## 10. Accessibility

```css
/* Already in globals.css */
*:focus-visible {
  @apply outline-2 outline-offset-2 outline-accent;
}
```

- All icon-only buttons: `aria-label` + `title` attributes
- All inputs: linked `<label>` via `htmlFor` / `id`
- Collapsibles: `aria-expanded` on trigger
- Status badges: `title` tooltip when color is the only differentiator
- Allergy icons: `title="Allergy: Penicillin"` on the ⚠ element
- Modal focus trap: handled by shadcn `Dialog` automatically
- `Escape` closes modals, dropdowns, and the doc panel
- Screen nav tabs: arrow-key navigation with `onKeyDown`
- Problem list reorder: arrow-key buttons in addition to drag

---

## 11. Validation Rules

All errors display inline below the offending field. Never use `alert()`.

```tsx
// Error state
<input className="... border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]" />
<p className="text-[12px] text-red mt-1">Systolic BP must be between 50 and 300.</p>
```

| Field | Rule |
|---|---|
| Last / First / Middle name | max 30 chars |
| Extension | max 3 chars |
| DOB | valid date, in the past |
| Age | derived from DOB, read-only |
| Systolic BP | integer 50–300 |
| Diastolic BP | integer 20–200 |
| Heart Rate | integer 20–300 |
| Resp. Rate | integer 5–60 |
| Temperature | float 30.0–45.0 |
| O₂ Saturation | integer 50–100 |
| Chief Complaint | free text, max 50 chars |
| Medication Dose | float > 0 |
| Medication Unit | `mg` \| `g` \| `mcg` \| `ml` \| `units` |
| Medication Instructions | free text, max 50 chars |
| Medication Quantity | integer > 0 |
| Lab/Imaging uploads | JPEG, PNG, PDF only |

Required fields (`*`) block note publishing but not auto-save as draft.

---

## 12. Role-Based Access

| Action | Admin | Doctor | Nurse |
|---|---|---|---|
| View Dashboard | ✓ | ✓ | ✓ |
| Add/Edit Vital Signs | ✓ | ✓ | ✓ |
| Delete Vital Signs | ✓ | ✓ | ✗ |
| View Notes | ✓ | ✓ | ✓ |
| Create/Edit Initial Note | ✓ | ✓ (author) | ✗ |
| Create/Edit Progress Note | ✓ | ✓ (author) | ✗ |
| Edit Problem List | ✓ | ✓ | ✗ |
| Edit Medication List | ✓ | ✓ | ✗ |
| Generate Medical Certificate | ✓ | ✓ | ✗ |
| Generate Lab Request / Prescription | ✓ | ✓ | ✓ |
| Generate Charge Slip | ✓ | ✗ | ✓ |
| View Audit Logs | ✓ | ✗ | ✗ |
| New Patient Registration | ✓ | ✓ | ✗ |

UI elements the current role cannot access are **hidden entirely** — not disabled or greyed out — unless visibility itself communicates important state.

Active role is always displayed in the **role pill** in the topbar.

---

## 13. New Patient Form

```tsx
// Required fields and constraints:
// Last Name, First Name, Middle Name — text, max 30 chars each (required: Last, First)
// Extension — text, max 3 chars
// Date of Birth — shadcn Calendar + Popover (required)
// Age — derived, read-only input
// Sex — shadcn Select: Female | Male (required)
// Blood Type — shadcn Select: Unknown | A+ | A- | B+ | B- | AB+ | AB- | O+ | O-
// Known Allergies — text input
// Street Address — free text
// Barangay — shadcn Combobox (searchable)
// City / Municipality — shadcn Combobox (searchable)
// Region — shadcn Select (searchable)
// Country — read-only: Philippines
```

Physician fields auto-populated from the logged-in user's profile. Visit datetime defaults to `new Date()`.

---

## 14. Audit Logs

```tsx
// Screen: Admin only. Columns:
// DateTime (font-mono text-[11px]) | Type (Badge) | User (avatar + name) | Description (HTML)

// Filter controls
<div className="flex gap-2 flex-wrap items-center">
  {/* Search input */}
  <div className="flex items-center gap-2 h-8 bg-surface border border-border rounded-btn px-3 max-w-[200px]">
    <SearchIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
    <input className="flex-1 bg-transparent text-[11px] outline-none" placeholder="Search logs..." />
  </div>
  {/* Type / Time / Date filters — shadcn Select, height h-8 */}
</div>
```

---

*End of DAMAYAN Design Standards v2.1*  
*Prepared for DAMAYAN project at UP-PGH · Primary Care Clinical Note Interface*  
*Tech stack: Next.js · Tailwind CSS · shadcn/ui · Prisma · PostgreSQL · Azure*