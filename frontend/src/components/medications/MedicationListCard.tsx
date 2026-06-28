'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useMedications } from '@/hooks/useMedications';
import { isRecentlyUpdated, mostRecentMedicationUpdate } from '@/lib/medication-utils';
import { MedicationListCardEmpty } from './MedicationListCardEmpty';
import { MedicationListSkeleton } from './MedicationListSkeleton';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

export function MedicationListCard({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading } = useMedications(patientId);

  const active = data?.data ?? [];

  const mostRecentItem = useMemo(() => {
    if (active.length === 0) return null;
    return active.reduce((latest, current) => 
      new Date(current.updatedAt).getTime() > new Date(latest.updatedAt).getTime() ? current : latest
    , active[0]);
  }, [active]);

  if (isLoading) return <MedicationListSkeleton />;
  if (active.length === 0) return <MedicationListCardEmpty patientId={patientId} />;



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
        <div className="w-[26px] h-[26px] bg-surface-3 rounded-icon flex items-center justify-center text-[12px] flex-shrink-0">💊</div>
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">
              Medications
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
          onClick={() => router.push(`/dashboard/${patientId}/medications`)}
          className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          Manage
        </button>
      </div>

      <div className="w-full">
        {/* Header */}
        <div className="bg-surface-2 border-b border-border grid grid-cols-[1.2fr_1fr_1fr_1.2fr] px-3.5 py-1.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary">Medication</div>
          <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary">Formulation</div>
          <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary">Dose</div>
          <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary">Instructions</div>
        </div>
        {/* Rows */}
        <div className="flex flex-col">
          {active.slice(0, 4).map((m, index) => {
            const isLast = active.length <= 4 && index === active.length - 1;
            return (
              <div 
                key={m.id} 
                className={cn(
                  "grid grid-cols-[1.2fr_1fr_1fr_1.2fr] px-3.5 py-1.5 border-border hover:bg-surface-3 transition-colors items-center",
                  !isLast && "border-b"
                )}
              >
                <div className="text-[12px] text-text-primary font-medium truncate pr-2">{m.name}</div>
                <div className="text-[11px] text-text-secondary truncate pr-2">{m.formulation || '—'}</div>
                <div className="font-mono text-[11px] text-accent font-medium whitespace-nowrap truncate pr-2">{m.dose}</div>
                <div className="text-[11px] text-text-muted truncate">{m.instructions || '—'}</div>
              </div>
            );
          })}
          {active.length > 4 && (
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-in-out",
                isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden">
                {active.slice(4).map((m, index) => {
                  const isLast = index === active.length - 5;
                  return (
                    <div 
                      key={m.id} 
                      className={cn(
                        "grid grid-cols-[1.2fr_1fr_1fr_1.2fr] px-3.5 py-1.5 border-border hover:bg-surface-3 transition-colors items-center",
                        !isLast && "border-b"
                      )}
                    >
                      <div className="text-[12px] text-text-primary font-medium truncate pr-2">{m.name}</div>
                      <div className="text-[11px] text-text-secondary truncate pr-2">{m.formulation || '—'}</div>
                      <div className="font-mono text-[11px] text-accent font-medium whitespace-nowrap truncate pr-2">{m.dose}</div>
                      <div className="text-[11px] text-text-muted truncate">{m.instructions || '—'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {active.length > 4 && (
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
                +{active.length - 4} more
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push(`/dashboard/${patientId}/medications`)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              View full list
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
