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
        overflow: 'hidden',
        borderLeft: documentationPanelOpen ? '1px solid #D1D5E0' : '1px solid transparent',
        background: '#F7F8FA',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-left-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          cursor: 'ew-resize',
          background: 'transparent',
          zIndex: 10,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#0A6E5F'; }}
        onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = 'transparent'; }}
      />

      {/* Header */}
      <div
        style={{
          minWidth: 420,
          background: '#D4EDE9',
          borderBottom: '1px solid #0D9E8C',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#085A4E',
            flex: 1,
          }}
        >
          Progress Note
        </span>

        {/* Autosave indicator */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            background: '#DCFCE7',
            color: '#14532D',
            border: '1px solid #22C55E',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          Saved
        </span>

        {/* Status badge */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            background: '#FEF3C7',
            color: '#92400E',
            border: '1px solid #F59E0B',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          Draft
        </span>
      </div>

      {/* Body — scrollable */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          minWidth: 420,
        }}
      >
        {/* Placeholder for Phase 6–9 work */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: '#D4EDE9',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              color: '#0A6E5F',
            }}
          >
            📝
          </div>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#0D1117',
              margin: 0,
            }}
          >
            Progress Note Workspace
          </p>
          <p
            style={{
              fontSize: 12,
              color: '#6B7280',
              textAlign: 'center',
              maxWidth: 280,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            The note-writing workspace will be available in Phase 6. Select a patient and create a visit to get started.
          </p>
        </div>
      </div>
    </aside>
  );
}
