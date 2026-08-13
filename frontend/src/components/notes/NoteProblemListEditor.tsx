'use client';

import { Trash2, Lock, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getCreatorName } from '@/lib/problem-utils';
import type { Problem } from '@/types/problem';

// Shape of one problemListSnapshot entry as it lives in form state — a
// simplified projection of a master Problem, plus session-only bookkeeping
// (`isNew`, `tempId`) that never survives cleanFormValues.
export interface NoteAssessmentItem {
  id?: string;
  tempId?: string;
  title: string;
  parentId?: string | null;
  depth?: number;
  isNew?: boolean;
  diagnosisDate?: string | null;
}

interface NoteProblemListEditorProps {
  value: NoteAssessmentItem[];
  onChange: (next: NoteAssessmentItem[]) => void;
  activeProblems: Problem[]; // copyForward.activeProblems — for Added By / created-at lookups only
  isPublished: boolean;
  isDisabled: boolean;
  isEditMode: boolean;
  isLockedByOther: boolean;
  onEnterEditMode: () => void;
  onRevert: () => void;
  onSaveDraft: () => void;
  currentUserLabel: string;
  newProbTitle: string;
  setNewProbTitle: (v: string) => void;
}

// A snapshot item's own identity for parent/descendant matching — its real
// Problem.id once it has one, else its client-generated tempId. Items with
// neither (shouldn't normally happen) can't be nested under or resolved.
function itemKey(item: NoteAssessmentItem): string | undefined {
  return item.id || item.tempId;
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

function formatDate(d: string | null | undefined): string {
  if (!d) return '--';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface FlatItem {
  item: NoteAssessmentItem;
  key: string;
  depth: number;
  originalIndex: number;
}

// Flattens the snapshot into tree (parent-then-children) order — identical
// in spirit to the Master Problem List's buildProblemTree + DFS flatten —
// so a row visually moves to sit right under its new parent the instant its
// "Nest Under" changes, instead of staying wherever it was first added.
// Sibling order otherwise follows array order; items whose parentId points
// nowhere resolvable fall back to root.
function buildFlatOrder(items: NoteAssessmentItem[]): FlatItem[] {
  const withKeys = items.map((item, originalIndex) => ({
    item,
    originalIndex,
    key: itemKey(item) || `__idx_${originalIndex}`,
  }));
  const byKey = new Map(withKeys.map((w) => [w.key, w]));
  const childrenByParent = new Map<string, typeof withKeys>();
  const roots: typeof withKeys = [];

  withKeys.forEach((w) => {
    const parentKey = w.item.parentId || undefined;
    if (parentKey && byKey.has(parentKey) && parentKey !== w.key) {
      const arr = childrenByParent.get(parentKey) || [];
      arr.push(w);
      childrenByParent.set(parentKey, arr);
    } else {
      roots.push(w);
    }
  });

  const result: FlatItem[] = [];
  const traverse = (nodes: typeof withKeys, depth: number) => {
    nodes.forEach((n) => {
      result.push({ item: n.item, key: n.key, depth, originalIndex: n.originalIndex });
      const kids = childrenByParent.get(n.key);
      if (kids) traverse(kids, depth + 1);
    });
  };
  traverse(roots, 0);
  return result;
}

export function NoteProblemListEditor({
  value,
  onChange,
  activeProblems,
  isPublished,
  isDisabled,
  isEditMode,
  isLockedByOther,
  onEnterEditMode,
  onRevert,
  onSaveDraft,
  currentUserLabel,
  newProbTitle,
  setNewProbTitle,
}: NoteProblemListEditorProps) {
  const items = value || [];
  const masterById = new Map(activeProblems.map((p) => [p.id, p]));
  const flatOrder = buildFlatOrder(items);

  const updateItem = (idx: number, patch: Partial<NoteAssessmentItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
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
        <div className="flex items-center gap-2 px-3 py-2 rounded-[6px] bg-slate-500/10 border border-slate-400/25 text-[11px] text-slate-600">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Locked — the Master Problem List is currently being edited. Finish there first.</span>
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
            title="Keeps your edits in this note's draft and unlocks the Master Problem List"
            className="h-[22px] px-2 rounded text-[10px] font-semibold text-text-secondary bg-surface-2 border border-border hover:bg-surface-3 transition-all duration-150 cursor-pointer disabled:opacity-50"
          >
            Save Draft
          </button>
        </div>
      )}

      <div className="border border-border rounded-[6px] overflow-hidden bg-surface">
        {flatOrder.length === 0 && (
          <div className="py-3 px-3 text-[12px] text-text-muted italic text-center">
            No problems added yet.
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
                'flex flex-col gap-1.5 px-3 py-2 bg-surface transition-colors animate-in fade-in duration-150',
                !isLast && 'border-b border-border',
                'hover:bg-surface-3/50',
              )}
            >
              <div className="flex items-center gap-2">
                {/* Status dot — dimmer + ringed for sub-problems, exactly like the Master Problem List */}
                <div
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0 transition-colors',
                    depth > 0 ? 'bg-accent/60 ring-2 ring-accent/15' : 'bg-accent-mid',
                  )}
                  title={depth > 0 ? `Sub-problem (Level ${depth})` : 'Top-level problem'}
                />

                {/* Tree branch connector, matching ActiveProblemTable's elbow style */}
                {depth > 0 && (
                  <div className="flex items-center flex-shrink-0" style={{ width: `${depth * 16}px` }}>
                    {Array.from({ length: depth - 1 }).map((_, i) => (
                      <span key={i} className="w-[16px] h-5 inline-block border-r border-border/40" />
                    ))}
                    <div className="w-[16px] h-5 flex items-center justify-center relative">
                      <span className="absolute left-0 top-0 bottom-1/2 w-2 border-l-2 border-b-2 border-accent/40 rounded-bl-[3px]" />
                    </div>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {isEditMode ? (
                    <input
                      value={item.title}
                      onChange={(e) => updateItem(originalIndex, { title: e.target.value })}
                      disabled={isDisabled}
                      className="w-full h-[26px] px-2 text-[12px] font-semibold rounded-[4px] border border-border-strong/60 outline-none focus:border-accent bg-white disabled:bg-surface-2 disabled:cursor-not-allowed"
                    />
                  ) : (
                    <span className={cn('text-[12px] truncate flex items-center gap-1.5', depth > 0 ? 'font-medium text-text-primary' : 'font-semibold text-text-primary')}>
                      {item.title}
                      {depth > 0 && (
                        <span className="text-[8px] font-semibold uppercase tracking-wider text-accent/80 bg-accent/5 px-1 py-[1px] rounded border border-accent/15 flex-shrink-0">
                          Sub-problem
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {item.isNew ? (
                  <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] bg-green-bg text-green border border-green-border shrink-0">
                    New
                  </span>
                ) : (
                  <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] bg-accent-light text-accent-hover border border-accent shrink-0">
                    Active
                  </span>
                )}
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => removeItem(originalIndex)}
                    disabled={isDisabled}
                    title="Remove Problem"
                    className="p-1 text-text-muted hover:text-red hover:bg-red-bg rounded-md transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div
                className="grid grid-cols-2 gap-2 text-[10px] text-text-muted"
                style={{ marginLeft: `${depth * 16 + 24}px` }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="uppercase tracking-[0.4px] text-[8px] font-bold text-text-secondary">
                    Date of Diagnosis
                  </span>
                  {isEditMode ? (
                    <input
                      type="date"
                      value={item.diagnosisDate ? new Date(item.diagnosisDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => updateItem(originalIndex, { diagnosisDate: e.target.value || null })}
                      disabled={isDisabled}
                      className="h-[24px] px-1.5 text-[10px] rounded-[4px] border border-border-strong/60 outline-none focus:border-accent bg-white disabled:bg-surface-2 disabled:cursor-not-allowed"
                    />
                  ) : (
                    <span className="font-mono text-text-primary">{formatDate(item.diagnosisDate)}</span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="uppercase tracking-[0.4px] text-[8px] font-bold text-text-secondary">
                    Added By
                  </span>
                  <span className="text-text-primary truncate">{creatorName}</span>
                </div>
                <div className="col-span-2 flex flex-col gap-0.5">
                  <span className="uppercase tracking-[0.4px] text-[8px] font-bold text-text-secondary">
                    Nest Under
                  </span>
                  {isEditMode ? (
                    <div className="flex items-center gap-1">
                      <select
                        value={item.parentId || ''}
                        onChange={(e) => updateItem(originalIndex, { parentId: e.target.value || null })}
                        disabled={isDisabled}
                        className={cn(
                          'h-[24px] flex-1 min-w-0 px-1.5 text-[10px] rounded-[4px] border border-border-strong/60 outline-none focus:border-accent bg-white cursor-pointer disabled:bg-surface-2 disabled:cursor-not-allowed transition-colors',
                          item.parentId && 'border-accent/40 bg-accent/5 font-medium',
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
                          className="h-[24px] px-1.5 rounded text-[9px] font-semibold text-text-muted hover:text-amber-700 bg-surface-2 hover:bg-amber-500/10 border border-border hover:border-amber-400/50 transition-all cursor-pointer flex items-center gap-0.5 flex-shrink-0 disabled:opacity-50"
                        >
                          <span>✕</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-text-primary truncate">{parentItem ? parentItem.title : '— Top Level —'}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isEditMode ? (
        <div className="flex flex-col gap-2 p-3 border border-border rounded-[8px] bg-surface-2/40">
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">Add Problem</span>
          <div className="flex items-center gap-2">
            <input
              id="newProbTitle"
              value={newProbTitle}
              onChange={(e) => setNewProbTitle(e.target.value)}
              disabled={isDisabled}
              placeholder="Problem Title (e.g. Hypertension)"
              className="flex-1 h-[32px] px-2.5 text-[12px] rounded-[6px] border border-border-strong/60 outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] bg-white transition-all disabled:bg-surface-2 disabled:cursor-not-allowed placeholder:text-border-strong/70"
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
              className="h-[32px] px-4 bg-accent hover:bg-accent-hover text-white rounded-[6px] font-semibold text-[11px] flex items-center gap-1 transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-50"
            >
              + Add Problem
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
            Edit Problem List
          </button>
        )
      )}
    </div>
  );
}
