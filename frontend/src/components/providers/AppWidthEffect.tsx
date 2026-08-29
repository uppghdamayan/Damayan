'use client';

import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { BP } from '@/lib/breakpoints';

/**
 * Feeds `uiStore.appWidth` from a ResizeObserver on the `app` container.
 *
 * This is the one measurement the rest of the app is allowed to branch on.
 * It matters that it is the *element's* width and not `window.innerWidth`:
 * `UiScaleEffect` sets `zoom` on `<html>`, so at any scale other than 100% the
 * two disagree — and this is the same box the `@container app` rules in
 * globals.css measure. Reading it here means the JS branches and the CSS
 * branches can never drift apart.
 *
 * Also applies the one-time width-derived default for the sidebar. That used to
 * live in the store's initializer as a `window.innerWidth` read, which made the
 * first client render disagree with the server render.
 */
export function AppWidthEffect() {
  const setAppWidth = useUiStore((s) => s.setAppWidth);

  useEffect(() => {
    const el = document.body;
    if (!el) return;

    const apply = (width: number) => {
      if (width <= 0) return;
      setAppWidth(width);

      // Seed the sidebar state from the first real measurement, but only if the
      // user has never touched it themselves.
      const { sidebarUserSet, setSidebarCollapsed } = useUiStore.getState();
      if (!sidebarUserSet) {
        setSidebarCollapsed(width < BP.wide, { userInitiated: false });
      }
    };

    apply(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        apply(entry.contentRect.width);
      }
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [setAppWidth]);

  return null;
}
