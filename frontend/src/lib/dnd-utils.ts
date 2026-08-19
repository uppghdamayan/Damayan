import type { Modifier } from '@dnd-kit/core';
import { useUiStore } from '@/stores/uiStore';

// Corrects the dnd-kit drag transform for the app's UI zoom
// (document.documentElement.style.zoom, set by UiScaleEffect). Without this,
// the drag overlay drifts away from the cursor at any zoom level other than
// 100% — CSS `zoom` scales layout but dnd-kit's pointer math is computed in
// unscaled coordinates. Shared by the Master Problem List (ProblemListScreen)
// and the note editors' problem list (NoteProblemListEditor).
export const zoomModifier: Modifier = ({ transform, activeNodeRect }) => {
  const currentScale = (useUiStore.getState().uiScale || 100) / 100;
  if (currentScale === 1 || !activeNodeRect) {
    return transform;
  }
  return {
    ...transform,
    x: transform.x + activeNodeRect.left * (1 / currentScale - 1),
    y: transform.y + activeNodeRect.top * (1 / currentScale - 1),
  };
};

// Locks a drag to vertical movement only. @dnd-kit/modifiers is not a
// dependency of this project — this one-liner covers the single modifier we
// need without adding one.
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});
