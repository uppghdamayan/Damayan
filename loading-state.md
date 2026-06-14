# DAMAYAN EMR — Loading & Performance Optimization Plan

**Version 1.0 · Frontend Performance Architecture**  
*Stack: Next.js 16 · React 19 · Tailwind CSS · TanStack Query · Zustand · Supabase*

---

## The Core Problem

The current architecture has **tab switches that block on data** before rendering the new screen. The user taps a tab in `ScreenNav`, Next.js navigates to the route, and the page only appears after its data arrives. This creates a "white flash" or blank period on every tab transition.

The fix is a two-part strategy:
1. **Instant tab switch** — the new screen renders immediately (with a skeleton)
2. **Background data load** — data fills in asynchronously without blocking the UI

---

## 1. Tab Navigation: Instant Switch Pattern

### Problem
`/dashboard/[patientId]/[tab]/page.tsx` files are empty stubs that will eventually fetch data. Without suspense boundaries and skeletons, navigation blocks.

### Solution: Route-Level Suspense with Per-Tab Skeletons

Every `page.tsx` under `[patientId]` must:
1. Start fetching data immediately on mount (no `await` at page level)
2. Wrap data-dependent components in `<Suspense fallback={<SkeletonXxx />}>`
3. The skeleton renders instantly; the data component resolves when ready

**`src/app/dashboard/[patientId]/layout.tsx`** — add a `loading.tsx` sibling and Suspense wrapper:

```tsx
// src/app/dashboard/[patientId]/loading.tsx
// This file causes Next.js to show this fallback INSTANTLY on tab navigation
// before the page component has finished any server work.
export default function PatientWorkspaceLoading() {
  return <TabContentSkeleton />;
}
```

```tsx
// src/components/layout/TabContentSkeleton.tsx
// Generic skeleton shown during route transitions
import { Skeleton } from '@/components/ui/skeleton';

export function TabContentSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-5 py-4 animate-pulse">
      {/* Banner-width bar */}
      <Skeleton width="100%" height={88} borderRadius={8} />
      {/* Vitals row */}
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={72} borderRadius={8} />
        ))}
      </div>
      {/* Two-column cards */}
      <div className="grid grid-cols-2 gap-4">
        <Skeleton width="100%" height={180} borderRadius={8} />
        <Skeleton width="100%" height={180} borderRadius={8} />
      </div>
    </div>
  );
}
```

**`ScreenNav.tsx`** — add `startTransition` so the active tab state flips immediately without waiting for the route:

```tsx
import { useTransition } from 'react';

export function ScreenNav({ patientId }: { patientId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const navigate = (path: string) => {
    // Flip the active tab style IMMEDIATELY, then navigate
    startTransition(() => {
      router.push(path);
    });
  };

  return (
    <nav ...>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => navigate(`${basePath}${tab.path}`)}
          className={cn(
            '...',
            active ? 'bg-accent text-white ...' : '...',
            // Show a subtle loading shimmer on the active tab while transitioning
            isPending && active && 'opacity-80 animate-pulse'
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
```

---

## 2. Feature-Specific Loading States

### 2.1 Login — Button Spinner

**File:** `src/app/login/page.tsx`

**Current:** Button changes text to "Signing in…" only.

**Implementation:**

```tsx
// Replace the submit button with this:
<button
  onClick={handleLogin}
  disabled={loading || !email || !password}
  className={`h-[34px] w-full ... flex items-center justify-center gap-2`}
>
  {loading ? (
    <>
      <svg
        className="animate-spin h-3.5 w-3.5 text-white"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>Signing in…</span>
    </>
  ) : (
    'Sign In'
  )}
</button>
```

**Create reusable component:** `src/components/ui/spinner.tsx`

```tsx
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const sizeMap = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
};

export function Spinner({ size = 'sm', className }: SpinnerProps) {
  return (
    <svg
      className={cn('animate-spin text-current', sizeMap[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
```

Apply `<Spinner />` to: Login, Change Password, Create Account, Reset Password, Register Patient buttons — any button that triggers an async operation.

---

### 2.2 Patient Search — Skeleton Table

