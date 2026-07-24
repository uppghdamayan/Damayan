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

const COLUMN_LAYOUT = '22px 14px 2.5fr 1.2fr 2.2fr 1.1fr 1.8fr 150px';

export type DragOverAction = 'nest' | 'unnest' | 'reorder';

export interface DragOverState {
  id: string;
  action: DragOverAction;
  targetTitle?: string;
}

interface ActiveProblemTableProps {
  nodes: ProblemNode[];
  flatProblems: { problem: ProblemNode; depth: number }[];
  isTableDragging: boolean;
  activeDragItem: { problem: ProblemNode; depth: number } | null;
  dragOverState: DragOverState | null;
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

function getProblemDepth(problems: Problem[], problemId: string): number {
  let depth = 0;
  let curr = problems.find((p) => p.id === problemId);
  while (curr && curr.parentId) {
    depth++;
    curr = problems.find((p) => p.id === curr!.parentId);
  }
  return depth;
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
  dragOverState: DragOverState | null;
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

  const isCurrentTarget = dragOverState?.id === problem.id;
  const isNestHover = isCurrentTarget && dragOverState?.action === 'nest';
  const isUnnestHover = isCurrentTarget && dragOverState?.action === 'unnest';
  const isReorderHover = isCurrentTarget && dragOverState?.action === 'reorder';

  const creator = problem.addedByUser;
  const addedAt = problem.createdAt;

  const getCreatorName = (user: typeof problem.addedByUser) => {
    if (!user) return 'System';
    if (user.role === 'DOCTOR') return `Dr. ${user.lastName}`;
    if (user.role === 'NURSE') return `Nurse ${user.lastName}`;
    return `${user.firstName} ${user.lastName}`;
  };
  const creatorName = getCreatorName(creator);

  const formattedAddedDateTime =
    new Date(addedAt).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' · ' +
    new Date(addedAt).toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  const isOptimistic = problem.id.startsWith('optimistic-');

  return (
    <div
      {...(canManage ? dragHandleProps?.attributes : {})}
      {...(canManage ? dragHandleProps?.listeners : {})}
      className={cn(
        'grid items-center gap-4 px-[14px] py-3 bg-surface transition-all duration-150 animate-row-entry group relative',
        canManage && !isOptimistic && 'cursor-grab active:cursor-grabbing hover:bg-surface-2/60',
        isDragging && 'relative z-10 opacity-40 shadow-sm dragging',
        isReorderHover && 'bg-accent-light/50 border-t-2 border-t-accent',
        isNestHover && 'bg-green-bg/80 border-2 border-dashed border-green-border relative shadow-sm',
        isUnnestHover && 'bg-amber-500/10 border-2 border-dashed border-amber-400/80 relative shadow-sm',
        isOptimistic && 'opacity-50 pointer-events-none'
      )}
      style={{ gridTemplateColumns: COLUMN_LAYOUT }}
    >
      {/* Column 1: Drag handle indicator */}
      <div className="flex items-center justify-center">
        {canManage ? (
          <span
            className="text-border-strong group-hover:text-accent flex-shrink-0 select-none text-[15px] font-bold transition-colors cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-surface-3"
            title="Drag to reorder, nest (drag right), or un-nest (drag left)"
          >
            ⠿
          </span>
        ) : null}
      </div>

      {/* Column 2: Status dot */}
      <div className="flex items-center justify-center">
        <div
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0 transition-colors',
            depth > 0 ? 'bg-accent/60 ring-2 ring-accent/15' : 'bg-accent-mid'
          )}
          title={depth > 0 ? `Sub-problem (Level ${depth})` : 'Top-level problem'}
        />
      </div>

      {/* Column 3: Problem name and code with visual tree branch connectors */}
      <div className="flex items-center gap-2 truncate text-text-primary min-w-0">
        {depth > 0 && (
          <div className="flex items-center flex-shrink-0" style={{ width: `${depth * 20}px` }}>
            {Array.from({ length: depth - 1 }).map((_, i) => (
              <span key={i} className="w-[20px] h-6 inline-block border-r border-border/40" />
            ))}
            <div className="w-[20px] h-6 flex items-center justify-center relative">
              <span className="absolute left-0 top-0 bottom-1/2 w-2.5 border-l-2 border-b-2 border-accent/40 rounded-bl-[4px]" />
            </div>
          </div>
        )}

        <span className={cn('text-[13px] truncate', depth > 0 ? 'font-medium text-text-primary' : 'font-semibold text-text-primary')}>
          {problem.title}
        </span>

        {isOptimistic && (
          <div className="h-3 w-3 rounded-full border-2 border-accent border-r-transparent animate-spin flex-shrink-0 ml-1" />
        )}

        {problem.icdCode && (
          <span className="font-mono text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border flex-shrink-0">
            {problem.icdCode}
          </span>
        )}

