# DAMAYAN EMR — Design Standards

**Version 2.0 · Tailwind CSS + shadcn/ui + Next.js**  
*Aligned with Wireframe3 · Problem-Oriented Dynamic Clinical Note Interface for Primary Care*

---

## 1. Guiding Principles

DAMAYAN is used primarily by doctors and medical personnel in a clinical setting. The interface must be designed with the following priorities:

1. **Clarity over cleverness.** Every label, button, and section must be immediately understandable without prior training.
2. **Reduce cognitive load.** The system organizes information by problem, not by visit. Users should never scroll through previous notes to understand the current state of a patient.
3. **Large, readable text.** Minimum body font size of `text-[13px]`, with all critical values (vitals, problem names) at `text-[15px]` to `text-lg`. The interface must support browser zoom up to 150% without breaking layouts.
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
/* src/app/globals.css */
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

  /* Minimum viewport breakpoint (1280px) */
  @media (max-width: 1439px) {
    :root {
      --sidebar-w:                 220px;
      --documentation-panel-width: 340px;
      --timeline-w:                200px;
      --topbar-h:                  52px;
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
// src/app/dashboard/layout.tsx — Next.js layout structure
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStartupLoader>
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
    </AppStartupLoader>
  );
}
```

### 4.2 Responsive Breakpoints

DAMAYAN supports a **minimum viewport of 1280×800px**.

| Breakpoint | Width | Notes |
|---|---|---|
| `desktop-lg` | ≥ 1440px | Default layout |
| `desktop` | 1280px–1439px | Reduced sidebar/panel widths, compact padding |

Below 1280px, show a fullscreen notice:

```tsx
// src/components/layout/NarrowScreenNotice.tsx
export function NarrowScreenNotice() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg p-8 text-center hidden max-[1279px]:flex">
      <div className="max-w-sm">
        <p className="text-[15px] font-bold text-[var(--text-primary)] mb-2">
          Screen too narrow
        </p>
        <p className="text-[13px] text-[var(--text-muted)]">
          DAMAYAN is designed for laptop or desktop screens.
          Please use a device with a screen width of at least 1280px.
        </p>
      </div>
    </div>
  );
}
```

#### Responsive Adaptations at 1280px

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

#### Sidebar Collapse

```tsx
// Sidebar toggle — persisted to localStorage
const [sidebarOpen, setSidebarOpen] = useState(() => {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem("damayan-sidebar");
  if (saved !== null) return saved === "open";
  return window.innerWidth >= 1440; // default collapsed at 1280
});
```

```tsx
<aside
  className={cn(
    "bg-surface border-r border-border flex-shrink-0 overflow-y-auto overflow-x-hidden transition-[width] duration-300 ease-in-out",
    sidebarOpen ? "w-[var(--sidebar-w)]" : "w-0 border-r-transparent"
  )}
>
  {/* inner content fixed at --sidebar-w so it doesn't reflow */}
  <div className="w-[var(--sidebar-w)]">
    {/* sidebar content */}
  </div>
</aside>
```

---

## 5. Navigation

### 5.1 Topbar

```tsx
// src/components/layout/Topbar.tsx
<header className="h-[var(--topbar-h)] bg-surface border-b border-border flex items-center px-4 gap-3 flex-shrink-0 z-[200] sticky top-0 shrink-0">
  {/* Sidebar toggle */}
  <Button variant="ghost" size="icon" onClick={toggleSidebar} className="w-6 h-6 -ml-1.5 mr-1">
    <MenuIcon className="w-[18px] h-[18px]" />
  </Button>

  {/* Logo — fixed width matching sidebar */}
  <div className="flex items-center gap-2 w-[var(--sidebar-w)] flex-shrink-0 overflow-hidden">
    <div className="w-[22px] h-[22px] bg-accent rounded-[5px] flex items-center justify-center flex-shrink-0">
      {/* logo mark SVG */}
    </div>
    <span className="text-[16px] font-bold tracking-[0.5px] whitespace-nowrap">
      DAMAYAN <small className="text-[9px] font-semibold text-[var(--text-muted)] tracking-[1px] uppercase mt-[3px]">EMR</small>
    </span>
  </div>

  {/* Active patient chip (centered) */}
  <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface-2 border border-accent rounded-full px-3.5 py-1 cursor-pointer shadow-sm">
    {/* avatar + name + meta */}
  </div>

  {/* Right zone */}
  <div className="ml-auto flex items-center gap-2">
    <Button className="h-[34px] bg-accent hover:bg-accent-hover text-white border-accent-hover shadow-btn-primary text-[12px] font-medium">
      ＋ New Note
    </Button>
    {/* Doctor name + avatar */}
    <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border">
      <div className="flex flex-col items-end leading-tight">
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">Dr. Ana M. Reyes</span>
        <span className="text-[10px] text-[var(--text-muted)]">Attending Physician</span>
      </div>
      <Avatar className="w-8 h-8 bg-accent-hover text-white text-[11px] font-bold border-2 border-border">
        AR
      </Avatar>
    </div>
  </div>
