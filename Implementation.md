# Feature: A+ / A- Text Zoom Control (Topbar)

**Target file(s):**
- `src/stores/uiStore.ts` (or wherever the zustand `useUiStore` lives)
- A top-level client layout/provider (e.g. `app/layout.tsx`'s client wrapper, or `Providers.tsx` — locate the component that already mounts on app boot)
- `src/components/Topbar.tsx`

**Goal:** Add two buttons ("A-" and "A+") to the Topbar that let a user (esp. doctors with poor eyesight) scale the entire app's UI up/down, behaving like the browser's native Ctrl+ / Ctrl- zoom — i.e. it must **reflow the layout**, not just visually stretch it, so nothing gets clipped, overlapped, or cut off at the edges.

---

## 1. Why `zoom`, not `transform: scale`

Do **not** implement this with `transform: scale(...)` on a wrapper div. `transform` does not affect layout — it just visually stretches pixels, which:
- causes overflow/clipping on fixed-size or `overflow: hidden` containers,
- breaks click hit-boxes (they stay at the original untransformed position),
- misaligns `position: fixed` / `position: sticky` elements (like this very Topbar).

Instead, use the CSS `zoom` property on the document root. Unlike `transform`, `zoom` triggers an actual reflow — same mechanism the browser itself uses for Ctrl+/Ctrl-. This is supported in Chrome, Edge, Safari, and Firefox 126+.

```css
/* conceptually, what we're doing */
html {
  zoom: 110%; /* recalculates layout, not just a visual stretch */
}
```

**Note:** Since our buttons stack with the browser's own native zoom (they're independent), a user could theoretically zoom both. That's fine and expected — same as any site with in-app font controls.

---

## 2. Update `uiStore.ts`

Add scale state + bounded actions. Merge into the **existing** store — do not overwrite other state/actions already there (e.g. `sidebarCollapsed`, `documentationPanelOpen`).

```ts
// constants
const UI_SCALE_MIN = 80;
const UI_SCALE_MAX = 150;
const UI_SCALE_STEP = 10;
const UI_SCALE_DEFAULT = 100;

// add to store state shape
uiScale: number;

// add to store actions
increaseUiScale: () => void;
decreaseUiScale: () => void;
resetUiScale: () => void;
```

Implementation (adapt to however the existing store is structured — plain `create()` or `create(persist(...))`):

```ts
uiScale: UI_SCALE_DEFAULT,

increaseUiScale: () =>
  set((state) => ({
    uiScale: Math.min(UI_SCALE_MAX, state.uiScale + UI_SCALE_STEP),
  })),

decreaseUiScale: () =>
  set((state) => ({
    uiScale: Math.max(UI_SCALE_MIN, state.uiScale - UI_SCALE_STEP),
  })),

resetUiScale: () => set({ uiScale: UI_SCALE_DEFAULT }),
```

