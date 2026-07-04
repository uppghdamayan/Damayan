'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function VitalsStripSkeleton() {
  return (
    <div className="grid grid-cols-5 @max-[1023px]:grid-cols-3 @max-[767px]:grid-cols-2 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-[#F7F8FA] border border-[#D1D5E0] rounded-lg px-3 py-2.5 flex flex-col gap-1.5"
        >
          <Skeleton width={60} height={9} borderRadius={4} />
          <Skeleton width={70} height={18} borderRadius={4} />
          <Skeleton width={40} height={10} borderRadius={4} />
        </div>
      ))}
    </div>
  );
}

