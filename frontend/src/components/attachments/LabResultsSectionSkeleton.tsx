import { Skeleton } from '@/components/ui/skeleton';

export function LabResultsSectionSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden">
      {/* Card header — always visible */}
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex items-center gap-2">
        <div className="w-[26px] h-[26px] bg-surface-3 rounded-icon flex items-center justify-center text-[12px]">
          🧪
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">
          Lab Results & Attachments
        </span>
      </div>
      {/* Skeleton rows */}
      <div className="divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="px-3.5 py-2.5 flex items-center gap-3 animate-pulse">
            <Skeleton width={32} height={32} borderRadius={6} />
            <div className="flex-1 flex flex-col gap-1">
              <Skeleton width={150} height={12} borderRadius={4} />
              <Skeleton width={100} height={10} borderRadius={4} />
            </div>
            <Skeleton width={60} height={24} borderRadius={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