</header>
```

**Role pill:**
```tsx
<span className="text-[10px] font-bold uppercase tracking-[0.6px] px-2 py-[3px] rounded-full bg-accent-light text-[var(--text-primary)] border border-accent">
  Doctor
</span>
```

### 5.2 Patient Sidebar

```tsx
// src/components/layout/Sidebar.tsx
<div className="sticky top-0 z-10 flex flex-col gap-2 p-3 border-b border-border bg-surface shrink-0">
  <div className="flex items-center gap-2 h-[34px] bg-surface-2 border border-border rounded-btn px-3">
    <SearchIcon className="w-4 h-4 text-[var(--text-muted)]" />
    <input
      className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
      placeholder="Search patients…"
    />
  </div>
  <Button className="w-full h-[28px] bg-accent hover:bg-accent-hover text-white text-[11px] font-semibold justify-center gap-1">
    <PlusIcon className="w-2.5 h-2.5" /> New Patient
  </Button>
</div>

{/* Patient rows */}
<div
  className={cn(
    "flex items-center gap-2.5 mx-3.5 my-[6px] px-3 py-2.5 rounded-card border cursor-pointer transition-all duration-150",
    active
      ? "bg-accent-light border-accent shadow-sm"
      : "bg-surface border-border hover:bg-surface-2 hover:border-border-strong"
  )}
