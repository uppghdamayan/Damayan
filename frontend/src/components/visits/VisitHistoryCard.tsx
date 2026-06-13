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
  const statusColor = visit.status === 'PUBLISHED' ? '#4C1D95' : '#92400E';
  const statusBg    = visit.status === 'PUBLISHED' ? '#EDE9FE' : '#FEF3C7';
  const statusBorder= visit.status === 'PUBLISHED' ? '#8B5CF6' : '#F59E0B';

  return (
    <div style={{
      padding: '10px 14px', borderBottom: '1px solid #D1D5E0',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      {/* Date column */}
      <div style={{ width: 90, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0D1117' }}>{dateStr}</div>
        <div style={{ fontSize: 11, color: '#6B7280', fontFamily: "'IBM Plex Mono', monospace" }}>{timeStr}</div>
      </div>

      {/* Detail column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{ fontSize: 12, color: '#374151' }}>{physician}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
            padding: '1px 5px', borderRadius: 4,
            background: visit.visitType === 'INITIAL' ? '#DBEAFE' : '#D4EDE9',
            color: visit.visitType === 'INITIAL' ? '#1E3A8A' : '#085A4E',
            border: `1px solid ${visit.visitType === 'INITIAL' ? '#3B82F6' : '#0A6E5F'}`,
          }}>
            {visit.visitType === 'INITIAL' ? 'Initial' : 'Progress'}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
            padding: '1px 5px', borderRadius: 4,
            background: statusBg, color: statusColor, border: `1px solid ${statusBorder}`,
          }}>
            {visit.status}
          </span>
        </div>
        {notePreview && (
          <div style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
    <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      {/* Card header */}
      <div style={{ background: '#F7F8FA', borderBottom: '1px solid #D1D5E0', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, background: '#EFF1F5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🗒</div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151' }}>Visit History</span>
          {total > 0 && (
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '2px 6px', borderRadius: 4, background: '#D4EDE9', color: '#085A4E', border: '1px solid #0A6E5F' }}>
              {total} visit{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div style={{ padding: '16px 14px', fontSize: 12, color: '#6B7280' }}>Loading visit history…</div>
      ) : visits.length === 0 ? (
        <div style={{ padding: '20px 14px', fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
          No visits recorded yet.
        </div>
      ) : (
        <>
          {visits.map((v) => <VisitRow key={v.id} visit={v} />)}
          {total > 5 && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid #D1D5E0' }}>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ background: 'none', border: 'none', fontSize: 12, color: '#0A6E5F', cursor: 'pointer', fontWeight: 600 }}
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