**File:** `src/components/layout/SidebarSkeleton.tsx` — already implemented. Extend it:

**Current gap:** The skeleton shows when `isLoading` is true, but when `search` changes, `keepPreviousData` in `usePatients` keeps the old list visible — this is correct and should stay. Verify `placeholderData: keepPreviousData` remains in `usePatients`.

**Add a search-in-progress indicator** inside the search input:

```tsx
// Sidebar.tsx — inside the search input wrapper
<div className="flex items-center gap-2 h-[34px] bg-surface-2 border border-border rounded-btn px-3 ...">
  <Search className="w-4 h-4 text-text-muted shrink-0" />
  <input ... />
  {/* Show spinner while a search query is in-flight */}
  {isLoading && search.length > 0 && (
    <Spinner size="xs" className="text-text-muted shrink-0" />
  )}
</div>
```

**Alphabetical group skeletons** — preserve letters while loading new search results:

```tsx
// SidebarSkeleton.tsx — already good, just ensure it matches the real row height
// Each skeleton item should be the same height as a real patient row (≈ 53px)
```

---

### 2.3 Patient Profile — Skeleton Card

**Already implemented:** `PatientBannerSkeleton`, `VitalsStripSkeleton`. Extend to cover all dashboard sections.

**File:** `src/components/patients/PatientBannerSkeleton.tsx` — enhance to match the real 3-column banner layout:

```tsx
export function PatientBannerSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-card p-4 flex gap-5 animate-pulse">
      {/* Left: avatar + name */}
      <div className="flex gap-3.5 items-center flex-[1.2] min-w-[250px] border-r border-border pr-5">
        <Skeleton width={44} height={44} borderRadius="50%" />
        <div className="flex flex-col gap-2">
          <Skeleton width={60} height={9} borderRadius={4} />
          <Skeleton width={200} height={18} borderRadius={4} />
          <Skeleton width={80} height={16} borderRadius={4} />
        </div>
      </div>
      {/* Middle: demographics */}
      <div className="flex flex-col gap-2 flex-1 min-w-[220px] border-r border-border pr-5 justify-center">
        <Skeleton width={80} height={9} borderRadius={4} />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width={120} height={12} borderRadius={4} />
          ))}
        </div>
      </div>
      {/* Right: clinical profile */}
      <div className="flex flex-col gap-2 flex-[0.8] min-w-[180px] justify-center">
        <Skeleton width={80} height={9} borderRadius={4} />
        <div className="flex gap-1.5">
          <Skeleton width={70} height={18} borderRadius={4} />
          <Skeleton width={60} height={18} borderRadius={4} />
        </div>
        <Skeleton width={160} height={12} borderRadius={4} />
      </div>
    </div>
  );
}
```

**New:** `src/components/visits/VisitHistoryCardSkeleton.tsx`

```tsx
export function VisitHistoryCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex items-center gap-2">
        <Skeleton width={26} height={26} borderRadius={6} />
        <Skeleton width={80} height={10} borderRadius={4} />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-3.5 py-2.5 flex gap-3 items-start animate-pulse">
            <div className="w-[90px] shrink-0 flex flex-col gap-1">
              <Skeleton width={80} height={12} borderRadius={4} />
              <Skeleton width={50} height={10} borderRadius={4} />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                <Skeleton width={120} height={12} borderRadius={4} />
                <Skeleton width={50} height={16} borderRadius={4} />
                <Skeleton width={60} height={16} borderRadius={4} />
              </div>
              <Skeleton width={220} height={11} borderRadius={4} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**New:** `src/components/problems/ProblemListSkeleton.tsx`

```tsx
export function ProblemListSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex items-center gap-2">
        <Skeleton width={26} height={26} borderRadius={6} />
        <Skeleton width={80} height={10} borderRadius={4} />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-2.5 py-2 flex items-center gap-2 animate-pulse">
            <Skeleton width={14} height={14} borderRadius={2} />
            <Skeleton width={8} height={8} borderRadius="50%" />
            <Skeleton width={i % 2 === 0 ? 160 : 120} height={12} borderRadius={4} />
            <div className="ml-auto">
              <Skeleton width={50} height={16} borderRadius={4} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 2.4 Progress Notes — Skeleton Timeline

