'use client';

import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useMedications,
  useCreateMedication,
  useUpdateMedication,
  useDeleteMedication,
  useMedicationLogs,
} from '@/hooks/useMedications';
import { useAuthStore } from '@/stores/authStore';
import { MedicationEntry, MED_COLUMN_LAYOUT } from './MedicationEntry';
import { MedicationFormModal } from './MedicationForm';
import { MedicationLogTable } from './MedicationLogTable';
import { MedicationListSkeleton } from './MedicationListSkeleton';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import type { Medication } from '@/types/medication';

type PendingChanges = {
  creates: Omit<Medication, 'id' | 'patientId' | 'createdAt' | 'updatedAt' | 'addedBy' | 'updatedBy' | 'addedByUser' | 'updatedByUser'>[];
  updates: Record<string, Partial<Medication>>;
  deletes: string[];
};

export function MedicationsScreen({ patientId }: { patientId: string }) {
  const { user } = useAuthStore();
  const canManage = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

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
        setPendingChanges(JSON.parse(saved));
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

    const newItems = pendingChanges.creates.map((c, idx) => ({
      ...c,
      id: `temp-${idx}`,
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

  const handleAdd = () => { setEditing(null); setModalOpen(true); };
  const handleEdit = (m: Medication) => { setEditing(m); setModalOpen(true); };

  const handleSave = async (values: { name: string; dose: string; formulation: string; instructions: string; quantity: number }) => {
    if (editing) {
      if (editing.id.startsWith('temp-')) {
        const idx = parseInt(editing.id.replace('temp-', ''), 10);
        setPendingChanges(prev => {
          const newCreates = [...prev.creates];
          newCreates[idx] = { ...newCreates[idx], ...values };
          return { ...prev, creates: newCreates };
        });
      } else {
        setPendingChanges(prev => ({ ...prev, updates: { ...prev.updates, [editing.id]: { ...prev.updates[editing.id], ...values } } }));
      }
    } else {
      setPendingChanges(prev => ({ ...prev, creates: [...prev.creates, { ...values, isActive: true }] }));
    }
    setModalOpen(false);
  };

  const handleStatusChange = async (m: Medication, isActive: boolean) => {
    if (m.id.startsWith('temp-')) {
      const idx = parseInt(m.id.replace('temp-', ''), 10);
      setPendingChanges(prev => {
        const newCreates = [...prev.creates];
        newCreates[idx] = { ...newCreates[idx], isActive };
        return { ...prev, creates: newCreates };
      });
    } else {
      setPendingChanges(prev => ({ ...prev, updates: { ...prev.updates, [m.id]: { ...prev.updates[m.id], isActive } } }));
    }
  };

  const handleDelete = (m: Medication) => {
    setMedicationToDelete(m);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!medicationToDelete) return;
    if (medicationToDelete.id.startsWith('temp-')) {
      const idx = parseInt(medicationToDelete.id.replace('temp-', ''), 10);
      setPendingChanges(prev => {
        const newCreates = [...prev.creates];
        newCreates.splice(idx, 1);
        return { ...prev, creates: newCreates };
      });
    } else {
      setPendingChanges(prev => ({ ...prev, deletes: [...prev.deletes, medicationToDelete.id] }));
    }
    setDeleteModalOpen(false);
    setMedicationToDelete(null);
  };

  const handleRevert = () => {
    setPendingChanges({ creates: [], updates: {}, deletes: [] });
    setLastAutoSaved(null);
    localStorage.removeItem(draftStorageKey);
    toast.info('Changes reverted.');
  };

  const handleSaveDraft = () => {
    localStorage.setItem(draftStorageKey, JSON.stringify(pendingChanges));
    setLastAutoSaved(new Date());
    toast.success('Draft saved locally. Publish when ready to share with co-doctors.');
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const publishedChanges: Record<string, string[]> = {};
      for (const [id, updates] of Object.entries(pendingChanges.updates)) {
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

      for (const id of pendingChanges.deletes) {
        await deleteMedication.mutateAsync(id);
      }
      for (const [id, updates] of Object.entries(pendingChanges.updates)) {
        await updateMedication.mutateAsync({ id, ...updates });
      }
      for (const create of pendingChanges.creates) {
        const { isActive, ...payload } = create;
        const res = await createMedication.mutateAsync({
          ...payload,
          formulation: payload.formulation ?? undefined,
          instructions: payload.instructions ?? undefined,
          quantity: payload.quantity ?? undefined,
        });
        if (res && res.id) {
          publishedChanges[res.id] = ['_isNew'];
        }
      }
      setPendingChanges({ creates: [], updates: {}, deletes: [] });
      setLastAutoSaved(null);
      localStorage.removeItem(draftStorageKey);
      setRecentlyPublished(publishedChanges);
      localStorage.setItem(publishedStorageKey, JSON.stringify(publishedChanges));
      setTimeout(() => {
        setRecentlyPublished({});
      }, 5000);
      toast.success('Medication changes published successfully.');
    } catch (err) {
      toast.error('Failed to publish changes.');
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) return <MedicationListSkeleton />;

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
      {canManage && (
        <div className="flex justify-end -mb-2">
          <button
            onClick={handleAdd}
            className="h-8 px-4 rounded-btn text-[12px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all duration-150 cursor-pointer"
          >
            + Add Medication
          </button>
        </div>
      )}

      <div className={cn(
        "bg-surface border border-border border-l-[3px] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-200",
        isEditMode ? "border-l-amber-500" : "border-l-accent"
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
          </div>
        </div>

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
            No active medications recorded.
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
                  canManage={canManage}
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
          <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-2 flex items-center justify-center text-[12px] flex-shrink-0">🗒</div>
          <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-secondary">Discontinued Medications</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-2.5 py-[3px] rounded border border-border text-text-secondary bg-surface-2 ml-auto">
            {inactive.length} Discontinued
          </span>
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
                  canManage={canManage}
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
