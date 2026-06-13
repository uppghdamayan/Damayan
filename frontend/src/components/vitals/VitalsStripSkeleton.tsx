'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function VitalsStripSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: '#F7F8FA',
            border: '1px solid #D1D5E0',
            borderRadius: 8,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <Skeleton width={60} height={9} borderRadius={4} />
          <Skeleton width={70} height={18} borderRadius={4} />
          <Skeleton width={40} height={10} borderRadius={4} />
        </div>
      ))}
    </div>
  );
}
