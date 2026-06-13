'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function PatientBannerSkeleton() {
  return (
    <div className="bg-white border border-[#D1D5E0] rounded-lg p-4 flex items-center gap-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
      {/* Avatar circle */}
      <Skeleton width={48} height={48} borderRadius="50%" />

      {/* Text bars */}
      <div className="flex flex-col gap-2">
        <Skeleton width={200} height={20} borderRadius={6} />
        <Skeleton width={300} height={13} borderRadius={6} />
        <Skeleton width={160} height={13} borderRadius={6} />
      </div>
    </div>
  );
}
