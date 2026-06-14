import { Skeleton } from '@/components/ui/skeleton';

export function NoteFormSkeleton() {
  return (
    <div className="flex-1 bg-surface border border-border rounded-card p-5 flex flex-col gap-5 animate-pulse">
      <Skeleton width={200} height={24} borderRadius={6} />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton width={120} height={14} borderRadius={4} />
            <Skeleton width="100%" height={80} borderRadius={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
