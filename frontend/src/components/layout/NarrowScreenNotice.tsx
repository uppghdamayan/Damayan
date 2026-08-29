'use client';

import { useSyncExternalStore } from 'react';
import { NARROW_NOTICE_DISMISSED_KEY } from '@/lib/breakpoints';

// Read through useSyncExternalStore rather than useEffect + setState: the flag
// lives in sessionStorage, which does not exist during SSR, and this gives a
// server snapshot of `false` without a hydration mismatch or a cascading render.
let cached: boolean | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot() {
  if (cached !== null) return cached;
  try {
    cached = sessionStorage.getItem(NARROW_NOTICE_DISMISSED_KEY) === '1';
  } catch {
    // Private mode or blocked site data — just show the notice.
    cached = false;
  }
  return cached;
}

function dismiss() {
  try {
    sessionStorage.setItem(NARROW_NOTICE_DISMISSED_KEY, '1');
  } catch {
    // Non-fatal: the notice still goes away for this session in memory.
  }
  cached = true;
  listeners.forEach((l) => l());
}

export function NarrowScreenNotice() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, () => false);

  if (dismissed) return null;

  return (
    // Threshold lowered from 767px to 639px. 768–1023px is a real working range
    // (half-screen windows, landscape tablets) and is now handled properly by
    // the overlay panels, so blocking it was hiding a layout that works.
    <div className="fixed inset-0 z-[9999] items-center justify-center bg-bg p-8 text-center hidden @max-[639px]/app:flex">
      <div className="max-w-sm">
        <p className="text-[15px] font-bold text-text-primary mb-2">
          Screen too narrow
        </p>
        <p className="text-[13px] text-text-muted">
          DAMAYAN is designed for tablet, laptop, or desktop screens.
          Please use a device with a screen width of at least 640px.
        </p>
        {/*
          Escape hatch. This was a hard z-[9999] lock with no way out, so
          narrowing a desktop window past the threshold locked the user out of a
          session they were in the middle of.
        */}
        <button
          onClick={dismiss}
          className="mt-4 h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center justify-center cursor-pointer"
        >
          Continue anyway
        </button>
      </div>
    </div>
  );
}