>
  <Avatar className={cn("w-8 h-8 text-[11px] font-bold flex-shrink-0", active ? "bg-accent text-white border-accent" : "bg-surface-2 text-[var(--text-secondary)] border border-border")}>
    MC
  </Avatar>
  <div className="flex-1 min-w-0 flex flex-col">
    <span className={cn("text-[12px] font-semibold truncate", active ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]")}>
      Cruz, Maria Santos
    </span>
    <span className="font-mono text-[10px] text-[var(--text-muted)] truncate">
      F · 34 yrs · #PT-0012
    </span>
  </div>
  <div className="flex flex-col items-end gap-1 flex-shrink-0">
    {hasAllergy && <span className="text-red text-[12px] font-bold" title="Allergy: Penicillin">⚠</span>}
    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
  </div>
</div>
```

**Active state:** replace `border-border` with `border-accent`, `bg-surface` with `bg-accent-light`.

### 5.3 Screen Navigation Tabs

```tsx
// src/components/layout/ScreenNav.tsx
<nav className="flex items-center gap-1.5 bg-surface border-b border-border px-4 h-[52px] flex-shrink-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
  {tabs.map((tab) => {
    const active = isActive(tab);
    return (
      <Link
        key={tab.id}
        href={`${basePath}${tab.path}`}
        onClick={() => setOptimisticPath(`${basePath}${tab.path}`)}
        className={cn(
          "h-8 px-3.5 text-[12px] font-medium rounded-btn border whitespace-nowrap transition-all duration-150 flex-shrink-0 cursor-pointer flex items-center justify-center",
          active
            ? "bg-accent text-white border-accent shadow-[0_4px_12px_rgba(10,110,95,0.25)]"
            : "bg-surface-2 text-text-secondary border-border hover:bg-surface-3 hover:border-border-strong hover:text-text-primary"
        )}
      >
        {tab.label}
      </Link>
    );
  })}
  {/* Toggle doc panel button — far right */}
  <button
    onClick={() => setDocumentationPanelOpen(!documentationPanelOpen)}
    className="ml-auto h-8 px-3 rounded-btn border border-border bg-surface-2 hover:bg-surface-3 flex-shrink-0 flex items-center justify-center cursor-pointer"
  >
    {documentationPanelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
  </button>
</nav>
```

Tab label shortening at 1280px is handled with a `shortLabel` prop:
```tsx
const label = isCompact ? tab.shortLabel : tab.label;
// e.g. { label: "Note Timeline ★", shortLabel: "Timeline" }
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
  <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] flex-1">
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
<button className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap">
  Save Note
</button>

// Secondary (default)
<button className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-[var(--text-secondary)] border border-border hover:bg-surface-3 hover:text-[var(--text-primary)] hover:border-border-strong transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap">
  Record Vitals
</button>

// Destructive
<button className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-red-bg text-red border border-red-border hover:bg-red/15 hover:border-red/80 transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap">
  Remove Problem
</button>

// Ghost (icon-only or toggles)
<button className="h-[28px] px-2 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center gap-[5px]">
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

With shadcn/ui `Badge`, override variants in `src/components/ui/badge.tsx`:

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
  <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">
    Chief Complaint <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
  </label>

  {/* Text input */}
  <input
    className="w-full h-[34px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none transition-all duration-150
      focus:bg-surface focus:border-accent focus:shadow-accent-focus
      placeholder:text-[var(--text-muted)]"
    placeholder="e.g. Persistent headaches for 2 weeks"
  />

  {/* Textarea */}
  <textarea
    className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none resize-y min-h-[80px] leading-[1.6] transition-all duration-150
      focus:bg-surface focus:border-accent focus:shadow-accent-focus"
  />
</div>

// Input with unit addon (vitals)
<div className="flex bg-surface-2 border border-border rounded-btn overflow-hidden focus-within:bg-surface focus-within:border-accent focus-within:shadow-accent-focus transition-all duration-150">
  <input className="flex-1 min-w-0 bg-transparent px-2.5 py-[7px] text-[13px] text-[var(--text-primary)] outline-none" />
  <span className="px-2.5 py-[7px] text-[11px] text-[var(--text-muted)] flex items-center">mmHg</span>
</div>

// Field row layouts
<div className="grid grid-cols-2 gap-3 max-[1439px]:gap-2">…</div>             // .field-row
<div className="grid grid-cols-3 gap-3 max-[1439px]:grid-cols-2">…</div>        // .field-row-3 (compact at 1280px with sidebar open)
```

**Shadcn/ui `Input` override** in `src/components/ui/input.tsx`:
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
  <div className="bg-surface border border-border rounded-[10px] w-[500px] max-[1439px]:w-[460px] max-h-[80vh] overflow-y-auto shadow-modal">
    {/* Header */}
    <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border">
      <h2 className="text-[15px] font-bold flex-1 text-[var(--text-primary)]">Modal Title</h2>
      <Button variant="ghost" size="icon" onClick={onClose}><XIcon /></Button>
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
// Required section order:
// 1. Patient Banner
// 2. Vitals Strip
// 3. grid-cols-2: Problem List | Medication List
// 4. Non-pharmacologic Management (full width)
// 5. Consultation History

// Patient Banner
<div className="bg-surface border border-border rounded-card p-4 flex gap-5 items-stretch flex-wrap">
  {/* Left: avatar + name */}
  <div className="flex gap-3.5 items-center flex-[1.2] min-w-[250px] border-r border-border pr-5">
    <div className="w-11 h-11 rounded-full bg-accent-light border-2 border-accent flex items-center justify-center text-[15px] font-bold text-accent-hover flex-shrink-0">
      MC
    </div>
    <div className="text-[12px] flex flex-col gap-1">
      <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.5px]">Patient Name</span>
      <span className="text-[18px] font-bold text-[var(--text-primary)] leading-tight">Cruz, Maria Santos</span>
      {/* name grid, tags */}
    </div>
  </div>
  {/* Middle: demographics */}
  <div className="flex flex-col gap-1 flex-1 min-w-[220px] border-r border-border pr-5 text-[12px]">…</div>
  {/* Right: clinical profile */}
  <div className="flex flex-col gap-1 flex-[0.8] min-w-[180px] text-[12px]">…</div>
</div>
```

**Allergy pill:**
```tsx
<span className="text-[9px] font-bold bg-red-bg text-red border border-red-border px-[7px] py-[2px] rounded-[4px] inline-flex items-center gap-[3px]">
  ⚠ Penicillin
</span>
```

### 7.2 Vitals Strip

```tsx
<div className={cn(
  "grid gap-2",
  sidebarOpen
    ? "grid-cols-5 max-[1439px]:grid-cols-3"
    : "grid-cols-5"
)}>
  {/* Vital card */}
  <div className={cn(
    "border rounded-card p-[9px_11px]",
    status === "critical" ? "bg-red-bg border-red-border" :
    status === "warn"     ? "bg-amber-bg border-amber-border" :
    "bg-surface-2 border-border"
  )}>
    <div className={cn(
      "text-[9px] font-bold uppercase tracking-[0.6px] mb-0.5 max-[1439px]:text-[8px]",
      status === "critical" ? "text-red" :
      status === "warn"     ? "text-amber" :
      "text-[var(--text-muted)]"
    )}>
      Blood Pressure
    </div>
    <div className={cn(
      "font-mono text-[18px] font-medium leading-[1.1] max-[1439px]:text-[16px]",
      status === "critical" ? "text-red" :
      status === "warn"     ? "text-amber" :
      "text-[var(--text-primary)]"
    )}>
      152<span className="text-[10px] text-[var(--text-muted)] ml-[1px]">mmHg</span>
    </div>
    <div className="font-mono text-[9px] text-[var(--text-muted)] mt-0.5">/ 94 diastolic</div>
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
<Collapsible>
  <CollapsibleTrigger asChild>
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border cursor-pointer hover:bg-surface-3">
      {/* icon + title */}
      <ChevronDownIcon className="ml-auto w-3 h-3 text-[var(--text-muted)] transition-transform data-[state=open]:rotate-180" />
    </div>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="p-3 px-3.5">{/* content */}</div>
  </CollapsibleContent>
</Collapsible>
```

Required fields block **publishing** but not auto-save as draft.

### 7.4 Problem List

```tsx
// Problem row
<div className={cn(
  "flex items-center gap-2 px-2.5 py-1.5 border-b border-border last:border-b-0 cursor-grab active:cursor-grabbing",
  dragOver && "bg-accent-light border-t-2 border-t-accent",
  mergeOver && "bg-green-bg border-2 border-dashed border-green-border"
)}>
  <span className="text-border-strong text-[15px] cursor-grab">⠿</span>
  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", status === "Active" ? "bg-accent-mid" : "bg-[var(--text-muted)]")} />
  <div className="flex-1 text-[12px] text-[var(--text-primary)]">
    {problem.name}
    {problem.code && <span className="font-mono text-[10px] text-[var(--text-muted)] ml-1.5">{problem.code}</span>}
  </div>
  {/* actions */}
</div>

// Nested child (indent + accent line)
<div className="ml-6 border-l-2 border-accent-light pl-2.5">
  {/* child row */}
</div>
```

Keyboard: Arrow Up/Down to reorder; Enter to open edit dialog.

// src/components/layout/DocumentationPanel.tsx
<aside
  className={cn(
    "bg-surface border-l border-border flex flex-col flex-shrink-0 h-full overflow-hidden transition-[width] duration-300 ease-in-out relative",
    panelOpen ? "w-[var(--documentation-panel-width)]" : "w-0 border-l-transparent"
  )}
>
  {/* Resize handle */}
  <div
    onMouseDown={startResize}
    className="absolute top-0 left-0 w-[5px] h-full cursor-ew-resize hover:bg-accent z-10 transition-colors"
  />
  {/* Inner content — fixed width to prevent reflow */}
  <div className="w-[var(--documentation-panel-width)] flex flex-col h-full overflow-hidden">
    {/* Panel header */}
    <div className="flex items-center gap-2 px-4 py-3 bg-accent-light border-b border-accent-mid flex-shrink-0">
      <PenIcon className="w-3.5 h-3.5 text-accent-hover" />
      <span className="font-bold text-accent-hover flex-1">Progress Note</span>
      {/* autosave indicator + badges + action buttons */}
    </div>
    {/* Scrollable body */}
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-surface-2">
      {/* patient context collapsible, note fields */}
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
| Modal | `Dialog` | `max-w-[520px]` (460 at 1280), overlay `bg-black/45 backdrop-blur-[4px]` |
| Badges | `Badge` | Custom variants per Section 6.3 |
| Collapsible | `Collapsible` | Chevron rotate transition via `data-[state]` |
| Date input | `Popover` + `Calendar` | DOB, visit datetime |
| Toasts | `Sonner` | `position="bottom-right"`, `richColors` |
| Tables | `Table` | TH `text-[9px]` uppercase, row hover `bg-surface-3` |
| Tabs (screen nav) | Custom `<button>` | Do **not** use shadcn Tabs — screen nav needs horizontal scroll + custom styling |
| Drag handles | Native HTML5 drag or `@dnd-kit/core` | Problem list reordering |

Override shadcn defaults in `src/components/ui/` files. Never touch the CSS variables shadcn uses internally — use `[var(--token)]` references in Tailwind classes instead so both systems coexist.

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

*End of DAMAYAN Design Standards v2.0*  
*Prepared for DAMAYAN project at UP-PGH · Primary Care Clinical Note Interface*  
*Tech stack: Next.js · Tailwind CSS · shadcn/ui · Prisma · PostgreSQL · Azure*

---

## 15. Component Directory Architecture

To maintain modularity and domain separation, the component directory is structured into domain-specific modules alongside layout, provider, and design-system primitives:

```
src/components/
├── attachments/          # File upload and attachment sections (e.g. upload progress, lab results sections)
├── documents/            # PDF/doc generation interfaces (e.g. certificates, document screen)
├── layout/               # Global shell layouts (Sidebar, Topbar, ScreenNav, DocPanel, Loader, Screen Notice)
├── medications/          # Medication list displays, logs, entry forms, and medications sub-screens
├── notes/                # Note timeline entries, SOAP form inputs, collapsible note sections, uploader widgets
├── patients/             # Patient demographics, banners, and creation/editing modals
├── problems/             # Active and resolved problem lists, edit modals, and logging tables
├── providers/            # React-Query or global context providers
├── ui/                   # Reusable atomic UI components (shadcn/ui customized overrides & custom alerts/modals)
├── visits/               # Patient historical visit cards and skeletons
└── vitals/               # Vitals card, vital forms, vitals history log tables, and vitals screen layout
```

### Module Descriptions & Files

- **`attachments/`**
  - [AttachmentsSection.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/attachments/AttachmentsSection.tsx) - Layout displaying patient-uploaded files and lab results.
  - [LabResultsSectionSkeleton.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/attachments/LabResultsSectionSkeleton.tsx) - Loading skeleton state for lab uploads.
  - [UploadProgressBar.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/attachments/UploadProgressBar.tsx) - Visual progress indicator for uploads in progress.
- **`documents/`**
  - [DocumentGeneratorModal.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/documents/DocumentGeneratorModal.tsx) - Modal interface for generating charge slips, certificates, or prescriptions.
  - [DocumentsScreen.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/documents/DocumentsScreen.tsx) - Parent layout for the Documents tab view.
- **`layout/`**
  - [AppStartupLoader.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/layout/AppStartupLoader.tsx) - Fullscreen application loading screen during initial authentication.
  - [Topbar.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/layout/Topbar.tsx) - Navigation bar with logo, active patient chip, role pill, user details, and "New Note" trigger.
  - [Sidebar.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/layout/Sidebar.tsx) / [SidebarSkeleton.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/layout/SidebarSkeleton.tsx) - Collapsible patient search list.
  - [ScreenNav.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/layout/ScreenNav.tsx) - Horizontal sub-tab bar routing across patient subsections.
  - [DocumentationPanel.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/layout/DocumentationPanel.tsx) - Collapsible, draggable sidebar panel hosting the active SOAP note editors.
  - [NarrowScreenNotice.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/layout/NarrowScreenNotice.tsx) - Fullscreen cover forcing layout to >= 1280px viewports.
- **`medications/`**
  - [MedicationEntry.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/medications/MedicationEntry.tsx) / [MedicationForm.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/medications/MedicationForm.tsx) - Form states for prescribing or modifying meds.
  - [MedicationListCard.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/medications/MedicationListCard.tsx) / [MedicationListCardEmpty.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/medications/MedicationListCardEmpty.tsx) - Card summaries of currently active drugs.
  - [MedicationsScreen.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/medications/MedicationsScreen.tsx) / [MedicationLogTable.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/medications/MedicationLogTable.tsx) - Tab view and logs table showing records of past prescriptions.
- **`notes/`**
  - [InitialNoteForm.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/notes/InitialNoteForm.tsx) / [ProgressNoteForm.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/notes/ProgressNoteForm.tsx) - SOAP structure documentation templates.
  - [NoteTimeline.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/notes/NoteTimeline.tsx) / [TimelineEntry.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/notes/TimelineEntry.tsx) - Timeline records of historical patient consultations.
  - [MedicationListEditor.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/notes/MedicationListEditor.tsx) / [TagInputField.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/notes/TagInputField.tsx) / [AttachmentUploader.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/notes/AttachmentUploader.tsx) - Complex custom form components inside SOAP editing.
- **`patients/`**
  - [PatientBanner.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/patients/PatientBanner.tsx) / [PatientBannerSkeleton.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/patients/PatientBannerSkeleton.tsx) - Primary summary details of active patient.
  - [NewPatientModal.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/patients/NewPatientModal.tsx) / [EditPatientModal.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/patients/EditPatientModal.tsx) - Modals containing verified fields for user registration and editing.
  - [NonPharmacologicCard.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/patients/NonPharmacologicCard.tsx) - Panel displaying non-drug management directives.
- **`problems/`**
  - [ActiveProblemTable.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/problems/ActiveProblemTable.tsx) / [ResolvedProblemTable.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/problems/ResolvedProblemTable.tsx) - Interactive problem lists with custom states.
  - [ProblemListCard.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/problems/ProblemListCard.tsx) / [ProblemListScreen.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/problems/ProblemListScreen.tsx) / [ProblemLogTable.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/problems/ProblemLogTable.tsx) - Overview cards and logs table.
  - [ProblemEditModal.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/problems/ProblemEditModal.tsx) - Dialog for modifying diagnostic descriptions.
- **`providers/`**
  - [QueryProvider.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/providers/QueryProvider.tsx) - Setup wrapper for `@tanstack/react-query` hooks.
- **`ui/`**
  - Atomic shadcn overrides: `badge.tsx`, `button.tsx`, `calendar.tsx`, `card.tsx`, `collapsible.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `popover.tsx`, `select.tsx`, `sheet.tsx`, `skeleton.tsx`, `sonner.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`.
  - Custom UI elements: `ComboboxInput.tsx` (for barangay/city lists), `date-range-picker.tsx`, `DeleteConfirmModal.tsx`, `spinner.tsx`.
- **`visits/`**
  - [VisitHistoryCard.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/visits/VisitHistoryCard.tsx) / [VisitHistoryCardSkeleton.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/visits/VisitHistoryCardSkeleton.tsx) - Visual summaries of clinical consult visits.
- **`vitals/`**
  - [VitalsCard.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/vitals/VitalsCard.tsx) - Displays single vital measurements with status coloring indicators.
  - [VitalsForm.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/vitals/VitalsForm.tsx) - Modal form validating physiological vitals thresholds (blood pressure, heart rate, temp, O₂).
  - [VitalsScreen.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/vitals/VitalsScreen.tsx) / [VitalsHistoryTable.tsx](file:///d:/Documents/Coding/Damayan/frontend/src/components/vitals/VitalsHistoryTable.tsx) - Displays vital trends and historical logs.