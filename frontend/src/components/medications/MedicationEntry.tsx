'use client';

import { cn } from '@/lib/utils';
import { formatDose } from '@/lib/medication-utils';
import type { Medication } from '@/types/medication';

interface MedicationEntryProps {
  medication: Medication;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function MedicationEntry({ medication, canManage, onEdit, onDelete }: MedicationEntryProps) {
  return (
    <div className={cn(
      'flex items-center gap-3 px-3.5 py-2.5 border-b border-border last:border-b-0',
      !medication.isActive && 'opacity-60',
    )}>
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', medication.isActive ? 'bg-accent-mid' : 'bg-border-strong')} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-text-primary">{medication.name}</span>
          {medication.formulation && <span className="text-[12px] text-text-secondary">{medication.formulation}</span>}
          <span className="font-mono text-[12px] text-text-secondary">{formatDose(medication)}</span>
        </div>
        {medication.instructions && (
          <div className="text-[11px] text-text-muted mt-0.5 truncate">{medication.instructions}</div>
        )}
      </div>

      {medication.quantity != null && (
        <span className="font-mono text-[11px] text-text-muted whitespace-nowrap">Qty: {medication.quantity}</span>
      )}

      {canManage && medication.isActive && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onEdit}
            className="h-[22px] px-2 rounded text-[10px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer">
            Edit
          </button>
          <button onClick={onDelete}
            className="h-[22px] px-2 rounded text-[10px] font-semibold bg-red-bg text-red border border-red-border hover:bg-red-bg/80 transition-all duration-150 cursor-pointer">
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
