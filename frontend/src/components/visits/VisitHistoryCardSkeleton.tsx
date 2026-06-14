import { Skeleton } from '@/components/ui/skeleton';

export function VisitHistoryCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex items-center gap-2">
        <Skeleton width={26} height={26} borderRadius={6} />
        <Skeleton width={80} height={10} borderRadius={4} />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-3.5 py-2.5 flex gap-3 items-start animate-pulse">
            <div className="w-[90px] shrink-0 flex flex-col gap-1">
              <Skeleton width={80} height={12} borderRadius={4} />
              <Skeleton width={50} height={10} borderRadius={4} />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                <Skeleton width={120} height={12} borderRadius={4} />
                <Skeleton width={50} height={16} borderRadius={4} />
                <Skeleton width={60} height={16} borderRadius={4} />
              </div>
              <Skeleton width={220} height={11} borderRadius={4} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
