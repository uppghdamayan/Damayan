'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function PatientBannerSkeleton() {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #D1D5E0',
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      }}
    >
      {/* Avatar circle */}
      <Skeleton width={48} height={48} borderRadius="50%" />

      {/* Text bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width={200} height={20} borderRadius={6} />
        <Skeleton width={300} height={13} borderRadius={6} />
        <Skeleton width={160} height={13} borderRadius={6} />
      </div>
    </div>
  );
}
