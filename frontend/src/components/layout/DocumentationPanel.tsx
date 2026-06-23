'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { Pen, Edit, ClipboardList, ArrowRight } from 'lucide-react';
import { ProgressNoteForm } from '@/components/notes/ProgressNoteForm';
import { useParams, useRouter } from 'next/navigation';
import { useInitialNote } from '@/hooks/useInitialNote';
import { Button } from '@/components/ui/button';


export function DocumentationPanel() {
  const { documentationPanelOpen, activeNoteEditor, closeNoteEditor, setDocumentationPanelOpen } = useUiStore();
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter();
  const params = useParams();
  const patientId = params?.patientId as string | undefined;
  const { data: initialNote, isLoading: initialNoteLoading } = useInitialNote(patientId || null);
  const hasNoInitialNote = patientId && !initialNoteLoading && (!initialNote || initialNote.status !== 'PUBLISHED');


  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      const clamped = Math.max(300, Math.min(newWidth, window.innerWidth * 0.6));
      document.documentElement.style.setProperty('--documentation-panel-width', `${clamped}px`);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  return (
    <aside
      ref={panelRef}
      style={{
        width: documentationPanelOpen ? 'var(--documentation-panel-width, 420px)' : 0,
      }}
      className={cn(
        "bg-surface flex flex-col shrink-0 relative overflow-hidden h-full",
        documentationPanelOpen ? "border-l border-border" : "border-l border-transparent",
        isResizing ? "transition-none" : "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      )}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute top-0 left-0 w-[5px] h-full cursor-ew-resize z-10 transition-colors duration-150",
          isResizing ? "bg-accent" : "bg-transparent hover:bg-accent"
        )}
      />

        {/* Inner content wrapper with static width to prevent reflow */}
        <div className="w-[var(--documentation-panel-width,420px)] min-w-[var(--documentation-panel-width,420px)] flex flex-col h-full overflow-hidden">
          {activeNoteEditor.mode !== null ? (
            <ProgressNoteForm 
              patientId={activeNoteEditor.patientId!} 
              noteId={activeNoteEditor.noteId ?? undefined} 
              onClose={() => closeNoteEditor()} 
            />
          ) : initialNoteLoading ? (
            <>
              {/* Panel header (Section 7.5) */}
              <div className="flex items-center gap-2 px-4 py-3 bg-accent-light border-b border-accent-mid flex-shrink-0">
                <Pen className="w-3.5 h-3.5 text-accent-hover" strokeWidth={2.5} />
                <span className="font-bold text-accent-hover flex-1 text-[13px]">
                  Progress Note
                </span>
              </div>
              <div className="flex-1 overflow-hidden bg-surface-2 flex flex-col relative">
                <div className="absolute inset-0 overflow-y-auto">
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                </div>
              </div>
            </>
          ) : hasNoInitialNote ? (
            <>
              {/* Panel header (Section 7.5) */}
              <div className="flex items-center gap-2 px-4 py-3 bg-accent-light border-b border-accent-mid flex-shrink-0">
                <Pen className="w-3.5 h-3.5 text-accent-hover" strokeWidth={2.5} />
                <span className="font-bold text-accent-hover flex-1 text-[13px]">
                  Progress Note
                </span>
              </div>
              <div className="flex-1 overflow-hidden bg-surface-2 flex flex-col relative">
                <div className="absolute inset-0 overflow-y-auto">
                  <div className="flex flex-col items-center justify-center h-full px-6 py-10 text-center">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent mb-4 transition-transform hover:scale-110 duration-300">
                      <ClipboardList className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="text-[14px] font-semibold text-text-primary mb-1.5">
                      Initial Note Required
                    </h3>
                    <p className="text-[12px] text-text-muted max-w-[260px] mb-5 leading-relaxed">
                      Before documenting progress notes, you must first create and publish an Initial Consultation Note for this patient.
                    </p>
                    <Button
                      onClick={() => {
                        setDocumentationPanelOpen(false);
                        router.push(`/dashboard/${patientId}/initial-note`);
                      }}
                      className="group text-[12px] h-[34px] px-4 bg-accent hover:bg-accent-hover text-white rounded-btn font-bold flex items-center gap-1.5 cursor-pointer shadow-btn-primary hover:shadow-btn-primary-hover transition-all"
                    >
                      Create Initial Note
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1 duration-200" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <ProgressNoteForm 
              patientId={patientId!} 
              onClose={() => closeNoteEditor()} 
            />
          )}
        </div>
    </aside>
  );
}
