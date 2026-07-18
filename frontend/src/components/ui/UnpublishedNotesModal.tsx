'use client';

import { useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Button } from './button';

interface UnpublishedNotesModalProps {
  open: boolean;
  onClose: () => void;
  onPublish: () => void;
  onKeepDraft: () => void;
  patientName: string;
  isPublishing?: boolean;
}

export function UnpublishedNotesModal({
  open,
  onClose,
  onPublish,
  onKeepDraft,
  patientName,
  isPublishing = false,
}: UnpublishedNotesModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isPublishing) onClose();
      }}
      className="fixed inset-0 bg-black/40 backdrop-blur-[5px] z-[9999] flex items-center justify-center animate-in fade-in duration-200"
    >
      <div className="bg-surface border border-border/80 rounded-[14px] w-[440px] max-w-[90vw] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-amber-50/15">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <h2 className="text-[15px] font-bold flex-1 text-text-primary">
            Unpublished Notes
          </h2>
          <button
            onClick={onClose}
            disabled={isPublishing}
            aria-label="Close modal"
            className="w-6 h-6 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted hover:text-text-primary cursor-pointer disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 text-[13px] text-text-secondary leading-relaxed flex flex-col gap-1">
          <p>
            You are drafting a note for <strong className="text-text-primary">{patientName}</strong>.
          </p>
          <p className="text-text-muted mt-1">
            Would you like to publish this note before switching to another patient, or save it as a draft?
          </p>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 px-5 py-4.5 border-t border-border bg-surface-2/30">
          <Button
            onClick={onClose}
            disabled={isPublishing}
            variant="ghost"
            className="h-[32px] px-3.5 rounded-btn text-[11px] font-semibold text-text-muted hover:text-text-primary hover:bg-surface-3 transition-all duration-150 cursor-pointer w-full sm:w-auto order-3 sm:order-1"
          >
            Cancel
          </Button>
          
          <Button
            onClick={onKeepDraft}
            disabled={isPublishing}
            variant="outline"
            className="h-[32px] px-3.5 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 cursor-pointer w-full sm:w-auto order-2"
          >
            Keep as Draft
          </Button>

          <Button
            onClick={onPublish}
            disabled={isPublishing}
            className="h-[32px] px-4 rounded-btn text-[11px] font-semibold bg-accent hover:bg-accent-hover text-white border border-accent-hover shadow-btn-primary hover:shadow-btn-primary-hover transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto order-1 sm:order-3"
          >
            {isPublishing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Publishing...
              </>
            ) : (
              'Publish Note'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
