'use client';

import { Lock, Pencil, Edit as EditIcon, TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComboboxInput } from '@/components/ui/ComboboxInput';

// Shape of one medicationSnapshot entry as it lives in form state.
export interface NoteMedicationItem {
  name: string;
  dose?: string;
  formulation?: string;
  quantity?: number;
  instructions?: string;
  isNew?: boolean;
  fromPast?: boolean;
}

interface NoteMedicationEditorProps {
  value: NoteMedicationItem[];
  onChange: (next: NoteMedicationItem[]) => void;
  isPublished: boolean;
  isDisabled: boolean;
  isEditMode: boolean;
  isLockedByOther: boolean;
  onEnterEditMode: () => void;
  onRevert: () => void;
  onSaveDraft: () => void;
  onEditMedication: (idx: number) => void;
  originalDoseByMedName: Map<string, string>;
  nameOptions: string[];
  newMedName: string;
  setNewMedName: (v: string) => void;
  newMedDose: string;
  setNewMedDose: (v: string) => void;
  newMedFormulation: string;
  setNewMedFormulation: (v: string) => void;
  newMedQuantity: string;
  setNewMedQuantity: (v: string) => void;
  newMedInstructions: string;
  setNewMedInstructions: (v: string) => void;
  medError: string;
  setMedError: (v: string) => void;
}

