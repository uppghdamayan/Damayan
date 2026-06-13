'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function SidebarSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '8px 0' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 12px',
          }}
        >
          {/* Avatar circle */}
          <Skeleton width={32} height={32} borderRadius="50%" />

          {/* Text bars */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Skeleton width={100} height={12} borderRadius={4} />
            <Skeleton width={120} height={11} borderRadius={4} />
          </div>
        </div>
      ))}
    </div>
  );
}
