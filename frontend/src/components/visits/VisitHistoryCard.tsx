'use client';

import { useState } from 'react';
import { useVisits } from '@/hooks/useVisits';
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
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useVisits(patientId, 1, expanded ? 20 : 5);
  const visits = data?.data ?? [];
  const total  = data?.meta.total ?? 0;

  return (
    <div className="bg-white border border-[#D1D5E0] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
      {/* Card header */}
      <div className="bg-[#F7F8FA] border-b border-[#D1D5E0] px-3.5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] bg-[#EFF1F5] rounded-md flex items-center justify-center text-[13px]">🗒</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#374151]">Visit History</span>
          {total > 0 && (
            <span className="text-[9px] font-bold uppercase tracking-[0.6px] px-1.5 py-0.5 rounded bg-[#D4EDE9] text-[#085A4E] border border-[#0A6E5F]">
              {total} visit{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="px-3.5 py-4 text-xs text-[#6B7280]">Loading visit history…</div>
      ) : visits.length === 0 ? (
        <div className="py-5 px-3.5 text-xs text-[#6B7280] text-center">
          No visits recorded yet.
        </div>
      ) : (
        <>
          {visits.map((v) => <VisitRow key={v.id} visit={v} />)}
          {total > 5 && (
            <div className="px-3.5 py-2.5 border-t border-[#D1D5E0]">
              <button
                onClick={() => setExpanded(!expanded)}
                className="bg-transparent border-none text-xs text-[#0A6E5F] cursor-pointer font-semibold"
              >
                {expanded ? '▲ Show less' : `▼ Show all ${total} visits`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