**File:** `src/app/dashboard/[patientId]/notes/page.tsx` (currently a stub).

**When implemented in Phase 7**, the Note Timeline needs:

**`src/components/notes/NoteTimelineSkeleton.tsx`**

```tsx
export function NoteTimelineSkeleton() {
  return (
    <div className="flex gap-4">
      {/* Left: timeline rail */}
      <div className="w-[260px] flex-shrink-0 flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-card p-3 flex gap-2 animate-pulse">
            <div className="flex flex-col items-center gap-1 w-[50px] shrink-0">
              <Skeleton width={40} height={10} borderRadius={4} />
              <Skeleton width={30} height={9} borderRadius={4} />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex gap-1">
                <Skeleton width={44} height={16} borderRadius={4} />
                <Skeleton width={50} height={16} borderRadius={4} />
              </div>
              <Skeleton width={100} height={10} borderRadius={4} />
            </div>
          </div>
        ))}
      </div>

      {/* Right: note detail panel */}
      <div className="flex-1 bg-surface border border-border rounded-card p-4 flex flex-col gap-4 animate-pulse">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <Skeleton width={120} height={14} borderRadius={4} />
          <Skeleton width={50} height={18} borderRadius={4} />
          <div className="ml-auto">
            <Skeleton width={80} height={26} borderRadius={6} />
          </div>
        </div>
        {/* Section blocks */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton width={100} height={10} borderRadius={4} />
            <Skeleton width="100%" height={60} borderRadius={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 2.5 Lab Results — Section Loading

For the attachments/lab results section (Phase 11), use section-level loading rather than full-page loading:

**`src/components/attachments/LabResultsSectionSkeleton.tsx`**

```tsx
export function LabResultsSectionSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden">
      {/* Card header — always visible */}
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex items-center gap-2">
        <div className="w-[26px] h-[26px] bg-surface-3 rounded-icon flex items-center justify-center text-[12px]">
          🧪
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">
          Lab Results & Attachments
        </span>
      </div>
      {/* Skeleton rows */}
      <div className="divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="px-3.5 py-2.5 flex items-center gap-3 animate-pulse">
            <Skeleton width={32} height={32} borderRadius={6} />
            <div className="flex-1 flex flex-col gap-1">
              <Skeleton width={150} height={12} borderRadius={4} />
              <Skeleton width={100} height={10} borderRadius={4} />
            </div>
            <Skeleton width={60} height={24} borderRadius={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Pattern:** Every collapsible section that loads its own data should have an inline skeleton, not a full-page loader. Use `useQuery` with `enabled: sectionIsOpen` to defer loading until the section is expanded.

```tsx
// Example: lazy-load attachments only when the section is open
const [open, setOpen] = useState(false);
const { data, isLoading } = useAttachments(noteId, { enabled: open });

<Collapsible open={open} onOpenChange={setOpen}>
  <CollapsibleTrigger>Lab Results</CollapsibleTrigger>
  <CollapsibleContent>
    {isLoading ? <LabResultsSectionSkeleton /> : <LabResultsList data={data} />}
  </CollapsibleContent>
</Collapsible>
```

---

### 2.6 File Uploads — Progress Bar

**File:** `src/components/attachments/FileUploadZone.tsx` (Phase 11)

Implement native XHR (not fetch) for upload progress:

```tsx
// src/lib/upload.ts
export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export function uploadFile(
  file: File,
  token: string,
  patientId: string,
  noteId: string,
  tag: string,
  onProgress: (p: UploadProgress) => void,
): Promise<{ storageKey: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('file', file);
    fd.append('tag', tag);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));

    xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL}/patients/${patientId}/attachments`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(fd);
  });
}
```

**Progress bar UI:**

```tsx
// src/components/attachments/UploadProgressBar.tsx
interface UploadProgressBarProps {
  fileName: string;
  percent: number;       // 0–100
  status: 'uploading' | 'done' | 'error';
}

