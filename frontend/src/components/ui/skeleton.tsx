import { cn } from '@/lib/utils';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  className?: string;
}

export function Skeleton({ width, height, borderRadius = 6, className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'shrink-0 bg-skeleton animate-pulse',
        className
      )}
      style={{ width, height, borderRadius }}
    />
  );
}
