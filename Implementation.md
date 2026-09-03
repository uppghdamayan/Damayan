# Pagination Pattern — 1:1 Reuse Spec

Canonical pagination system for this codebase. Follow this exactly — do not eyeball sizes/spacing/colors from a screenshot, use the values below. Source of truth: [NotesHistory.tsx](../src/components/notes/NotesHistory.tsx) (linear variant), [VitalsHistoryTable.tsx](../src/components/vitals/VitalsHistoryTable.tsx), [AdminShared.tsx](../src/components/admin/AdminShared.tsx).

Three variants exist. **Default to Variant C (linear prev/number/next bar)** for any new feature unless told otherwise — it's the "very linear" one: single centered row, fixed-size square buttons, ellipsis-compressed page list, arrow endcaps.

---

## Design tokens used (resolved values)

All classes below map to CSS vars in [globals.css](../src/app/globals.css). Resolved hex given so the doc is usable even without the Tailwind theme loaded.

| Token class | CSS var | Hex |
|---|---|---|
| `bg-surface` | `--surface` | `#ffffff` |
| `bg-surface-2` | `--surface-2` | `#f7f8fa` |
| `bg-surface-3` | `--surface-3` | `#eff1f5` |
| `border-border` | `--border` | `#d1d5e0` |
| `border-border-strong` | `--border-strong` | `#9ba3b5` |
| `text-text-primary` | `--text-primary` | `#0d1117` |
| `text-text-secondary` | `--text-secondary` | `#374151` |
| `text-text-muted` | `--text-muted` | `#6b7280` |
| `bg-accent` | `--accent` | `#0a6e5f` |
| `border-accent-hover` / `bg-accent-hover` | `--accent-hover` | `#085a4e` |
| `shadow-btn-primary` | — | `0 2px 4px rgba(10,110,95,0.15)` |

Transition on every interactive state: `transition-all duration-150` (150ms, default easing).

---

## Variant C — Linear bar (prev / numbers+ellipsis / next) — DEFAULT

Visual: one horizontal row, centered, made of fixed **40×40px** square buttons with **8px** gaps. Looks like: `‹  1  …  4  [5]  6  …  12  ›`

### Exact layout spec

```
Wrapper:      flex items-center justify-center gap-2 py-2
Each button:  w-10 h-10  (40px × 40px)
              rounded-xl (12px corner radius)
              border (1px)
              text-[13px] font-bold
              flex items-center justify-center
              cursor-pointer
              transition-all duration-150
Gap between buttons/arrows/ellipsis: 8px (gap-2 on the wrapper — do NOT add per-button margin)
Vertical padding around the whole bar: 8px top+bottom (py-2), 0 horizontal (bar is centered by flex)
Icon size inside arrow/ellipsis buttons: w-4 h-4 (16px), from lucide-react
```

### States (exact classes)

**Page number button — inactive:**
```
bg-surface text-text-secondary border-border
hover:bg-surface-2 hover:border-border-strong hover:text-text-primary
```

**Page number button — active (current page):**
```
bg-accent text-white border-accent-hover shadow-btn-primary
```
Add `aria-current="page"` on the active button.

**Prev / Next arrow button (enabled):**
```
bg-surface text-text-secondary border-border
hover:bg-surface-2 hover:border-border-strong hover:text-text-primary
```

**Prev / Next arrow button (disabled — at first/last page):**
```
disabled:opacity-40 disabled:cursor-not-allowed
disabled:hover:bg-surface disabled:hover:border-border
```
(i.e. hover styles must be explicitly cancelled while disabled, not just relying on `disabled:` opacity)

**Ellipsis slot** (non-interactive, same 40×40 footprint so the row never jumps):
```
w-10 h-10 flex items-center justify-center text-text-muted
```
Contains a `MoreHorizontal` icon (`w-4 h-4`), not the `…` glyph — keeps icon weight consistent with the arrows.

### Full component (copy verbatim, generalize the props)

