'use client';

import { useEffect, useRef } from 'react';
import { useVisitsInfinite } from '@/hooks/useVisitsInfinite';
import { Spinner } from '@/components/ui/spinner';
import type { Visit } from '@/types/visit';

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
    ? 'bg-[#EDE9FE] text-[#4C1D95] border-[#8B5CF6]' 
    : 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]';

  return (
    <div className="px-3.5 py-2.5 border-b border-[#D1D5E0] flex gap-3 items-start">
      {/* Date column */}
      <div className="w-[90px] shrink-0">
        <div className="text-xs font-semibold text-[#0D1117]">{dateStr}</div>
        <div className="text-[11px] text-[#6B7280] font-mono">{timeStr}</div>
      </div>

      {/* Detail column */}
      <div className="flex-1 min-w-0">
        <div className="flex gap-1.5 items-center flex-wrap mb-0.5">
          <span className="text-xs text-[#374151]">{physician}</span>
          <span className={`text-[9px] font-bold uppercase tracking-[0.6px] px-[5px] py-[1px] rounded border ${visit.visitType === 'INITIAL' ? 'bg-[#DBEAFE] text-[#1E3A8A] border-[#3B82F6]' : 'bg-[#D4EDE9] text-[#085A4E] border-[#0A6E5F]'}`}>
            {visit.visitType === 'INITIAL' ? 'Initial' : 'Progress'}
          </span>
          <span className={`text-[9px] font-bold uppercase tracking-[0.6px] px-[5px] py-[1px] rounded border ${statusClasses}`}>
            {visit.status}
          </span>
        </div>
        {notePreview && (
          <div className="text-xs text-[#6B7280] whitespace-nowrap overflow-hidden text-ellipsis">
            {notePreview}
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
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] bg-surface-3 rounded-md flex items-center justify-center text-[13px]">🗒</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-primary">Visit History</span>
          {total > 0 && (
            <span className="text-[9px] font-bold uppercase tracking-[0.6px] px-1.5 py-0.5 rounded bg-accent-light text-accent border border-accent">
              {total} visit{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
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
          {visits.map((v) => <VisitRow key={v.id} visit={v} />)}

          {/* Automatic trigger div */}
          {hasNextPage && <div ref={loaderRef} className="h-px" />}

          {/* Manual fallback */}
          {isFetchingNextPage && (
            <div className="px-3.5 py-2.5 flex items-center gap-2 border-t border-border">
              <Spinner size="xs" className="text-text-muted" />
              <span className="text-[11px] text-text-muted">Loading more visits…</span>
            </div>
          )}

          {!hasNextPage && total > 10 && (
            <div className="px-3.5 py-2.5 border-t border-border text-center text-[11px] text-text-muted">
              All {total} visits loaded
            </div>
          )}
        </>
      )}
    </div>
  );
}
