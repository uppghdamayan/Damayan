'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  useMedications,
  useCreateMedication,
  useUpdateMedication,
  useDeleteMedication,
} from '@/hooks/useMedications';
import { useAuthStore } from '@/stores/authStore';
import { MedicationEntry, MED_COLUMN_LAYOUT, MED_COLUMN_LAYOUT_DISCONTINUED } from './MedicationEntry';
import { MedicationFormModal } from './MedicationForm';
import { useMedicationLogs } from '@/hooks/useMedications';
import { MedicationLogTable } from './MedicationLogTable';
import { MedicationListSkeleton } from './MedicationListSkeleton';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import type { Medication } from '@/types/medication';

export function MedicationsScreen({ patientId }: { patientId: string }) {
  const { user } = useAuthStore();
  const canManage = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const { data, isLoading } = useMedications(patientId, true); // full history for autocomplete + inactive rows
  const createMedication = useCreateMedication(patientId);
  const updateMedication = useUpdateMedication(patientId);
  const deleteMedication = useDeleteMedication(patientId);
  
  const { data: logsData, isLoading: logsLoading } = useMedicationLogs(patientId);
  const logs = logsData?.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [medicationToDelete, setMedicationToDelete] = useState<Medication | null>(null);

  const all = data?.data ?? [];
  const active = all.filter((m) => m.isActive);
  const inactive = all.filter((m) => !m.isActive);

  const handleAdd = () => { setEditing(null); setModalOpen(true); };
  const handleEdit = (m: Medication) => { setEditing(m); setModalOpen(true); };

  const handleSave = async (values: { name: string; dose: string; formulation?: string; instructions?: string; quantity?: number }) => {
    try {
      if (editing) {
        await updateMedication.mutateAsync({ id: editing.id, ...values });
        toast.success('Medication updated.');
      } else {
        await createMedication.mutateAsync(values);
        toast.success('Medication added to the list.');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save medication.');
    }
  };

  const handleStatusChange = async (m: Medication, isActive: boolean) => {
    try {
      await updateMedication.mutateAsync({ id: m.id, isActive });
      toast.success(`Medication marked as ${isActive ? 'active' : 'inactive'}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleDelete = (m: Medication) => {
    setMedicationToDelete(m);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!medicationToDelete) return;
    deleteMedication.mutate(medicationToDelete.id, {
      onSuccess: () => {
        toast.success('Medication removed.');
        setDeleteModalOpen(false);
        setMedicationToDelete(null);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to remove medication.');
      },
    });
  };

  if (isLoading) return <MedicationListSkeleton />;

  return (
    <div className="flex flex-col gap-6">
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

      <div className="bg-surface border border-border border-l-[3px] border-l-accent rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface border-b border-border">
          <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-2 flex items-center justify-center text-[12px] flex-shrink-0">💊</div>
          <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-secondary">Current Medications</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-2.5 py-[3px] rounded border border-[#2B7A78] text-[#2B7A78] bg-[#DEF2F1] ml-auto">
            {active.length} Active
          </span>
        </div>

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
            {active.map((m) => (
              <MedicationEntry key={m.id} medication={m} canManage={canManage} onEdit={() => handleEdit(m)} onDelete={() => handleDelete(m)} onStatusChange={(isActive) => handleStatusChange(m, isActive)} />
            ))}
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
            style={{ gridTemplateColumns: MED_COLUMN_LAYOUT_DISCONTINUED }}
          >
            <div className="text-left">Medication</div>
            <div className="text-left">Formulation</div>
            <div className="text-left">Dose</div>
            <div className="text-left">Instructions</div>
            <div className="text-left">Qty</div>
            <div className="text-left">Actions</div>
          </div>
        )}

        {inactive.length === 0 ? (
          <div className="py-8 px-[14px] text-center text-[13px] text-text-muted italic">
            No discontinued medications recorded.
          </div>
        ) : (
          <div className="flex flex-col">
            {inactive.map((m) => (
              <MedicationEntry key={m.id} medication={m} canManage={canManage} onEdit={() => {}} onDelete={() => handleDelete(m)} onStatusChange={(isActive) => handleStatusChange(m, isActive)} hideStatus={true} />
            ))}
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
        suggestions={all}
        onSave={handleSave}
        saving={createMedication.isPending || updateMedication.isPending}
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
        isDeleting={deleteMedication.isPending}
      />
    </div>
  );
}
