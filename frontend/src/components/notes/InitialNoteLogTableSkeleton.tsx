import { Skeleton } from '@/components/ui/skeleton';

const COLUMN_LAYOUT = '1.2fr 1.5fr 3fr 1fr';
const PLACEHOLDER_ROWS = 4;

/**
 * Shape-stable first-load placeholder for InitialNoteLogTable — mirrors the
 * real toolbar / header / row grid so the swap-in causes no layout shift
 * (design-standard §6.8).
 */
export function InitialNoteLogTableSkeleton() {
  return (
    <div className="flex flex-col w-full bg-surface rounded-b-lg">
      {/* Toolbar */}
      <div className="flex flex-col @sm:flex-row gap-3 items-stretch @sm:items-center justify-between p-3 bg-surface border-b border-border/60">
        <div className="flex flex-col @sm:flex-row items-stretch @sm:items-center gap-2 w-full @sm:w-auto">
          <Skeleton height={34} borderRadius={6} className="w-full @sm:w-64" />
          <Skeleton height={34} width={130} borderRadius={6} />
          <Skeleton height={34} width={150} borderRadius={6} />
        </div>
      </div>

      {/* Header row */}
      <div
        className="relative grid items-center gap-4 px-[14px] py-2.5 bg-surface-2 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-['']"
        style={{ gridTemplateColumns: COLUMN_LAYOUT }}
      >
        <Skeleton height={8} width={62} borderRadius={2} />
        <Skeleton height={8} width={40} borderRadius={2} />
        <Skeleton height={8} width={68} borderRadius={2} />
        <Skeleton height={8} width={40} borderRadius={2} className="mx-auto" />
      </div>

      {/* Body rows */}
      <div className="flex flex-col">
        {Array.from({ length: PLACEHOLDER_ROWS }).map((_, i) => (
          <div
            key={i}
            style={{ gridTemplateColumns: COLUMN_LAYOUT }}
            className="relative grid items-center gap-4 px-[14px] py-3 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] last:after:hidden bg-surface"
          >
            <div className="flex flex-col gap-1">
              <Skeleton height={11} width={88} borderRadius={3} />
              <Skeleton height={9} width={58} borderRadius={3} />
            </div>
            <Skeleton height={12} width={110} borderRadius={3} />
            <Skeleton height={12} borderRadius={3} className="w-[85%]" />
            <Skeleton height={16} width={68} borderRadius={4} className="mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
