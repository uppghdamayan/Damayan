'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useProblems } from '@/hooks/useProblems';
import { isRecentlyUpdated, mostRecentUpdate, buildProblemTree } from '@/lib/problem-utils';
import type { ProblemNode } from '@/types/problem';
import { ProblemListCardEmpty } from './ProblemListCardEmpty';
import { ProblemListSkeleton } from './ProblemListSkeleton';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

const statusDotClass: Record<string, string> = {
  ACTIVE: 'bg-accent-mid',
  RESOLVED: 'bg-border-strong',
  REMOVED: 'bg-border-strong',
};

export function ProblemListCard({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading } = useProblems(patientId);

  const allProblems = data?.data ?? [];

  const active = useMemo(() => allProblems.filter((p) => p.status === 'ACTIVE'), [allProblems]);

  const flatActiveProblems = useMemo(() => {
    const tree = buildProblemTree(active);
    const list: { problem: ProblemNode; depth: number }[] = [];
    const traverse = (nodes: ProblemNode[], depth: number) => {
      nodes.forEach(node => {
        list.push({ problem: node, depth });
        traverse(node.children, depth + 1);
      });
    };
    traverse(tree, 0);
    return list;
  }, [active]);

  const listToCheck = active.length > 0 ? active : allProblems;
  const mostRecentItem = useMemo(() => {
    if (listToCheck.length === 0) return null;
    return listToCheck.reduce((latest, current) => 
      new Date(current.updatedAt).getTime() > new Date(latest.updatedAt).getTime() ? current : latest
    , listToCheck[0]);
  }, [listToCheck]);

  if (isLoading) return <ProblemListSkeleton />;
  if (allProblems.length === 0) return <ProblemListCardEmpty />;



  const lastUpdated = mostRecentItem?.updatedAt || null;
  const recent = isRecentlyUpdated(lastUpdated);

  return (
    <div
      className={cn(
        'bg-surface border rounded-card shadow-card overflow-hidden',
        recent ? 'border-l-[3px] border-l-accent border-border' : 'border-border',
      )}
    >
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex items-center gap-2.5">
        <div className="w-[26px] h-[26px] bg-surface-3 rounded-icon flex items-center justify-center text-[12px] flex-shrink-0">
          📋
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">
              Problem List
            </span>
            {lastUpdated && (
              <span className={cn('font-mono text-[9px] normal-case font-normal', recent ? 'text-text-secondary' : 'text-text-muted')}>
                {recent && <span className="w-2 h-2 rounded-full bg-accent-mid inline-block mr-1" />}
                Updated {new Date(lastUpdated).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          {mostRecentItem?.addedByUser && (
            <span className="text-[9px] text-text-muted mt-0.5 normal-case tracking-normal">
              Last updated by: <span className="font-medium text-text-secondary">{mostRecentItem.addedByUser.firstName} {mostRecentItem.addedByUser.lastName}</span>
            </span>
          )}
        </div>
        <button
          onClick={() => router.push(`/dashboard/${patientId}/problems`)}
          className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
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
          {flatActiveProblems.slice(0, 4).map((item, index) => {
            const isLast = flatActiveProblems.length <= 4 && index === flatActiveProblems.length - 1;
            const p = item.problem;
            return (
              <div key={p.id} className={cn("flex items-center gap-2 px-3.5 py-1.5 border-border", !isLast && "border-b")}>
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusDotClass[p.status])} />
                <div 
                  className="flex-1 min-w-0"
                  style={item.depth > 0 ? { paddingLeft: `${item.depth * 20}px` } : undefined}
                >
                  <div className="text-[12px] text-text-primary font-medium truncate">
                    {item.depth > 0 && <span className="font-mono text-text-muted mr-1 select-none">↳</span>}
                    {p.title}
                  </div>
                  <div className={cn("font-mono text-[10px] text-text-muted mt-0.5 truncate", item.depth > 0 && "ml-[18px]")}>
                    {p.icdCode ? `${p.icdCode} · ` : ''}Since {new Date(p.diagnosisDate || p.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] flex-shrink-0 bg-accent-light text-accent-hover border border-accent">
                  {p.status}
                </span>
              </div>
            );
          })}
          {flatActiveProblems.length > 4 && (
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-in-out",
                isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden">
                {flatActiveProblems.slice(4).map((item, index) => {
                  const isLast = index === flatActiveProblems.length - 5;
                  const p = item.problem;
                  return (
                    <div key={p.id} className={cn("flex items-center gap-2 px-3.5 py-1.5 border-border", !isLast && "border-b")}>
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusDotClass[p.status])} />
                      <div 
                        className="flex-1 min-w-0"
                        style={item.depth > 0 ? { paddingLeft: `${item.depth * 20}px` } : undefined}
                      >
                        <div className="text-[12px] text-text-primary font-medium truncate">
                          {item.depth > 0 && <span className="font-mono text-text-muted mr-1 select-none">↳</span>}
                          {p.title}
                        </div>
                        <div className={cn("font-mono text-[10px] text-text-muted mt-0.5 truncate", item.depth > 0 && "ml-[18px]")}>
                          {p.icdCode ? `${p.icdCode} · ` : ''}Since {new Date(p.diagnosisDate || p.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] flex-shrink-0 bg-accent-light text-accent-hover border border-accent">
                        {p.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {flatActiveProblems.length > 4 && (
            <div className="px-3.5 py-2 flex items-center justify-between border-t border-border bg-surface-2/30">
              {isExpanded ? (
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-hover transition-colors cursor-pointer"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  Collapse
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-hover transition-colors cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  +{flatActiveProblems.length - 4} more
                </button>
              )}
              <button
                type="button"
                onClick={() => router.push(`/dashboard/${patientId}/problems`)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                View full list
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
