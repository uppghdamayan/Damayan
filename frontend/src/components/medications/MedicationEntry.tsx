'use client';

import { cn } from '@/lib/utils';
import { formatDose } from '@/lib/medication-utils';
import type { Medication } from '@/types/medication';

export const MED_COLUMN_LAYOUT = '1.8fr 1.2fr 0.8fr 0.8fr 1.8fr 0.8fr 120px 1.5fr';

interface MedicationEntryProps {
  medication: Medication;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function MedicationEntry({ medication, canManage, onEdit, onDelete }: MedicationEntryProps) {
  return (
    <div 
      className={cn(
        'relative grid items-center gap-4 pl-[14px] pr-[28px] py-2.5 bg-surface transition-all duration-150 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[""] last:after:hidden hover:bg-surface-2/50',
        !medication.isActive && 'opacity-60',
      )}
      style={{ gridTemplateColumns: MED_COLUMN_LAYOUT }}
    >
      <div className="text-[13px] font-bold text-text-primary truncate pr-2">
        {medication.name}
      </div>

      <div className="text-[12px] font-medium text-text-secondary truncate pr-2">
        {medication.formulation || '-'}
      </div>

      <div className="text-[12px] font-mono text-text-secondary">
        {medication.dose}
      </div>

      <div className="text-[12px] font-mono text-text-secondary">
        {medication.unit.toLowerCase()}
      </div>

      <div className="text-[12px] text-text-secondary truncate pr-2">
        {medication.instructions || '-'}
      </div>

      <div className="text-[12px] font-mono text-text-secondary text-left">
        {medication.quantity != null ? `${medication.quantity} ${medication.formulation?.toLowerCase().includes('tablet') ? 'tabs' : medication.formulation?.toLowerCase().includes('capsule') ? 'caps' : 'pcs'}` : '-'}
      </div>

      <div className="flex items-center justify-start gap-2">
        {canManage && medication.isActive && (
          <>
            <button onClick={onEdit}
              className="h-[24px] px-2.5 rounded text-[11px] font-medium bg-surface text-text-secondary border border-border hover:bg-surface-2 hover:text-text-primary transition-all duration-150 cursor-pointer shadow-sm">
              Edit
            </button>
            <button onClick={onDelete}
              className="h-[24px] px-2.5 rounded text-[11px] font-medium bg-red-bg text-red border border-red-border hover:bg-red-bg/80 transition-all duration-150 cursor-pointer shadow-sm">
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}
