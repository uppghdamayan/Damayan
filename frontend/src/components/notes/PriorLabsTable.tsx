import React from 'react';
import { usePriorLabs, useAttachmentDownloadUrl } from '@/hooks/useAttachments';
import { Trash2, Eye, FileText, FlaskConical, Paperclip } from 'lucide-react';
import { Button } from '../ui/button';

interface PriorLabsTableProps {
  patientId: string;
  localAttachments?: any[];
  onRemoveLocalAttachment?: (index: number) => void;
}

export function PriorLabsTable({ patientId, localAttachments = [], onRemoveLocalAttachment }: PriorLabsTableProps) {
  const { data: groupedLabs, isLoading } = usePriorLabs(patientId);

  // Find the noteId of the most recently uploaded attachment across all tags.
  // We then only display attachments that belong to that same note, so the
  // section shows the full set of labs from the latest visit — not one-per-tag
  // from across all historical notes.
  const latestNoteId = React.useMemo(() => {
    if (!groupedLabs) return null;
    const allAttachments = groupedLabs.flatMap((g: any) => g.attachments);
    if (allAttachments.length === 0) return null;
    const newest = allAttachments.reduce((max: any, att: any) =>
      new Date(att.uploadedAt).getTime() > new Date(max.uploadedAt).getTime() ? att : max
    );
    return newest.noteId ?? null;
  }, [groupedLabs]);

  // Only keep groups that have at least one attachment from the latest note.
  const filteredGroups = React.useMemo(() => {
    if (!groupedLabs || !latestNoteId) return groupedLabs ?? [];
    return groupedLabs
      .map((group: any) => ({
        ...group,
        attachments: group.attachments.filter((att: any) => att.noteId === latestNoteId),
      }))
      .filter((group: any) => group.attachments.length > 0);
  }, [groupedLabs, latestNoteId]);

  if (isLoading) {
    return <div className="p-4 text-[12px] text-text-muted">Loading prior labs...</div>;
  }

  if (!groupedLabs || (filteredGroups.length === 0 && localAttachments.length === 0)) {
    return (
      <div className="py-2 text-[12px] text-[var(--text-muted)] italic">
        No prior labs or imaging found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Attachments staged in the current, unsaved note — removable until save */}
      {localAttachments.length > 0 && (
        <div className="border border-accent/40 rounded-[6px] overflow-hidden bg-accent/[0.04]">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/10 border-b border-accent/25">
            <Paperclip className="w-3 h-3 text-accent shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-[0.6px] text-accent-hover">
              Attaching to this note ({localAttachments.length})
            </span>
          </div>
          <ul className="divide-y divide-accent/15">
            {localAttachments.map((att: any, idx: number) => (
              <li key={`local-${idx}`} className="flex items-center gap-2 px-2.5 py-2">
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[12px] font-semibold text-text-primary truncate" title={att.tag}>
                    {att.tag}
                  </span>
                  <span className="text-[11px] text-text-muted truncate" title={att.textResult || att.file?.name}>
                    {att.textResult ? `"${att.textResult}"` : att.file?.name}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {att.file && (
                    <IconAction
                      label="View file"
                      onClick={() => window.open(URL.createObjectURL(att.file), '_blank')}
                    >
                      <Eye size={13} />
                    </IconAction>
                  )}
                  {onRemoveLocalAttachment && (
                    <IconAction
                      label="Remove before saving"
                      danger
                      onClick={() => onRemoveLocalAttachment(idx)}
                    >
                      <Trash2 size={13} />
                    </IconAction>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Saved history — only attachments from the most recent note, grouped by tag */}
      {filteredGroups.map((group: any) => {
        const latestAttachment = group.attachments[0];
        if (!latestAttachment) return null;
        return (
          <div key={group.tag} className="border border-border rounded-[6px] overflow-hidden bg-surface">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-2 border-b border-border">
              <FlaskConical className="w-3 h-3 text-text-muted shrink-0" />
              <span className="text-[11px] font-bold text-text-primary truncate" title={group.tag}>
                {group.tag}
              </span>
              <span className="text-[9px] font-bold text-accent bg-accent/10 border border-accent/30 px-1.5 py-[1px] rounded-full shrink-0">
                Latest
              </span>
            </div>
            <ul className="divide-y divide-border">
              <li key={latestAttachment.id} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-surface-2/70 transition-colors">
                <span className="text-[11px] font-mono text-text-secondary whitespace-nowrap shrink-0 w-[72px]">
                  {new Date(latestAttachment.uploadedAt).toLocaleDateString()}
                </span>
                <span className="flex-1 min-w-0 text-[12px] text-text-secondary truncate" title={latestAttachment.textResult || undefined}>
                  {latestAttachment.textResult ? (
                    <span className="italic">&quot;{latestAttachment.textResult}&quot;</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-text-muted">
                      <FileText className="w-3 h-3 shrink-0" />
                      <span className="text-[11px]">File only</span>
                    </span>
                  )}
                </span>
                <div className="shrink-0">
                  <DownloadButton attachmentId={latestAttachment.id} storageKey={latestAttachment.storageKey} />
                </div>
              </li>
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function IconAction({
  children,
  label,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`h-6 w-6 p-0 flex items-center justify-center border border-transparent transition-all cursor-pointer text-text-muted ${
        danger
          ? 'hover:text-red hover:bg-red-bg hover:border-red-border'
          : 'hover:text-accent hover:bg-surface-2 hover:border-border'
      }`}
    >
      {children}
    </Button>
  );
}

function DownloadButton({ attachmentId, storageKey }: { attachmentId: string, storageKey: string | null }) {
  const { refetch, isFetching } = useAttachmentDownloadUrl(attachmentId);
  
  if (!storageKey) return <span className="text-text-muted text-[11px]">N/A</span>;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await refetch();
      if (res.data) {
        window.open(res.data, '_blank');
      }
    } catch (e) {
      alert('Failed to get download link');
    }
  };

  return (
    <IconAction label="View file" onClick={handleDownload} disabled={isFetching}>
      {isFetching ? (
        <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      ) : (
        <Eye size={13} />
      )}
    </IconAction>
  );
}
