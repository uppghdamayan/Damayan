'use client';

import { useMemo } from 'react';
import {
  formatTemperature,
  formatBloodPressure,
} from '@/lib/vitals-utils';
import type { VitalSign } from '@/types/vitals';
import { useAuthStore } from '@/stores/authStore';

interface VitalsHistoryTableProps {
  vitals: VitalSign[];
  onEdit: (vital: VitalSign) => void;
  onDelete: (vital: VitalSign) => void;
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
  deletingId?: string | null;
}

export function VitalsHistoryTable({ vitals, onEdit, onDelete, page, totalPages, total, onPageChange, deletingId }: VitalsHistoryTableProps) {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'DOCTOR' || user?.role === 'NURSE' || user?.role === 'ADMIN';
  const canDelete = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  // Automatically place soft-deleted/ghost vitals at the bottom of the list,
  // while keeping date ordering (newest first) within active and deleted groups.
  const sortedVitals = useMemo(() => {
    return [...vitals].sort((a, b) => {
      const aGhost = !!a.isDeleted || deletingId === a.id;
      const bGhost = !!b.isDeleted || deletingId === b.id;
      if (aGhost !== bGhost) {
        return aGhost ? 1 : -1;
      }
      return new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime();
    });
  }, [vitals, deletingId]);

  return (
    <div className="bg-surface border border-border border-l-[3px] border-l-accent rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border">
        <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">📈</div>
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">Vitals History</span>
        {total !== undefined && (
          <span className="ch-badge badge-active text-[9px] font-bold uppercase tracking-[0.5px] px-2 py-0.5 rounded border border-accent text-accent-hover bg-accent-light">
            {total} Recorded
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px] text-left border-collapse min-w-[700px]">
          <thead className="bg-surface-2 text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border">
            <tr>
              <th className="py-2.5 px-4 whitespace-nowrap">Date & Time</th>
              <th className="py-2.5 px-4">BP</th>
              <th className="py-2.5 px-4">HR</th>
              <th className="py-2.5 px-4">RR</th>
              <th className="py-2.5 px-4">Temp</th>
              <th className="py-2.5 px-4">SpO2</th>
              <th className="py-2.5 px-4">Recorded By</th>
              <th className="py-2.5 px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedVitals.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[13px] text-text-muted italic">
                  No vital signs recorded.
                </td>
              </tr>
            ) : (
              sortedVitals.map((v) => {
                const dt = new Date(v.measuredAt);
                const dateStr = dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = dt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
                
                // Row is being deleted right now (mutation in flight) — transient ghost.
                const isDeleting = deletingId === v.id;
                // Row is permanently soft-deleted — persistent ghost, same as a
                const isGhost = !!v.isDeleted || isDeleting;
                const strikeClass = isGhost ? 'line-through decoration-text-muted/65 decoration-1' : '';

                return (
                  <tr
                    key={v.id}
                    className={`transition-all duration-200 ${isGhost ? 'opacity-55 grayscale blur-[0.5px] select-none hover:opacity-75 hover:blur-none' : 'hover:bg-surface-2'}`}
                  >
                    <td className={`py-2.5 px-4 whitespace-nowrap ${strikeClass}`}>
                      <div className="font-mono">{dateStr}</div>
                      <div className="font-mono text-[10px] text-text-muted">{timeStr}</div>
                    </td>
                    <td className={`py-2.5 px-4 ${strikeClass}`}>{formatBloodPressure(v.sbp, v.dbp)}</td>
                    <td className={`py-2.5 px-4 ${strikeClass}`}>{v.heartRate ?? '—'}</td>
                    <td className={`py-2.5 px-4 ${strikeClass}`}>{v.respiratoryRate ?? '—'}</td>
                    <td className={`py-2.5 px-4 ${strikeClass}`}>{formatTemperature(v.temperature)}</td>
                    <td className={`py-2.5 px-4 ${strikeClass}`}>{v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—'}</td>
                    <td className={`py-2.5 px-4 ${strikeClass}`}>
                      {v.measuredByUser ? (
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{v.measuredByUser.firstName} {v.measuredByUser.lastName[0]}.</span>
                          <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted border border-border">
                            {v.measuredByUser.role}
                          </span>
                        </div>
                      ) : (
                        <span className="text-text-muted italic">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-start gap-1.5">
                        {isDeleting ? (
                          <span className="text-[10px] font-semibold text-red italic">Deleting…</span>
                        ) : v.isDeleted ? (
                          <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-0.5 rounded bg-red-bg text-red border border-red-border">
                            Deleted
                          </span>
                        ) : (
                          <>
                            {canEdit && (
                              <button
                                onClick={() => onEdit(v)}
                                className="h-[22px] px-2 rounded text-[10px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer"
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => onDelete(v)}
                                className="h-[22px] px-2 rounded text-[10px] font-semibold bg-red-bg text-red border border-red-border hover:bg-red-bg/80 transition-all duration-150 cursor-pointer"
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-3 bg-surface border-t border-border flex items-center justify-between">
          <div className="text-[11px] text-text-muted">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => onPageChange(i + 1)}
                className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-medium transition-colors ${
                  page === i + 1
                    ? 'bg-accent text-white'
                    : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
