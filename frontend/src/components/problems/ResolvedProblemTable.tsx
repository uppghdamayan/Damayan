'use client';

import { cn } from '@/lib/utils';
import type { Problem } from '@/types/problem';

const COLUMN_LAYOUT = '3fr 1.8fr 2.2fr 1.5fr';

interface ResolvedProblemTableProps {
  problems: Problem[];
  canManage: boolean;
  onReactivate: (p: Problem) => void;
  onDelete: (p: Problem) => void;
}

export function ResolvedProblemTable({ problems, canManage, onReactivate, onDelete }: ResolvedProblemTableProps) {
  if (problems.length === 0) return null;

  return (
    <div className="flex flex-col overflow-x-auto w-full">
      <div 
        className="relative grid items-center gap-4 px-[14px] py-2 bg-surface-2 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary text-center"
        style={{ gridTemplateColumns: COLUMN_LAYOUT }}
      >
        <div className="text-left">Problem / Diagnosis</div>
        <div className="text-center">ICD-10 Code</div>
        <div className="text-center">Date Resolved</div>
        <div className="text-center">Actions</div>
      </div>
      <div className="flex flex-col">
        {problems.map((problem) => (
          <div
            key={problem.id}
            className="relative grid items-center gap-4 px-[14px] py-3 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] last:after:hidden bg-surface"
            style={{ gridTemplateColumns: COLUMN_LAYOUT }}
          >
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
                    onClick={() => onReactivate(problem)}
                    className="h-[22px] px-2 rounded text-[10px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer"
                  >
                    Reactivate
                  </button>
                  <button
                    onClick={() => onDelete(problem)}
                    className="h-[22px] px-2 rounded text-[10px] font-semibold bg-red-bg text-red border border-red-border hover:bg-red-bg/80 transition-all duration-150 cursor-pointer"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

