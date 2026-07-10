'use client';

import { cn } from '@/lib/utils';
import type { Medication } from '@/types/medication';

export const MED_COLUMN_LAYOUT = '1.8fr 1.2fr 1.2fr 1.2fr 0.8fr 110px 160px';
export const MED_COLUMN_LAYOUT_DISCONTINUES = '1.8fr 1.2fr 1.2fr 1.2fr 0.8fr 160px';

interface MedicationEntryProps {
  medication: Medication;
  recentlyPublishedFields?: string[];
  draftChangedFields?: string[];
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange?: (isActive: boolean) => void;
  hideStatus?: boolean;
}

export function MedicationEntry({
  medication,
  recentlyPublishedFields,
  draftChangedFields,
  canManage,
  onEdit,
  onDelete,
  onStatusChange,
  hideStatus,
}: MedicationEntryProps) {
  const renderUpdateTag = (fieldName: string) => {
    const isPublishedChange = recentlyPublishedFields?.includes(fieldName);
    const isDraftChange = draftChangedFields?.includes(fieldName);

    if (!isPublishedChange && !isDraftChange) return null;

    return (
      <span className={cn(
        "ml-1.5 px-1 rounded border inline-flex items-center py-0.5",
        isDraftChange ? "text-amber-700 bg-amber-500/10 border-amber-400/25 animate-pill-pulse" : "animate-highlight-pill text-green-700 bg-green-500/10 border-green-400/25"
      )}>
        <span className={cn(
          "text-[9px] font-bold uppercase tracking-[0.3px] inline-flex items-center",
          !isDraftChange && "animate-pill-pulse"
        )}>
          updated!
        </span>
      </span>
    );
  };

  return (
    <div 
      className={cn(
        'relative grid items-center gap-4 pl-[14px] pr-[28px] py-2.5 bg-surface transition-all duration-150 animate-row-entry after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[""] last:after:hidden hover:bg-surface-2/50',
      )}
      style={{ gridTemplateColumns: hideStatus ? MED_COLUMN_LAYOUT_DISCONTINUES : MED_COLUMN_LAYOUT }}
    >
      <div className={cn("text-[13px] font-bold truncate pr-2 flex items-center flex-wrap min-w-0", medication.isActive ? "text-text-primary" : "text-text-muted line-through")}>
        <span className="truncate">{medication.name}</span>
        {renderUpdateTag('name')}
      </div>

      <div className={cn("text-[12px] font-medium truncate pr-2 flex items-center flex-wrap min-w-0", medication.isActive ? "text-text-secondary" : "text-text-muted")}>
        <span className="truncate">{medication.formulation || '-'}</span>
        {renderUpdateTag('formulation')}
      </div>

      <div className={cn("text-[12px] font-mono flex items-center flex-wrap min-w-0", medication.isActive ? "text-accent font-semibold" : "text-text-muted")}>
        <span>{medication.dose}</span>
        {renderUpdateTag('dose')}
      </div>

      <div className={cn("text-[12px] truncate pr-2 flex items-center flex-wrap min-w-0", medication.isActive ? "text-text-secondary" : "text-text-muted")}>
        <span className="truncate">{medication.instructions || '-'}</span>
        {renderUpdateTag('instructions')}
      </div>

      <div className={cn("text-[12px] font-mono text-left flex items-center flex-wrap min-w-0", medication.isActive ? "text-text-secondary" : "text-text-muted")}>
        <span>
          {medication.quantity != null ? `${medication.quantity} ${medication.formulation?.toLowerCase().includes('tablet') ? 'tabs' : medication.formulation?.toLowerCase().includes('capsule') ? 'caps' : 'pcs'}` : '-'}
        </span>
        {renderUpdateTag('quantity')}
      </div>

      {!hideStatus && (
        <div className="flex items-center gap-2">
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
          {renderUpdateTag('isActive')}
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
              <button onClick={() => onStatusChange?.(false)}
                className="h-[24px] px-2.5 rounded text-[11px] font-medium bg-red-bg text-red border border-red-border hover:bg-red-bg/80 transition-all duration-150 cursor-pointer shadow-sm">
                Deactivate
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