**Persistence:** If `useUiStore` already uses zustand's `persist` middleware, `uiScale` will be saved automatically — just confirm it's not excluded via a `partialize` allowlist. If the store is NOT persisted, wrap only this slice, or persist it separately to `localStorage` under a key like `damayan-ui-scale`, so the preference survives reloads/logout (this matters — a doctor who sets this once shouldn't have to reset it every session).

---

## 3. Apply the zoom globally

Find the top-level client component that mounts once per app load (commonly a `Providers.tsx`, or directly in the root layout's client boundary). Add an effect that syncs `uiScale` to the `<html>` element:

```tsx
'use client';

import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';

export function UiScaleEffect() {
  const uiScale = useUiStore((state) => state.uiScale);

  useEffect(() => {
    // Cast needed: `zoom` is a valid CSS prop in all major browsers today
    // but is not yet in the standard TS CSSStyleDeclaration typings.
    (document.documentElement.style as any).zoom = `${uiScale}%`;
  }, [uiScale]);

  return null;
}
```

Mount `<UiScaleEffect />` once near the root of the provider tree (alongside auth/theme providers), so it's active app-wide, not just when Topbar is rendered.

---

## 4. Add the buttons to Topbar

There's already an empty placeholder comment in `Topbar.tsx`:
```tsx
{/* Documentation panel toggle */}
```
Replace/use that slot. Insert this block between the "New Note" button and the user name/avatar block:

```tsx
{/* Text zoom control */}
<div className="flex items-center gap-0.5 h-[34px] px-1 rounded-btn border border-border bg-surface-2 shrink-0">
  <button
    onClick={decreaseUiScale}
    disabled={uiScale <= 80}
    aria-label="Decrease text size"
    title="Decrease text size"
    className="w-6 h-6 inline-flex items-center justify-center rounded-[4px] text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
  >
    <span className="text-[10px] font-bold leading-none">A-</span>
  </button>

  <span
    aria-live="polite"
    className="text-[9px] font-mono text-text-muted w-8 text-center select-none tabular-nums"
  >
    {uiScale}%
  </span>

  <button
    onClick={increaseUiScale}
    disabled={uiScale >= 150}
    aria-label="Increase text size"
    title="Increase text size"
    className="w-6 h-6 inline-flex items-center justify-center rounded-[4px] text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
  >
    <span className="text-[13px] font-bold leading-none">A+</span>
  </button>
</div>
```

Pull the new state/actions from the store at the top of the component, alongside the existing `useUiStore` destructure:

```tsx
const {
  toggleSidebar,
  sidebarCollapsed,
  documentationPanelOpen,
  setDocumentationPanelOpen,
  uiScale,
  increaseUiScale,
  decreaseUiScale,
} = useUiStore();
```

**Mobile/narrow viewport:** Follow the same collapse pattern already used elsewhere in this file (`max-[1023px]:...`). Recommend keeping the percentage label but consider `max-[767px]:hidden` on the `%` text only (keep the two buttons visible) so it doesn't crowd the header on small screens — mirror how the patient chip already hides secondary text at `max-[767px]`.

---

## 5. Clipping/overflow audit (do this even though `zoom` reflows)

`zoom` fixes the *layout math*, but it can still expose pre-existing bugs where a container was relying on a fixed viewport size. After wiring this up, manually test at 150% and 80% and check:

- [ ] Sidebar + main content area still scroll independently, no double scrollbars
- [ ] Any modal/dialog components stay centered and don't overflow the viewport
- [ ] Tables (e.g. Problem List, Attachments list) get horizontal scroll rather than clipping at 150%
- [ ] The active-patient chip (absolutely centered in Topbar) doesn't overlap the "New Note" button or the zoom control at 150% on smaller windows — this is the highest-risk element since it uses `absolute left-1/2 -translate-x-1/2`
- [ ] Any `overflow: hidden` containers holding dynamic text truncate gracefully (ellipsis) instead of hard-clipping at larger scale
- [ ] Sticky/fixed positioned elements (this Topbar itself, any sticky table headers) stay aligned to the top after scale changes

If the patient chip overlap becomes an issue at high zoom, the fix is to give it a responsive `max-width` with `truncate`, not to abandon the `zoom` approach.

---

## 6. Testing checklist

- [ ] Click A+ five times → scale reaches 150%, button disables at cap
- [ ] Click A- from 150% down past 100% to 80% → button disables at floor
- [ ] Refresh the page after setting a non-default scale → scale persists
- [ ] Log out and back in → scale persists (confirms it's not scoped to a single session/tab)
- [ ] Zoom to 150%, then also use native browser Ctrl+ → both stack without breaking layout
- [ ] Test on the smallest supported breakpoint to confirm the control doesn't crowd out other Topbar items
- [ ] Screen reader announces the new percentage when a button is pressed (via `aria-live="polite"` on the label)

---

## 7. Explicitly out of scope / do not do

- Do not intercept `Ctrl +` / `Ctrl -` keydown events to hijack native browser zoom — this can break accessibility tooling and is unnecessary; the buttons are additive, not a replacement.
- Do not implement this by changing Tailwind's root `font-size` and hoping rem-based utilities cascade — this codebase uses a lot of arbitrary px values (`text-[11px]`, `h-[34px]`, etc.) that won't respond to a root font-size change. `zoom` is the correct primitive because it scales *rendered* pixels regardless of unit.