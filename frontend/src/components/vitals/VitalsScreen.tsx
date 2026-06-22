'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  useVitals,
  useCreateVitals,
  useUpdateVitals,
  useDeleteVitals,
} from '@/hooks/useVitals';
import { useAuthStore } from '@/stores/authStore';
import { VitalsFormModal } from './VitalsForm';
import { VitalsHistoryTable } from './VitalsHistoryTable';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import type { VitalSign, CreateVitalsInput, UpdateVitalsInput } from '@/types/vitals';

export function VitalsScreen({ patientId }: { patientId: string }) {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'DOCTOR' || user?.role === 'NURSE' || user?.role === 'ADMIN';

  const [page, setPage] = useState(1);
  const { data, isLoading } = useVitals(patientId, page, 10);
  
  const createVitals = useCreateVitals(patientId);
  const updateVitals = useUpdateVitals(patientId);
  const deleteVitals = useDeleteVitals(patientId);

  const [editing, setEditing] = useState<VitalSign | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [vitalToDelete, setVitalToDelete] = useState<VitalSign | null>(null);

  const handleSave = async (values: CreateVitalsInput | (UpdateVitalsInput & { id: string })) => {
    try {
      if ('id' in values) {
        await updateVitals.mutateAsync(values as UpdateVitalsInput & { id: string });
        toast.success('Vitals updated.');
      } else {
        await createVitals.mutateAsync(values as CreateVitalsInput);
        toast.success('Vitals recorded.');
      }
      setEditing(null);
      setFormVisible(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save vitals.');
    }
  };

  const handleDelete = (v: VitalSign) => {
    setVitalToDelete(v);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!vitalToDelete) return;
    deleteVitals.mutate(vitalToDelete.id, {
      onSuccess: () => {
        toast.success('Vitals record deleted.');
        setDeleteModalOpen(false);
        setVitalToDelete(null);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to delete vitals.');
      },
    });
  };

  const vitals = data?.data ?? [];
  const meta = data?.meta ?? { totalPages: 1, page: 1, total: 0, limit: 10 };

  return (
    <div className="flex flex-col gap-6">
      {canEdit && (
        <div className="flex justify-end -mb-2">
          <button
            onClick={() => { setEditing(null); setFormVisible(true); }}
            className="h-8 px-4 rounded-btn text-[12px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all duration-150 cursor-pointer"
          >
            + Record Vitals
          </button>
        </div>
      )}

      <VitalsFormModal
        open={formVisible}
        onClose={() => { setEditing(null); setFormVisible(false); }}
        patientId={patientId}
        editing={editing}
        onSave={handleSave}
        saving={createVitals.isPending || updateVitals.isPending}
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setVitalToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Vitals Record"
        message="Are you sure you want to delete this vital signs record? This action cannot be undone."
        isDeleting={deleteVitals.isPending}
      />

      {isLoading ? (
        <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden animate-pulse">
          <div className="px-4 py-3 border-b border-border bg-surface-2 flex items-center gap-4">
             <div className="w-1/4 h-4 bg-border/50 rounded" />
             <div className="w-1/4 h-4 bg-border/50 rounded" />
             <div className="w-1/4 h-4 bg-border/50 rounded" />
             <div className="w-1/4 h-4 bg-border/50 rounded" />
          </div>
          <div className="flex flex-col divide-y divide-border bg-surface">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-4 flex items-center gap-4">
                <div className="w-1/4 h-4 bg-border/30 rounded" />
                <div className="w-1/4 h-4 bg-border/30 rounded" />
                <div className="w-1/4 h-4 bg-border/30 rounded" />
                <div className="w-1/4 h-4 bg-border/30 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <VitalsHistoryTable
          vitals={vitals}
          onEdit={(v) => { setEditing(v); setFormVisible(true); }}
          onDelete={handleDelete}
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
