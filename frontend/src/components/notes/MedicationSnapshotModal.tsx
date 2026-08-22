'use client';

import { useEffect, useState } from 'react';
import { X, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ComboboxInput } from '@/components/ui/ComboboxInput';

export interface MedicationSnapshotValues {
  name: string;
  dose: string;
  formulation?: string;
  quantity?: number;
  instructions?: string;
}

interface MedicationSnapshotFormValues {
  name: string;
  dose: string;
  formulation: string;
  instructions: string;
  quantity: string;
}

interface MedicationSnapshotModalProps {
  open: boolean;
  onClose: () => void;
  editing: MedicationSnapshotValues | null;
  nameOptions: string[];
  onSave: (values: MedicationSnapshotValues) => void;
}

const emptyValues: MedicationSnapshotFormValues = { name: '', dose: '', formulation: '', instructions: '', quantity: '' };

/**
 * Edits a single row of a note's local `medicationSnapshot` draft array
 * (InitialNoteForm / ProgressNoteForm). Deliberately separate from
 * MedicationFormModal (components/medications/MedicationForm.tsx), which
 * edits the patient's cumulative medication list — that flow is untouched.
 */
export function MedicationSnapshotModal({ open, onClose, editing, nameOptions, onSave }: MedicationSnapshotModalProps) {
  const [values, setValues] = useState<MedicationSnapshotFormValues>(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(
        editing
          ? {
              name: editing.name != null ? String(editing.name) : '',
              dose: editing.dose != null ? String(editing.dose) : '',
              formulation: editing.formulation != null ? String(editing.formulation) : '',
              instructions: editing.instructions != null ? String(editing.instructions) : '',
              quantity: editing.quantity != null ? String(editing.quantity) : '',
            }
          : emptyValues,
      );
      setErrors({});
    }
  }, [open, editing]);

  if (!open) return null;

  const validate = () => {
    const e: Record<string, string> = {};
    const nameStr = String(values.name ?? '').trim();
    const doseStr = String(values.dose ?? '').trim();
    const qtyStr = String(values.quantity ?? '').trim();

    if (!nameStr) e.name = 'Medication name is required.';
    if (!doseStr) e.dose = 'Dose is required.';
    if (!qtyStr) {
      e.quantity = 'Quantity is required.';
    } else {
      const qtyNum = parseInt(qtyStr, 10);
      if (isNaN(qtyNum) || qtyNum <= 0) e.quantity = 'Quantity must be a whole number greater than 0.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const nameStr = String(values.name ?? '').trim();
    const doseStr = String(values.dose ?? '').trim();
    const formStr = String(values.formulation ?? '').trim();
    const instStr = String(values.instructions ?? '').trim();
    const qtyStr = String(values.quantity ?? '').trim();

    onSave({
      name: nameStr,
      dose: doseStr,
      formulation: formStr || undefined,
      quantity: parseInt(qtyStr, 10),
      instructions: instStr || undefined,
    });
  };

  const inputCn = (hasError?: boolean) =>
    cn(
      'h-[34px] w-full px-2.5 bg-surface border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150',
      hasError
        ? 'border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
        : 'border-border focus:border-accent focus:shadow-accent-focus',
    );

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center animate-in fade-in duration-150"
    >
      <div className="bg-surface border border-border rounded-[10px] w-[460px] max-h-[80vh] overflow-y-auto shadow-modal">
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border">
          <Pill className="w-4 h-4 text-accent" />
          <h2 className="text-[13px] font-bold text-text-primary">
            {editing ? 'Edit Medication' : 'Add Medication'}
          </h2>
        </div>

        <div className="p-[18px] flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
              Medication Name <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
            </label>
            <ComboboxInput
              value={values.name}
              onChange={(val) => {
                setValues((v) => ({ ...v, name: val }));
                if (errors.name) setErrors((e) => ({ ...e, name: '' }));
              }}
              options={nameOptions}
              placeholder="e.g. Losartan, Metformin"
              className={inputCn(!!errors.name)}
            />
            {errors.name && <p className="text-[12px] text-red mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 @max-[1023px]:grid-cols-1 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
                Dose <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
              </label>
              <input
                type="text"
                value={values.dose}
                onChange={(e) => {
                  setValues((v) => ({ ...v, dose: e.target.value }));
                  if (errors.dose) setErrors((er) => ({ ...er, dose: '' }));
                }}
                placeholder="e.g. 50 mg"
                className={inputCn(!!errors.dose)}
              />
              {errors.dose && <p className="text-[12px] text-red mt-1">{errors.dose}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
                Formulation
              </label>
              <input
                type="text"
                value={values.formulation}
                onChange={(e) => setValues((v) => ({ ...v, formulation: e.target.value }))}
                placeholder="e.g. tablet"
                className={inputCn()}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
              Instructions / Sig
            </label>
            <input
              type="text"
              value={values.instructions}
              onChange={(e) => setValues((v) => ({ ...v, instructions: e.target.value }))}
              placeholder="e.g. 1 tab PO OD with meals"
              className={inputCn()}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
              Quantity <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
            </label>
            <input
              type="number" step="1" min="1"
              value={values.quantity}
              onChange={(e) => {
                const val = e.target.value;
                setValues((v) => ({ ...v, quantity: val }));
                let err = '';
                if (!val.trim()) {
                  err = 'Quantity is required.';
                } else {
                  const qtyNum = parseInt(val, 10);
                  if (isNaN(qtyNum) || qtyNum <= 0) err = 'Quantity must be a whole number greater than 0.';
                }
                setErrors((er) => ({ ...er, quantity: err }));
              }}
              placeholder="e.g. 30"
              className={inputCn(!!errors.quantity)}
            />
            {errors.quantity && <p className="text-[12px] text-red mt-1">{errors.quantity}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-[18px] py-3 border-t border-border">
          <button onClick={onClose}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSubmit}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all duration-150 cursor-pointer">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
