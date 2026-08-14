import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useUiStore } from '@/stores/uiStore';

export type MedicationEditOwner = 'master' | 'note';

function hasMasterDraft(patientId: string): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(`damayan_medication_draft_${patientId}`);
}

function hasNoteDraft(patientId: string): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(`damayan:draft:${patientId}:progress`);
}

/**
 * Mutual-exclusion lock between the Master Medications List (owner: 'master')
 * and a Progress Note's in-note "Current Medication List" editor (owner:
 * 'note') — only one may be in draft-edit mode for a given patient at a
 * time, so publishing one side never silently clobbers unpublished edits
 * made on the other. Structurally identical to useProblemEditLock, kept as
 * its own independent lock so an unrelated problem-list edit never blocks a
 * medications edit or vice versa.
 */
export function useMedicationEditLock(
  patientId: string | null,
  owner: MedicationEditOwner,
  options?: { noteId?: string; hasOpenDbDraft?: boolean },
) {
  const medicationEditLock = useUiStore((s) => s.medicationEditLock);
  const acquireMedicationEditLock = useUiStore((s) => s.acquireMedicationEditLock);
  const releaseMedicationEditLock = useUiStore((s) => s.releaseMedicationEditLock);

  // A lock recorded for a different patient is irrelevant to this hook's
  // caller — treat it as absent rather than let it block edits here.
  const lockForThisPatient =
    patientId && medicationEditLock?.patientId === patientId ? medicationEditLock : null;
  const lockOwner = lockForThisPatient?.owner ?? null;
  const lockNoteId = lockForThisPatient?.noteId ?? null;
  const isLockedByOther = lockOwner !== null && lockOwner !== owner;
  const canEdit = !isLockedByOther;

  // Reconcile a stuck lock — but ONLY once per patient, right when a
  // component first mounts for them. This is a crash-recovery check, not a
  // live watcher: reacting to every lock change would release a lock within
  // the same tick it was legitimately acquired, since autosave hasn't
  // written a draft yet. See useProblemEditLock for the full rationale —
  // this mirrors it exactly.
  const reconciledPatientRef = useRef<string | null>(null);
  useEffect(() => {
    if (!patientId) return;
    if (reconciledPatientRef.current === patientId) return;
    reconciledPatientRef.current = patientId;

    const lock = useUiStore.getState().medicationEditLock;
    if (!lock || lock.patientId !== patientId) return;
    const stillBacked =
      lock.owner === 'master'
        ? hasMasterDraft(patientId)
        : hasNoteDraft(patientId) || !!options?.hasOpenDbDraft;
    if (!stillBacked) {
      useUiStore.getState().releaseMedicationEditLock(lock.owner);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const tryAcquire = useCallback(() => {
    if (!patientId) return false;
    const ok = acquireMedicationEditLock(patientId, owner, options?.noteId);
    if (!ok) {
      toast.error(
        owner === 'master'
          ? 'The Master Medications List is locked — a Progress Note draft is currently editing medications. Publish or revert that note first.'
          : 'The Medications list is locked — the Master Medications List is currently being edited. Finish there first.',
      );
    }
    return ok;
  }, [patientId, owner, options?.noteId, acquireMedicationEditLock]);

  const release = useCallback(() => {
    releaseMedicationEditLock(owner);
  }, [owner, releaseMedicationEditLock]);

  return { isLockedByOther, lockOwner, lockNoteId, canEdit, tryAcquire, release };
}