```tsx
'use client';

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Builds a compact page list with ellipsis markers, e.g. [1, '…', 4, 5, 6, '…', 12] */
function getPageRange(page: number, totalPages: number): (number | '…')[] {
  const siblingCount = 1;
  const totalNumbers = siblingCount * 2 + 5; // first + last + current + 2 siblings + 2 ellipses

  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, totalPages);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  const range: (number | '…')[] = [1];

  if (showLeftEllipsis) {
    range.push('…');
  } else if (leftSibling > 1) {
    range.push(2);
  }

  for (let p = Math.max(leftSibling, 2); p <= Math.min(rightSibling, totalPages - 1); p++) {
    range.push(p);
  }

  if (showRightEllipsis) {
    range.push('…');
  } else if (rightSibling < totalPages) {
    range.push(totalPages - 1);
  }

  range.push(totalPages);

  return Array.from(new Set(range.filter((v) => v !== '…') as number[]))
    .sort((a, b) => a - b)
    .reduce<(number | '…')[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
      acc.push(p);
      return acc;
    }, []);
}

export function PaginationBar({ page, totalPages, onPageChange }: PaginationBarProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {/* Prev arrow */}
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="w-10 h-10 rounded-xl border border-border bg-surface text-text-secondary flex items-center justify-center transition-all duration-150 cursor-pointer hover:bg-surface-2 hover:border-border-strong hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:border-border"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Page numbers with ellipsis */}
      {getPageRange(page, totalPages).map((p, idx) =>
        p === '…' ? (
          <span
            key={`ellipsis-${idx}`}
            className="w-10 h-10 flex items-center justify-center text-text-muted"
          >
            <MoreHorizontal className="w-4 h-4" />
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'w-10 h-10 rounded-xl text-[13px] font-bold cursor-pointer border flex items-center justify-center transition-all duration-150',
              p === page
                ? 'bg-accent text-white border-accent-hover shadow-btn-primary'
                : 'bg-surface text-text-secondary border-border hover:bg-surface-2 hover:border-border-strong hover:text-text-primary'
            )}
          >
            {p}
          </button>
        )
      )}

      {/* Next arrow */}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        className="w-10 h-10 rounded-xl border border-border bg-surface text-text-secondary flex items-center justify-center transition-all duration-150 cursor-pointer hover:bg-surface-2 hover:border-border-strong hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:border-border"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
```

Placement rule: render this bar **below the list content**, guarded by the caller with nothing extra needed (component self-guards `totalPages <= 1`). Do not wrap it in a bordered card — it sits directly in the page flow, centered, with its own `py-2` breathing room.

### Optional companion — page-size selector

Only add when the list can reasonably grow past ~50 items and a user benefit exists (e.g. clinical notes). Sits in the section header, **not** next to the pagination bar itself.

```tsx
const PAGE_SIZE_OPTIONS = [1, 5, 10, 20, 50];

<div className="relative flex items-center">
  <select
    value={limit}
    onChange={(e) => onLimitChange(Number(e.target.value))}
    aria-label="Items per page"
    className="h-8 pl-3 pr-7 rounded-full bg-surface border border-border text-[11px] font-semibold text-text-secondary outline-none cursor-pointer appearance-none hover:border-border-strong hover:text-text-primary focus:border-accent transition-all duration-150"
  >
    {PAGE_SIZE_OPTIONS.map((opt) => (
      <option key={opt} value={opt}>{opt} / page</option>
    ))}
  </select>
  <ChevronDown className="w-3 h-3 text-text-muted absolute right-2.5 pointer-events-none" />
</div>
```
Height `32px` (`h-8`), pill radius (`rounded-full`), `11px` semibold label text, `ChevronDown` at `12px` (`w-3 h-3`) absolutely positioned `10px` from the right (`right-2.5`), vertically centered via the flex parent.