export function UploadProgressBar({ fileName, percent, status }: UploadProgressBarProps) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2 bg-surface-2 border border-border rounded-btn">
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-[11px] font-medium text-text-secondary truncate max-w-[200px]">{fileName}</span>
        <span className={cn(
          "text-[9px] font-bold uppercase tracking-[0.5px]",
          status === 'done' ? 'text-green' : status === 'error' ? 'text-red' : 'text-text-muted'
        )}>
          {status === 'uploading' ? `${percent}%` : status === 'done' ? 'Done' : 'Failed'}
        </span>
      </div>
      <div className="h-[3px] bg-surface-3 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-200",
            status === 'error' ? 'bg-red' : 'bg-accent'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
```

---

### 2.7 Infinite Records — Lazy Loading (Visit History)

**File:** `src/components/visits/VisitHistoryCard.tsx`

The current expand pattern (5 → 20) works but discards the first page. Use infinite scroll instead:

**`src/hooks/useVisitsInfinite.ts`**

```tsx
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { VisitsResponse } from '@/types/visit';

export function useVisitsInfinite(patientId: string | null) {
  return useInfiniteQuery<VisitsResponse>({
    queryKey: ['visits-infinite', patientId],
    queryFn: ({ pageParam = 1 }) =>
      apiRequest<VisitsResponse>(
        `/patients/${patientId}/visits?page=${pageParam}&limit=10`,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: !!patientId,
    staleTime: 1000 * 30,
    gcTime: 3 * 60 * 1000,
  });
}
```

**`VisitHistoryCard.tsx`** — replace expand button with "Load more":

```tsx
export function VisitHistoryCard({ patientId }: { patientId: string }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useVisitsInfinite(patientId);

  const visits = data?.pages.flatMap((p) => p.data) ?? [];
  const total  = data?.pages[0]?.meta.total ?? 0;

  // Intersection Observer for automatic load-more
  const loaderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loaderRef.current || !hasNextPage) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) fetchNextPage(); },
      { threshold: 0.1 }
    );
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasNextPage, fetchNextPage]);

  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
      {/* ... header ... */}
      {visits.map((v) => <VisitRow key={v.id} visit={v} />)}

      {/* Automatic trigger div */}
      {hasNextPage && <div ref={loaderRef} className="h-px" />}

      {/* Manual fallback */}
      {isFetchingNextPage && (
        <div className="px-3.5 py-2.5 flex items-center gap-2 border-t border-border">
          <Spinner size="xs" className="text-text-muted" />
          <span className="text-[11px] text-text-muted">Loading more visits…</span>
        </div>
      )}

      {!hasNextPage && total > 10 && (
        <div className="px-3.5 py-2.5 border-t border-border text-center text-[11px] text-text-muted">
          All {total} visits loaded
        </div>
      )}
    </div>
  );
}
```

**Apply the same pattern to:**
- Audit logs (Admin panel)
- Problem list changes history (future)

---

### 2.8 Save Note — Optimistic Updates

For the progress note panel (Phase 6–7), implement optimistic updates so the UI reflects changes before the server confirms.

**Pattern for Problem List reordering:**

```tsx
// src/hooks/useProblems.ts
const qc = useQueryClient();

export function useUpdateProblemOrder() {
  return useMutation({
    mutationFn: (updates: { id: string; sortOrder: number }[]) =>
      apiRequest('/problems/reorder', { method: 'PATCH', body: JSON.stringify(updates) }),

    // 1. Snapshot current state
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: ['problems', patientId] });
      const prev = qc.getQueryData(['problems', patientId]);

      // 2. Apply optimistic update immediately
      qc.setQueryData(['problems', patientId], (old: Problem[]) =>
        old.map((p) => {
          const u = updates.find((x) => x.id === p.id);
          return u ? { ...p, sortOrder: u.sortOrder } : p;
        }).sort((a, b) => a.sortOrder - b.sortOrder)
      );

      return { prev }; // context for rollback
    },

    // 3. Rollback on error
    onError: (_err, _updates, ctx) => {
      if (ctx?.prev) qc.setQueryData(['problems', patientId], ctx.prev);
      toast.error('Failed to reorder problems');
    },

    // 4. Sync with server data
    onSettled: () => qc.invalidateQueries({ queryKey: ['problems', patientId] }),
  });
}
```

**Pattern for note auto-save draft status:**

```tsx
// Auto-save state machine — no server round-trip blocks the UI
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
const [saveState, setSaveState] = useState<SaveState>('idle');

