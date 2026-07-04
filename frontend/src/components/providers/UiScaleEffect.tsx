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
