import { Skeleton } from '@/components/ui/skeleton';

export function MedicationListSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex items-center gap-2">
        <Skeleton width={26} height={26} borderRadius={6} />
        <Skeleton width={140} height={10} borderRadius={4} />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-3.5 py-2.5 flex items-center gap-3 animate-pulse">
            <Skeleton width={8} height={8} borderRadius="50%" />
            <div className="flex-1 flex flex-col gap-1">
              <Skeleton width={i % 2 === 0 ? 160 : 120} height={12} borderRadius={4} />
              <Skeleton width={100} height={10} borderRadius={4} />
            </div>
            <Skeleton width={60} height={22} borderRadius={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