// On any field change:
const handleChange = (field: string, value: string) => {
  setForm((f) => ({ ...f, [field]: value }));
  setSaveState('dirty');
  scheduleAutosave(); // debounce 3s
};

// The save indicator shows state without blocking the form:
const SaveIndicator = () => {
  if (saveState === 'saving') return (
    <span className="flex items-center gap-1 text-[10px] text-text-muted">
      <Spinner size="xs" /> Saving…
    </span>
  );
  if (saveState === 'saved') return (
    <span className="text-[9px] font-bold uppercase tracking-[0.5px] bg-green-bg text-green border border-green-border px-1.5 py-[2px] rounded-[4px]">
      Saved
    </span>
  );
  if (saveState === 'error') return (
    <span className="text-[9px] font-bold uppercase tracking-[0.5px] bg-amber-bg text-amber border border-amber-border px-1.5 py-[2px] rounded-[4px]">
      Retry
    </span>
  );
  return <span className="text-[9px] font-bold uppercase tracking-[0.5px] bg-amber-bg text-amber border border-amber-border px-1.5 py-[2px] rounded-[4px]">Draft</span>;
};
```

---

### 2.9 Initial App Startup — Full Screen Loader

Between login redirect and dashboard render, there's a flash while Zustand hydrates from `localStorage` and the session is verified. Add a blocking loader.

**`src/components/layout/AppStartupLoader.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';

