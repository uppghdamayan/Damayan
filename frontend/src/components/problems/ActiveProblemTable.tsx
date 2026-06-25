'use client';

import { useMemo } from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { isDescendant } from '@/lib/problem-utils';
import type { Problem, ProblemNode, ProblemStatusValue } from '@/types/problem';

const COLUMN_LAYOUT = '22px 14px 3fr 1.5fr 1.2fr 2fr 120px 1.5fr';

interface ActiveProblemTableProps {
  nodes: ProblemNode[];
  flatProblems: { problem: ProblemNode; depth: number }[];
  isTableDragging: boolean;
  activeDragItem: { problem: ProblemNode; depth: number } | null;
  dragOverState: { id: string; isMerge: boolean } | null;
  allOptions: Problem[];
  canManage: boolean;
  isEditMode: boolean;
  onRevert: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  isSaving: boolean;
  lastAutoSaved?: Date | null;
  onEdit: (p: Problem) => void;
  onStatusChange: (p: Problem, status: ProblemStatusValue) => void;
  onDelete: (p: Problem) => void;
  onParentChange: (p: Problem, newParentId: string | null) => void;
}

export function ActiveProblemRow({
  problem,
  depth = 0,
  canManage,
  dragHandleProps,
  isDragging,
  allOptions,
  dragOverState,
  onEdit,
  onStatusChange,
  onDelete,
  onParentChange,
}: {
  problem: Problem;
  depth?: number;
  canManage: boolean;
  dragHandleProps?: { attributes: any; listeners: any };
  isDragging?: boolean;
  allOptions: Problem[];
  dragOverState: { id: string; isMerge: boolean } | null;
  onEdit: () => void;
  onStatusChange: (status: ProblemStatusValue) => void;
  onDelete: () => void;
  onParentChange: (newParentId: string | null) => void;
}) {
  const selectableParents = allOptions.filter((p) => {
    if (p.status !== 'ACTIVE') return false;
    if (p.id === problem.id) return false;
    if (isDescendant(allOptions, p.id, problem.id)) return false;
    return true;
  });

  const isMergeHover = dragOverState?.id === problem.id && dragOverState.isMerge;
  const isReorderHover = dragOverState?.id === problem.id && !dragOverState.isMerge;

  return (
    <div
      {...(canManage ? dragHandleProps?.attributes : {})}
      {...(canManage ? dragHandleProps?.listeners : {})}
      className={cn(
        'grid items-center gap-4 px-[14px] py-3 bg-surface transition-all duration-150 animate-row-entry',
        canManage && 'cursor-grab active:cursor-grabbing',
        isDragging && 'relative z-10 opacity-40 shadow-sm dragging',
        isReorderHover && 'bg-accent-light border-t-2 border-t-accent',
        isMergeHover && 'bg-green-bg border-2 border-dashed border-green-border relative'
      )}
      style={{ gridTemplateColumns: COLUMN_LAYOUT }}
    >
      {/* Column 1: Drag handle indicator */}
      <div className="flex items-center justify-center">
        {canManage ? (
          <span
            className="text-border-strong flex-shrink-0 select-none text-[15px] font-bold"
            title="Drag to reorder"
          >
            ⠿
          </span>
        ) : null}
      </div>

      {/* Column 2: Status dot */}
      <div className="flex items-center justify-center">
        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-accent-mid" title="Active" />
      </div>

      {/* Column 3: Problem name and code with nesting indentation */}
      <div 
        className="flex items-center gap-2 truncate text-text-primary"
        style={depth > 0 ? { paddingLeft: `${depth * 24}px` } : undefined}
      >
        {depth > 0 && (
          <span className="font-mono text-text-muted mr-1 select-none">↳</span>
        )}
        <span className="text-[13px] font-semibold truncate">{problem.title}</span>
        {problem.icdCode && (
          <span className="font-mono text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">
            {problem.icdCode}
          </span>
        )}
      </div>

      {/* Column 4: Date Added */}
      <div className="text-[12px] font-mono text-text-secondary whitespace-nowrap text-left">
        {new Date(problem.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>

      {/* Column 5: Status */}
      <div className="flex justify-start">
        <select
          disabled={!canManage}
          value={problem.status}
          onChange={(e) => onStatusChange(e.target.value as ProblemStatusValue)}
          className="h-6 w-full max-w-[90px] px-1 bg-surface-2 border border-border rounded text-[11px] text-text-primary outline-none cursor-pointer focus:border-accent disabled:bg-surface-2 disabled:cursor-not-allowed"
        >
          <option value="ACTIVE">Active</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      {/* Column 6: Nest Under */}
      <div className="flex justify-start">
        <select
          disabled={!canManage}
          value={problem.parentId || ''}
          onChange={(e) => onParentChange(e.target.value || null)}
          className="h-6 w-full max-w-[150px] px-1 bg-surface-2 border border-border rounded text-[11px] text-text-primary outline-none cursor-pointer focus:border-accent disabled:bg-surface-2 disabled:cursor-not-allowed truncate"
        >
          <option value="">None (Top Level)</option>
          {selectableParents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {/* Column 7: Actions */}
      <div className="flex items-center justify-start gap-1.5">
        {canManage && (
          <>
            <button
              onClick={onEdit}
              className="h-[22px] px-2 rounded text-[10px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer"
            >
              Rename
            </button>
            <button
              onClick={onDelete}
              className="h-[22px] px-2 rounded text-[10px] font-semibold bg-red-bg text-red border border-red-border hover:bg-red-bg/80 transition-all duration-150 cursor-pointer"
            >
              Remove
            </button>
          </>
        )}
      </div>

      {/* Merge indicator overlay */}
      {isMergeHover && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-green text-white px-2.5 py-1 rounded-full text-[11px] font-bold pointer-events-none shadow-sm z-20 animate-in fade-in duration-100">
          + Merge Under
        </div>
      )}
    </div>
  );
}

function SortableRow({
  item,
  canManage,
  allOptions,
  dragOverState,
  onEdit,
  onStatusChange,
  onDelete,
  onParentChange,
}: {
  item: { problem: ProblemNode; depth: number };
  canManage: boolean;
  allOptions: Problem[];
  dragOverState: { id: string; isMerge: boolean } | null;
  onEdit: (p: Problem) => void;
  onStatusChange: (p: Problem, status: ProblemStatusValue) => void;
  onDelete: (p: Problem) => void;
  onParentChange: (p: Problem, newParentId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.problem.id,
    disabled: !canManage,
  });

  const isMergeTarget = dragOverState?.id === item.problem.id && dragOverState.isMerge;

  const style = {
    transform: CSS.Transform.toString(isMergeTarget ? null : transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} id={`row-${item.problem.id}`} className="relative after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] last:after:hidden">
      <ActiveProblemRow
        problem={item.problem}
        depth={item.depth}
        canManage={canManage}
        dragHandleProps={{ attributes, listeners }}
        isDragging={isDragging}
        allOptions={allOptions}
        dragOverState={dragOverState}
        onEdit={() => onEdit(item.problem)}
        onStatusChange={(status) => onStatusChange(item.problem, status)}
        onDelete={() => onDelete(item.problem)}
        onParentChange={(newParentId) => onParentChange(item.problem, newParentId)}
      />
    </div>
  );
}

export function ActiveProblemTable({
  nodes,
  flatProblems,
  isTableDragging,
  dragOverState,
  allOptions,
  canManage,
  isEditMode,
  onRevert,
  onSaveDraft,
  onPublish,
  isSaving,
  lastAutoSaved,
  onEdit,
  onStatusChange,
  onDelete,
  onParentChange,
}: ActiveProblemTableProps) {
  const ids = useMemo(() => flatProblems.map(item => item.problem.id), [flatProblems]);

  const { setNodeRef } = useDroppable({
    id: 'active-table',
  });

  return (
    <div ref={setNodeRef} className={cn("flex flex-col w-full relative rounded-b-lg transition-colors", isTableDragging ? "overflow-x-hidden" : "overflow-x-auto")}>
      


      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="flex items-center gap-3 px-[14px] py-[9px] bg-amber-500/10 border-b border-amber-400/25 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-amber-700">Editing Order</span>
            <span className="text-[10px] text-amber-600/80 hidden md:inline">
              — Changes are local and not yet visible to other doctors.
            </span>
            {lastAutoSaved && (
              <span className="text-[9px] text-amber-500/70 hidden lg:inline flex-shrink-0">
                Auto-saved {lastAutoSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onRevert}
              disabled={isSaving}
              className="h-[24px] px-2.5 rounded text-[10px] font-semibold text-amber-700 border border-amber-400/50 hover:bg-amber-500/10 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↺ Revert
            </button>
            <button
              onClick={onSaveDraft}
              disabled={isSaving}
              title="Saves your order locally only — does not affect other doctors"
              className="h-[24px] px-2.5 rounded text-[10px] font-semibold text-text-secondary bg-surface-2 border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Draft
            </button>
            <button
              onClick={onPublish}
              disabled={isSaving}
              title="Publishes the order to all co-doctors"
              className="h-[24px] px-2.5 rounded text-[10px] font-semibold bg-accent text-white border border-accent-hover hover:bg-accent-hover shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '…' : 'Publish'}
            </button>
          </div>
        </div>
      )}

      {flatProblems.length === 0 ? (
        <div className="py-8 px-[14px] text-center text-[13px] text-text-muted italic bg-surface rounded-b-lg">
          No active problems recorded.
        </div>
      ) : (
        <>
          <div 
            className="relative grid items-center gap-4 px-[14px] py-2 bg-surface-2 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary rounded-t-lg text-left"
            style={{ gridTemplateColumns: COLUMN_LAYOUT }}
          >
            <div className="w-[22px]" />
            <div className="w-[14px]" />
            <div className="text-left">Problem</div>
            <div className="whitespace-nowrap text-left">Date Added</div>
            <div className="text-left">Status</div>
            <div className="text-left">Nest Under</div>
            <div className="text-left">Actions</div>
          </div>
          <div className="flex flex-col relative min-h-[100px]">
            {isSaving && (
              <div className="absolute inset-0 z-10 bg-surface/40 backdrop-blur-[1.5px] flex items-center justify-center rounded-b-lg pointer-events-auto transition-all duration-200">
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-surface rounded-full shadow-md border border-border/60 animate-in fade-in zoom-in-95 duration-200">
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-accent border-r-transparent animate-spin" />
                  <span className="text-[11px] font-semibold tracking-wide text-text-primary uppercase">Publishing...</span>
                </div>
              </div>
            )}
            <div className={cn("flex flex-col", isSaving && "pointer-events-none opacity-60 transition-opacity duration-200")}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {flatProblems.map((item) => (
                  <SortableRow
                    key={item.problem.id}
                    item={item}
                    canManage={canManage && !isSaving}
                    allOptions={allOptions}
                    dragOverState={dragOverState}
                    onEdit={onEdit}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                    onParentChange={onParentChange}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

