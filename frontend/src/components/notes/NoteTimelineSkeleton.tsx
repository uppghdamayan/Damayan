import { Skeleton } from '@/components/ui/skeleton';

export function NoteTimelineSkeleton() {
  return (
    <div className="flex gap-4">
      {/* Left: timeline rail */}
      <div className="w-[260px] flex-shrink-0 flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-card p-3 flex gap-2 animate-pulse">
            <div className="flex flex-col items-center gap-1 w-[50px] shrink-0">
              <Skeleton width={40} height={10} borderRadius={4} />
              <Skeleton width={30} height={9} borderRadius={4} />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex gap-1">
                <Skeleton width={44} height={16} borderRadius={4} />
                <Skeleton width={50} height={16} borderRadius={4} />
              </div>
              <Skeleton width={100} height={10} borderRadius={4} />
            </div>
          </div>
        ))}
      </div>

      {/* Right: note detail panel */}
      <div className="flex-1 bg-surface border border-border rounded-card p-4 flex flex-col gap-4 animate-pulse">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <Skeleton width={120} height={14} borderRadius={4} />
          <Skeleton width={50} height={18} borderRadius={4} />
          <div className="ml-auto">
            <Skeleton width={80} height={26} borderRadius={6} />
          </div>
        </div>
        {/* Section blocks */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton width={100} height={10} borderRadius={4} />
            <Skeleton width="100%" height={60} borderRadius={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
