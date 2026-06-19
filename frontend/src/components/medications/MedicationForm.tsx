'use client';

import { useEffect, useState, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildMedicationSuggestions } from '@/lib/medication-utils';
import type { Medication, MedUnitValue } from '@/types/medication';

interface MedicationFormValues {
  name: string;
  dose: string;
  unit: MedUnitValue;
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
  onSave: (values: { name: string; dose: number; unit: MedUnitValue; formulation?: string; instructions?: string; quantity?: number }) => void;
}

const UNIT_OPTIONS: MedUnitValue[] = ['MG', 'G', 'MCG', 'ML', 'UNITS'];
const FORMULATION_OPTIONS = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Cream', 'Ointment', 'Drops', 'Patch', 'Suppository', 'Inhaler', 'Lotion', 'Gel'
];

const emptyValues: MedicationFormValues = { name: '', dose: '', unit: 'MG', formulation: '', instructions: '', quantity: '' };

function ComboboxInput({
  value,
  onChange,
  options,
  placeholder,
  hasError,
  autoFocus,
  readOnly = false,
  maxLength,
  lowercaseOnly = false
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  hasError?: boolean;
  autoFocus?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  lowercaseOnly?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = readOnly ? options : options.filter((option) =>
    option.toLowerCase().includes(value.trim().toLowerCase())
  );

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredOptions.length > 0 ? (prev - 1 + filteredOptions.length) % filteredOptions.length : -1
      );
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        e.preventDefault();
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (readOnly && filteredOptions.length > 0) {
         e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const inputCn = cn(
    'h-[34px] w-full px-2.5 bg-surface border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 pr-8',
    hasError
      ? 'border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
      : 'border-border focus:border-accent focus:shadow-accent-focus',
    readOnly && 'cursor-pointer'
  );

  return (
    <div className="relative" ref={containerRef}>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={lowercaseOnly ? value.toLowerCase() : value}
        onChange={(e) => {
          if (!readOnly) {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }
        }}
        onClick={() => {
          if (readOnly) {
            setIsOpen((prev) => !prev);
            setHighlightedIndex(0);
          }
        }}
        onFocus={() => {
          if (!readOnly) {
             setIsOpen(true);
             setHighlightedIndex(0);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        readOnly={readOnly}
        className={inputCn}
      />
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          inputRef.current?.focus();
        }}
        tabIndex={-1}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
      >
        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>
      {isOpen && filteredOptions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto bg-surface border border-border rounded-btn shadow-modal z-[600] py-1"
        >
          {filteredOptions.map((option, index) => (
            <li
              key={option}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "px-3 py-1.5 text-[13px] text-text-primary cursor-pointer transition-colors duration-100",
                index === highlightedIndex ? "bg-surface-2 font-medium" : ""
              )}
            >
              {lowercaseOnly ? option.toLowerCase() : option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MedicationFormModal({ open, onClose, editing, suggestions, saving, onSave }: MedicationFormModalProps) {
  const [values, setValues] = useState<MedicationFormValues>(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(
        editing
          ? {
              name: editing.name,
              dose: String(Number(editing.dose)),
              unit: editing.unit,
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

    const doseNum = parseFloat(values.dose);
    if (!values.dose || isNaN(doseNum) || doseNum <= 0) e.dose = 'Dose must be a number greater than 0.';
    else if (doseNum > 99999.99) e.dose = 'Dose is too large.';

    if (values.instructions && values.instructions.length > 50) e.instructions = 'Max 50 characters.';

    if (values.quantity) {
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
      dose: parseFloat(values.dose),
      unit: values.unit,
      formulation: values.formulation.trim() || undefined,
      instructions: values.instructions.trim() || undefined,
      quantity: values.quantity ? parseInt(values.quantity, 10) : undefined,
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
              autoFocus
              value={values.name}
              onChange={(val) => { setValues(v => ({ ...v, name: val })); setErrors(er => ({ ...er, name: '' })); }}
              options={nameOptions}
              placeholder="e.g. Losartan"
              hasError={!!errors.name}
              maxLength={255}
            />
            {errors.name && <p className="text-[12px] text-red mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
                Dose <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
              </label>
              <input
                type="number" step="0.01" min="0.01"
                value={values.dose}
                onChange={(e) => { setValues((v) => ({ ...v, dose: e.target.value })); setErrors((er) => ({ ...er, dose: '' })); }}
                placeholder="50"
                className={inputCn(!!errors.dose)}
              />
              {errors.dose && <p className="text-[12px] text-red mt-1">{errors.dose}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">Unit</label>
              <ComboboxInput
                value={values.unit}
                onChange={(val) => { setValues(v => ({ ...v, unit: val as MedUnitValue })); }}
                options={UNIT_OPTIONS}
                readOnly
                lowercaseOnly
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">Formulation</label>
              <ComboboxInput
                value={values.formulation}
                onChange={(val) => { setValues(v => ({ ...v, formulation: val })); }}
                options={FORMULATION_OPTIONS}
                placeholder="e.g. Tablet"
                maxLength={50}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mb-3.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">Instructions</label>
            <input
              value={values.instructions}
              onChange={(e) => { setValues((v) => ({ ...v, instructions: e.target.value })); setErrors((er) => ({ ...er, instructions: '' })); }}
              placeholder="e.g. Once daily with food"
              maxLength={50}
              className={inputCn(!!errors.instructions)}
            />
            {errors.instructions && <p className="text-[12px] text-red mt-1">{errors.instructions}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">Quantity</label>
            <input
              type="number" step="1" min="1"
              value={values.quantity}
              onChange={(e) => { setValues((v) => ({ ...v, quantity: e.target.value })); setErrors((er) => ({ ...er, quantity: '' })); }}
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
