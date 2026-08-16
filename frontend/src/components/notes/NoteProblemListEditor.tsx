'use client';

import { Trash2, Lock, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getCreatorName,
  assessmentItemKey as itemKey,
  buildAssessmentFlatOrder as buildFlatOrder,
  formatDiagnosisDate as formatDate,
  type NoteAssessmentItem,
} from '@/lib/problem-utils';
import type { Problem } from '@/types/problem';

// Re-exported so existing importers (ProgressNoteForm.tsx) keep working —
// the shape itself now lives in problem-utils.ts, shared with InitialNoteForm.
export type { NoteAssessmentItem };

interface NoteProblemListEditorProps {
  value: NoteAssessmentItem[];
  onChange: (next: NoteAssessmentItem[]) => void;
  activeProblems: Problem[]; // copyForward.activeProblems — for Added By / created-at lookups only
  isPublished: boolean;
  isDisabled: boolean;
  isEditMode: boolean;
  // The remaining props are only meaningful for a note that participates in
  // the master/note mutual-exclusion lock and has a separate edit-mode toggle
  // (the Progress Note). The Initial Note's assessment is always editable
  // while the note is a draft — no lock, no toggle — so it omits all of them.
  isLockedByOther?: boolean;
  onEnterEditMode?: () => void;
  onRevert?: () => void;
  onSaveDraft?: () => void;
  // When supplied, a row's trash button defers removal to the caller (so it
  // can show its own confirmation) instead of splicing `value` directly.
  onRequestRemove?: (index: number) => void;
  currentUserLabel: string;
  newProbTitle: string;
  setNewProbTitle: (v: string) => void;
  emptyLabel?: string;
}

function isSnapshotDescendant(
  items: NoteAssessmentItem[],
  potentialDescendantKey: string,
  ancestorKey: string,
  guard = 0,
): boolean {
  if (potentialDescendantKey === ancestorKey) return true;
  if (guard > items.length) return false; // cycle guard — should be unreachable
  const descendant = items.find((i) => itemKey(i) === potentialDescendantKey);
  const parentKey = descendant?.parentId || undefined;
  if (!descendant || !parentKey) return false;
  return isSnapshotDescendant(items, parentKey, ancestorKey, guard + 1);
}

function getEligibleParents(items: NoteAssessmentItem[], excludeKey?: string): NoteAssessmentItem[] {
  return items.filter((i) => {
    const key = itemKey(i);
    if (!key) return false;
    if (!excludeKey) return true;
    if (key === excludeKey) return false;
    if (isSnapshotDescendant(items, key, excludeKey)) return false;
    return true;
  });
}

// A parent option's own depth within the CURRENT items array — used only to
// indent "Nest Under" dropdown options, mirroring ActiveProblemTable's
// getProblemDepth so a nested option reads the same way in both places.
function getItemDepth(items: NoteAssessmentItem[], key: string, guard = 0): number {
  if (guard > items.length) return 0; // cycle guard — should be unreachable
  const curr = items.find((i) => itemKey(i) === key);
  const parentKey = curr?.parentId || undefined;
  if (!curr || !parentKey) return 0;
  return 1 + getItemDepth(items, parentKey, guard + 1);
}

