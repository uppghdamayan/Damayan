'use client';

import { 
  formatTemperature, 
  formatBloodPressure, 
  classifyBloodPressure, 
  classifyHeartRate, 
  classifyRespiratoryRate, 
  classifyTemperature, 
  classifyOxygenSaturation 
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
}

export function VitalsHistoryTable({ vitals, onEdit, onDelete, page, totalPages, total, onPageChange }: VitalsHistoryTableProps) {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'DOCTOR' || user?.role === 'NURSE' || user?.role === 'ADMIN';
  const canDelete = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const getColorClass = (severity: 'normal' | 'warn' | 'critical') => {
    if (severity === 'critical') return 'text-red font-semibold';
    if (severity === 'warn') return 'text-amber font-medium';
    return '';
  };

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
            {vitals.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[13px] text-text-muted italic">
                  No vital signs recorded.
                </td>
              </tr>
            ) : (
              vitals.map((v) => {
                const dt = new Date(v.measuredAt);
                const dateStr = dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = dt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
                
                const bpClass = getColorClass(classifyBloodPressure(v.sbp, v.dbp));
                const hrClass = getColorClass(classifyHeartRate(v.heartRate));
                const rrClass = getColorClass(classifyRespiratoryRate(v.respiratoryRate));
                const tempClass = getColorClass(classifyTemperature(v.temperature));
                const spo2Class = getColorClass(classifyOxygenSaturation(v.oxygenSaturation));

                return (
                  <tr key={v.id} className="hover:bg-surface-2 transition-colors">
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="font-mono">{dateStr}</div>
                      <div className="font-mono text-[10px] text-text-muted">{timeStr}</div>
                    </td>
                    <td className={`py-2.5 px-4 ${bpClass}`}>{formatBloodPressure(v.sbp, v.dbp)}</td>
                    <td className={`py-2.5 px-4 ${hrClass}`}>{v.heartRate ?? '—'}</td>
                    <td className={`py-2.5 px-4 ${rrClass}`}>{v.respiratoryRate ?? '—'}</td>
                    <td className={`py-2.5 px-4 ${tempClass}`}>{formatTemperature(v.temperature)}</td>
                    <td className={`py-2.5 px-4 ${spo2Class}`}>{v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—'}</td>
                    <td className="py-2.5 px-4">
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
