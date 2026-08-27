import { create } from 'zustand';

/**
 * Live channel from an open ProgressNoteForm editor to NoteTimeline, carrying
 * only the two arrays a draft's timeline entry needs to stay 1:1 with the
 * editor: `problemListSnapshot` / `medicationSnapshot` form state, before
 * it's ever saved. Deliberately NOT persisted (unlike uiStore) — a
 * rehydrated stale snapshot on reload would override the timeline's own
 * live merge (see NoteTimeline's use of note-snapshot-merge.ts), which is
 * strictly more correct once the editor isn't mounted.
 *
 * Keyed by `${patientId}:${noteId}` so multiple patients/notes never
 * collide; the editor clears its own key on unmount.
 */

export interface DraftSnapshot {
  problemListSnapshot: any[];
  medicationSnapshot: any[];
}

interface DraftSnapshotState {
  byKey: Record<string, DraftSnapshot>;
  setDraftSnapshot: (key: string, snapshot: DraftSnapshot) => void;
  clearDraftSnapshot: (key: string) => void;
}

function shallowArrayEqual(a: any[], b: any[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  // Snapshot arrays are replaced wholesale on every relevant change (never
  // mutated in place), so a JSON comparison is cheap and correct here — it
  // only runs when problemListSnapshot/medicationSnapshot actually changed
  // reference, i.e. on real edits, not on every keystroke of unrelated
  // fields (those never reach this store at all).
  return JSON.stringify(a) === JSON.stringify(b);
}

export const useDraftSnapshotStore = create<DraftSnapshotState>((set) => ({
  byKey: {},
  setDraftSnapshot: (key, snapshot) =>
    set((state) => {
      const existing = state.byKey[key];
      if (
        existing &&
        shallowArrayEqual(existing.problemListSnapshot, snapshot.problemListSnapshot) &&
        shallowArrayEqual(existing.medicationSnapshot, snapshot.medicationSnapshot)
      ) {
        return state; // no-op: keeps the stored reference stable, no re-render downstream
      }
      return { byKey: { ...state.byKey, [key]: snapshot } };
    }),
  clearDraftSnapshot: (key) =>
    set((state) => {
      if (!(key in state.byKey)) return state;
      const next = { ...state.byKey };
      delete next[key];
      return { byKey: next };
    }),
}));