export function NoteProblemListEditor({
  value,
  onChange,
  activeProblems,
  isPublished,
  isDisabled,
  isEditMode,
  isLockedByOther = false,
  onEnterEditMode,
  onRevert,
  onSaveDraft,
  onRequestRemove,
  currentUserLabel,
  newProbTitle,
  setNewProbTitle,
  emptyLabel = 'No problems added yet.',
}: NoteProblemListEditorProps) {
  const items = value || [];
  const masterById = new Map(activeProblems.map((p) => [p.id, p]));
  const flatOrder = buildFlatOrder(items);

  const updateItem = (idx: number, patch: Partial<NoteAssessmentItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    if ('parentId' in patch) {
      if (!patch.parentId) {
        next[idx].parentId = null;
        next[idx].depth = 0;
      }
    }
    onChange(next);
  };

  const removeItem = (idx: number) => {
    const next = [...items];
    next.splice(idx, 1);
    onChange(next);
  };

  const addProblem = () => {
    if (!newProbTitle.trim()) return;
    onChange([...items, { title: newProbTitle.trim(), isNew: true, tempId: crypto.randomUUID() }]);
    setNewProbTitle('');
  };

  return (
    <div className="flex flex-col gap-3">
      {isLockedByOther && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[6px] bg-slate-500/10 border border-slate-400/30 text-xs font-medium text-slate-700 dark:text-slate-300">
          <Lock className="w-4 h-4 shrink-0" />
          <span>Locked — the Master Problem List is currently being edited. Finish there first.</span>
        </div>
      )}

      {isEditMode && onRevert && onSaveDraft && (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-[6px] bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/40">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-amber-800 dark:text-amber-300 flex-1">
            Draft Mode (Unpublished)
          </span>
          <button
            type="button"
            onClick={onRevert}
            disabled={isDisabled}
            className="h-[26px] px-2.5 rounded text-[11px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-400 hover:bg-amber-500/15 transition-all duration-150 cursor-pointer disabled:opacity-50"
          >
            ↺ Revert
          </button>
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isDisabled}
            title="Keeps your edits in this note's draft and unlocks the Master Problem List"
            className="h-[26px] px-2.5 rounded text-[11px] font-semibold text-text-primary bg-surface-2 border border-border hover:bg-surface-3 transition-all duration-150 cursor-pointer disabled:opacity-50"
          >
            Save Draft
          </button>
        </div>
      )}

      <div className="border border-border rounded-[8px] overflow-hidden bg-surface shadow-xs">
        {flatOrder.length === 0 && (
          <div className="py-4 px-3 text-[13px] text-text-muted italic text-center">
            {emptyLabel}
          </div>
        )}
        {flatOrder.map((flat, rowIdx) => {
          const { item, depth, originalIndex } = flat;
          const isLast = rowIdx === flatOrder.length - 1;
          const key = itemKey(item);
          const master = item.id ? masterById.get(item.id) : undefined;
          const creatorName = item.id
            ? (master ? getCreatorName(master.addedByUser) : 'Unknown')
            : currentUserLabel;
          const parentItem = item.parentId
            ? items.find((i) => itemKey(i) === item.parentId)
            : undefined;
          const eligibleParents = getEligibleParents(items, key);

          return (
            <div
              key={key || originalIndex}
              className={cn(
                'flex flex-col gap-2 px-3.5 py-2.5 bg-surface transition-colors animate-in fade-in duration-150',
                !isLast && 'border-b border-border',
                'hover:bg-surface-2/60',
              )}
            >
              <div className="flex items-center gap-2.5">
                {/* Status dot — dimmer + ringed for sub-problems, exactly like the Master Problem List */}
                <div
                  className={cn(
                    'w-2.5 h-2.5 rounded-full shrink-0 transition-colors',
                    depth > 0 ? 'bg-accent/70 ring-2 ring-accent/20' : 'bg-accent',
                  )}
                  title={depth > 0 ? `Sub-problem (Level ${depth})` : 'Top-level problem'}
                />

                {/* Tree branch connector, matching ActiveProblemTable's elbow style */}
                {depth > 0 && (
                  <div className="flex items-center flex-shrink-0" style={{ width: `${depth * 18}px` }}>
                    {Array.from({ length: depth - 1 }).map((_, i) => (
                      <span key={i} className="w-[18px] h-5 inline-block border-r border-border" />
                    ))}
                    <div className="w-[18px] h-5 flex items-center justify-center relative">
                      <span className="absolute left-0 top-0 bottom-1/2 w-2.5 border-l-2 border-b-2 border-accent/60 rounded-bl-[3px]" />
                    </div>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {isEditMode ? (
                    <input
                      value={item.title}
                      onChange={(e) => updateItem(originalIndex, { title: e.target.value })}
                      disabled={isDisabled}
                      className="w-full h-[32px] px-2.5 text-[13px] font-semibold rounded-[6px] border border-border-strong/80 dark:border-slate-600 outline-none focus:border-accent focus:ring-1 focus:ring-accent bg-white text-text-primary disabled:bg-surface-2 disabled:cursor-not-allowed shadow-xs"
                    />
                  ) : (
                    <span className={cn('text-[13px] truncate flex items-center gap-2', depth > 0 ? 'font-medium text-text-primary' : 'font-semibold text-text-primary')}>
                      {item.title}
                      {depth > 0 && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-1.5 py-[2px] rounded border border-accent/25 flex-shrink-0">
                          Sub-problem
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {item.isNew ? (
                  <span className="text-[10px] font-bold uppercase tracking-[0.5px] px-2 py-[2.5px] rounded-[4px] bg-green-bg text-green border border-green-border shrink-0">
                    New
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-[0.5px] px-2 py-[2.5px] rounded-[4px] bg-accent-light text-accent-hover border border-accent shrink-0">
                    Active
                  </span>
                )}
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => (onRequestRemove ? onRequestRemove(originalIndex) : removeItem(originalIndex))}
                    disabled={isDisabled}
                    title="Remove Problem"
                    className="p-1.5 text-text-muted hover:text-red hover:bg-red-bg rounded-md transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div
                className="grid grid-cols-2 gap-2.5 text-xs text-text-secondary"
                style={{ marginLeft: `${depth * 18 + 26}px` }}
              >
                <div className="flex flex-col gap-1">
                  <span className="uppercase tracking-[0.5px] text-[10px] font-bold text-text-secondary">
                    Date of Diagnosis
                  </span>
                  {isEditMode ? (
                    <input
                      type="date"
                      value={item.diagnosisDate ? new Date(item.diagnosisDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => updateItem(originalIndex, { diagnosisDate: e.target.value || null })}
                      disabled={isDisabled}
                      className="h-[30px] px-2 text-xs font-medium text-text-primary rounded-[5px] border border-border-strong/80 dark:border-slate-600 outline-none focus:border-accent focus:ring-1 focus:ring-accent bg-white disabled:bg-surface-2 disabled:cursor-not-allowed shadow-xs"
                    />
                  ) : (
                    <span className="font-mono text-xs font-semibold text-text-primary">{formatDate(item.diagnosisDate)}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="uppercase tracking-[0.5px] text-[10px] font-bold text-text-secondary">
                    Added By
                  </span>
                  <span className="text-xs font-medium text-text-primary truncate">{creatorName}</span>
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <span className="uppercase tracking-[0.5px] text-[10px] font-bold text-text-secondary">
                    Nest Under
                  </span>
                  {isEditMode ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={item.parentId || ''}
                        onChange={(e) => updateItem(originalIndex, { parentId: e.target.value || null })}
                        disabled={isDisabled}
                        className={cn(
                          'h-[30px] flex-1 min-w-0 px-2 text-xs font-medium text-text-primary rounded-[5px] border border-border-strong/80 dark:border-slate-600 outline-none focus:border-accent bg-white cursor-pointer disabled:bg-surface-2 disabled:cursor-not-allowed transition-colors shadow-xs',
                          item.parentId && 'border-accent/50 bg-accent/5 font-semibold text-accent',
                        )}
                      >
                        <option value="">None (Top Level)</option>
                        {eligibleParents.map((p) => {
                          const pKey = itemKey(p)!;
                          const parentDepth = getItemDepth(items, pKey);
                          const indent = parentDepth > 0 ? `${'  '.repeat(parentDepth)}└─ ` : '';
                          return (
                            <option key={pKey} value={pKey}>
                              {indent}{p.title}
                            </option>
                          );
                        })}
                      </select>
                      {item.parentId && (
                        <button
                          type="button"
                          onClick={() => updateItem(originalIndex, { parentId: null })}
                          disabled={isDisabled}
                          title="Un-nest problem (Move to Top Level)"
                          className="h-[30px] px-2 rounded-[5px] text-[10px] font-bold text-text-secondary hover:text-amber-800 bg-surface-2 hover:bg-amber-500/15 border border-border hover:border-amber-400 transition-all cursor-pointer flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
                        >
                          <span>✕</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-text-primary truncate">{parentItem ? parentItem.title : '— Top Level —'}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isEditMode ? (
        <div className="flex flex-col gap-2.5 p-3.5 border border-border rounded-[8px] bg-surface-2/60">
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">Add Problem</span>
          <div className="flex items-center gap-2">
            <input
              id="newProbTitle"
              value={newProbTitle}
              onChange={(e) => setNewProbTitle(e.target.value)}
              disabled={isDisabled}
              placeholder="Problem Title (e.g. Hypertension)"
              className="flex-1 h-[34px] px-3 text-[13px] text-text-primary rounded-[6px] border border-border-strong/80 dark:border-slate-600 outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] bg-white transition-all disabled:bg-surface-2 disabled:cursor-not-allowed placeholder:text-text-muted/80 shadow-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addProblem();
                }
              }}
            />
            <Button
              id="addProbBtn"
              type="button"
              variant="default"
              disabled={isDisabled || !newProbTitle.trim()}
              onClick={addProblem}
              className="h-[34px] px-4 bg-accent hover:bg-accent-hover text-white rounded-[6px] font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-50"
            >
              + Add Problem
            </Button>
          </div>
        </div>
      ) : (
        !isPublished && onEnterEditMode && (
          <button
            type="button"
            onClick={onEnterEditMode}
            disabled={isDisabled || isLockedByOther}
            className="self-start h-[32px] px-3.5 rounded-[6px] text-xs font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Problem List
          </button>
        )
      )}
    </div>
  );
}
