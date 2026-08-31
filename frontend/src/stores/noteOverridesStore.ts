import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Durable record of medications AND problems the clinician explicitly
 * removed *within a specific draft progress note* (via the in-note
 * "Current Medication List" / Problem List editors), keyed by
 * `${patientId}:${noteId ?? 'new'}:${'med' | 'problem'}`.
 *
 * Why this needs to exist separately from draftSnapshotStore: a
 * discontinued medication is still ACTIVE on the master Medication row
 * (and a deleted-in-note problem is still ACTIVE on the master Problem
 * List) until the note is published, so mergeActiveMedications'/
 * mergeActiveProblems' "add missing actives back" step would otherwise
 * resurrect it the moment the live list is re-read — which happens on
 * every copyForward refetch, not just on publish. draftSnapshotStore is
 * deliberately non-persisted and cleared on unmount, so it only masks
 * this while the editor happens to be mounted; closing the note panel (or
 * reloading) let the removal reappear in the note timeline's own live
 * merge. This store is `persist`-ed (same middleware as uiStore)
 * specifically so the removal survives both.
 *
 * The `'new'` segment matters: an unsaved note (noteId === null) tombstones
 * under `${patientId}:new:...`, and MUST be migrated (not cleared) to the
 * real key once the note is first saved — see `migrateKey`. Losing that
 * migration is exactly how a discontinuation/deletion resurrected right
 * after the first Save Draft.
 *
 * Scope is intentionally narrow: only the removed tombstones live here,
 * never form content — draftSnapshotStore/useAutoSave already own that.
 */

interface NoteOverridesState {
  byKey: Record<string, string[]>; // key -> opaque removed-item tokens
  addRemoved: (key: string, tokens: string[]) => void;
  removeRemoved: (key: string, tokens: string[]) => void;
  clearRemoved: (key: string) => void;
  // Unions byKey[fromKey] into byKey[toKey] and deletes fromKey. No-op if
  // fromKey is absent or the two keys are equal. Union (not overwrite) so a
  // tombstone already recorded under the real key is never lost.
  migrateKey: (fromKey: string, toKey: string) => void;
}

export const useNoteOverridesStore = create<NoteOverridesState>()(
  persist(
    (set) => ({
      byKey: {},
      addRemoved: (key, tokens) =>
        set((state) => {
          const current = new Set(state.byKey[key] || []);
          let changed = false;
          for (const token of tokens) {
            if (!token) continue;
            if (!current.has(token)) {
              current.add(token);
              changed = true;
            }
          }
          if (!changed) return state;
          return { byKey: { ...state.byKey, [key]: Array.from(current) } };
        }),
      removeRemoved: (key, tokens) =>
        set((state) => {
          const current = state.byKey[key];
          if (!current || current.length === 0) return state;
          const toDrop = new Set(tokens);
          const next = current.filter((t) => !toDrop.has(t));
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
      migrateKey: (fromKey, toKey) =>
        set((state) => {
          if (fromKey === toKey) return state;
          const fromTokens = state.byKey[fromKey];
          if (!fromTokens || fromTokens.length === 0) {
            if (!(fromKey in state.byKey)) return state;
            const next = { ...state.byKey };
            delete next[fromKey];
            return { byKey: next };
          }
          const merged = new Set([...(state.byKey[toKey] || []), ...fromTokens]);
          const next = { ...state.byKey, [toKey]: Array.from(merged) };
          delete next[fromKey];
          return { byKey: next };
        }),
    }),
    {
      name: 'damayan-note-overrides',
      version: 1,
      // v0 (medNoteOverridesStore) keyed medication tombstones as
      // `${patientId}:${noteId ?? 'new'}` with no `:med`/`:problem` suffix.
      // Rewrite every existing key to `...:med` so an in-flight
      // discontinuation isn't silently dropped by this deploy.
      migrate: (persisted: unknown, version: number) => {
        if (version === 0 && persisted && typeof persisted === 'object' && 'byKey' in persisted) {
          const old = persisted as { byKey: Record<string, string[]> };
          const byKey: Record<string, string[]> = {};
          for (const [key, tokens] of Object.entries(old.byKey)) {
            byKey[`${key}:med`] = tokens;
          }
          return { ...old, byKey };
        }
        return persisted;
      },
    },
  ),
);

export function noteOverrideKey(
  patientId: string,
  noteId: string | null | undefined,
  kind: 'med' | 'problem',
): string {
  return `${patientId}:${noteId ?? 'new'}:${kind}`;
}

export function medNoteOverrideKey(patientId: string, noteId: string | null | undefined): string {
  return noteOverrideKey(patientId, noteId, 'med');
}

export function problemNoteOverrideKey(patientId: string, noteId: string | null | undefined): string {
  return noteOverrideKey(patientId, noteId, 'problem');
}

// Clears both the medication and problem tombstone buckets for one note in
// a single update — used on publish/delete/revert terminal paths.
export function clearNoteOverrides(patientId: string, noteId: string | null | undefined): void {
  const state = useNoteOverridesStore.getState();
  state.clearRemoved(medNoteOverrideKey(patientId, noteId));
  state.clearRemoved(problemNoteOverrideKey(patientId, noteId));
}
