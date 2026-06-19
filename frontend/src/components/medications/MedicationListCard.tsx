'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useMedications } from '@/hooks/useMedications';
import { isRecentlyUpdated, mostRecentMedicationUpdate, formatDose } from '@/lib/medication-utils';
import { MedicationListCardEmpty } from './MedicationListCardEmpty';
import { MedicationListSkeleton } from './MedicationListSkeleton';

export function MedicationListCard({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { data, isLoading } = useMedications(patientId);

  if (isLoading) return <MedicationListSkeleton />;

  const active = data?.data ?? [];
  if (active.length === 0) return <MedicationListCardEmpty patientId={patientId} />;

  const lastUpdated = mostRecentMedicationUpdate(active);
  const recent = isRecentlyUpdated(lastUpdated);

  return (
    <div
      className={cn(
        'bg-surface border rounded-card shadow-card overflow-hidden',
        recent ? 'border-l-[3px] border-l-accent border-border' : 'border-border',
      )}
    >
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] bg-surface-3 rounded-md flex items-center justify-center text-[13px]">💊</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">Medications</span>
          {lastUpdated && (
            <span className={cn('font-mono text-[9px]', recent ? 'text-text-secondary' : 'text-text-muted')}>
              {recent && <span className="w-2 h-2 rounded-full bg-accent-mid inline-block mr-1" />}
              {new Date(lastUpdated).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <button
          onClick={() => router.push(`/dashboard/${patientId}/medications`)}
          className="h-7 px-3 bg-surface-2 text-text-secondary border border-border rounded-md text-[11px] font-semibold cursor-pointer hover:bg-surface-3 hover:text-text-primary transition-colors"
        >
          Manage
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-2 border-b border-border">
              <th className="px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary">Medication</th>
              <th className="px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary">Formulation</th>
              <th className="px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary">Dose</th>
              <th className="px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary">Instructions</th>
            </tr>
          </thead>
          <tbody>
            {active.slice(0, 6).map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0 hover:bg-surface-3 transition-colors">
                <td className="px-3.5 py-2 text-[12px] text-text-primary font-medium">
                  {m.name}
                </td>
                <td className="px-3.5 py-2 text-[11px] text-text-secondary">
                  {m.formulation || '—'}
                </td>
                <td className="px-3.5 py-2 font-mono text-[11px] text-accent font-medium whitespace-nowrap">
                  {formatDose(m)}
                </td>
                <td className="px-3.5 py-2 text-[11px] text-text-muted truncate max-w-[120px]">
                  {m.instructions || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {active.length > 6 && (
          <div className="px-3.5 py-2 text-[11px] text-text-muted text-center border-t border-border">
            +{active.length - 6} more — view full list
          </div>
        )}
      </div>
    </div>
  );
}
