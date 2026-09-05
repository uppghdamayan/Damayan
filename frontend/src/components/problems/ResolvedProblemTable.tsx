'use client';

import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { getCreatorName } from '@/lib/problem-utils';
import type { Problem } from '@/types/problem';

const COLUMN_LAYOUT = '22px 14px minmax(190px, 3.2fr) minmax(110px, 1.1fr) minmax(130px, 1.6fr) minmax(85px, 0.9fr) 130px';

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
        "relative grid items-center gap-4 px-[14px] py-3 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] last:after:hidden bg-surface transition-all duration-150 animate-row-entry min-w-0",
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
      <div className="flex items-center gap-2 text-text-muted line-through decoration-text-muted/65 decoration-1 min-w-0">
        <span className="text-[13px] font-semibold break-words [overflow-wrap:anywhere] whitespace-normal leading-snug min-w-0">{problem.title}</span>
      </div>
      
      {/* Column 4: Date of Diagnosis */}
      <div className="text-[12px] font-mono text-text-muted whitespace-nowrap text-left opacity-80 min-w-0">
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
      <div className="flex justify-start opacity-70 min-w-0">
        <select
          disabled
          value="RESOLVED"
          className="h-6 w-full max-w-[90px] px-1 bg-surface-2 border border-border rounded text-[11px] text-text-muted outline-none cursor-not-allowed"
        >
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      {/* Column 7: Actions */}
      <div className="flex items-center justify-end pr-4 gap-1.5 min-w-0">
        {canManage && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onReactivate(); }}
              className="h-[22px] px-2 rounded text-[10px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer flex-shrink-0"
            >
              Reactivate
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Remove from list — different from Resolve; the problem is taken off the list entirely"
              className="h-[22px] px-2 rounded text-[10px] font-semibold bg-red-bg text-red border border-red-border hover:bg-red-bg/80 transition-all duration-150 cursor-pointer flex-shrink-0"
            >
              Remove from list
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
        <div className="min-w-[760px] w-full flex flex-col">
          <div 
            className="relative grid items-center gap-4 px-[14px] py-2 bg-surface-2 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary text-left"
            style={{ gridTemplateColumns: COLUMN_LAYOUT }}
          >
            <div className="w-[22px]" />
            <div className="w-[14px]" />
            <div className="text-left min-w-0">Problem</div>
            <div className="whitespace-nowrap text-left min-w-0">Date of Diagnosis</div>
            <div className="text-left min-w-0">Added By</div>
            <div className="text-left min-w-0">Status</div>
            <div className="text-right pr-4 min-w-0">Actions</div>
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
        </div>
      )}
    </div>
  );
}
