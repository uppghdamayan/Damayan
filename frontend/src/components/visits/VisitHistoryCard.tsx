'use client';

import { useEffect, useRef } from 'react';
import { useVisitsInfinite } from '@/hooks/useVisitsInfinite';
import { Spinner } from '@/components/ui/spinner';
import type { Visit } from '@/types/visit';
import { cn } from '@/lib/utils';

function VisitRow({ visit }: { visit: Visit }) {
  const dt = new Date(visit.visitDatetime);
  const dateStr = dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = dt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const physician = visit.physician
    ? `Dr. ${visit.physician.lastName}, ${visit.physician.firstName}`
    : 'Unknown Physician';
  const notePreview = visit.initialNote?.chiefComplaint
    ? `CC: ${visit.initialNote.chiefComplaint}`
    : visit.progressNote?.subjective?.slice(0, 80)
    ? visit.progressNote.subjective.slice(0, 80) + '…'
    : null;

  const statusClasses = visit.status === 'PUBLISHED' 
    ? 'bg-purple-bg text-purple border-purple-border' 
    : 'bg-amber-bg text-amber border-amber-border';

  return (
    <div className="px-3.5 py-2 border-b border-border flex gap-3 items-start">
      {/* Date column */}
      <div className="w-[90px] shrink-0">
        <div className="text-xs font-semibold text-text-primary">{dateStr}</div>
        <div className="text-[11px] text-text-muted font-mono">{timeStr}</div>
      </div>

      {/* Detail column */}
      <div className="flex-1 min-w-0">
        <div className="flex gap-1.5 items-center flex-wrap mb-1">
          <span className="text-[12px] font-medium text-text-primary">{physician}</span>
          <span className={cn(
            "text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border inline-flex items-center",
            visit.visitType === 'INITIAL' 
              ? 'bg-blue-bg text-blue border-blue-border' 
              : 'bg-accent-light text-accent-hover border-accent'
          )}>
            {visit.visitType === 'INITIAL' ? 'Initial' : 'Progress'}
          </span>
          <span className={cn(
            "text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border inline-flex items-center",
            statusClasses
          )}>
            {visit.status}
          </span>
        </div>
        {notePreview && (
          <div className="text-[11px] text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis mb-1.5">
            {notePreview}
          </div>
        )}
        
        {/* Render Diffs */}
        {visit.problemChanges && (visit.problemChanges.added.length > 0 || visit.problemChanges.removed.length > 0) && (
          <div className="flex flex-wrap gap-1 mb-1 items-center">
            <span className="text-[10px] text-text-muted uppercase tracking-wide mr-1">Problems:</span>
            {visit.problemChanges.added.map((p, i) => (
              <span key={`p-a-${i}`} className="text-[10px] bg-green-bg text-green border border-green-border px-1.5 py-[1px] rounded flex items-center">
                + {p.title}
              </span>
            ))}
            {visit.problemChanges.removed.map((p, i) => (
              <span key={`p-r-${i}`} className="text-[10px] bg-red-bg text-red border border-red-border px-1.5 py-[1px] rounded flex items-center line-through">
                - {p.title}
              </span>
            ))}
          </div>
        )}

        {visit.medicationChanges && (visit.medicationChanges.added.length > 0 || visit.medicationChanges.removed.length > 0) && (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[10px] text-text-muted uppercase tracking-wide mr-1">Meds:</span>
            {visit.medicationChanges.added.map((m, i) => (
              <span key={`m-a-${i}`} className="text-[10px] bg-green-bg text-green border border-green-border px-1.5 py-[1px] rounded flex items-center">
                + {m.name}
              </span>
            ))}
            {visit.medicationChanges.removed.map((m, i) => (
              <span key={`m-r-${i}`} className="text-[10px] bg-red-bg text-red border border-red-border px-1.5 py-[1px] rounded flex items-center line-through">
                - {m.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function VisitHistoryCard({ patientId }: { patientId: string }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useVisitsInfinite(patientId);

  const visits = data?.pages.flatMap((p) => p.data) ?? [];
  const total  = data?.pages[0]?.meta.total ?? 0;

  // Intersection Observer for automatic load-more
  const loaderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loaderRef.current || !hasNextPage) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) fetchNextPage(); },
      { threshold: 0.1 }
    );
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasNextPage, fetchNextPage]);

  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
      {/* Card header */}
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex items-center gap-2.5">
        <div className="w-[26px] h-[26px] bg-surface-3 rounded-icon flex items-center justify-center text-[12px] flex-shrink-0">🗒</div>
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-primary flex-1">
          Visit History
          {total > 0 && (
            <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border inline-flex items-center bg-accent-light text-accent border-accent ml-2">
              {total} visit{total !== 1 ? 's' : ''}
            </span>
          )}
        </span>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="px-3.5 py-4 text-xs text-text-muted">Loading visit history…</div>
      ) : visits.length === 0 ? (
        <div className="py-5 px-3.5 text-xs text-text-muted text-center">
          No visits recorded yet.
        </div>
      ) : (
        <>
          <div className="max-h-[200px] overflow-y-auto">
            {visits.map((v) => <VisitRow key={v.id} visit={v} />)}

            {/* Automatic trigger div */}
            {hasNextPage && <div ref={loaderRef} className="h-px" />}
          </div>

          {/* Manual fallback */}
          {isFetchingNextPage && (
            <div className="px-3.5 py-2 flex items-center gap-2 border-t border-border">
              <Spinner size="xs" className="text-text-muted" />
              <span className="text-[11px] text-text-muted">Loading more visits…</span>
            </div>
          )}

          {!hasNextPage && total > 10 && (
            <div className="px-3.5 py-2 border-t border-border text-center text-[11px] text-text-muted">
              All {total} visits loaded
            </div>
          )}
        </>
      )}
    </div>
  );
}
