'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ClipboardList, ArrowRight } from 'lucide-react';
import {
  useMedications,
  useCreateMedication,
  useUpdateMedication,
  useDeleteMedication,
  useMedicationLogs,
} from '@/hooks/useMedications';
import { useInitialNote } from '@/hooks/useInitialNote';
import { useProgressNotes } from '@/hooks/useProgressNotes';
import { useMedicationEditLock } from '@/hooks/useMedicationEditLock';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Lock } from 'lucide-react';
import { MedicationEntry, MED_COLUMN_LAYOUT } from './MedicationEntry';
import { MedicationFormModal } from './MedicationForm';
import { MedicationLogTable } from './MedicationLogTable';
import { MedicationListSkeleton } from './MedicationListSkeleton';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import type { Medication } from '@/types/medication';

type PendingMedicationCreate = Omit<
  Medication,
  'id' | 'patientId' | 'createdAt' | 'updatedAt' | 'addedBy' | 'updatedBy' | 'addedByUser' | 'updatedByUser'
> & {
  tempId: string;
};

type PendingChanges = {
  creates: PendingMedicationCreate[];
  updates: Record<string, Partial<Medication>>;
  deletes: string[];
};

export function MedicationsScreen({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: initialNote, isLoading: initialNoteLoading } = useInitialNote(patientId);
  const hasPublishedInitialNote = Boolean(initialNote && initialNote.status === 'PUBLISHED');
  const canManage = (user?.role === 'DOCTOR' || user?.role === 'ADMIN') && hasPublishedInitialNote;

  // Same query args as NoteTimeline's useProgressNotes(patientId, 1, 100) —
  // keep them in sync so the two hooks share one cached fetch.
  const { data: progressNotesResponse } = useProgressNotes(patientId, 1, 100);
  // The Master Medication List is read-only unless a note draft is currently
  // in progress — an unpublished Initial Note, or an unpublished (DRAFT)
  // Progress Note — mirrors the same rule on the Master Problem List (see
  // ProblemListScreen's hasDraftNoteInProgress for the full rationale).
  const hasDraftNoteInProgress = Boolean(
    (initialNote && initialNote.status === 'DRAFT') ||
      (progressNotesResponse?.data ?? []).some((n) => n.status === 'DRAFT'),
  );

  const openExistingProgressNote = useUiStore((state) => state.openExistingProgressNote);
  // Mutual-exclusion lock vs. the Progress Note's in-note medication editor —
  // see useMedicationEditLock. While a note holds it, this list stays
  // read-only rather than risk a data mismatch between the two drafts.
  const { isLockedByOther, lockNoteId, tryAcquire, release } = useMedicationEditLock(patientId, 'master');
  const effectiveCanManage = canManage && !isLockedByOther && hasDraftNoteInProgress;
  // Visual/read-only gate for the two tables — distinct from effectiveCanManage
  // in that it ignores isLockedByOther (that gets its own banner instead of
  // the generic grayed-out treatment).
  const isMasterListLocked = !hasPublishedInitialNote || !hasDraftNoteInProgress;

  const { data, isLoading } = useMedications(patientId, true);
  const createMedication = useCreateMedication(patientId);
  const updateMedication = useUpdateMedication(patientId);
  const deleteMedication = useDeleteMedication(patientId);
  
  const { data: logsData, isLoading: logsLoading } = useMedicationLogs(patientId);
  const logs = logsData?.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [medicationToDelete, setMedicationToDelete] = useState<Medication | null>(null);

  // Draft state
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({ creates: [], updates: {}, deletes: [] });
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const [recentlyPublished, setRecentlyPublished] = useState<Record<string, string[]>>({});

  const draftStorageKey = `damayan_medication_draft_${patientId}`;
  const publishedStorageKey = `damayan_medication_recent_publish_${patientId}`;

  useEffect(() => {
    const saved = localStorage.getItem(draftStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const creates: PendingMedicationCreate[] = (parsed.creates || []).map((c: any) => ({
          name: c.name ?? '',
          dose: c.dose ?? '',
          formulation: c.formulation ?? '',
          instructions: c.instructions ?? '',
          quantity: c.quantity ?? undefined,
          isActive: c.isActive ?? true,
          tempId: c.tempId || c.id || `temp-${Math.random().toString(36).slice(2, 9)}`,
        }));
        setPendingChanges({
          creates,
          updates: parsed.updates || {},
          deletes: parsed.deletes || [],
        });
        setLastAutoSaved(new Date());
      } catch {}
    }
    
    // Load recently published changes if they exist to show the updated pill for 5s on mount
    const recent = localStorage.getItem(publishedStorageKey);
    if (recent) {
      try {
        setRecentlyPublished(JSON.parse(recent));
        const t = setTimeout(() => {
          setRecentlyPublished({});
        }, 5000);
        return () => clearTimeout(t);
      } catch {}
    }
  }, [patientId, draftStorageKey, publishedStorageKey]);

  const isEditMode = pendingChanges.creates.length > 0 || Object.keys(pendingChanges.updates).length > 0 || pendingChanges.deletes.length > 0;

  useEffect(() => {
    if (isEditMode) {
      localStorage.setItem(draftStorageKey, JSON.stringify(pendingChanges));
    } else {
      localStorage.removeItem(draftStorageKey);
    }
  }, [pendingChanges, isEditMode, draftStorageKey]);

  // Auto-save draft to localStorage every 10 seconds while in edit mode
  useEffect(() => {
    if (!isEditMode) return;
    const interval = setInterval(() => {
      localStorage.setItem(draftStorageKey, JSON.stringify(pendingChanges));
      setLastAutoSaved(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, [isEditMode, pendingChanges, draftStorageKey]);

  const rawData = data?.data ?? [];

  const all = useMemo(() => {
    let list = [...rawData];
    list = list.filter((m) => !pendingChanges.deletes.includes(m.id));
    list = list.map((m) => {
      if (pendingChanges.updates[m.id]) {
        return { ...m, ...pendingChanges.updates[m.id] } as Medication;
      }
      return m;
    });

    const newItems = pendingChanges.creates.map((c) => ({
      ...c,
      id: c.tempId,
      patientId,
      addedBy: user?.id ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: null,
      addedByUser: user ? { firstName: user.firstName, lastName: user.lastName, role: user.role } : null,
      updatedByUser: null,
    })) as Medication[];

    return [...list, ...newItems];
  }, [rawData, pendingChanges, patientId, user]);

  const active = all.filter((m) => m.isActive);
  const inactive = all.filter((m) => !m.isActive);

  // Last Edited By Logic
  const lastPublishedEdit = useMemo(() => {
    if (rawData.length === 0) return null;
    let latestMed = rawData[0];
    let latestTime = new Date(latestMed.updatedAt).getTime();
    for (const m of rawData) {
      const t = new Date(m.updatedAt).getTime();
      if (t > latestTime) {
        latestTime = t;
        latestMed = m;
      }
    }
    const editor = latestMed.updatedByUser || latestMed.addedByUser;
    const editedAt = latestMed.updatedBy ? latestMed.updatedAt : latestMed.createdAt;
    return { editor, editedAt };
  }, [rawData]);

  const editorDisplayName = useMemo(() => {
    if (!lastPublishedEdit || !lastPublishedEdit.editor) return 'System';
    const usr = lastPublishedEdit.editor;
    if (usr.role === 'DOCTOR') return `Dr. ${usr.lastName}`;
    if (usr.role === 'NURSE') return `Nurse ${usr.lastName}`;
    return `${usr.firstName} ${usr.lastName}`;
  }, [lastPublishedEdit]);

  const formattedLastEditedTime = useMemo(() => {
    if (!lastPublishedEdit) return '';
    const date = new Date(lastPublishedEdit.editedAt);
    return date.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' · ' + date.toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, [lastPublishedEdit]);

  // Acquires the edit lock (if not already held) before entering draft mode.
  // Returns false — and leaves pendingChanges untouched — if the note holds
  // it, so every call site can bail out of its edit before mutating state.
  const ensureEditMode = () => {
    if (!hasDraftNoteInProgress) return false;
    if (isEditMode) return true;
    return tryAcquire();
  };

  const handleAdd = () => {
    if (!hasPublishedInitialNote) {
      toast.error('An Initial Note must be created and published first.');
      return;
    }
    if (!hasDraftNoteInProgress) {
      toast.error('Editing requires a note draft in progress — start or open an unpublished Initial or Progress Note first.');
      return;
    }
    if (isLockedByOther) {
      tryAcquire(); // surfaces the "locked by a note" toast
      return;
    }
    setEditing(null);
    setModalOpen(true);
  };
  const handleEdit = (m: Medication) => {
    if (!hasPublishedInitialNote || !hasDraftNoteInProgress) return;
    if (isLockedByOther) {
      tryAcquire();
      return;
    }
    setEditing(m);
    setModalOpen(true);
  };

  const handleSave = async (values: { name: string; dose: string; formulation: string; instructions: string; quantity: number }) => {
    if (!hasPublishedInitialNote) return;
    if (!ensureEditMode()) return;
    if (editing) {
      if (editing.id.startsWith('temp-')) {
        setPendingChanges(prev => ({
          ...prev,
          creates: prev.creates.map(c => (c.tempId === editing.id ? { ...c, ...values } : c)),
        }));
      } else {
        setPendingChanges(prev => ({
          ...prev,
          updates: { ...prev.updates, [editing.id]: { ...prev.updates[editing.id], ...values } },
        }));
      }
    } else {
      const tempId = `temp-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2, 7)}`;
      setPendingChanges(prev => ({
        ...prev,
        creates: [...prev.creates, { tempId, ...values, isActive: true }],
      }));
    }
    setModalOpen(false);
  };

  const handleStatusChange = async (m: Medication, isActive: boolean) => {
    if (!hasPublishedInitialNote) return;
    if (!ensureEditMode()) return;
    if (m.id.startsWith('temp-')) {
      setPendingChanges(prev => ({
        ...prev,
        creates: prev.creates.map(c => (c.tempId === m.id ? { ...c, isActive } : c)),
      }));
    } else {
      setPendingChanges(prev => ({
        ...prev,
        updates: { ...prev.updates, [m.id]: { ...prev.updates[m.id], isActive } },
      }));
    }
  };

  const handleDelete = (m: Medication) => {
    if (!hasPublishedInitialNote || !hasDraftNoteInProgress) return;
    if (isLockedByOther) {
      tryAcquire();
      return;
    }
    setMedicationToDelete(m);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!medicationToDelete || !hasPublishedInitialNote) return;
    if (!ensureEditMode()) {
      setDeleteModalOpen(false);
      setMedicationToDelete(null);
      return;
    }
    const targetId = medicationToDelete.id;

    if (targetId.startsWith('temp-')) {
      setPendingChanges(prev => ({
        ...prev,
        creates: prev.creates.filter(c => c.tempId !== targetId),
      }));
    } else {
      setPendingChanges(prev => {
        const nextUpdates = { ...prev.updates };
        delete nextUpdates[targetId];
        return {
          ...prev,
          updates: nextUpdates,
          deletes: prev.deletes.includes(targetId) ? prev.deletes : [...prev.deletes, targetId],
        };
      });
    }
    setDeleteModalOpen(false);
    setMedicationToDelete(null);
  };

  const handleRevert = () => {
    setPendingChanges({ creates: [], updates: {}, deletes: [] });
    setLastAutoSaved(null);
    localStorage.removeItem(draftStorageKey);
    release();
    toast.info('Changes reverted.');
  };

  const handleSaveDraft = () => {
    if (!hasPublishedInitialNote || !hasDraftNoteInProgress) return;
    localStorage.setItem(draftStorageKey, JSON.stringify(pendingChanges));
    setLastAutoSaved(new Date());
    toast.success('Draft saved locally. Publish when ready to share with co-doctors.');
  };

  const handlePublish = async () => {
    if (!hasPublishedInitialNote || !hasDraftNoteInProgress) return;
    setIsPublishing(true);
    try {
      const publishedChanges: Record<string, string[]> = {};
      for (const [id, updates] of Object.entries(pendingChanges.updates)) {
        if (pendingChanges.deletes.includes(id)) continue;
        const original = rawData.find((r) => r.id === id);
        if (original) {
          const fields: string[] = [];
          if (updates.name !== undefined && updates.name !== original.name) fields.push('name');
          if (updates.formulation !== undefined && updates.formulation !== original.formulation) fields.push('formulation');
          if (updates.dose !== undefined && updates.dose !== original.dose) fields.push('dose');
          if (updates.instructions !== undefined && updates.instructions !== original.instructions) fields.push('instructions');
          if (updates.quantity !== undefined && updates.quantity !== original.quantity) fields.push('quantity');
          if (updates.isActive !== undefined && updates.isActive !== original.isActive) fields.push('isActive');
          
          if (fields.length > 0) {
            publishedChanges[id] = fields;
          }
        }
      }

      // 1. Process deletes
      for (const id of pendingChanges.deletes) {
        await deleteMedication.mutateAsync(id);
      }

      // 2. Process updates for non-deleted items
      for (const [id, updates] of Object.entries(pendingChanges.updates)) {
        if (pendingChanges.deletes.includes(id)) continue;
        await updateMedication.mutateAsync({ id, ...updates });
      }

      // 3. Process creates
      for (const create of pendingChanges.creates) {
        const { tempId, isActive, ...payload } = create as any;
        const res = await createMedication.mutateAsync({
          ...payload,
          formulation: payload.formulation ?? undefined,
          instructions: payload.instructions ?? undefined,
          quantity: payload.quantity ?? undefined,
        });
        if (res && res.id) {
          publishedChanges[res.id] = ['_isNew'];
          if (isActive === false) {
            await updateMedication.mutateAsync({ id: res.id, isActive: false });
          }
        }
      }

      setPendingChanges({ creates: [], updates: {}, deletes: [] });
      setLastAutoSaved(null);
      localStorage.removeItem(draftStorageKey);
      release();
      setRecentlyPublished(publishedChanges);
      localStorage.setItem(publishedStorageKey, JSON.stringify(publishedChanges));
      setTimeout(() => {
        setRecentlyPublished({});
      }, 5000);
      toast.success('Medication changes published successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish changes.');
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading || initialNoteLoading) return <MedicationListSkeleton />;

  const getDraftChanges = (m: Medication) => {
    if (m.id.startsWith('temp-')) {
      return ['_isNew'];
    }
    const updates = pendingChanges.updates[m.id];
    const original = rawData.find((r) => r.id === m.id);
    if (updates && original) {
      const fields: string[] = [];
      if (updates.name !== undefined && updates.name !== original.name) fields.push('name');
      if (updates.formulation !== undefined && updates.formulation !== original.formulation) fields.push('formulation');
      if (updates.dose !== undefined && updates.dose !== original.dose) fields.push('dose');
      if (updates.instructions !== undefined && updates.instructions !== original.instructions) fields.push('instructions');
      if (updates.quantity !== undefined && updates.quantity !== original.quantity) fields.push('quantity');
      if (updates.isActive !== undefined && updates.isActive !== original.isActive) fields.push('isActive');
      return fields;
    }
    return undefined;
  };

  return (
    <div className="flex flex-col gap-6">
      <style>{`
        @keyframes highlight-pill-fade {
          0% { opacity: 0; transform: scale(0.9); }
          10% { opacity: 1; transform: scale(1); }
          90% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1); }
        }
        .animate-highlight-pill {
          animation: highlight-pill-fade 5s ease-in-out forwards;
          white-space: nowrap;
        }
        @keyframes highlight-pill-pulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.05); filter: brightness(1.15); }
        }
        .animate-pill-pulse {
          animation: highlight-pill-pulse 1.5s ease-in-out infinite;
        }
      `}</style>
      {!hasPublishedInitialNote && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-surface border border-accent/20 bg-accent-light shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-text-primary">Initial Note Required</h4>
              <p className="text-[12px] text-text-secondary mt-0.5">
                {user?.role === 'DOCTOR' || user?.role === 'ADMIN'
                  ? 'An Initial Consultation Note must be created and published before medications can be added or edited.'
                  : 'An Initial Consultation Note must be created and published by a doctor before medications can be added or edited.'}
              </p>
            </div>
          </div>
          {(user?.role === 'DOCTOR' || user?.role === 'ADMIN') && (
            <button
              onClick={() => router.push(`/dashboard/${patientId}/initial-note`)}
              className="h-[32px] px-3.5 rounded-btn text-[11px] font-bold bg-accent hover:bg-accent-hover text-white flex items-center gap-1.5 whitespace-nowrap shadow-btn-primary transition-all flex-shrink-0 cursor-pointer"
            >
              Create Initial Note
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {hasPublishedInitialNote && !hasDraftNoteInProgress && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-surface border border-slate-400/30 bg-slate-500/5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-500/10 flex items-center justify-center text-slate-600 flex-shrink-0 text-[16px]">
              🔒
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-text-primary">Editing Locked — No Note Draft in Progress</h4>
              <p className="text-[12px] text-text-secondary mt-0.5">
                {user?.role === 'DOCTOR' || user?.role === 'ADMIN'
                  ? 'The Master Medication List can only be edited while an Initial or Progress Note draft is in progress. Start or open an unpublished note to make changes.'
                  : 'The Master Medication List can only be edited while an Initial or Progress Note draft is in progress.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {(user?.role === 'DOCTOR' || user?.role === 'ADMIN') && (
        <div className="flex justify-end -mb-2">
          <button
            onClick={handleAdd}
            disabled={!hasPublishedInitialNote || !hasDraftNoteInProgress || isLockedByOther}
            title={
              !hasPublishedInitialNote
                ? 'An Initial Note must be published before adding medications'
                : !hasDraftNoteInProgress
                  ? 'Editing requires a note draft in progress — start or open an unpublished Initial or Progress Note first'
                  : isLockedByOther
                  ? 'Locked — a Progress Note draft is currently editing medications'
                  : undefined
            }
            className="h-8 px-4 rounded-btn text-[12px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Medication
          </button>
        </div>
      )}

      <div className={cn(
        "bg-surface border border-border border-l-[3px] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-200",
        isEditMode ? "border-l-amber-500" : "border-l-accent",
        isMasterListLocked && "opacity-65 grayscale-[30%] bg-surface-2/30 pointer-events-none select-none"
      )}>
        <div className="flex flex-col @md:flex-row @md:items-center justify-between gap-3 px-4 py-3 bg-surface-2 border-b border-border">
          {/* Left side */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0 shadow-sm border border-border">
                💊
              </div>
              <h3 className="text-[13px] font-bold tracking-[0.3px] text-text-primary">
                Current Medications
              </h3>
              <span className="ch-badge badge-active text-[9px] font-bold uppercase tracking-[0.5px] px-2 py-0.5 rounded border border-[#2B7A78] text-[#2B7A78] bg-[#DEF2F1]">
                {active.length} Active
              </span>
            </div>
            
            {!isEditMode && lastPublishedEdit && (
              <div className="text-[11px] text-text-muted flex items-center gap-1.5 pl-[34px] animate-in fade-in duration-200">
                <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                <span className="bg-accent/5 dark:bg-accent/10 border border-accent/15 px-2.5 py-0.5 rounded-md text-text-secondary flex items-center gap-1 flex-wrap">
                  Last edited by <span className="font-semibold text-accent">{editorDisplayName}</span> on <span className="font-mono text-text-primary font-medium">{formattedLastEditedTime}</span>
                </span>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isMasterListLocked && (
              <span className="text-[10px] font-medium text-text-muted bg-surface-3 border border-border px-2.5 py-1 rounded-[4px] flex items-center gap-1 select-none">
                🔒 {hasPublishedInitialNote ? 'Locked — No Draft' : 'Read Only'}
              </span>
            )}
          </div>
        </div>

        {/* Locked-by-note Banner — takes priority over the (mutually
            exclusive) edit-mode banner below, since this list can't be in its
            own edit mode while locked by the other side. */}
        {isLockedByOther && (
          <div className="flex items-center gap-3 px-[14px] py-[9px] bg-slate-500/10 border-b border-slate-400/25 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Lock className="w-3.5 h-3.5 shrink-0 text-slate-600" />
              <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-slate-600">Locked</span>
              <span className="text-[10px] text-slate-500 hidden @md:inline">
                — Medication edits are in progress in a Progress Note draft.
              </span>
            </div>
            {lockNoteId && (
              <button
                onClick={() => openExistingProgressNote(patientId, lockNoteId)}
                className="h-[24px] px-2.5 rounded text-[10px] font-semibold text-slate-700 border border-slate-400/50 hover:bg-slate-500/10 transition-all duration-150 cursor-pointer flex-shrink-0"
              >
                Open Note →
              </button>
            )}
          </div>
        )}

        {/* Edit Mode Banner inside the card */}
        {isEditMode && (
          <div className="flex items-center gap-3 px-[14px] py-[9px] bg-amber-500/10 border-b border-amber-400/25 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-amber-700">Editing Medications</span>
              <span className="text-[10px] text-amber-600/80 hidden @md:inline">
                — Changes are local and not yet visible to other doctors.
              </span>
              {lastAutoSaved && (
                <span className="text-[9px] text-amber-500/70 hidden @lg:inline flex-shrink-0">
                  Auto-saved {lastAutoSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={handleRevert}
                disabled={isPublishing}
                className="h-[24px] px-2.5 rounded text-[10px] font-semibold text-amber-700 border border-amber-400/50 hover:bg-amber-500/10 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ↺ Revert
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={isPublishing}
                title="Saves your changes locally only — does not affect other doctors"
                className="h-[24px] px-2.5 rounded text-[10px] font-semibold text-text-secondary bg-surface-2 border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Draft
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                title="Publishes the changes to all co-doctors"
                className="h-[24px] px-2.5 rounded text-[10px] font-semibold bg-accent text-white border border-accent-hover hover:bg-accent-hover shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPublishing ? '…' : 'Publish'}
              </button>
            </div>
          </div>
        )}

        {active.length > 0 && (
          <div 
            className="relative grid items-center gap-4 pl-[14px] pr-[28px] py-2 bg-surface-2 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary"
            style={{ gridTemplateColumns: MED_COLUMN_LAYOUT }}
          >
            <div className="text-left">Medication</div>
            <div className="text-left">Formulation</div>
            <div className="text-left">Dose</div>
            <div className="text-left">Instructions</div>
            <div className="text-left">Qty</div>
            <div className="text-left">Status</div>
            <div className="text-left">Actions</div>
          </div>
        )}

        {active.length === 0 ? (
          <div className="py-8 px-[14px] text-center text-[13px] text-text-muted italic">
            {!hasPublishedInitialNote
              ? 'No active medications recorded. Create and publish an Initial Note to begin tracking medications.'
              : 'No active medications recorded.'}
          </div>
        ) : (
          <div className="flex flex-col">
            {active.map((m) => {
              return (
                <MedicationEntry
                  key={m.id}
                  medication={m}
                  recentlyPublishedFields={recentlyPublished[m.id]}
                  draftChangedFields={getDraftChanges(m)}
                  canManage={effectiveCanManage}
                  onEdit={() => handleEdit(m)}
                  onDelete={() => handleDelete(m)}
                  onStatusChange={(isActive) => handleStatusChange(m, isActive)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className={cn(
        "bg-surface border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden",
        isMasterListLocked && "opacity-65 grayscale-[30%] bg-surface-2/30 pointer-events-none select-none"
      )}>
        <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface border-b border-border">
          <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-2 flex items-center justify-center text-[12px] flex-shrink-0">🗒</div>
          <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-secondary">Discontinued Medications</span>
          <div className="ml-auto flex items-center gap-2">
            {isMasterListLocked && (
              <span className="text-[10px] font-medium text-text-muted bg-surface-3 border border-border px-2.5 py-1 rounded-[4px] flex items-center gap-1 select-none">
                🔒 {hasPublishedInitialNote ? 'Locked — No Draft' : 'Read Only'}
              </span>
            )}
            <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-2.5 py-[3px] rounded border border-border text-text-secondary bg-surface-2">
              {inactive.length} Discontinued
            </span>
          </div>
        </div>

        {inactive.length > 0 && (
          <div 
            className="relative grid items-center gap-4 pl-[14px] pr-[28px] py-2 bg-surface-2 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary"
            style={{ gridTemplateColumns: MED_COLUMN_LAYOUT }}
          >
            <div className="text-left">Medication</div>
            <div className="text-left">Formulation</div>
            <div className="text-left">Dose</div>
            <div className="text-left">Instructions</div>
            <div className="text-left">Qty</div>
            <div className="text-left">Status</div>
            <div className="text-left">Actions</div>
          </div>
        )}

        {inactive.length === 0 ? (
          <div className="py-8 px-[14px] text-center text-[13px] text-text-muted italic">
            No discontinued medications recorded.
          </div>
        ) : (
          <div className="flex flex-col">
            {inactive.map((m) => {
              return (
                <MedicationEntry
                  key={m.id}
                  medication={m}
                  recentlyPublishedFields={recentlyPublished[m.id]}
                  draftChangedFields={getDraftChanges(m)}
                  canManage={effectiveCanManage}
                  onEdit={() => handleEdit(m)}
                  onDelete={() => handleDelete(m)}
                  onStatusChange={(isActive) => handleStatusChange(m, isActive)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface border-b border-border">
          <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-2 flex items-center justify-center text-[12px] flex-shrink-0">📜</div>
          <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-secondary">Medication Logs</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-2.5 py-[3px] rounded border border-border text-text-secondary bg-surface-2 ml-auto">
            {logs.length} Entries
          </span>
        </div>
        <MedicationLogTable logs={logs} isLoading={logsLoading} />
      </div>

      <MedicationFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        suggestions={rawData}
        onSave={handleSave}
        saving={isPublishing}
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setMedicationToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Remove Medication"
        message={`Are you sure you want to remove "${medicationToDelete?.name}" from the medication list? This action cannot be undone.`}
        isDeleting={false}
      />
    </div>
  );
}
