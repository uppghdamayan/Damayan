'use client';

import { cn } from '@/lib/utils';

import type { Medication } from '@/types/medication';

export const MED_COLUMN_LAYOUT = '1.8fr 1.2fr 1.2fr 1.2fr 0.8fr 110px 160px';
export const MED_COLUMN_LAYOUT_DISCONTINUED = '1.8fr 1.2fr 1.2fr 1.2fr 0.8fr 160px';

interface MedicationEntryProps {
  medication: Medication;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange?: (isActive: boolean) => void;
  hideStatus?: boolean;
}

export function MedicationEntry({ medication, canManage, onEdit, onDelete, onStatusChange, hideStatus }: MedicationEntryProps) {
  return (
    <div 
      className={cn(
        'relative grid items-center gap-4 pl-[14px] pr-[28px] py-2.5 bg-surface transition-all duration-150 animate-row-entry after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[""] last:after:hidden hover:bg-surface-2/50',
      )}
      style={{ gridTemplateColumns: hideStatus ? MED_COLUMN_LAYOUT_DISCONTINUED : MED_COLUMN_LAYOUT }}
    >
      <div className={cn("text-[13px] font-bold truncate pr-2", medication.isActive ? "text-text-primary" : "text-text-muted line-through")}>
        {medication.name}
      </div>

      <div className={cn("text-[12px] font-medium truncate pr-2", medication.isActive ? "text-text-secondary" : "text-text-muted")}>
        {medication.formulation || '-'}
      </div>

      <div className={cn("text-[12px] font-mono", medication.isActive ? "text-accent font-semibold" : "text-text-muted")}>
        {medication.dose}
      </div>

      <div className={cn("text-[12px] truncate pr-2", medication.isActive ? "text-text-secondary" : "text-text-muted")}>
        {medication.instructions || '-'}
      </div>

      <div className={cn("text-[12px] font-mono text-left", medication.isActive ? "text-text-secondary" : "text-text-muted")}>
        {medication.quantity != null ? `${medication.quantity} ${medication.formulation?.toLowerCase().includes('tablet') ? 'tabs' : medication.formulation?.toLowerCase().includes('capsule') ? 'caps' : 'pcs'}` : '-'}
      </div>

      {!hideStatus && (
        <div className="flex justify-start">
          {onStatusChange ? (
            <select
              disabled={!canManage}
              value={medication.isActive ? 'ACTIVE' : 'INACTIVE'}
              onChange={(e) => onStatusChange(e.target.value === 'ACTIVE')}
              className="h-6 w-full max-w-[90px] px-1 bg-surface-2 border border-border rounded text-[11px] text-text-primary outline-none cursor-pointer focus:border-accent disabled:bg-surface-2 disabled:cursor-not-allowed"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          ) : (
            <div className="text-[12px] font-medium text-text-secondary">
              {medication.isActive ? 'Active' : 'Inactive'}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-start gap-2">
        {canManage && (
          medication.isActive ? (
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
          ) : (
            <>
              <button onClick={() => onStatusChange?.(true)}
                className="h-[24px] px-2.5 rounded text-[11px] font-medium bg-surface text-text-secondary border border-border hover:bg-surface-2 hover:text-text-primary transition-all duration-150 cursor-pointer shadow-sm">
                Reactivate
              </button>
              <button onClick={onDelete}
                className="h-[24px] px-2.5 rounded text-[11px] font-medium bg-red-bg text-red border border-red-border hover:bg-red-bg/80 transition-all duration-150 cursor-pointer shadow-sm">
                Remove
              </button>
            </>
          )
        )}
      </div>
    </div>
  );
}
