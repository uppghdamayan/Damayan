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
    if (!confirm('Delete this vital signs record?')) return;
    deleteVitals.mutate(v.id, {
      onSuccess: () => toast.success('Vitals record deleted.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete vitals.'),
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

      {isLoading ? (
        <div className="animate-pulse bg-surface border border-border rounded-lg h-64"></div>
      ) : (
        <VitalsHistoryTable
          vitals={vitals}
          onEdit={(v) => { setEditing(v); setFormVisible(true); }}
          onDelete={handleDelete}
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
