import { Skeleton } from '@/components/ui/skeleton';

export function ProblemListSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex items-center gap-2">
        <Skeleton width={26} height={26} borderRadius={6} />
        <Skeleton width={80} height={10} borderRadius={4} />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-2.5 py-2 flex items-center gap-2 animate-pulse">
            <Skeleton width={14} height={14} borderRadius={2} />
            <Skeleton width={8} height={8} borderRadius="50%" />
            <Skeleton width={i % 2 === 0 ? 160 : 120} height={12} borderRadius={4} />
            <div className="ml-auto">
              <Skeleton width={50} height={16} borderRadius={4} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
