import { Skeleton } from '@/components/ui/skeleton';

export function PatientBannerSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-card p-4 flex gap-5 animate-pulse">
      {/* Left: avatar + name */}
      <div className="flex gap-3.5 items-center flex-[1.2] min-w-[250px] border-r border-border pr-5">
        <Skeleton width={44} height={44} borderRadius="50%" />
        <div className="flex flex-col gap-2">
          <Skeleton width={60} height={9} borderRadius={4} />
          <Skeleton width={200} height={18} borderRadius={4} />
          <Skeleton width={80} height={16} borderRadius={4} />
        </div>
      </div>
      {/* Middle: demographics */}
      <div className="flex flex-col gap-2 flex-1 min-w-[220px] border-r border-border pr-5 justify-center">
        <Skeleton width={80} height={9} borderRadius={4} />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width={120} height={12} borderRadius={4} />
          ))}
        </div>
      </div>
      {/* Right: clinical profile */}
      <div className="flex flex-col gap-2 flex-[0.8] min-w-[180px] justify-center">
        <Skeleton width={80} height={9} borderRadius={4} />
        <div className="flex gap-1.5">
          <Skeleton width={70} height={18} borderRadius={4} />
          <Skeleton width={60} height={18} borderRadius={4} />
        </div>
        <Skeleton width={160} height={12} borderRadius={4} />
      </div>
    </div>
  );
}
