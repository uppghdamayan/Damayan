'use client';

import { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { PdfPreview } from '@/components/ui/PdfPreview';

interface AttachmentPeekModalProps {
  open: boolean;
  onClose: () => void;
  tag: string;
  mimeType?: string | null;
  url: string | null;
  isLoading: boolean;
  isError?: boolean;
}

/**
 * Read-only in-app preview for an attachment's file — images render inline, PDFs render via the
 * self-hosted PdfPreview (react-pdf), anything else falls back to an "Open in new tab" link.
 * Styled after DeleteConfirmModal.
 */
export function AttachmentPeekModal({ open, onClose, tag, mimeType, url, isLoading, isError }: AttachmentPeekModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isImage = !!mimeType?.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center animate-in fade-in duration-150 p-4"
    >
      <div className="bg-surface border border-border rounded-[10px] w-full max-w-[720px] h-[75vh] max-h-[85vh] flex flex-col shadow-modal">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border shrink-0">
          <h2 className="text-[15px] font-bold flex-1 text-text-primary truncate" title={tag}>
            {tag}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="w-6 h-6 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 p-[18px]">
          {isError ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-center">
              <p className="text-[13px] text-red font-medium">Couldn&apos;t load this file.</p>
              <p className="text-[12px] text-text-muted">Try again, or check your connection.</p>
            </div>
          ) : isLoading || !url ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-text-muted text-[12px]">
              <Spinner size="md" />
              Loading preview…
            </div>
          ) : isImage ? (
            <div className="w-full h-full overflow-auto flex items-center justify-center">
              <img src={url} alt={tag} className="max-w-full max-h-full object-contain rounded-[6px]" />
            </div>
          ) : isPdf ? (
            <PdfPreview key={url} fileUrl={url} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-[13px] text-text-secondary">
                Preview isn&apos;t available for this file type.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3 h-3" /> Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
