import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Durable record of medications the clinician explicitly discontinued
 * *within a specific draft progress note* (via the in-note "Current
 * Medication List" editor), keyed by `${patientId}:${noteId}`.
 *
 * Why this needs to exist separately from draftSnapshotStore: a
 * discontinued medication is still ACTIVE on the master Medication row
 * until the note is published (see MedicationsService#upsertFromNoteMedications),
 * so mergeActiveMedications' "add missing active meds back" step would
 * otherwise resurrect it the moment the live active-medications list is
 * re-read — which happens on every copyForward refetch, not just on
 * publish. draftSnapshotStore is deliberately non-persisted and cleared on
 * unmount, so it only masks this while the editor happens to be mounted;
 * closing the note panel (or reloading) let the removal reappear in the
 * note timeline's own live merge. This store is `persist`-ed (same
 * middleware as uiStore) specifically so the removal survives both.
 *
 * Scope is intentionally narrow: only the removed-name tombstones live
 * here, never form content — draftSnapshotStore/useAutoSave already own
 * that.
 */

interface MedNoteOverridesState {
  byKey: Record<string, string[]>; // key -> lowercased/trimmed removed med names
  addRemoved: (key: string, names: string[]) => void;
  removeRemoved: (key: string, names: string[]) => void;
  clearRemoved: (key: string) => void;
}

export const useMedNoteOverridesStore = create<MedNoteOverridesState>()(
  persist(
    (set) => ({
      byKey: {},
      addRemoved: (key, names) =>
        set((state) => {
          const current = new Set(state.byKey[key] || []);
          let changed = false;
          for (const name of names) {
            if (!name) continue;
            if (!current.has(name)) {
              current.add(name);
              changed = true;
            }
          }
          if (!changed) return state;
          return { byKey: { ...state.byKey, [key]: Array.from(current) } };
        }),
      removeRemoved: (key, names) =>
        set((state) => {
          const current = state.byKey[key];
          if (!current || current.length === 0) return state;
          const toDrop = new Set(names);
          const next = current.filter((n) => !toDrop.has(n));
          if (next.length === current.length) return state;
          return { byKey: { ...state.byKey, [key]: next } };
        }),
      clearRemoved: (key) =>
        set((state) => {
          if (!(key in state.byKey)) return state;
          const next = { ...state.byKey };
          delete next[key];
          return { byKey: next };
        }),
    }),
    {
      name: 'damayan-med-note-overrides',
    },
  ),
);

export function medNoteOverrideKey(patientId: string, noteId: string | null | undefined): string {
  return `${patientId}:${noteId ?? 'new'}`;
}