        {depth > 0 && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-accent/80 bg-accent/5 px-1.5 py-0.2 rounded border border-accent/15 flex-shrink-0 hidden @lg:inline">
            Sub-problem
          </span>
        )}
      </div>

      {/* Column 4: Date of Diagnosis */}
      <div className="text-[12px] font-mono text-text-secondary whitespace-nowrap text-left">
        {problem.diagnosisDate
          ? new Date(problem.diagnosisDate).toLocaleDateString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '--'}
      </div>

      {/* Column 5: Added By */}
      <div className="flex flex-col text-[11px] leading-tight text-text-secondary text-left min-w-0">
        <span className="font-semibold text-text-primary truncate" title={creatorName}>
          {creatorName}
        </span>
        <span className="text-[10px] text-text-muted font-mono whitespace-nowrap mt-0.5">
          {formattedAddedDateTime}
        </span>
      </div>

      {/* Column 6: Status */}
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

      {/* Column 7: Nest Under with Visual Option Hierarchy & Quick Un-nest */}
      <div className="flex items-center gap-1 justify-start">
        <select
          disabled={!canManage}
          value={problem.parentId || ''}
          onChange={(e) => onParentChange(e.target.value || null)}
          className={cn(
            'h-6 w-full max-w-[140px] px-1 bg-surface-2 border border-border rounded text-[11px] text-text-primary outline-none cursor-pointer focus:border-accent disabled:bg-surface-2 disabled:cursor-not-allowed truncate transition-colors',
            problem.parentId && 'border-accent/40 bg-accent/5 font-medium'
          )}
        >
          <option value="">None (Top Level)</option>
          {selectableParents.map((p) => {
            const parentDepth = getProblemDepth(allOptions, p.id);
            const indent = parentDepth > 0 ? `${'\u00A0\u00A0'.repeat(parentDepth)}└─ ` : '';
            return (
              <option key={p.id} value={p.id}>
                {indent}{p.title}
              </option>
            );
          })}
        </select>

        {problem.parentId && canManage && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onParentChange(null);
            }}
            title="Un-nest problem (Move to Top Level)"
            className="h-6 px-1.5 rounded text-[10px] font-semibold text-text-muted hover:text-amber-700 bg-surface-2 hover:bg-amber-500/10 border border-border hover:border-amber-400/50 transition-all cursor-pointer flex items-center gap-0.5 flex-shrink-0"
          >
            <span>✕</span>
            <span className="hidden @xl:inline">Un-nest</span>
          </button>
        )}
      </div>

      {/* Column 8: Actions */}
      <div className="flex items-center justify-end pr-4 gap-1.5">
        {canManage && (
          <>
            <button
              onClick={onEdit}
              className="h-[22px] px-2 rounded text-[10px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer"
            >
              Edit
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

      {/* Floating Action Badge Overlays */}
      {isNestHover && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-green text-white px-3 py-1 rounded-full text-[11px] font-bold pointer-events-none shadow-md z-20 flex items-center gap-1.5 animate-in fade-in duration-100">
          <span>+</span> Nest under &quot;{problem.title}&quot;
        </div>
      )}
      {isUnnestHover && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-amber-600 text-white px-3 py-1 rounded-full text-[11px] font-bold pointer-events-none shadow-md z-20 flex items-center gap-1.5 animate-in fade-in duration-100">
          <span>↖</span> Un-nest to Top Level
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
  dragOverState: DragOverState | null;
  onEdit: (p: Problem) => void;
  onStatusChange: (p: Problem, status: ProblemStatusValue) => void;
  onDelete: (p: Problem) => void;
  onParentChange: (p: Problem, newParentId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.problem.id,
    disabled: !canManage,
  });

  const isTargetNestOrUnnest = dragOverState?.id === item.problem.id && (dragOverState.action === 'nest' || dragOverState.action === 'unnest');

  const style = {
    transform: CSS.Transform.toString(isTargetNestOrUnnest ? null : transform),
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
            <span className="text-[10px] text-amber-600/80 hidden @md:inline">
              — Changes are local and not yet visible to other doctors.
            </span>
            {lastAutoSaved && (
              <span className="text-[9px] text-amber-500/70 hidden @lg:inline flex-shrink-0">
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
            <div className="whitespace-nowrap text-left">Date of Diagnosis</div>
            <div className="text-left">Added By</div>
            <div className="text-left">Status</div>
            <div className="text-left">Nest Under</div>
            <div className="text-right pr-4">Actions</div>
          </div>
          <div className="flex flex-col relative min-h-[100px]">
            {/* Publishing is surfaced inline on the Publish button ("…" spinner) per
                design-standard.md §7.3 — no blur/opacity overlay, so the list stays
                readable. Row controls disable via `canManage && !isSaving` below to
                block concurrent edits without freezing the whole section. */}
            <div className="flex flex-col">
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

