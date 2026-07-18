import React, { useState } from 'react';
import { usePriorLabs, useAttachmentDownloadUrl, useDeleteAttachment } from '@/hooks/useAttachments';
import { Trash2, Eye } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuthStore } from '@/stores/authStore';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';

interface PriorLabsTableProps {
  patientId: string;
  noteId?: string;
  localAttachments?: any[];
  onRemoveLocalAttachment?: (index: number) => void;
}

export function PriorLabsTable({ patientId, noteId, localAttachments = [], onRemoveLocalAttachment }: PriorLabsTableProps) {
  const { data: groupedLabs, isLoading } = usePriorLabs(patientId);
  const deleteMutation = useDeleteAttachment();
  const { user } = useAuthStore();
  const role = user?.role;
  const canDelete = role === 'DOCTOR' || role === 'ADMIN';

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, tag: string, noteType: string, noteId: string } | null>(null);

  const latestCurrentNoteAttachmentId = React.useMemo(() => {
    if (!noteId) return null;
    const allAttachments = groupedLabs ? groupedLabs.flatMap((g: any) => g.attachments) : [];
    const currentNoteAttachments = allAttachments.filter((att: any) => att.noteId === noteId);
    if (currentNoteAttachments.length === 0) return null;
    let latest = currentNoteAttachments[0];
    for (let i = 1; i < currentNoteAttachments.length; i++) {
      if (new Date(currentNoteAttachments[i].uploadedAt).getTime() > new Date(latest.uploadedAt).getTime()) {
        latest = currentNoteAttachments[i];
      }
    }
    return latest.id;
  }, [groupedLabs, noteId]);



  if (isLoading) {
    return <div className="p-4 text-[12px] text-text-muted">Loading prior labs...</div>;
  }

  if (!groupedLabs || (groupedLabs.length === 0 && localAttachments.length === 0)) {
    return (
      <div className="py-2 text-[12px] text-[var(--text-muted)] italic">
        No prior labs or imaging found.
      </div>
    );
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({
        id: deleteTarget.id,
        noteType: deleteTarget.noteType,
        noteId: deleteTarget.noteId,
      });
      setDeleteTarget(null);
    } catch (e: any) {
      alert(e.message || 'Failed to delete attachment');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="border border-border rounded-[6px] overflow-hidden my-1">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] px-2.5 py-2 text-left bg-surface-2 border-b border-border">Tag</th>
            <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] px-2.5 py-2 text-left bg-surface-2 border-b border-border">Date</th>
            <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] px-2.5 py-2 text-left bg-surface-2 border-b border-border">Result</th>
            <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] px-2.5 py-2 text-center bg-surface-2 border-b border-border w-[90px]">Activity</th>
          </tr>
        </thead>
        <tbody>
          {localAttachments.map((att: any, idx: number) => (
            <tr key={`local-${idx}`} className="bg-[rgba(10,110,95,0.04)] border-l-2 border-l-accent transition-colors">
              <td className="px-2.5 py-2 text-[12px] text-[var(--text-primary)] font-semibold align-top border-b border-border border-l-2 border-l-accent">
                {att.tag}
              </td>
              <td className="px-2.5 py-2 text-[12px] text-[var(--text-secondary)] align-top border-b border-border">
                <span className="text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded uppercase tracking-[0.5px]">Added Just Now</span>
              </td>
              <td className="px-2.5 py-2 text-[12px] text-[var(--text-secondary)] align-top border-b border-border">
                {att.textResult ? (
                  <span className="italic text-[var(--text-secondary)]">"{att.textResult}"</span>
                ) : att.file ? (
                  <span className="text-[12px] font-medium text-accent">{att.file.name}</span>
                ) : null}
              </td>
              <td className="px-2.5 py-2 text-[12px] text-[var(--text-secondary)] align-middle border-b border-border text-center">
                <div className="flex items-center justify-center gap-1">
                  {att.file && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        const url = URL.createObjectURL(att.file);
                        window.open(url, '_blank');
                      }}
                      className="text-text-muted hover:text-accent hover:bg-surface-2 border border-transparent hover:border-border transition-all cursor-pointer h-7 w-7 flex items-center justify-center"
                      title="View File"
                    >
                      <Eye size={13} />
                    </Button>
                  )}
                  {onRemoveLocalAttachment && (
                    <Button 
                      variant="ghost" 
                      size="icon-xs" 
                      onClick={() => onRemoveLocalAttachment(idx)}
                      className="text-text-muted hover:text-red hover:bg-red-bg border border-transparent hover:border-red-border transition-all cursor-pointer h-7 w-7 flex items-center justify-center"
                      title="Remove Attachment"
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {groupedLabs?.map((group: any) => (
            <React.Fragment key={group.tag}>
              {group.attachments.map((att: any, idx: number) => (
                <tr key={att.id} className="hover:bg-surface-3 transition-colors">
                  {idx === 0 ? (
                    <td className="px-2.5 py-2 text-[12px] text-[var(--text-primary)] font-semibold align-top border-b border-border" rowSpan={group.attachments.length}>
                      {group.tag}
                    </td>
                  ) : null}
                  <td className="px-2.5 py-2 text-[12px] text-[var(--text-secondary)] align-top border-b border-border">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{new Date(att.uploadedAt).toLocaleDateString()}</span>
                      {att.id === latestCurrentNoteAttachmentId && (
                        <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded uppercase tracking-[0.5px] whitespace-nowrap">
                          Latest Upload
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2.5 py-2 text-[12px] text-[var(--text-secondary)] align-top border-b border-border">
                    {att.textResult ? (
                      <span className="italic text-[var(--text-secondary)]">"{att.textResult}"</span>
                    ) : (
                      <span className="text-[var(--text-muted)] text-[11px] uppercase tracking-[0.5px]">File only</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-[12px] text-[var(--text-secondary)] align-middle border-b border-border text-center">
                    <div className="flex items-center justify-center gap-1">
                      <DownloadButton attachmentId={att.id} storageKey={att.storageKey} />
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({
                              id: att.id,
                              tag: att.tag,
                              noteType: att.noteType,
                              noteId: att.noteId,
                            });
                          }}
                          className="text-text-muted hover:text-red hover:bg-red-bg border border-transparent hover:border-red-border transition-all cursor-pointer h-7 w-7 flex items-center justify-center"
                          title="Delete Attachment"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {deleteTarget && (
        <DeleteConfirmModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Attachment"
          message={`Are you sure you want to delete the attachment for "${deleteTarget.tag}"? This action cannot be undone.`}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
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
    <Button 
      variant="ghost" 
      size="icon-xs" 
      onClick={handleDownload}
      disabled={isFetching}
      title="Download/View File"
      className="text-text-muted hover:text-accent hover:bg-surface-2 border border-transparent hover:border-border transition-all cursor-pointer h-7 w-7 flex items-center justify-center"
    >
      {isFetching ? (
        <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      ) : (
        <Eye size={13} />
      )}
    </Button>
  );
}
