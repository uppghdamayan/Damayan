import { useLatestVitals } from '@/hooks/useVitals';
import { formatBloodPressure, formatTemperature } from '@/lib/vitals-utils';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

interface VitalsSummaryRowProps {
  patientId: string;
}

export function VitalsSummaryRow({ patientId }: VitalsSummaryRowProps) {
  const { data: vitals, isLoading } = useLatestVitals(patientId);

  if (isLoading) return <div className="h-[60px] bg-surface-2 animate-pulse rounded-lg mb-4" />;
  if (!vitals) return null;

  // One source for both layouts below — the table and the narrow-panel tiles
  // render the same list, so a new vital can never appear in one and not the
  // other.
  const measuredAt = new Date(vitals.measuredAt);
  const cells = [
    {
      key: 'datetime',
      label: 'Date / Time',
      compactLabel: 'Date',
      value: `${measuredAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${measuredAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
      mono: 'text-[11px] text-text-secondary',
    },
    { key: 'bp', label: 'BP', value: formatBloodPressure(vitals.sbp, vitals.dbp), mono: 'text-[13px] text-text-primary' },
    { key: 'hr', label: 'HR', value: vitals.heartRate ?? '—', mono: 'text-[13px] text-text-primary' },
    { key: 'rr', label: 'RR', value: vitals.respiratoryRate ?? '—', mono: 'text-[13px] text-text-primary' },
    { key: 'temp', label: 'Temp', value: formatTemperature(Number(vitals.temperature)), mono: 'text-[13px] text-text-primary' },
    { key: 'spo2', label: 'SpO₂', value: vitals.oxygenSaturation ? `${vitals.oxygenSaturation}%` : '—', mono: 'text-[13px] text-text-primary' },
  ] as const;

  return (
    <div className="bg-surface border border-accent-mid rounded-[8px] shadow-[0_4px_12px_rgba(10,110,95,0.08)] mb-4 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-[14px] py-[10px] bg-accent-light/40 border-b border-accent-mid/40 rounded-t-[7px]">
        <div className="flex items-center gap-[9px] min-w-0">
          <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface text-accent shrink-0">🫀</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-hover truncate">Latest Vital Signs</span>
        </div>
        <Link
          href={`/dashboard/${patientId}/vitals`}
          className="flex items-center gap-1 shrink-0 text-[10px] font-bold uppercase tracking-[0.6px] text-accent hover:text-accent-hover transition-colors"
          title="Go to Vitals"
        >
          <span className="@max-[410px]/notepanel:hidden">View All</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <div className="p-4">
        {/*
          Six columns of clinical numbers. The panel is resizable down to 300px,
          and the table had no overflow wrapper, so the columns simply crushed
          into each other. Above 410px it scrolls instead; below that it stops
          being a table at all.
        */}
        <div className="border border-border rounded-[8px] overflow-hidden shadow-[0_2px_6px_rgba(0,0,0,0.03)] @max-[410px]/notepanel:hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  {cells.map((c) => (
                    <th
                      key={c.key}
                      className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary px-[10px] py-2 text-left border-b border-border bg-surface-2 whitespace-nowrap"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-surface-3">
                  {cells.map((c) => (
                    <td
                      key={c.key}
                      className={`px-[10px] py-2 border-b border-border font-mono align-middle whitespace-nowrap ${c.mono}`}
                    >
                      {c.value}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Narrow panel: label-over-value tiles instead of a squeezed table. */}
        <div className="hidden @max-[410px]/notepanel:grid grid-cols-3 gap-2">
          {cells.map((c) => (
            <div key={c.key} className="border border-border rounded-[6px] bg-surface-2 px-2 py-1.5 min-w-0">
              <span className="block text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary truncate">
                {'compactLabel' in c ? c.compactLabel : c.label}
              </span>
              <span className={`block font-mono truncate ${c.mono}`}>{c.value}</span>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-text-muted mt-2.5 flex items-center gap-1.5">
          <svg width="12" height="12" fill="none" viewBox="0 0 16 16" className="shrink-0">
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
