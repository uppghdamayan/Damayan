'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useProblems } from '@/hooks/useProblems';
import { isRecentlyUpdated, mostRecentUpdate } from '@/lib/problem-utils';
import { ProblemListCardEmpty } from './ProblemListCardEmpty';
import { ProblemListSkeleton } from './ProblemListSkeleton';

const statusDotClass: Record<string, string> = {
  ACTIVE: 'bg-accent-mid',
  RESOLVED: 'bg-border-strong',
  REMOVED: 'bg-border-strong',
};

export function ProblemListCard({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { data, isLoading } = useProblems(patientId);

  if (isLoading) return <ProblemListSkeleton />;

  const allProblems = data?.data ?? [];
  if (allProblems.length === 0) return <ProblemListCardEmpty />;

  const active = allProblems.filter((p) => p.status === 'ACTIVE');
  const lastUpdated = mostRecentUpdate(active.length > 0 ? active : allProblems);
  const recent = isRecentlyUpdated(lastUpdated);

  return (
    <div
      className={cn(
        'bg-surface border rounded-card shadow-card overflow-hidden',
        recent ? 'border-l-[3px] border-l-accent border-border' : 'border-border',
      )}
    >
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] bg-surface-3 rounded-md flex items-center justify-center text-[13px]">
            📋
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">
            Problem List
          </span>
          {lastUpdated && (
            <span className={cn('font-mono text-[9px]', recent ? 'text-text-secondary' : 'text-text-muted')}>
              {recent && <span className="w-2 h-2 rounded-full bg-accent-mid inline-block mr-1" />}
              {new Date(lastUpdated).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <button
          onClick={() => router.push(`/dashboard/${patientId}/problems`)}
          className="h-7 px-3 bg-surface-2 text-text-secondary border border-border rounded-md text-[11px] font-semibold cursor-pointer hover:bg-surface-3 hover:text-text-primary transition-colors"
        >
          Manage
        </button>
      </div>

      {active.length === 0 ? (
        <div className="py-5 px-3.5 text-xs text-text-muted text-center">
          No active problems. {allProblems.length} resolved/removed entr{allProblems.length === 1 ? 'y' : 'ies'} on file.
        </div>
      ) : (
        <div className="flex flex-col">
          {active.slice(0, 6).map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-3.5 py-2 border-b border-border last:border-0">
              <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusDotClass[p.status])} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-text-primary font-medium truncate">{p.title}</div>
                <div className="font-mono text-[10px] text-text-muted mt-0.5 truncate">
                  {p.icdCode ? `${p.icdCode} · ` : ''}Since {new Date(p.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-0.5 rounded flex-shrink-0 bg-accent-light text-accent-hover border border-accent">
                {p.status}
              </span>
            </div>
          ))}
          {active.length > 6 && (
            <div className="px-3.5 py-2 text-[11px] text-text-muted text-center border-t border-border">
              +{active.length - 6} more — view full list
            </div>
          )}
        </div>
      )}
    </div>
  );
}
