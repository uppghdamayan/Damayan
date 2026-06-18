'use client';

import { cn } from '@/lib/utils';
import type { Problem } from '@/types/problem';

interface ResolvedProblemTableProps {
  problems: Problem[];
  canManage: boolean;
  onReactivate: (p: Problem) => void;
  onDelete: (p: Problem) => void;
}

export function ResolvedProblemTable({ problems, canManage, onReactivate, onDelete }: ResolvedProblemTableProps) {
  if (problems.length === 0) return null;

  return (
    <div className="flex flex-col">
      <div 
        className="grid items-center gap-4 px-[14px] py-2 bg-surface-2 border-b border-border text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary text-left"
        style={{ gridTemplateColumns: '1fr 120px 140px 130px' }}
      >
        <div className="text-left">Problem / Diagnosis</div>
        <div className="text-left">ICD-10 Code</div>
        <div className="text-left">Date Resolved</div>
        <div className="text-left">Actions</div>
      </div>
      <div className="flex flex-col">
        {problems.map((problem) => (
          <div
            key={problem.id}
            className="grid items-center gap-4 px-[14px] py-3 border-b border-border last:border-b-0 bg-surface"
            style={{ gridTemplateColumns: '1fr 120px 140px 130px' }}
          >
            <div className="text-[13px] font-bold text-text-muted line-through truncate">
              {problem.title}
            </div>
            
            <div className="font-mono text-[11px] text-text-muted">
              {problem.icdCode ? (
                <span className="bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                  {problem.icdCode}
                </span>
              ) : (
                '—'
              )}
            </div>

            <div className="text-[12px] font-mono text-text-muted whitespace-nowrap">
              {new Date(problem.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>

            <div className="flex items-center gap-1.5">
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