**Rule: changing the limit always resets `page` to `1`** — see [Page-level wiring](#page-level-wiring) below.

---

## Variant B — Inline numbered strip in table footer

Use only when: table already has a header total-count badge and pages will realistically stay low (≤ ~10). Source: [VitalsHistoryTable.tsx:185-206](../src/components/vitals/VitalsHistoryTable.tsx).

```tsx
{totalPages > 1 && (
  <div className="px-4 py-3 bg-surface border-t border-border flex items-center justify-between">
    <div className="text-[11px] text-text-muted">Page {page} of {totalPages}</div>
    <div className="flex gap-1">
      {Array.from({ length: totalPages }).map((_, i) => (
        <button
          key={i}
          onClick={() => onPageChange(i + 1)}
          className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-medium transition-colors ${
            page === i + 1
              ? 'bg-accent text-white'
              : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
          }`}
        >
          {i + 1}
        </button>
      ))}
    </div>
  </div>
)}
```
Differences from Variant C: buttons are **24×24px** (`w-6 h-6`), gap **4px** (`gap-1`), `rounded` (not `rounded-xl`), `text-[11px]` (not `13px`), no arrows, no ellipsis (lists this size never need compression), footer bar has `px-4 py-3` padding with `border-t` and a left-aligned "Page X of Y" label plus right-aligned buttons (`justify-between`), not centered.

---

## Variant A — Admin table footer strip

Use only inside `/admin/*` table cards. Source: [AdminShared.tsx:101-127](../src/components/admin/AdminShared.tsx) (`AdminPagination`).

```tsx
export const AdminPagination = ({ page, totalPages, onPageChange }: {
  page: number; totalPages: number; onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;
  return (
    <div className="px-3.5 py-2.5 border-t border-border flex gap-2 justify-end bg-surface-2">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={cn(
            'w-7 h-7 rounded-btn text-[11px] font-semibold cursor-pointer border flex items-center justify-center transition-all duration-150',
            p === page
              ? 'bg-accent text-white border-accent-hover shadow-btn-primary'
              : 'bg-surface text-text-secondary border-border hover:bg-surface-2 hover:border-border-strong hover:text-text-primary'
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
};
```
Differences: buttons **28×28px** (`w-7 h-7`), `rounded-btn` (6px radius, from `--radius-btn`), `gap-2` (8px), right-aligned (`justify-end`) not centered, footer has `bg-surface-2` fill + `px-3.5 py-2.5` padding, no arrows/ellipsis (admin lists are small and simple).

---

## Variant picker

| Situation | Variant |
|---|---|
| New feature, default choice, "linear" bar | **C** |
| List can grow large / needs page-size control | **C** (with page-size select) |
| Inside an existing history table footer, small page count | B |
| Inside `/admin/*` table card footer | A |

Don't mix variants within the same page. Don't invent new sizes — reuse the exact px values above (40/24/28px button, 8/4/8px gaps) so pagination bars feel identical across the app.

---

## Page-level wiring

```tsx
const [page, setPage] = useState(1);
const [limit, setLimit] = useState(20); // omit if limit is fixed for this list

const { data, isLoading } = useThings(id, page, limit);
const list = data?.data || [];
const meta = data?.meta || { total: 0, page: 1, limit, totalPages: 1 };

const handleLimitChange = (newLimit: number) => {
  setLimit(newLimit);
  setPage(1); // always reset to page 1 on limit change
};
```

Reset `page` to `1` on:
- Search/filter change (debounced), e.g. [admin/patients/page.tsx](../src/app/admin/patients/page.tsx): `setPage(1)` inside the search debounce effect.
- Page-size (`limit`) change (`handleLimitChange` above).
- After creating a new item at the top of a newest-first list, e.g. [notes/page.tsx](../src/app/dashboard/[patientId]/notes/page.tsx): `setPage(1)` right after a successful create, so the new item is visible immediately.

Always pass the **server-echoed** `meta.page` / `meta.totalPages` down to the pagination component, not the raw local `page` state — they should match, but the meta object is the source of truth once a response lands.

```tsx
<PaginationBar page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
```

---

## API route (server side) — required shape

```ts
const searchParams = req.nextUrl.searchParams;
const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
const skip = (page - 1) * limit;

const [items, total] = await Promise.all([
  Model.find(query).sort({ field: -1 }).skip(skip).limit(limit).lean(),
  Model.countDocuments(query),
]);

return NextResponse.json({
  data: formattedItems,
  meta: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  },
});
```
Rules: `page` floors at 1. `limit` clamps to `[1, 100]`. `totalPages` always `≥ 1` (`|| 1` guards `total === 0`). Response envelope is always `{ data, meta }`, never a bare array.

## Hook (TanStack Query)

```ts
export function useThings(id: string | undefined | null, page = 1, limit = 20) {
  return useQuery<{ data: ThingRecord[]; meta: { total: number; page: number; limit: number; totalPages: number } }>({
    queryKey: ['things', id, page, limit],
    queryFn: () =>
      apiRequest(`/things/${id}?page=${page}&limit=${limit}`),
    enabled: !!id,
  });
}
```
`page` and `limit` must be in `queryKey` so changing either auto-refetches.

---

## Checklist for a new paginated feature (Variant C, default)

1. API route returns `{ data, meta: { total, page, limit, totalPages } }` per the shape above.
2. Hook: `useQuery` keyed on `[name, ...filters, page, limit]`.
3. Page component: `useState` for `page` (+ `limit` if variable); reset `page` to `1` on filter/limit change and after top-of-list creates.
4. Drop in `PaginationBar` (Variant C code above) directly below the list, centered, no wrapping card.
5. Wire `page={meta.page}` `totalPages={meta.totalPages}` `onPageChange={setPage}` — exact prop names, no renaming.
6. Do not resize the 40×40px buttons or the 8px gap. Do not swap `rounded-xl` for another radius. Do not change the 150ms transition.