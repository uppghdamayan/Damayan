import { useLatestVitals } from '@/hooks/useVitals';
import { 
  classifyBloodPressure, classifyHeartRate, classifyOxygenSaturation, 
  classifyTemperature, classifyRespiratoryRate,
  formatBloodPressure, formatTemperature
} from '@/lib/vitals-utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

interface VitalsSummaryRowProps {
  patientId: string;
}

export function VitalsSummaryRow({ patientId }: VitalsSummaryRowProps) {
  const { data: vitals, isLoading } = useLatestVitals(patientId);

  if (isLoading) return <div className="h-[60px] bg-surface-2 animate-pulse rounded-lg mb-4" />;
  if (!vitals) return null;

  const getStatusColor = (status: 'normal' | 'warn' | 'critical' | 'unknown') => {
    switch (status) {
      case 'critical': return 'text-red font-semibold';
      case 'warn': return 'text-amber font-medium';
      case 'normal': return 'text-green';
      default: return '';
    }
  };

  const hrStatus = classifyHeartRate(vitals.heartRate);
  const tempStatus = classifyTemperature(Number(vitals.temperature));
  const o2Status = classifyOxygenSaturation(vitals.oxygenSaturation);
  const bpStatus = classifyBloodPressure(vitals.sbp, vitals.dbp);

  return (
    <div className="bg-surface border border-accent-mid rounded-[8px] shadow-[0_4px_12px_rgba(10,110,95,0.08)] mb-4 overflow-hidden">
      <div className="flex items-center justify-between px-[14px] py-[10px] bg-accent-light/40 border-b border-accent-mid/40 rounded-t-[7px]">
        <div className="flex items-center gap-[9px]">
          <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface text-accent shrink-0">🫀</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-hover flex-1">Latest Vital Signs</span>
        </div>
        <Link 
          href={`/dashboard/${patientId}/vitals`}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.6px] text-accent hover:text-accent-hover transition-colors"
          title="Go to Vitals"
        >
          View All <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <div className="p-4">
        <div className="border border-border rounded-[8px] overflow-hidden shadow-[0_2px_6px_rgba(0,0,0,0.03)]">
          <table className="w-full border-collapse">
            <thead className="bg-surface-2">
              <tr>
                <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary px-[10px] py-2 text-left border-b border-border bg-surface-2">Date / Time</th>
                <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary px-[10px] py-2 text-left border-b border-border bg-surface-2">BP</th>
                <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary px-[10px] py-2 text-left border-b border-border bg-surface-2">HR</th>
                <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary px-[10px] py-2 text-left border-b border-border bg-surface-2">RR</th>
                <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary px-[10px] py-2 text-left border-b border-border bg-surface-2">Temp</th>
                <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary px-[10px] py-2 text-left border-b border-border bg-surface-2">SpO₂</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-surface-3">
                <td className="px-[10px] py-2 border-b border-border font-mono text-[11px] text-text-secondary align-middle">
                  {new Date(vitals.measuredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(vitals.measuredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </td>
                <td className={cn("px-[10px] py-2 border-b border-border font-mono text-[13px] align-middle", getStatusColor(bpStatus))}>
                  {formatBloodPressure(vitals.sbp, vitals.dbp)}
                </td>
                <td className={cn("px-[10px] py-2 border-b border-border font-mono text-[13px] align-middle", getStatusColor(hrStatus))}>
                  {vitals.heartRate ?? '—'}
                </td>
                <td className={cn("px-[10px] py-2 border-b border-border font-mono text-[13px] align-middle", getStatusColor(classifyRespiratoryRate(vitals.respiratoryRate)))}>
                  {vitals.respiratoryRate ?? '—'}
                </td>
                <td className={cn("px-[10px] py-2 border-b border-border font-mono text-[13px] align-middle", getStatusColor(tempStatus))}>
                  {formatTemperature(Number(vitals.temperature))}
                </td>
                <td className={cn("px-[10px] py-2 border-b border-border font-mono text-[13px] align-middle", getStatusColor(o2Status))}>
                  {vitals.oxygenSaturation ? `${vitals.oxygenSaturation}%` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-text-muted mt-2.5 flex items-center gap-1.5">
          <svg width="12" height="12" fill="none" viewBox="0 0 16 16">
            <path d="M8 15A7 7 0 108 1a7 7 0 000 14zm0-3.5v-4M8 5.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            Vitals are automatically synced from the patient&apos;s record. To record new vitals, please use the{' '}
            <Link href={`/dashboard/${patientId}/vitals`} className="text-accent hover:text-accent-hover underline underline-offset-2 font-medium">
              Vital Signs tab
            </Link>.
          </span>
        </div>
      </div>
    </div>
  );
}

