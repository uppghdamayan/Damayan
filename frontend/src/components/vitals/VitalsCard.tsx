'use client';

import Link from 'next/link';
import { 
  isRecentlyUpdated, 
  isStaleReading, 
  formatTemperature, 
  formatBloodPressure, 
  classifyBloodPressure, 
  classifyHeartRate, 
  classifyRespiratoryRate, 
  classifyTemperature, 
  classifyOxygenSaturation 
} from '@/lib/vitals-utils';
import { useLatestVitals } from '@/hooks/useVitals';
import { VitalsStripSkeleton } from './VitalsStripSkeleton';

export function VitalsCard({ patientId }: { patientId: string }) {
  const { data: latest, isLoading } = useLatestVitals(patientId);

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border">
          <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">❤️</div>
          <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-secondary">Vital Signs</span>
        </div>
        <div className="p-3">
          <VitalsStripSkeleton />
        </div>
      </div>
    );
  }

  const noReadingToday = !latest || isStaleReading(latest.measuredAt);
  const isRecent = latest && isRecentlyUpdated(latest.measuredAt);

  const getColorClass = (severity: 'normal' | 'warn' | 'critical') => {
    if (severity === 'critical') return 'text-red font-semibold';
    if (severity === 'warn') return 'text-amber font-medium';
    return 'text-text-primary font-bold';
  };

  const renderVitalCell = (label: string, valueStr: string, unit: string, severity: 'normal' | 'warn' | 'critical', timeStr?: string) => (
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.5px] text-text-muted">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={`text-[16px] ${getColorClass(severity)} leading-none`}>{valueStr}</span>
        {valueStr !== '—' && valueStr !== '—/—' && <span className="text-[11px] text-text-muted">{unit}</span>}
      </div>
      <div className="text-[10px] text-text-muted font-mono mt-0.5">
        {timeStr || '—'}
      </div>
    </div>
  );

  const timeStr = latest ? new Date(latest.measuredAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className={`bg-surface border border-border ${isRecent ? 'border-l-[3px] border-l-accent' : ''} rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden`}>
      <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border">
        <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">❤️</div>
        <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-secondary">Vital Signs</span>
        
        {noReadingToday && (
          <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-2.5 py-[3px] rounded border border-amber-border text-amber bg-amber-bg ml-3">
            No reading today
          </span>
        )}

        <div className="ml-auto">
          <Link
            href={`/dashboard/${patientId}/vitals`}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface border border-border text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors flex items-center"
          >
            Record Vitals
          </Link>
        </div>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-5 gap-3">
          {renderVitalCell(
            'Blood Pressure',
            latest ? formatBloodPressure(latest.sbp, latest.dbp) : '—/—',
            'mmHg',
            latest ? classifyBloodPressure(latest.sbp, latest.dbp) : 'normal',
            timeStr
          )}
          {renderVitalCell(
            'Heart Rate',
            latest?.heartRate?.toString() ?? '—',
            'bpm',
            latest ? classifyHeartRate(latest.heartRate) : 'normal',
            timeStr
          )}
          {renderVitalCell(
            'Resp Rate',
            latest?.respiratoryRate?.toString() ?? '—',
            '/min',
            latest ? classifyRespiratoryRate(latest.respiratoryRate) : 'normal',
            timeStr
          )}
          {renderVitalCell(
            'Temperature',
            latest ? formatTemperature(latest.temperature) : '—',
            '°C',
            latest ? classifyTemperature(latest.temperature) : 'normal',
            timeStr
          )}
          {renderVitalCell(
            'SpO2',
            latest?.oxygenSaturation?.toString() ?? '—',
            '%',
            latest ? classifyOxygenSaturation(latest.oxygenSaturation) : 'normal',
            timeStr
          )}
        </div>
      </div>
    </div>
  );
}
