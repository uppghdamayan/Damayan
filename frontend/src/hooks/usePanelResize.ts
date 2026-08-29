'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';

const KEYBOARD_STEP_PX = 16;

interface UsePanelResizeOptions {
  /** Which edge of the layout the panel is docked to. */
  side: 'left' | 'right';
  /**
   * Custom property the drag writes, e.g. `--doc-panel-w-user`. It is set on
   * `#shell`, never on `<html>`: globals.css feeds it through a clamp() whose
   * bounds are owned by the breakpoint tiers, so a drag can pick a point inside
   * the current tier but can never escape it or outlive it. Writing the
   * resolved width directly onto the root — which is what this used to do —
   * permanently overrode the tier rules for the rest of the session.
   */
  cssVar: string;
  /** The panel element, measured at drag start to seed the width. */
  elementRef: React.RefObject<HTMLElement | null>;
  min: number;
  /**
   * Recomputed on every pointer move rather than captured once — the other
   * panel can open mid-drag, and the two clamps have to stay aware of each
   * other or they sum past 100% and squeeze the center column to nothing.
   */
  getMax: () => number;
  /** Persisted width to re-apply on mount. null = use the tier default. */
  persistedPx: number | null;
  onCommit: (px: number) => void;
  enabled: boolean;
}

export function usePanelResize({
  side,
  cssVar,
  elementRef,
  min,
  getMax,
  persistedPx,
  onCommit,
  enabled,
}: UsePanelResizeOptions) {
  const [isResizing, setIsResizing] = useState(false);
  const latestWidthRef = useRef<number | null>(null);

  const writeVar = useCallback((px: number) => {
    document.getElementById('shell')?.style.setProperty(cssVar, `${px}px`);
  }, [cssVar]);

  // Re-apply the persisted width. Previously the drag's inline style survived
  // client-side navigation but not a reload, so the same panel had two
  // different widths depending on how you got to the page.
  useEffect(() => {
    if (persistedPx == null) return;
    writeVar(persistedPx);
  }, [persistedPx, writeVar]);

  const startDrag = useCallback((clientX: number) => {
    if (!enabled) return;
    const el = elementRef.current;
    if (!el) return;

    // offsetWidth is in layout pixels and clientX is in visual pixels, which
    // differ whenever UiScaleEffect has applied a zoom. Working from the
    // *delta* rather than an absolute position means only the scale factor has
    // to be corrected for, which is exact in every engine.
    const startWidth = el.offsetWidth;
    const startClientX = clientX;
    const scale = (useUiStore.getState().uiScale || 100) / 100;

    setIsResizing(true);

    const move = (clientXNow: number) => {
      const deltaLayoutPx = (clientXNow - startClientX) / scale;
      const raw = side === 'right' ? startWidth - deltaLayoutPx : startWidth + deltaLayoutPx;
      const max = Math.max(min, getMax());
      const clamped = Math.max(min, Math.min(raw, max));
      latestWidthRef.current = clamped;
      writeVar(clamped);
    };

    const onPointerMove = (e: PointerEvent) => move(e.clientX);
    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setIsResizing(false);
      if (latestWidthRef.current != null) onCommit(latestWidthRef.current);
    };

    // Pointer events rather than mouse events: the target device class here
    // includes clinic tablets, where the mouse-only handler never fired.
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
  }, [enabled, elementRef, getMax, min, onCommit, side, writeVar]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    startDrag(e.clientX);
  }, [startDrag]);

  // The handles used to be mouse-only, so panel width was unreachable by
  // keyboard entirely.
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!enabled) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const el = elementRef.current;
    if (!el) return;
    e.preventDefault();

    const towardsWider = side === 'right' ? e.key === 'ArrowLeft' : e.key === 'ArrowRight';
    const delta = towardsWider ? KEYBOARD_STEP_PX : -KEYBOARD_STEP_PX;
    const max = Math.max(min, getMax());
    const next = Math.max(min, Math.min(el.offsetWidth + delta, max));
    writeVar(next);
    onCommit(next);
  }, [enabled, elementRef, getMax, min, onCommit, side, writeVar]);

  return {
    isResizing,
    handleProps: {
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-label': side === 'right' ? 'Resize documentation panel' : 'Resize patient list',
      tabIndex: 0,
      onPointerDown,
      onKeyDown,
    },
  };
}
