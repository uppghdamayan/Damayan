'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { Pen, Edit } from 'lucide-react';
import { ProgressNoteForm } from '@/components/notes/ProgressNoteForm';

export function DocumentationPanel() {
  const { documentationPanelOpen, activeNoteEditor, closeNoteEditor } = useUiStore();
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
          {activeNoteEditor.mode === null ? (
            <>
              {/* Panel header (Section 7.5) */}
              <div className="flex items-center gap-2 px-4 py-3 bg-accent-light border-b border-accent-mid flex-shrink-0">
                <Pen className="w-3.5 h-3.5 text-accent-hover" strokeWidth={2.5} />
                <span className="font-bold text-accent-hover flex-1 text-[13px]">
                  Progress Note
                </span>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-hidden bg-surface-2 flex flex-col relative">
                <div className="absolute inset-0 overflow-y-auto">
                  <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
                    <div className="w-10 h-10 bg-accent-light rounded-lg flex items-center justify-center text-lg text-accent">
                      📝
                    </div>
                    <p className="text-[13px] font-semibold text-[var(--text-primary)] m-0">
                      Progress Note Workspace
                    </p>
                    <p className="text-xs text-[var(--text-muted)] text-center max-w-[280px] m-0 leading-relaxed">
                      Select a note from the timeline, or start a new note, to begin documenting.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <ProgressNoteForm 
              patientId={activeNoteEditor.patientId!} 
              noteId={activeNoteEditor.noteId ?? undefined} 
              onClose={() => closeNoteEditor()} 
            />
          )}
        </div>
    </aside>
  );
}
