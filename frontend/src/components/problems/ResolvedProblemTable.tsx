'use client';

import { useMemo } from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { Problem } from '@/types/problem';

const COLUMN_LAYOUT = '22px 14px 2.5fr 1.2fr 2.2fr 1.1fr 150px';

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
  const creator = problem.addedByUser;
  const addedAt = problem.createdAt;

  const getCreatorName = (user: typeof problem.addedByUser) => {
    if (!user) return 'System';
    if (user.role === 'DOCTOR') return `Dr. ${user.lastName}`;
    if (user.role === 'NURSE') return `Nurse ${user.lastName}`;
    return `${user.firstName} ${user.lastName}`;
  };
  const creatorName = getCreatorName(creator);

  const formattedAddedDateTime = new Date(addedAt).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' · ' + new Date(addedAt).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const style = {
    gridTemplateColumns: COLUMN_LAYOUT,
  };

  return (
    <div
      style={style}
      className={cn(
        "relative grid items-center gap-4 px-[14px] py-3 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] last:after:hidden bg-surface transition-all duration-150 animate-row-entry",
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

      {/* Column 2: Status dot */}
      <div className="flex items-center justify-center">
        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-text-muted/40" title="Resolved" />
      </div>

      {/* Column 3: Problem name */}
      <div className="flex items-center gap-2 truncate text-text-muted line-through">
        <span className="text-[13px] font-semibold truncate">{problem.title}</span>
      </div>
      
      {/* Column 4: Date of Diagnosis */}
      <div className="text-[12px] font-mono text-text-muted whitespace-nowrap text-left opacity-80">
        {problem.diagnosisDate ? new Date(problem.diagnosisDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
      </div>

      {/* Column 5: Added By */}
      <div className="flex flex-col text-[11px] leading-tight text-text-muted text-left min-w-0 opacity-75">
        <span className="font-semibold truncate" title={creatorName}>
          {creatorName}
        </span>
        <span className="text-[10px] font-mono whitespace-nowrap mt-0.5">
          {formattedAddedDateTime}
        </span>
      </div>

      {/* Column 6: Status */}
      <div className="flex justify-start opacity-70">
        <select
          disabled
          value="RESOLVED"
          className="h-6 w-full max-w-[90px] px-1 bg-surface-2 border border-border rounded text-[11px] text-text-muted outline-none cursor-not-allowed"
        >
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      {/* Column 7: Actions */}
      <div className="flex items-center justify-end pr-4 gap-1.5">
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

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex flex-col overflow-x-auto w-full transition-colors relative rounded-b-lg"
      )}
    >


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
            <div className="w-[14px]" />
            <div className="text-left">Problem</div>
            <div className="whitespace-nowrap text-left">Date of Diagnosis</div>
            <div className="text-left">Added By</div>
            <div className="text-left">Status</div>
            <div className="text-right pr-4">Actions</div>
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
