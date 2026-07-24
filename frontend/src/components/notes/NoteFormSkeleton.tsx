import { Skeleton } from '@/components/ui/skeleton';

export function NoteFormSkeleton() {
  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 animate-pulse">
      {/* Context Summary Bar Skeleton */}
      <div className="border border-border rounded-lg p-3 bg-surface flex flex-col gap-2 shadow-xs">
        <Skeleton width={140} height={16} borderRadius={4} />
        <Skeleton width="80%" height={14} borderRadius={4} />
        <Skeleton width="60%" height={14} borderRadius={4} />
      </div>

      {/* Subjective Section Skeleton */}
      <div className="bg-surface border border-border rounded-[8px] overflow-hidden shadow-xs">
        <div className="px-[14px] py-[10px] bg-surface-2 border-b border-border flex items-center gap-2">
          <Skeleton width={24} height={24} borderRadius={6} />
          <Skeleton width={180} height={14} borderRadius={4} />
        </div>
        <div className="p-[14px]">
          <Skeleton width="100%" height={85} borderRadius={6} />
        </div>
      </div>

      {/* Objective Section Skeleton */}
      <div className="bg-surface border border-border rounded-[8px] overflow-hidden shadow-xs">
        <div className="px-[14px] py-[10px] bg-surface-2 border-b border-border flex items-center gap-2">
          <Skeleton width={24} height={24} borderRadius={6} />
          <Skeleton width={210} height={14} borderRadius={4} />
        </div>
        <div className="p-[14px]">
          <Skeleton width="100%" height={70} borderRadius={6} />
        </div>
      </div>

      {/* Assessment / Problem List Section Skeleton */}
      <div className="bg-surface border border-border rounded-[8px] overflow-hidden shadow-xs">
        <div className="px-[14px] py-[10px] bg-surface-2 border-b border-border flex items-center gap-2">
          <Skeleton width={24} height={24} borderRadius={6} />
          <Skeleton width={200} height={14} borderRadius={4} />
        </div>
        <div className="p-[14px] flex flex-col gap-2">
          <Skeleton width="100%" height={36} borderRadius={6} />
          <Skeleton width="100%" height={36} borderRadius={6} />
          <Skeleton width="100%" height={36} borderRadius={6} />
        </div>
      </div>
    </div>
  );
}
