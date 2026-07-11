import React from 'react';
import { usePriorLabs, useAttachmentDownloadUrl } from '@/hooks/useAttachments';
import { Download, Trash2, Eye } from 'lucide-react';
import { Button } from '../ui/button';

interface PriorLabsTableProps {
  patientId: string;
  localAttachments?: any[];
  onRemoveLocalAttachment?: (index: number) => void;
}

export function PriorLabsTable({ patientId, localAttachments = [], onRemoveLocalAttachment }: PriorLabsTableProps) {
  const { data: groupedLabs, isLoading } = usePriorLabs(patientId);

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

  return (
    <div className="border border-border rounded-[6px] overflow-hidden my-1">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] px-2.5 py-2 text-left bg-surface-2 border-b border-border">Tag</th>
            <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] px-2.5 py-2 text-left bg-surface-2 border-b border-border">Date</th>
            <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] px-2.5 py-2 text-left bg-surface-2 border-b border-border">Result</th>
            <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] px-2.5 py-2 text-left bg-surface-2 border-b border-border w-[80px]">Action</th>
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
              <td className="px-2.5 py-2 text-[12px] text-[var(--text-secondary)] align-top border-b border-border">
                <div className="flex items-center gap-1.5">
                  {att.file && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        const url = URL.createObjectURL(att.file);
                        window.open(url, '_blank');
                      }}
                      className="h-6.5 text-[11px] font-semibold border-accent/20 hover:border-accent/50 hover:bg-accent-light/20 hover:text-accent transition-all duration-150 flex items-center gap-1"
                    >
                      <Eye size={12} />
                      View
                    </Button>
                  )}
                  {onRemoveLocalAttachment && (
                    <Button 
                      variant="ghost" 
                      size="icon-xs" 
                      onClick={() => onRemoveLocalAttachment(idx)}
                      className="h-7 w-7 text-text-muted hover:text-red transition-all duration-150 p-0 flex items-center justify-center rounded-[4px]"
                    >
                      <Trash2 size={14} />
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
                    {new Date(att.uploadedAt).toLocaleDateString()}
                  </td>
                  <td className="px-2.5 py-2 text-[12px] text-[var(--text-secondary)] align-top border-b border-border">
                    {att.textResult ? (
                      <span className="italic text-[var(--text-secondary)]">"{att.textResult}"</span>
                    ) : (
                      <span className="text-[var(--text-muted)] text-[11px] uppercase tracking-[0.5px]">File only</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-[12px] text-[var(--text-secondary)] align-top border-b border-border">
                    <DownloadButton attachmentId={att.id} storageKey={att.storageKey} />
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DownloadButton({ attachmentId, storageKey }: { attachmentId: string, storageKey: string | null }) {
  const { refetch, isFetching } = useAttachmentDownloadUrl(attachmentId);
  
  if (!storageKey) return <span className="text-text-muted text-11px">N/A</span>;

  const handleDownload = async () => {
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
      variant="outline" 
      size="xs" 
      onClick={handleDownload}
      disabled={isFetching}
      className="h-6.5 text-[11px] font-semibold border-accent/20 hover:border-accent/50 hover:bg-accent-light/20 hover:text-accent transition-all duration-150 flex items-center gap-1"
    >
      <Eye size={12} />
      {isFetching ? 'Loading...' : 'View'}
    </Button>
  );
}
