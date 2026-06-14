import { cn } from '@/lib/utils';

interface UploadProgressBarProps {
  fileName: string;
  percent: number;       // 0–100
  status: 'uploading' | 'done' | 'error';
}

export function UploadProgressBar({ fileName, percent, status }: UploadProgressBarProps) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2 bg-surface-2 border border-border rounded-btn">
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-[11px] font-medium text-text-secondary truncate max-w-[200px]">{fileName}</span>
        <span className={cn(
          "text-[9px] font-bold uppercase tracking-[0.5px]",
          status === 'done' ? 'text-green' : status === 'error' ? 'text-red' : 'text-text-muted'
        )}>
          {status === 'uploading' ? `${percent}%` : status === 'done' ? 'Done' : 'Failed'}
        </span>
      </div>
      <div className="h-[3px] bg-surface-3 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-200",
            status === 'error' ? 'bg-red' : 'bg-accent'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
