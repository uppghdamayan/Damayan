'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';

export function DocumentationPanel() {
  const { documentationPanelOpen } = useUiStore();
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
      className={`overflow-hidden bg-[#F7F8FA] flex flex-col shrink-0 relative ${documentationPanelOpen ? 'border-l border-[#D1D5E0]' : 'border-l border-transparent'} ${isResizing ? 'transition-none' : 'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]'}`}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute left-0 top-0 bottom-0 w-[5px] cursor-ew-resize z-10 transition-colors duration-150 ${isResizing ? 'bg-[#0A6E5F]' : 'bg-transparent hover:bg-[#0A6E5F]'}`}
      />

      {/* Header */}
      <div className="min-w-[420px] bg-[#D4EDE9] border-b border-[#0D9E8C] px-3.5 py-2.5 flex items-center gap-2.5 shrink-0">
        <span className="text-[13px] font-bold text-[#085A4E] flex-1">
          Progress Note
        </span>

        {/* Autosave indicator */}
        <span className="text-[9px] font-bold uppercase tracking-[0.5px] bg-[#DCFCE7] text-[#14532D] border border-[#22C55E] px-1.5 py-0.5 rounded">
          Saved
        </span>

        {/* Status badge */}
        <span className="text-[9px] font-bold uppercase tracking-[0.5px] bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B] px-1.5 py-0.5 rounded">
          Draft
        </span>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto p-4 min-w-[420px]">
        {/* Placeholder for Phase 6–9 work */}
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="w-10 h-10 bg-[#D4EDE9] rounded-lg flex items-center justify-center text-lg text-[#0A6E5F]">
            📝
          </div>
          <p className="text-[13px] font-semibold text-[#0D1117] m-0">
            Progress Note Workspace
          </p>
          <p className="text-xs text-[#6B7280] text-center max-w-[280px] m-0 leading-relaxed">
            The note-writing workspace will be available in Phase 6. Select a patient and create a visit to get started.
          </p>
        </div>
      </div>
    </aside>
  );
}
