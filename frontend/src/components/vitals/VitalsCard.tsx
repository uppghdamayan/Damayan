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
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

export function VitalsCard({ patientId }: { patientId: string }) {
  const { data: latest, isLoading } = useLatestVitals(patientId);
  const { sidebarCollapsed } = useUiStore();
  const sidebarOpen = !sidebarCollapsed;

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
  const isOlderThan24h = latest ? (Date.now() - new Date(latest.measuredAt).getTime() > 24 * 60 * 60 * 1000) : false;

  const renderVitalCell = (
    label: string, 
    valueStr: string, 
    unit: string, 
    severity: 'normal' | 'warn' | 'critical', 
    timeStr?: string
  ) => {
    const isCrit = severity === 'critical';
    const isWrn = severity === 'warn';

    return (
      <div className={cn(
        "border rounded-card p-[9px_11px] flex flex-col gap-0.5",
        isCrit ? "bg-red-bg border-red-border" :
        isWrn  ? "bg-amber-bg border-amber-border" :
        "bg-surface-2 border-border"
      )}>
        <div className={cn(
          "text-[9px] font-bold uppercase tracking-[0.6px] mb-0.5 max-[1439px]:text-[8px]",
          isCrit ? "text-red" :
          isWrn  ? "text-amber" :
          "text-text-muted"
        )}>
          {label}
        </div>
        <div className={cn(
          "font-mono text-[18px] font-medium leading-[1.1] max-[1439px]:text-[16px]",
          isCrit ? "text-red" :
          isWrn  ? "text-amber" :
          "text-text-primary"
        )}>
          {valueStr}
          {valueStr !== '—' && valueStr !== '—/—' && (
            <span className="text-[10px] text-text-muted ml-[1px] font-sans">{unit}</span>
          )}
        </div>
        {timeStr && (
          <div className={cn("font-mono text-[9px] mt-0.5", isOlderThan24h ? "text-amber font-medium" : "text-text-muted")}>
            {timeStr}
          </div>
        )}
      </div>
    );
  };

  const timeStr = latest ? new Date(latest.measuredAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className={cn(
      "bg-surface border border-border rounded-card shadow-card overflow-hidden",
      isRecent ? "border-l-[3px] border-l-accent" : ""
    )}>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
        <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">❤️</div>
        <div className="flex-1 flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">Vital Signs</span>
          {latest?.measuredByUser && (
            <span className="text-[9px] text-text-muted mt-0.5 normal-case tracking-normal">
              Last recorded by: <span className="font-medium text-text-secondary">{latest.measuredByUser.firstName} {latest.measuredByUser.lastName}</span>
            </span>
          )}
        </div>
        
        {noReadingToday && (
          <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border border-amber-border text-amber bg-amber-bg ml-3">
            No reading today
          </span>
        )}

        <div className="ml-auto">
          <Link
            href={`/dashboard/${patientId}/vitals`}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            Record Vitals
          </Link>
        </div>
      </div>

      <div className="p-2.5">
        <div className={cn(
          "grid gap-2",
          sidebarOpen ? "grid-cols-5 max-[1439px]:grid-cols-3" : "grid-cols-5",
          "max-[1279px]:grid-cols-3 max-[767px]:grid-cols-2"
        )}>
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
