import { cn } from '@/lib/utils';
import { Edit } from 'lucide-react';

interface NoteStatusBadgeProps {
  status: 'DRAFT' | 'PUBLISHED';
  lastEditedBy?: string;
  lastEditedAt?: string;
}

export function NoteStatusBadge({ status, lastEditedBy, lastEditedAt }: NoteStatusBadgeProps) {
  const badgeBase = "text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border inline-flex items-center";
  const variants = {
    DRAFT: "bg-amber-bg text-amber border-amber-border",
    PUBLISHED: "bg-purple-bg text-purple border-purple-border",
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <span className={cn(badgeBase, variants[status])}>
        {status}
      </span>
      {status === 'PUBLISHED' && lastEditedBy && lastEditedAt && (
        <span className="text-[9px] font-bold tracking-[0.5px] text-[var(--text-muted)] flex items-center gap-1">
          <Edit className="w-2.5 h-2.5" />
          Edited by {lastEditedBy} · {new Date(lastEditedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })} · {new Date(lastEditedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}
