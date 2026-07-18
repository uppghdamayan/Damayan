'use client';

import { cn } from '@/lib/utils';
import type { Medication } from '@/types/medication';

export const MED_COLUMN_LAYOUT = '1.8fr 1.2fr 1.2fr 1.2fr 0.8fr 160px 160px';
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
  const isOptimistic = medication.id.startsWith('optimistic-');
  const isDraftNew = draftChangedFields?.includes('_isNew') || medication.id.startsWith('temp-');
  const isPublishedNew = recentlyPublishedFields?.includes('_isNew');
  const isNewItem = isDraftNew || isPublishedNew;

  const isDraftUpdated = draftChangedFields && draftChangedFields.length > 0 && !draftChangedFields.includes('_isNew');
  const isPublishedUpdated = recentlyPublishedFields && recentlyPublishedFields.length > 0 && !recentlyPublishedFields.includes('_isNew');
  const isUpdatedItem = isDraftUpdated || isPublishedUpdated;

  const getHighlightClass = (fieldName: string) => {
    if (!medication.isActive) return '';

    const isPublishedChange = recentlyPublishedFields?.includes(fieldName);
    const isDraftChange = draftChangedFields?.includes(fieldName);

    return cn(
      "px-1 py-0.5 rounded border transition-all duration-1000 ease-out",
      isDraftChange 
        ? "text-amber bg-amber-bg border-amber-border/25" 
        : isPublishedChange
        ? "text-green bg-green-bg border-green-border/25"
        : "border-transparent bg-transparent text-inherit"
    );
  };

  const getStatusHighlightClass = () => {
    if (!medication.isActive) return '';

    const isPublishedChange = recentlyPublishedFields?.includes('isActive');
    const isDraftChange = draftChangedFields?.includes('isActive');

    return cn(
      "transition-all duration-1000 ease-out",
      isDraftChange 
        ? "text-amber bg-amber-bg border-amber-border" 
        : isPublishedChange
        ? "text-green bg-green-bg border-green-border"
        : ""
    );
  };

  return (
    <div 
      className={cn(
        'relative grid items-center gap-4 pl-[14px] pr-[28px] py-2.5 bg-surface transition-all duration-150 animate-row-entry after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[""] last:after:hidden hover:bg-surface-2/50',
        isOptimistic && 'opacity-50 pointer-events-none'
      )}
      style={{ gridTemplateColumns: hideStatus ? MED_COLUMN_LAYOUT_DISCONTINUES : MED_COLUMN_LAYOUT }}
    >
      <div className={cn("text-[13px] font-bold truncate pr-2 flex items-center flex-wrap min-w-0", medication.isActive ? "text-text-primary" : "text-text-muted line-through")}>
        <span className={cn("truncate", getHighlightClass('name'))}>{medication.name}</span>
        {isOptimistic && (
          <div className="h-3 w-3 rounded-full border-2 border-accent border-r-transparent animate-spin flex-shrink-0 ml-1.5" />
        )}
        {(!medication.isActive && (isNewItem || isUpdatedItem)) ? (
          <span className={cn(
            "ml-1.5 px-1.5 py-0.5 rounded border inline-flex items-center text-[9px] font-bold uppercase tracking-[0.5px]",
            isDraftNew || isDraftUpdated 
              ? "text-red bg-red-bg border-red-border" 
              : "text-red bg-red-bg border-red-border animate-highlight-pill"
          )}>
            Discontinued
          </span>
        ) : isNewItem ? (
          <span className="ml-1.5 px-1.5 py-0.5 rounded border inline-flex items-center text-[9px] font-bold uppercase tracking-[0.5px] text-green bg-green-bg border-green-border">
            new
          </span>
        ) : isUpdatedItem ? (
          <span className={cn(
            "ml-1.5 px-1.5 py-0.5 rounded border inline-flex items-center text-[9px] font-bold uppercase tracking-[0.5px]",
            isDraftUpdated 
              ? "text-amber bg-amber-bg border-amber-border" 
              : "text-green bg-green-bg border-green-border animate-highlight-pill"
          )}>
            updated
          </span>
        ) : null}
      </div>

      <div className={cn("text-[12px] font-medium truncate pr-2 flex items-center flex-wrap min-w-0", medication.isActive ? "text-text-secondary" : "text-text-muted")}>
        <span className={cn("truncate", getHighlightClass('formulation'))}>{medication.formulation || '-'}</span>
      </div>

      <div className={cn("text-[12px] font-mono flex items-center flex-wrap min-w-0", medication.isActive ? "text-accent font-semibold" : "text-text-muted")}>
        <span className={getHighlightClass('dose')}>{medication.dose}</span>
      </div>

      <div className={cn("text-[12px] truncate pr-2 flex items-center flex-wrap min-w-0", medication.isActive ? "text-text-secondary" : "text-text-muted")}>
        <span className={cn("truncate", getHighlightClass('instructions'))}>{medication.instructions || '-'}</span>
      </div>

      <div className={cn("text-[12px] font-mono text-left flex items-center flex-wrap min-w-0", medication.isActive ? "text-text-secondary" : "text-text-muted")}>
        <span className={getHighlightClass('quantity')}>
          {medication.quantity != null ? `${medication.quantity} ${medication.formulation?.toLowerCase().includes('tablet') ? 'tabs' : medication.formulation?.toLowerCase().includes('capsule') ? 'caps' : 'pcs'}` : '-'}
        </span>
      </div>

      {!hideStatus && (
        <div className="flex items-center gap-2">
          {onStatusChange ? (
            <select
              disabled={!canManage}
              value={medication.isActive ? 'ACTIVE' : 'INACTIVE'}
              onChange={(e) => onStatusChange(e.target.value === 'ACTIVE')}
              className={cn(
                "h-6 w-full max-w-[90px] px-1 bg-surface-2 border border-border rounded text-[11px] text-text-primary outline-none cursor-pointer focus:border-accent disabled:bg-surface-2 disabled:cursor-not-allowed",
                getStatusHighlightClass()
              )}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          ) : (
            <div className={cn("text-[12px] font-medium text-text-secondary", getStatusHighlightClass())}>
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
