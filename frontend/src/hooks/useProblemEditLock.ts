import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useUiStore } from '@/stores/uiStore';
import { hasProgressDraft } from '@/lib/note-drafts';

export type ProblemEditOwner = 'master' | 'note';

function hasMasterDraft(patientId: string): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(`damayan_problem_draft_${patientId}`);
}

function hasNoteDraft(patientId: string): boolean {
  if (typeof window === 'undefined') return false;
  return hasProgressDraft(patientId);
}

/**
 * Mutual-exclusion lock between the Master Problem List (owner: 'master')
 * and a Progress Note's in-note Assessment editor (owner: 'note') — only one
 * may be in draft-edit mode for a given patient at a time, so publishing one
 * side never silently clobbers unpublished edits made on the other.
 *
 * The lock itself lives in `uiStore` (persisted, so it survives reload); this
 * hook wraps it with the acquire/release/toast rules plus a self-healing
 * reconciler so a crashed tab or a manually-cleared draft can never leave
 * both modules stuck locked forever.
 */
export function useProblemEditLock(
  patientId: string | null,
  owner: ProblemEditOwner,
  options?: { noteId?: string; hasOpenDbDraft?: boolean },
) {
  const problemEditLock = useUiStore((s) => s.problemEditLock);
  const acquireProblemEditLock = useUiStore((s) => s.acquireProblemEditLock);
  const releaseProblemEditLock = useUiStore((s) => s.releaseProblemEditLock);

  // A lock recorded for a different patient is irrelevant to this hook's
  // caller — treat it as absent rather than let it block edits here.
  const lockForThisPatient =
    patientId && problemEditLock?.patientId === patientId ? problemEditLock : null;
  const lockOwner = lockForThisPatient?.owner ?? null;
  const lockNoteId = lockForThisPatient?.noteId ?? null;
  const isLockedByOther = lockOwner !== null && lockOwner !== owner;
  const canEdit = !isLockedByOther;

  // Reconcile a stuck lock — but ONLY once per patient, right when a
  // component first mounts for them. This is a crash-recovery check (a
  // browser crash or a manually-cleared localStorage key can leave a lock
  // behind with nothing backing it), not a live watcher: a fresh, legitimate
  // acquisition made *during* this session has no draft written yet either
  // (autosave is debounced 5-10s), so reacting to every lock change here
  // would release a lock within the same tick it was acquired, defeating
  // the mutual-exclusion entirely. Re-checking only at mount means it can
  // still heal a stale lock inherited from a previous session/reload without
  // ever second-guessing one just acquired live.
  const reconciledPatientRef = useRef<string | null>(null);
  useEffect(() => {
    if (!patientId) return;
    if (reconciledPatientRef.current === patientId) return;
    reconciledPatientRef.current = patientId;

    const lock = useUiStore.getState().problemEditLock;
    if (!lock || lock.patientId !== patientId) return;
    const stillBacked =
      lock.owner === 'master'
        ? hasMasterDraft(patientId)
        : hasNoteDraft(patientId) || !!options?.hasOpenDbDraft;
    if (!stillBacked) {
      useUiStore.getState().releaseProblemEditLock(lock.owner);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const tryAcquire = useCallback(() => {
    if (!patientId) return false;
    const ok = acquireProblemEditLock(patientId, owner, options?.noteId);
    if (!ok) {
      toast.error(
        owner === 'master'
          ? 'The Master Problem List is locked — a Progress Note draft is currently editing problems. Publish or revert that note first.'
          : 'The Problem List is locked — the Master Problem List is currently being edited. Finish there first.',
      );
    }
    return ok;
  }, [patientId, owner, options?.noteId, acquireProblemEditLock]);

  const release = useCallback(() => {
    releaseProblemEditLock(owner);
  }, [owner, releaseProblemEditLock]);

  return { isLockedByOther, lockOwner, lockNoteId, canEdit, tryAcquire, release };
}