export function NoteMedicationEditor({
  value,
  onChange,
  isPublished,
  isDisabled,
  isEditMode,
  isLockedByOther,
  onEnterEditMode,
  onRevert,
  onSaveDraft,
  onEditMedication,
  originalDoseByMedName,
  nameOptions,
  newMedName,
  setNewMedName,
  newMedDose,
  setNewMedDose,
  newMedFormulation,
  setNewMedFormulation,
  newMedQuantity,
  setNewMedQuantity,
  newMedInstructions,
  setNewMedInstructions,
  medError,
  setMedError,
}: NoteMedicationEditorProps) {
  const meds = value || [];

  const handleAddMedication = () => {
    const trimmedName = newMedName.trim();
    const trimmedDose = newMedDose.trim();
    if (!trimmedName || !trimmedDose) {
      setMedError('Medication name and dose are required.');
      return;
    }
    setMedError('');
    const qtyNum = newMedQuantity.trim() ? parseInt(newMedQuantity.trim(), 10) : undefined;
    onChange([
      ...meds,
      {
        name: trimmedName,
        dose: trimmedDose,
        formulation: newMedFormulation.trim() || undefined,
        quantity: !isNaN(qtyNum as number) && (qtyNum as number) > 0 ? qtyNum : undefined,
        instructions: newMedInstructions.trim() || undefined,
        isNew: true,
      },
    ]);
    setNewMedName('');
    setNewMedDose('');
    setNewMedFormulation('');
    setNewMedQuantity('');
    setNewMedInstructions('');
  };

  return (
    <div className="flex flex-col gap-3">
      {isLockedByOther && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[6px] bg-slate-500/10 border border-slate-400/25 text-[11px] text-slate-600">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Locked — the Master Medications List is currently being edited. Finish there first.</span>
        </div>
      )}

      {isEditMode && (
        <div className="flex items-center gap-2 px-3 py-[7px] rounded-[6px] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
          <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-amber-700 flex-1">
            Draft Mode (Unpublished)
          </span>
          <button
            type="button"
            onClick={onRevert}
            disabled={isDisabled}
            className="h-[22px] px-2 rounded text-[10px] font-semibold text-amber-700 border border-amber-400/50 hover:bg-amber-500/10 transition-all duration-150 cursor-pointer disabled:opacity-50"
          >
            ↺ Revert
          </button>
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isDisabled}
            title="Keeps your edits in this note's draft and unlocks the Master Medications List"
            className="h-[22px] px-2 rounded text-[10px] font-semibold text-text-secondary bg-surface-2 border border-border hover:bg-surface-3 transition-all duration-150 cursor-pointer disabled:opacity-50"
          >
            Save Draft
          </button>
        </div>
      )}

      {/* Medication Items List */}
      <div className="flex flex-col gap-2">
        {meds.map((med: NoteMedicationItem | string, idx: number) => {
          const medName = typeof med === 'string' ? med : med.name;
          const medDose = typeof med !== 'string' ? med.dose : undefined;
          const medForm = typeof med !== 'string' ? med.formulation : undefined;
          const medQty = typeof med !== 'string' ? med.quantity : undefined;
          const medSig = typeof med !== 'string' ? med.instructions : undefined;
          const isNewMed = typeof med !== 'string' && med.isNew;

          const originalDose = !isNewMed && medName
            ? originalDoseByMedName.get(String(medName).trim().toLowerCase())
            : undefined;
          const doseChanged = !isNewMed && originalDose !== undefined && medDose
            && String(medDose).trim() !== originalDose && originalDose !== '';
          const originalDoseNum = doseChanged ? parseFloat(originalDose!) : NaN;
          const newDoseNum = doseChanged ? parseFloat(String(medDose)) : NaN;
          const doseDirection = !isNaN(originalDoseNum) && !isNaN(newDoseNum)
            ? (newDoseNum > originalDoseNum ? 'up' : newDoseNum < originalDoseNum ? 'down' : null)
            : null;

          return (
            <div
              key={idx}
              className="group relative flex flex-col gap-1.5 p-3 bg-white border border-border rounded-[8px] shadow-sm hover:border-border-strong transition-all duration-150"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-text-primary text-[13px] break-words">
                    {medName}
                  </span>
                  {isNewMed && (
                    <span className="text-[8px] font-bold text-green bg-green-bg border border-green-border px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                      New
                    </span>
                  )}
                  {medDose && (
                    <span className="font-mono text-[11px] font-semibold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-md shrink-0">
                      {medDose}
                    </span>
                  )}
                  {doseChanged && (
                    <span
                      className={
                        "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border " +
                        (doseDirection === 'up'
                          ? "text-blue bg-blue-bg border-blue-border/40"
                          : doseDirection === 'down'
                            ? "text-purple bg-purple-bg border-purple-border/40"
                            : "text-amber-700 bg-amber-50 border-amber-600/30")
                      }
                      title={`Dose changed from ${originalDose}`}
                    >
                      {doseDirection === 'up' ? '↑ Dose' : doseDirection === 'down' ? '↓ Dose' : 'Dose Changed'}
                    </span>
                  )}
                  {medForm && (
                    <span className="text-[11px] text-text-secondary bg-surface-2 border border-border px-2 py-0.5 rounded-md shrink-0">
                      {medForm}
                    </span>
                  )}
                  {medQty && (
                    <span className="text-[11px] text-text-muted font-medium shrink-0">
                      Qty: <span className="font-mono font-semibold text-text-secondary">{medQty}</span>
                    </span>
                  )}
                </div>

                {isEditMode && (
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onEditMedication(idx)}
                      disabled={isDisabled}
                      className="text-text-muted hover:text-accent hover:bg-accent/10 transition-colors w-6 h-6 rounded-md disabled:opacity-50 shrink-0 cursor-pointer p-0"
                      title="Edit Medication"
                    >
                      <EditIcon className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        const newMeds = [...meds];
                        newMeds.splice(idx, 1);
                        onChange(newMeds);
                      }}
                      disabled={isDisabled}
                      className="text-text-muted hover:text-red hover:bg-red-bg transition-colors w-6 h-6 rounded-md disabled:opacity-50 shrink-0 cursor-pointer p-0"
                      title="Remove Medication"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {medSig && (
                <div className="text-[11px] text-text-secondary pl-4 border-l-2 border-accent/20 py-0.5 mt-0.5 flex items-start gap-1">
                  <span className="font-medium text-text-muted shrink-0">Sig:</span>
                  <span className="italic text-text-secondary break-words">{medSig}</span>
                </div>
              )}
            </div>
          );
        })}

        {meds.length === 0 && (
          <div className="py-5 px-4 text-center rounded-[8px] border border-dashed border-border bg-surface-2/30 flex flex-col items-center justify-center gap-1">
            <span className="text-[12px] text-text-muted font-medium">No medications added yet.</span>
            {isEditMode && (
              <span className="text-[10px] text-text-muted/70">Use the form below to prescribe medications for this visit.</span>
            )}
          </div>
        )}
      </div>

      {/* Add Medication Sub-Form */}
      {isEditMode ? (
        <div className="flex flex-col gap-2.5 mt-1 p-3.5 border border-border rounded-[8px] bg-surface-2/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Add Medication
            </span>
            <span className="text-[10px] text-text-muted">
              * Name &amp; dose required
            </span>
          </div>

          {/* Row 1: Medication Name Combobox */}
          <div className="w-full">
            <ComboboxInput
              value={newMedName}
              onChange={(val) => {
                setNewMedName(val);
                if (medError) setMedError('');
              }}
              options={nameOptions}
              placeholder="Medication Name (e.g. Lisinopril, Metformin)"
              disabled={isDisabled}
              className="h-[34px] px-2.5 text-[12px] rounded-[6px] border border-border-strong/60 outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70"
            />
          </div>

          {/* Row 2: Responsive Grid for Dose, Formulation, Quantity */}
          <div className="grid grid-cols-12 gap-2 w-full">
            <div className="col-span-5 flex flex-col min-w-0">
              <input
                type="text"
                value={newMedDose}
                onChange={(e) => {
                  setNewMedDose(e.target.value);
                  if (medError) setMedError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMedication();
                  }
                }}
                placeholder="Dose (e.g. 10 mg)"
                disabled={isDisabled}
                className="w-full min-w-0 h-[34px] px-2.5 text-[12px] rounded-[6px] border border-border-strong/60 outline-none focus:border-accent bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:bg-surface-2 disabled:cursor-not-allowed"
              />
            </div>
            <div className="col-span-4 flex flex-col min-w-0">
              <input
                type="text"
                value={newMedFormulation}
                onChange={(e) => setNewMedFormulation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMedication();
                  }
                }}
                placeholder="Form (e.g. Tablet)"
                disabled={isDisabled}
                className="w-full min-w-0 h-[34px] px-2.5 text-[12px] rounded-[6px] border border-border-strong/60 outline-none focus:border-accent bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:bg-surface-2 disabled:cursor-not-allowed"
              />
            </div>
            <div className="col-span-3 flex flex-col min-w-0">
              <input
                type="number"
                min="1"
                step="1"
                value={newMedQuantity}
                onChange={(e) => setNewMedQuantity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMedication();
                  }
                }}
                placeholder="Qty"
                disabled={isDisabled}
                className="w-full min-w-0 h-[34px] px-2 text-[12px] rounded-[6px] border border-border-strong/60 outline-none focus:border-accent bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:bg-surface-2 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Row 3: Sig / Instructions */}
          <div className="w-full min-w-0">
            <input
              type="text"
              value={newMedInstructions}
              onChange={(e) => setNewMedInstructions(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddMedication();
                }
              }}
              placeholder="Sig / Instructions (e.g. Take 1 tab daily with meals)"
              disabled={isDisabled}
              className="w-full min-w-0 h-[34px] px-2.5 text-[12px] rounded-[6px] border border-border-strong/60 outline-none focus:border-accent bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:bg-surface-2 disabled:cursor-not-allowed"
            />
          </div>

          {/* Row 4: Error feedback and Add Button */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {medError ? (
              <span className="text-[11px] font-medium text-red animate-in fade-in duration-150">
                {medError}
              </span>
            ) : (
              <span className="text-[10px] text-text-muted hidden sm:inline">
                Press Enter to add
              </span>
            )}
            <Button
              type="button"
              variant="default"
              size="xs"
              disabled={isDisabled || (!newMedName.trim() && !newMedDose.trim())}
              onClick={handleAddMedication}
              className="h-[32px] px-4 bg-accent text-white hover:bg-accent-hover rounded-[6px] font-semibold text-[11px] flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 shrink-0 ml-auto transition-all"
            >
              <span>+</span> Add Medication
            </Button>
          </div>
        </div>
      ) : (
        !isPublished && (
          <button
            type="button"
            onClick={onEnterEditMode}
            disabled={isDisabled || isLockedByOther}
            className="self-start h-[30px] px-3 rounded-[6px] text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Medications
          </button>
        )
      )}
    </div>
  );
}
