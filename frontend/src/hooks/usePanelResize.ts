'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const KEYBOARD_STEP_PX = 16;

interface UsePanelResizeOptions {
  /** Which edge of the layout the panel is docked to. */
  side: 'left' | 'right';
  /**
   * Custom property the drag writes, e.g. `--doc-panel-w-user`. It is set on
   * `#shell`, never on `<html>`: globals.css floors it at `-min` but no longer
   * imposes a ceiling — this hook is the only source of the upper bound, via
   * `getMax`.
   */
  cssVar: string;
  /** The panel element, measured at drag start to seed the width. */
  elementRef: React.RefObject<HTMLElement | null>;
  min: number;
  /**
   * Recomputed on every pointer move rather than captured once — the other
   * panel can open mid-drag, and the two clamps have to stay aware of each
   * other or they sum past 100% and squeeze the center column to nothing.
   * Return a non-finite value (Infinity) when the layout hasn't been measured
   * yet — the caller must never collapse this to `min`, or every drag before
   * first measurement is indistinguishable from frozen.
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
  // Mirrors the rendered width outside of an active drag, so the keyboard path
  // and the re-clamp effect below have something to step/compare against
  // without re-reading a DOM measurement that stops changing once a CSS
  // ceiling (now gone, but keep the pattern honest) or an in-flight
  // transition holds it steady.
  const currentWidthRef = useRef<number | null>(persistedPx);

  const writeVar = useCallback((px: number) => {
    document.getElementById('shell')?.style.setProperty(cssVar, `${px}px`);
  }, [cssVar]);

  const clampToMax = useCallback((px: number) => {
    const max = getMax();
    const upper = Number.isFinite(max) ? Math.max(min, max) : Infinity;
    return Math.max(min, Math.min(px, upper));
  }, [getMax, min]);

  // Re-apply the persisted width. Previously the drag's inline style survived
  // client-side navigation but not a reload, so the same panel had two
  // different widths depending on how you got to the page.
  useEffect(() => {
    if (persistedPx == null) return;
    currentWidthRef.current = persistedPx;
    writeVar(persistedPx);
  }, [persistedPx, writeVar]);

  // Without a CSS ceiling, a panel widened at a wide viewport must be pulled
  // back in if the viewport (or the other panel opening) shrinks its budget
  // below the persisted width — otherwise it crushes the center column.
  useEffect(() => {
    if (!enabled) return;
    const current = currentWidthRef.current;
    if (current == null) return;
    const clamped = clampToMax(current);
    if (clamped !== current) {
      currentWidthRef.current = clamped;
      writeVar(clamped);
      onCommit(clamped);
    }
    // Re-run whenever the caller's budget could have changed; getMax itself is
    // recreated by the caller when its inputs (appWidth, other panel's state)
    // change, so depend on the function identity rather than trying to name
    // every underlying value here.
  }, [enabled, getMax, clampToMax, writeVar, onCommit]);

  const startDrag = useCallback((clientX: number, el: HTMLElement) => {
    if (!enabled) return;

    // getBoundingClientRect() and clientX are both in visual pixels, so no
    // zoom/scale correction is needed working from the delta between them.
    const startWidth = el.getBoundingClientRect().width;
    const startClientX = clientX;

    setIsResizing(true);
    // Kill the width transition immediately rather than waiting for the
    // `isResizing` state to re-render — otherwise the first move is fought by
    // a 300ms width transition.
    el.style.transition = 'none';

    const move = (clientXNow: number) => {
      const deltaPx = clientXNow - startClientX;
      const raw = side === 'right' ? startWidth - deltaPx : startWidth + deltaPx;
      const clamped = clampToMax(raw);
      latestWidthRef.current = clamped;
      currentWidthRef.current = clamped;
      writeVar(clamped);
    };

    const stop = () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
      el.style.transition = '';
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setIsResizing(false);
      if (latestWidthRef.current != null) {
        // Re-clamp at commit time in case the budget changed mid-drag (e.g.
        // the other panel opened).
        const finalPx = clampToMax(latestWidthRef.current);
        currentWidthRef.current = finalPx;
        onCommit(finalPx);
      }
    };

    const onPointerMove = (e: PointerEvent) => move(e.clientX);

    // Listeners on the handle itself (with pointer capture) rather than on
    // `document` — this survives anything else on the page listening for
    // pointer events at the document level, and drops cleanly if the handle
    // unmounts mid-drag.
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
  }, [enabled, side, clampToMax, writeVar, onCommit]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    startDrag(e.clientX, elementRef.current ?? (handle as unknown as HTMLElement));
  }, [startDrag, elementRef]);

  // The handles used to be mouse-only, so panel width was unreachable by
  // keyboard entirely.
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!enabled) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();

    const towardsWider = side === 'right' ? e.key === 'ArrowLeft' : e.key === 'ArrowRight';
    const delta = towardsWider ? KEYBOARD_STEP_PX : -KEYBOARD_STEP_PX;
    const base = currentWidthRef.current ?? elementRef.current?.getBoundingClientRect().width ?? min;
    const next = clampToMax(base + delta);
    currentWidthRef.current = next;
    writeVar(next);
    onCommit(next);
  }, [enabled, elementRef, min, clampToMax, onCommit, side, writeVar]);

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
