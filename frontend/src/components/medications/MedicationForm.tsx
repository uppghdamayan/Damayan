'use client';

import { useEffect, useState, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildMedicationSuggestions, MEDICATION_DICTIONARY } from '@/lib/medication-utils';
import type { Medication } from '@/types/medication';

interface MedicationFormValues {
  name: string;
  dose: string;
  formulation: string;
  instructions: string;
  quantity: string;
}

interface MedicationFormModalProps {
  open: boolean;
  onClose: () => void;
  editing: Medication | null;
  suggestions: Medication[];
  saving: boolean;
  onSave: (values: { name: string; dose: string; formulation: string; instructions: string; quantity: number }) => void;
}

const FORMULATION_OPTIONS = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Cream', 'Ointment', 'Drops', 'Patch', 'Suppository', 'Inhaler', 'Lotion', 'Gel'
];

const emptyValues: MedicationFormValues = { name: '', dose: '', formulation: '', instructions: '', quantity: '' };

import { ComboboxInput } from '@/components/ui/ComboboxInput';

export function MedicationFormModal({ open, onClose, editing, suggestions, saving, onSave }: MedicationFormModalProps) {
  const [values, setValues] = useState<MedicationFormValues>(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(
        editing
          ? {
              name: editing.name,
              dose: editing.dose,
              formulation: editing.formulation ?? '',
              instructions: editing.instructions ?? '',
              quantity: editing.quantity != null ? String(editing.quantity) : '',
            }
          : emptyValues,
      );
      setErrors({});
    }
  }, [open, editing]);

  if (!open) return null;

  const nameOptions = buildMedicationSuggestions(suggestions);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = 'Medication name is required.';
    else if (values.name.length > 255) e.name = 'Max 255 characters.';

    if (!values.dose.trim()) e.dose = 'Dose is required.';
    else if (values.dose.length > 255) e.dose = 'Max 255 characters.';

    if (!values.instructions.trim()) e.instructions = 'Instructions are required.';
    else if (values.instructions.length > 50) e.instructions = 'Max 50 characters.';

    if (!values.formulation.trim()) e.formulation = 'Formulation is required.';

    if (!values.quantity) {
      e.quantity = 'Quantity is required.';
    } else {
      const qtyNum = parseInt(values.quantity, 10);
      if (isNaN(qtyNum) || qtyNum <= 0) e.quantity = 'Quantity must be a whole number greater than 0.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave({
      name: values.name.trim(),
      dose: values.dose.trim(),
      formulation: values.formulation.trim(),
      instructions: values.instructions.trim(),
      quantity: parseInt(values.quantity, 10),
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
          <h2 className="text-[15px] font-bold flex-1 text-text-primary">
            {editing ? 'Edit Medication' : 'Add Medication'}
          </h2>
          <button onClick={onClose} aria-label="Close modal"
            className="w-6 h-6 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-[18px] py-[18px]">
          <div className="flex flex-col gap-1.5 mb-3.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
              Medication Name <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
            </label>
            <ComboboxInput
              value={values.name}
              onChange={(val) => { 
                setValues(v => ({ ...v, name: val })); 
                setErrors(er => ({ ...er, name: !val.trim() ? 'Medication name is required.' : val.length > 255 ? 'Max 255 characters.' : '' })); 
              }}
              options={nameOptions}
              placeholder="e.g. Losartan"
              hasError={!!errors.name}
              maxLength={255}
            />
            {errors.name && <p className="text-[12px] text-red mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 @max-[1023px]:grid-cols-1 gap-3 mb-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
                Dose <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
              </label>
              <input
                type="text"
                value={values.dose}
                onChange={(e) => { 
                  const val = e.target.value;
                  setValues((v) => ({ ...v, dose: val })); 
                  setErrors((er) => ({ ...er, dose: !val.trim() ? 'Dose is required.' : val.length > 255 ? 'Max 255 characters.' : '' })); 
                }}
                placeholder="e.g. 500 mg, 1 tablet"
                maxLength={255}
                className={inputCn(!!errors.dose)}
              />
              {errors.dose && <p className="text-[12px] text-red mt-1">{errors.dose}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
                Formulation <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
              </label>
              <ComboboxInput
                value={values.formulation}
                onChange={(val) => { 
                  setValues(v => ({ ...v, formulation: val })); 
                  setErrors(er => ({ ...er, formulation: !val.trim() ? 'Formulation is required.' : '' })); 
                }}
                options={FORMULATION_OPTIONS}
                placeholder="e.g. Tablet"
                hasError={!!errors.formulation}
                maxLength={50}
              />
              {errors.formulation && <p className="text-[12px] text-red mt-1">{errors.formulation}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mb-3.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
              Instructions <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
            </label>
            <input
              value={values.instructions}
              onChange={(e) => { 
                const val = e.target.value;
                setValues((v) => ({ ...v, instructions: val })); 
                setErrors((er) => ({ ...er, instructions: !val.trim() ? 'Instructions are required.' : val.length > 50 ? 'Max 50 characters.' : '' })); 
              }}
              placeholder="e.g. Once daily with food"
              maxLength={50}
              className={inputCn(!!errors.instructions)}
            />
            {errors.instructions && <p className="text-[12px] text-red mt-1">{errors.instructions}</p>}
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
                if (!val) {
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
          <button onClick={handleSubmit} disabled={saving}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all duration-150 cursor-pointer disabled:bg-text-muted disabled:border-border-strong disabled:cursor-not-allowed">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Medication'}
          </button>
        </div>
      </div>
    </div>
  );
}