export function AppStartupLoader({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Zustand `persist` middleware hydrates synchronously after mount
    // One tick is enough to let it settle
    const t = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(t);
  }, []);

  if (!hydrated) {
    return (
      <div className="fixed inset-0 z-[9999] bg-bg flex flex-col items-center justify-center gap-4">
        {/* Logo mark */}
        <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 8V16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 12H16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-[13px] font-semibold text-text-muted tracking-[0.3px]">
          DAMAYAN EMR
        </span>
        {/* Subtle progress line */}
        <div className="w-[120px] h-[2px] bg-surface-3 rounded-full overflow-hidden mt-1">
          <div className="h-full bg-accent rounded-full animate-[startup-progress_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

**Add to `globals.css`:**

```css
@keyframes startup-progress {
  0%   { width: 0%;   margin-left: 0%; }
  50%  { width: 60%;  margin-left: 20%; }
  100% { width: 0%;   margin-left: 100%; }
}
```

**Apply in `src/app/dashboard/layout.tsx`:**

```tsx
return (
  <AppStartupLoader>
    <div id="shell" className="h-screen ...">
      ...
    </div>
  </AppStartupLoader>
);
```

---

## 3. TanStack Query Global Optimizations

**File:** `src/components/providers/QueryProvider.tsx`

```tsx
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,          // ← keep: 20s is good for clinical data
      gcTime: 10 * 60_000,        // ↑ extend to 10min (was 5min) — retains across tab switches
      retry: 1,
      refetchOnWindowFocus: false, // ← keep: critical for clinical app
      refetchOnReconnect: true,    // ← add: sync after network drop
    },
    mutations: {
      retry: 0, // Never auto-retry mutations — clinical data needs explicit user intent
    },
  },
});
```

### Prefetch on Hover (Already Partially Implemented)

The `handlePrefetch` in `Sidebar.tsx` is correct. Extend it to also prefetch visits:

```tsx
const handlePrefetch = (patientId: string) => {
  // Patient detail
  qc.prefetchQuery({
    queryKey: ['patient', patientId],
    queryFn: () => apiRequest(`/patients/${patientId}`),
    staleTime: 30_000,
  });
  // First page of visits (so dashboard loads instantly)
  qc.prefetchQuery({
    queryKey: ['visits', patientId, 1, 5],
    queryFn: () => apiRequest(`/patients/${patientId}/visits?page=1&limit=5`),
    staleTime: 30_000,
  });
};
```

### Background Refetch on Patient Select

When a user clicks a patient, invalidate stale data so the banner always shows current info:

```tsx
const handleSelect = (p: Patient) => {
  setActivePatient(p);
  // Soft invalidation: only refetches if stale (respects staleTime)
  qc.invalidateQueries({ queryKey: ['patient', p.id] });
  router.push(`/dashboard/${p.id}`);
};
```

---

## 4. Next.js Route Prefetching

### `<Link>` vs `router.push`

The `ScreenNav` currently uses `router.push`. Switch to prefetch on hover for zero-latency JS chunk loading:

```tsx
// ScreenNav.tsx — replace button onClick with Link prefetch
import Link from 'next/link';

// Replace:
<button onClick={() => navigate(`${basePath}${tab.path}`)}>

// With:
<Link
  href={`${basePath}${tab.path}`}
  prefetch={true}           // Next.js will prefetch the JS chunk on mount
  className={cn('h-8 px-3.5 ...', active ? '...' : '...')}
>
  {tab.label}
</Link>
```

This causes Next.js to download the JavaScript bundle for each tab's page **in the background** the moment the ScreenNav renders, so switching tabs has zero JS download latency.

### Sidebar Patient Links

```tsx
// In Sidebar.tsx, wrap patient rows in Link instead of onClick router.push:
import Link from 'next/link';

<Link
  key={p.id}
  href={`/dashboard/${p.id}`}
  prefetch={false}        // Too many patients to prefetch all; hover-prefetch handles this
  onMouseEnter={() => handlePrefetch(p.id)}
  className={cn('flex items-center gap-2.5 ...', isActive ? '...' : '...')}
  onClick={() => setActivePatient(p)}
>
  {/* ... patient row content ... */}
</Link>
```

---

## 5. Code Splitting & Bundle Optimization

### Dynamic Imports for Heavy Sections

Some tab pages will be large (Initial Note has many fields, Medications has complex forms). Defer their JS until first navigation:

```tsx
// src/app/dashboard/[patientId]/initial-note/page.tsx
import dynamic from 'next/dynamic';
import { NoteFormSkeleton } from '@/components/notes/NoteFormSkeleton';

const InitialNoteForm = dynamic(
  () => import('@/components/notes/InitialNoteForm'),
  {
    loading: () => <NoteFormSkeleton />,
    ssr: false,   // Note forms are purely client-side
  }
);

export default function InitialNotePage() {
  return (
    <Suspense fallback={<NoteFormSkeleton />}>
      <InitialNoteForm />
    </Suspense>
  );
}
```

Apply to:
- `InitialNoteForm` — largest form in the app
- `ProgressNoteForm` — in documentation panel
- `AuditLogsTable` — admin only, large dataset
- `DocumentGeneratorModal` — PDF generation, heavyweight

### Avoid Dynamic Imports For:
- `PatientBanner` — shown on every patient view
- `Sidebar` — always present
- `Topbar` — always present
- `ScreenNav` — always present

---

## 6. Data Deduplication: The Patient Context Pattern

Currently, the dashboard page fetches `usePatient(patientId)` and some child components might fetch independently. Centralize patient data with a React Context so child components can read it without duplicate network calls.

**`src/contexts/PatientContext.tsx`**

```tsx
'use client';

import { createContext, useContext } from 'react';
import type { Patient } from '@/types/patient';

interface PatientContextValue {
  patient: Patient | undefined;
  isLoading: boolean;
}

const PatientContext = createContext<PatientContextValue>({
  patient: undefined,
  isLoading: false,
});

export const usePatientContext = () => useContext(PatientContext);
```

**`src/app/dashboard/[patientId]/layout.tsx`** — provide it at the layout level:

```tsx
export default function PatientWorkspaceLayout({ children }) {
  const { patientId } = useParams<{ patientId: string }>();
  const { data: patient, isLoading } = usePatient(patientId);   // Single fetch

  useEffect(() => {
    if (patient) setActivePatient(patient);
  }, [patient, setActivePatient]);

  return (
    <PatientContext.Provider value={{ patient, isLoading }}>
      <div className="flex flex-col flex-1 overflow-hidden">
        <ScreenNav patientId={patientId} />
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {children}
        </div>
      </div>
    </PatientContext.Provider>
  );
}
```

Child components call `usePatientContext()` instead of `usePatient()` — zero duplicate fetches.

---

## 7. Skeleton Design Rules

All skeletons must follow these constraints to feel native and not jarring:

### Rules

1. **Match the exact height** of the real component. A skeleton that's 20px shorter than the real card causes layout shift (CLS).
2. **Use `animate-pulse`** (Tailwind) or the existing shimmer from `Skeleton.tsx`. Never both.
3. **Skeleton opacity should be lower** than real content: `bg-surface-3` not `bg-surface-2` for skeleton bars.
4. **Don't animate the container**, only the bars inside it. The card border/header stays solid.
5. **Show 3–5 skeleton rows** for lists; never more than the viewport can display.
6. **Preserve card headers** — show the real card header (icon + title) even while the body loads. Only the body content gets a skeleton.

### Updated `Skeleton` Component

The existing `Skeleton.tsx` injects styles via `document.createElement`. Replace with a Tailwind-native version:

```tsx
// src/components/ui/skeleton.tsx — simplified, Tailwind-native
import { cn } from '@/lib/utils';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  className?: string;
}

export function Skeleton({ width, height, borderRadius = 6, className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'shrink-0 bg-surface-3 animate-pulse',
        className
      )}
      style={{ width, height, borderRadius }}
    />
  );
}
```

`animate-pulse` is a Tailwind utility that does `opacity: 1 → 0.5 → 1` at 2s intervals — this is smoother than the shimmer gradient for Tailwind v4.

---

## 8. The `loading.tsx` File Strategy

Next.js App Router uses `loading.tsx` as the instant Suspense boundary for a route segment. Place one at every level that needs instant feedback:

```
src/app/
  dashboard/
    loading.tsx          ← shown during dashboard layout load
    [patientId]/
      loading.tsx        ← shown instantly on any tab switch within a patient
      notes/
        loading.tsx      ← shown when navigating to the notes tab
      initial-note/
        loading.tsx      ← shown when navigating to initial note
      problems/
        loading.tsx
      medications/
        loading.tsx
      vitals/
        loading.tsx
      documents/
        loading.tsx
  admin/
    loading.tsx          ← shown during admin layout load
    accounts/
      loading.tsx        ← shown during accounts page load
```

**Template for all patient tab `loading.tsx` files:**

```tsx
// Generic: use this for vitals, medications, problems, documents
import { TabContentSkeleton } from '@/components/layout/TabContentSkeleton';
export default function Loading() {
  return <TabContentSkeleton />;
}
```

**Specific skeletons for tabs that have distinct layouts:**

```tsx
// notes/loading.tsx
import { NoteTimelineSkeleton } from '@/components/notes/NoteTimelineSkeleton';
export default function Loading() {
  return <NoteTimelineSkeleton />;
}

// initial-note/loading.tsx
import { NoteFormSkeleton } from '@/components/notes/NoteFormSkeleton';
export default function Loading() {
  return <NoteFormSkeleton />;
}
```

---

## 9. Performance Monitoring Targets

After implementing the above, validate against these targets:

| Metric | Current (Estimated) | Target |
|---|---|---|
| Tab switch to first paint | 300–800ms | < 50ms (instant skeleton) |
| Patient sidebar search | ~200ms debounce | Immediate with in-flight spinner |
| Patient banner load | ~400ms | < 100ms (prefetched) |
| Full app startup (hydration) | ~800ms blank | Full-screen loader → dashboard |
| Note autosave feedback | Blocking | Optimistic, non-blocking |
| Visit history scroll | Page-reload pattern | Infinite scroll, no flash |

---

## 10. Implementation Priority Order

Build in this sequence — each phase unblocks the next:

### Phase A: Foundations (do first)
1. Create `src/components/ui/spinner.tsx` — used everywhere
2. Update `Skeleton.tsx` to Tailwind-native
3. Create `src/components/layout/TabContentSkeleton.tsx`
4. Add `loading.tsx` to every route segment
5. Add `useTransition` to `ScreenNav.tsx`
6. Switch `ScreenNav` buttons to `<Link prefetch={true}>`

### Phase B: Per-Feature Skeletons (as features are built)
7. Enhance `PatientBannerSkeleton` to match exact banner layout
8. Create `VisitHistoryCardSkeleton`
9. Create `ProblemListSkeleton`
10. Create `NoteTimelineSkeleton` (Phase 7)
11. Create `NoteFormSkeleton` (Phase 6)

### Phase C: Data Optimizations
12. Add `refetchOnReconnect: true` to QueryProvider
13. Extend `handlePrefetch` to also prefetch visits
14. Extend `gcTime` to 10min
15. Switch `VisitHistoryCard` to `useInfiniteQuery`
16. Add `PatientContext` provider to patient layout

### Phase D: Advanced (Phase 6+)
17. Add `AppStartupLoader` to dashboard layout
18. Implement optimistic updates for problem reordering
19. Implement `SaveState` machine for notes
20. Add upload progress bar infrastructure

### Phase E: Dynamic Imports (Phase 6+, as forms are built)
21. Wrap `InitialNoteForm` in `dynamic()`
22. Wrap `ProgressNoteForm` in `dynamic()`
23. Wrap `AuditLogsTable` in `dynamic()`

---

## 11. Anti-Patterns to Avoid

These are common patterns that kill performance in data-heavy clinical apps:

| Anti-Pattern | Problem | Fix |
|---|---|---|
| `await data` at page level before rendering | Blocks first paint | Use `useQuery` inside components with Suspense |
| `isLoading && return null` | Blank flash | `isLoading && return <Skeleton />` |
| Fetching in parent and passing as props | Re-renders cascade | Fetch in the leaf component that needs it |
| `useEffect` data fetch | Double render on mount | Use TanStack Query |
| `router.push` without prefetch | JS bundle latency | `<Link prefetch={true}>` |
| Invalidating all queries on any mutation | Thundering herd | Invalidate only the affected query key |
| `staleTime: 0` (the default) | Every render = fetch | Set `staleTime: 20_000` globally (already done) |
| Fetching all patients on every search keystroke | Hammers the API | `usePatients` already debounces via `keepPreviousData` — add a 300ms debounce on the input |

---

## Quick Reference: Component → Loading State Map

| Component | Loading State | Skeleton File |
|---|---|---|
| Login button | Button spinner | `Spinner` in button |
| Change Password button | Button spinner | `Spinner` in button |
| Create Account button | Button spinner | `Spinner` in button |
| Register Patient button | Button spinner | `Spinner` in button |
| Sidebar patient list | `SidebarSkeleton` | Already exists |
| Sidebar search in-flight | Input spinner | Inline `Spinner` |
| Patient Banner | `PatientBannerSkeleton` | Enhance existing |
| Vitals Strip | `VitalsStripSkeleton` | Already exists |
| Problem List | `ProblemListSkeleton` | Create |
| Medication List | `MedicationListSkeleton` | Create (mirror Problems) |
| Visit History | `VisitHistoryCardSkeleton` | Create |
| Note Timeline | `NoteTimelineSkeleton` | Create (Phase 7) |
| Initial Note Form | `NoteFormSkeleton` | Create (Phase 6) |
| Lab Results section | `LabResultsSectionSkeleton` | Create (Phase 11) |
| File upload | `UploadProgressBar` | Create (Phase 11) |
| Tab navigation | Route `loading.tsx` + `useTransition` | Create all |
| App startup | `AppStartupLoader` | Create |
| Note autosave | `SaveState` inline indicator | Inline (Phase 6) |

---

*DAMAYAN EMR — Loading & Performance Optimization Plan v1.0*  
*For implementation across Phases 5–11 of the DAMAYAN project at UP-PGH*