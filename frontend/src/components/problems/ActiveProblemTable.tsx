'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { isDescendant } from '@/lib/problem-utils';
import type { Problem, ProblemNode, ProblemStatusValue } from '@/types/problem';

const COLUMN_LAYOUT = '22px 14px 3fr 1.8fr 1.5fr 2.2fr 1.5fr';

interface ActiveProblemTableProps {
  nodes: ProblemNode[];
  allOptions: Problem[];
  canManage: boolean;
  onEdit: (p: Problem) => void;
  onStatusChange: (p: Problem, status: ProblemStatusValue) => void;
  onDelete: (p: Problem) => void;
  onReorder: (items: { id: string; sortOrder: number }[]) => void;
  onParentChange: (p: Problem, newParentId: string | null) => void;
}

function ActiveProblemRow({
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
      className={cn(
        'grid items-center gap-4 px-[14px] py-3 border-b border-border last:border-b-0 bg-surface transition-all duration-150',
        isDragging && 'relative z-10 opacity-40 shadow-sm dragging',
        isReorderHover && 'bg-accent-light border-t-2 border-t-accent',
        isMergeHover && 'bg-green-bg border-2 border-dashed border-green-border relative'
      )}
      style={{ gridTemplateColumns: COLUMN_LAYOUT }}
    >
      {/* Column 1: Drag handle */}
      <div className="flex items-center justify-center">
        {canManage && dragHandleProps ? (
          <span
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
            className="text-border-strong cursor-grab active:cursor-grabbing touch-none flex-shrink-0 select-none text-[15px] font-bold"
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
      <div className="text-[12px] font-mono text-text-secondary whitespace-nowrap text-center">
        {new Date(problem.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>

      {/* Column 5: Status */}
      <div className="flex justify-center">
        <select
          disabled={!canManage}
          value={problem.status}
          onChange={(e) => onStatusChange(e.target.value as ProblemStatusValue)}
          className="h-6 w-full max-w-[90px] px-1 bg-surface-2 border border-border rounded text-[11px] text-text-primary outline-none cursor-pointer focus:border-accent disabled:bg-surface-2 disabled:cursor-not-allowed"
        >
          <option value="ACTIVE">Active</option>
          <option value="RESOLVED">Resolved</option>
          <option value="REMOVED">Removed</option>
        </select>
      </div>

      {/* Column 6: Nest Under */}
      <div className="flex justify-center">
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
      <div className="flex items-center justify-center gap-1.5">
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} id={`row-${item.problem.id}`}>
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
  allOptions,
  canManage,
  onEdit,
  onStatusChange,
  onDelete,
  onReorder,
  onParentChange,
}: ActiveProblemTableProps) {
  const [dragOverState, setDragOverState] = useState<{ id: string; isMerge: boolean } | null>(null);

  // Track global pointer coordinates to check relative x offset within elements
  const pointerPosition = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      pointerPosition.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const flatProblems = useMemo(() => {
    const list: { problem: ProblemNode; depth: number }[] = [];
    const traverse = (nodesList: ProblemNode[], depth: number) => {
      nodesList.forEach(node => {
        list.push({ problem: node, depth });
        traverse(node.children, depth + 1);
      });
    };
    traverse(nodes, 0);
    return list;
  }, [nodes]);

  const ids = useMemo(() => flatProblems.map(item => item.problem.id), [flatProblems]);

  const findProblemById = (id: string): ProblemNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const child = node.children.find(c => c.id === id);
      if (child) return child;
    }
    return undefined;
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { over } = event;
    if (!over) {
      setDragOverState(null);
      return;
    }
    const overElement = document.getElementById(`row-${over.id}`);
    if (overElement) {
      const rect = overElement.getBoundingClientRect();
      const x = pointerPosition.current.x - rect.left;
      const isMerge = x > 150;
      setDragOverState({ id: over.id as string, isMerge });
    } else {
      setDragOverState(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDragOverState(null);
    if (!over || active.id === over.id) return;

    const activeProblem = findProblemById(active.id as string);
    const targetProblem = findProblemById(over.id as string);
    if (!activeProblem || !targetProblem) return;

    const overElement = document.getElementById(`row-${over.id}`);
    let isMerge = false;
    if (overElement) {
      const rect = overElement.getBoundingClientRect();
      const x = pointerPosition.current.x - rect.left;
      isMerge = x > 150;
    }

    if (isMerge) {
      // Nesting (Merge) - target's parent if target is already nested, otherwise target itself
      const targetParentId = targetProblem.parentId;
      const newParentId = targetParentId || targetProblem.id;

      if (activeProblem.id === newParentId) return;
      if (isDescendant(allOptions, newParentId, activeProblem.id)) {
        toast.error('Cannot nest a problem under its own descendant.');
        return;
      }

      try {
        await onParentChange(activeProblem, newParentId);
        toast.success(`'${activeProblem.title}' nested under '${targetParentId ? 'sibling parent' : targetProblem.title}'.`);
      } catch (err) {
        // Parent screen handles mutation errors
      }
    } else {
      // Reordering - adopt target's parent level
      if (activeProblem.parentId !== targetProblem.parentId) {
        if (targetProblem.parentId && isDescendant(allOptions, targetProblem.parentId, activeProblem.id)) {
          toast.error('Cannot nest a problem under its own descendant.');
          return;
        }
        try {
          await onParentChange(activeProblem, targetProblem.parentId);
        } catch (err) {
          return;
        }
      }

      const oldIndex = flatProblems.findIndex((p) => p.problem.id === active.id);
      const newIndex = flatProblems.findIndex((p) => p.problem.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedList = arrayMove(flatProblems, oldIndex, newIndex);
        onReorder(
          reorderedList.map((item, index) => ({
            id: item.problem.id,
            sortOrder: index,
          }))
        );
      }
    }
  };

  return (
    <div className="flex flex-col overflow-x-auto w-full">
      <div 
        className="grid items-center gap-4 px-[14px] py-2 bg-surface-2 border-b border-border text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary rounded-t-lg text-center"
        style={{ gridTemplateColumns: COLUMN_LAYOUT }}
      >
        <div className="w-[22px]" />
        <div className="w-[14px]" />
        <div className="text-left">Problem</div>
        <div className="whitespace-nowrap text-center">Date Added</div>
        <div className="text-center">Status</div>
        <div className="text-center">Nest Under</div>
        <div className="text-center">Actions</div>
      </div>
      <div className="flex flex-col">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDragOverState(null)}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {flatProblems.map((item) => (
              <SortableRow
                key={item.problem.id}
                item={item}
                canManage={canManage}
                allOptions={allOptions}
                dragOverState={dragOverState}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                onParentChange={onParentChange}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
