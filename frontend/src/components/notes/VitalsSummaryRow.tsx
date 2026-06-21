import { useLatestVitals } from '@/hooks/useVitals';
import { 
  classifyBloodPressure, classifyHeartRate, classifyOxygenSaturation, 
  classifyTemperature, classifyRespiratoryRate,
  formatBloodPressure, formatTemperature
} from '@/lib/vitals-utils';
import { cn } from '@/lib/utils';

interface VitalsSummaryRowProps {
  patientId: string;
}

export function VitalsSummaryRow({ patientId }: VitalsSummaryRowProps) {
  const { data: vitals, isLoading } = useLatestVitals(patientId);

  if (isLoading) return <div className="h-[60px] bg-surface-2 animate-pulse rounded-card mb-4" />;
  if (!vitals) return null;

  const getStatusColor = (status: 'normal' | 'warn' | 'critical' | 'unknown') => {
    switch (status) {
      case 'critical': return 'text-red';
      case 'warn': return 'text-amber';
      case 'normal': return 'text-green';
      default: return 'text-[var(--text-secondary)]';
    }
  };

  const hrStatus = classifyHeartRate(vitals.heartRate);
  const rrStatus = classifyRespiratoryRate(vitals.respiratoryRate);
  const tempStatus = classifyTemperature(Number(vitals.temperature));
  const o2Status = classifyOxygenSaturation(vitals.oxygenSaturation);
  const bpStatus = classifyBloodPressure(vitals.sbp, vitals.dbp);

  return (
    <div className="flex items-center gap-4 p-3 bg-surface border border-border rounded-card mb-4 overflow-x-auto">
      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.6px] whitespace-nowrap">
        Latest Vitals
      </span>
      <div className="flex items-center gap-6 text-[13px]">
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)]">BP</span>
          <span className={cn("font-mono font-medium", getStatusColor(bpStatus))}>
            {formatBloodPressure(vitals.sbp, vitals.dbp)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)]">HR</span>
          <span className={cn("font-mono font-medium", getStatusColor(hrStatus))}>
            {vitals.heartRate ?? '—'}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)]">RR</span>
          <span className={cn("font-mono font-medium", getStatusColor(rrStatus))}>
            {vitals.respiratoryRate ?? '—'}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)]">Temp</span>
          <span className={cn("font-mono font-medium", getStatusColor(tempStatus))}>
            {formatTemperature(Number(vitals.temperature))}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)]">O2</span>
          <span className={cn("font-mono font-medium", getStatusColor(o2Status))}>
            {vitals.oxygenSaturation ?? '—'}%
          </span>
        </div>
      </div>
    </div>
  );
}
