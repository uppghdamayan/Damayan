import { useState } from 'react';
import { useMedications, useCreateMedication, useDeleteMedication } from '@/hooks/useMedications';
import { PlusIcon, TrashIcon } from 'lucide-react';
import type { MedUnitValue } from '@/types/medication';

interface MedicationListEditorProps {
  patientId: string;
}

export function MedicationListEditor({ patientId }: MedicationListEditorProps) {
  const { data: response, isLoading } = useMedications(patientId);
  const createMutation = useCreateMedication(patientId);
  const deleteMutation = useDeleteMedication(patientId);

  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [unit, setUnit] = useState<MedUnitValue>('MG');
  const [instructions, setInstructions] = useState('');

  const handleAdd = () => {
    if (!name || !dose) return;
    createMutation.mutate({
      name,
      dose: parseFloat(dose),
      unit,
      instructions,
    }, {
      onSuccess: () => {
        setName('');
        setDose('');
        setUnit('MG');
        setInstructions('');
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        <div className="text-[12px] text-[var(--text-muted)] animate-pulse">Loading medications...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {response?.data.map((med) => (
            <div key={med.id} className="flex items-center justify-between p-2 bg-surface-2 border border-border rounded-btn">
              <div className="flex flex-col">
                <span className="text-[12px] font-medium text-[var(--text-primary)]">
                  {med.name} {med.dose}{med.unit}
                </span>
                {med.instructions && (
                  <span className="text-[10px] text-[var(--text-muted)]">{med.instructions}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(med.id)}
                className="text-[var(--text-muted)] hover:text-red transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-12 gap-2.5 p-3 bg-surface-2 border border-border rounded-card mt-2">
        <div className="col-span-12 flex flex-col gap-1">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Medication Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-[28px] px-2 text-[12px] rounded border border-border outline-none focus:border-accent w-full bg-surface"
            placeholder="e.g. Lisinopril"
          />
        </div>
        <div className="col-span-6 flex flex-col gap-1">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Dose</label>
          <input
            type="number"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className="h-[28px] px-2 text-[12px] rounded border border-border outline-none focus:border-accent w-full bg-surface"
            placeholder="e.g. 10"
          />
        </div>
        <div className="col-span-6 flex flex-col gap-1">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Unit</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as MedUnitValue)}
            className="h-[28px] px-1 text-[12px] rounded border border-border outline-none focus:border-accent w-full bg-surface"
          >
            <option value="MG">MG</option>
            <option value="G">G</option>
            <option value="MCG">MCG</option>
            <option value="ML">ML</option>
            <option value="UNITS">UNITS</option>
          </select>
        </div>
        <div className="col-span-12 flex flex-col gap-1">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Sig / Instructions</label>
          <input
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="h-[28px] px-2 text-[12px] rounded border border-border outline-none focus:border-accent w-full bg-surface"
            placeholder="e.g. Take 1 tab daily"
          />
        </div>
        <div className="col-span-12 flex justify-end">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!name || !dose || createMutation.isPending}
            className="h-[28px] px-3.5 bg-accent hover:bg-accent-hover text-white rounded font-medium text-[11px] disabled:opacity-50 inline-flex items-center gap-1 shadow-btn-primary"
          >
            <PlusIcon className="w-3.5 h-3.5" /> Add Medication
          </button>
        </div>
      </div>
    </div>
  );
}
