'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function SidebarSkeleton() {
  return (
    <div className="flex flex-col py-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 py-[7px]"
        >
          {/* Avatar circle */}
          <Skeleton width={32} height={32} borderRadius="50%" />

          {/* Text bars */}
          <div className="flex-1 flex flex-col gap-1">
            <Skeleton width={100} height={12} borderRadius={4} />
            <Skeleton width={120} height={11} borderRadius={4} />
          </div>
        </div>
      ))}
    </div>
  );
}
