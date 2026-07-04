import { Skeleton } from '@/components/ui/skeleton';

export function TabContentSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-5 py-4 animate-pulse">
      {/* Banner-width bar */}
      <Skeleton width="100%" height={88} borderRadius={8} />
      {/* Vitals row */}
      <div className="grid grid-cols-5 @max-[1023px]:grid-cols-3 @max-[767px]:grid-cols-2 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={72} borderRadius={8} />
        ))}
      </div>
      {/* Two-column cards */}
      <div className="grid grid-cols-2 @max-[1023px]:grid-cols-1 gap-4">
        <Skeleton width="100%" height={180} borderRadius={8} />
        <Skeleton width="100%" height={180} borderRadius={8} />
      </div>
    </div>
  );
}

