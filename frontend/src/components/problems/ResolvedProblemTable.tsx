'use client';

import { useMemo } from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { Problem } from '@/types/problem';

const COLUMN_LAYOUT = '22px 3fr 1.8fr 2.2fr 1.5fr';

interface ResolvedProblemTableProps {
  problems: Problem[];
  canManage: boolean;
  onReactivate: (p: Problem) => void;
  onDelete: (p: Problem) => void;
}

export function ResolvedRow({ 
  problem, 
  canManage, 
  onReactivate, 
  onDelete,
  dragHandleProps,
  isDragging
}: { 
  problem: Problem, 
  canManage: boolean, 
  onReactivate: () => void, 
  onDelete: () => void,
  dragHandleProps?: { attributes: any; listeners: any },
  isDragging?: boolean
}) {
  const style = {
    gridTemplateColumns: COLUMN_LAYOUT,
  };

  return (
    <div
      style={style}
      className={cn(
        "relative grid items-center gap-4 px-[14px] py-3 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] last:after:hidden bg-surface transition-all duration-150",
        canManage && "cursor-grab active:cursor-grabbing",
        isDragging && "relative z-10 opacity-40 shadow-sm dragging"
      )}
      {...(canManage ? dragHandleProps?.attributes : {})}
      {...(canManage ? dragHandleProps?.listeners : {})}
    >
      {/* Column 1: Drag handle indicator */}
      <div className="flex items-center justify-center">
        {canManage ? (
          <span
            className="text-border-strong flex-shrink-0 select-none text-[15px] font-bold"
            title="Drag to reactivate"
          >
            ⠿
          </span>
        ) : null}
      </div>

      <div className="text-[13px] font-bold text-text-muted line-through truncate">
        {problem.title}
      </div>
      
      <div className="font-mono text-[11px] text-text-muted text-center">
        {problem.icdCode ? (
          <span className="bg-surface-2 px-1.5 py-0.5 rounded border border-border">
            {problem.icdCode}
          </span>
        ) : (
          '—'
        )}
      </div>

      <div className="text-[12px] font-mono text-text-muted whitespace-nowrap text-center">
        {new Date(problem.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {canManage && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onReactivate(); }}
              className="h-[22px] px-2 rounded text-[10px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer"
            >
              Reactivate
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="h-[22px] px-2 rounded text-[10px] font-semibold bg-red-bg text-red border border-red-border hover:bg-red-bg/80 transition-all duration-150 cursor-pointer"
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SortableResolvedRow({ problem, canManage, onReactivate, onDelete }: { problem: Problem, canManage: boolean, onReactivate: () => void, onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: problem.id,
    data: { type: 'resolved' },
    disabled: !canManage,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ResolvedRow 
        problem={problem}
        canManage={canManage}
        onReactivate={onReactivate}
        onDelete={onDelete}
        isDragging={isDragging}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
}

export function ResolvedProblemTable({ problems, canManage, onReactivate, onDelete }: ResolvedProblemTableProps) {
  const ids = useMemo(() => problems.map(p => p.id), [problems]);

  const { setNodeRef } = useDroppable({
    id: 'resolved-table',
  });

  const { active, over } = useDndContext();
  const isOverTableOrItem = over?.id === 'resolved-table' || ids.includes(over?.id as string);
  const isDraggingOverFromActive = isOverTableOrItem && active?.data.current?.type !== 'resolved';

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex flex-col overflow-x-auto w-full transition-colors relative rounded-b-lg",
        isDraggingOverFromActive && "outline-dashed outline-2 outline-green outline-offset-[-2px]"
      )}
    >
      {/* Drop overlay */}
      {isDraggingOverFromActive && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface/60 backdrop-blur-[3px] rounded-b-lg pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-green-light border-2 border-green flex items-center justify-center text-green text-xl font-bold mb-2">
            +
          </div>
          <div className="text-green font-bold text-[13px]">
            Drop to mark as Resolved
          </div>
        </div>
      )}

      {problems.length === 0 ? (
        <div className="py-8 px-[14px] text-center text-[13px] text-text-muted italic bg-surface rounded-b-lg">
          No resolved problems.
        </div>
      ) : (
        <>
          <div 
            className="relative grid items-center gap-4 px-[14px] py-2 bg-surface-2 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary text-center"
            style={{ gridTemplateColumns: COLUMN_LAYOUT }}
          >
            <div className="w-[22px]" />
            <div className="text-left">Problem / Diagnosis</div>
            <div className="text-center">ICD-10 Code</div>
            <div className="text-center">Date Resolved</div>
            <div className="text-center">Actions</div>
          </div>
          <div className="flex flex-col">
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {problems.map((problem) => (
                <SortableResolvedRow 
                  key={problem.id} 
                  problem={problem} 
                  canManage={canManage} 
                  onReactivate={() => onReactivate(problem)} 
                  onDelete={() => onDelete(problem)} 
                />
              ))}
            </SortableContext>
          </div>
        </>
      )}
    </div>
  );
}
