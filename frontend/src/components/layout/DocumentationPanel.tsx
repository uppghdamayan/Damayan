'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { usePanelResize } from '@/hooks/usePanelResize';
import { BP, DOC_PANEL_MIN_PX, MIN_CENTER_W } from '@/lib/breakpoints';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { Pen, Edit, ClipboardList, ArrowRight, PanelRightClose } from 'lucide-react';
import { ProgressNoteForm } from '@/components/notes/ProgressNoteForm';
import { useParams, useRouter } from 'next/navigation';
import { useInitialNote } from '@/hooks/useInitialNote';
import { useProgressNotes } from '@/hooks/useProgressNotes';
import { Button } from '@/components/ui/button';


export function DocumentationPanel() {
  const { user } = useAuthStore();
  const {
    documentationPanelOpen,
    activeNoteEditor,
    closeNoteEditor,
    setDocumentationPanelOpen,
    appWidth,
    sidebarCollapsed,
    docPanelWidthPx,
    setDocPanelWidthPx,
  } = useUiStore();
  const panelRef = useRef<HTMLElement>(null);

  // Below this width the panel stops being a column and becomes an overlay.
  // The old switch was `@md`, which on Tailwind v4's container scale is 448px,
  // not the 768px it reads as — so the overlay branch never ran on any real
  // screen and 768-1023px was left with a full-height column it had no room
  // for.
  const isOverlay = appWidth > 0 && appWidth < BP.laptop;
  
  const router = useRouter();
  const params = useParams();
  const patientId = params?.patientId as string | undefined;
  const { data: initialNote, isLoading: initialNoteLoading } = useInitialNote(patientId || null);
  // Args must match NoteTimeline's useProgressNotes(patientId, 1, 100) call —
  // they're part of the TanStack query key, so a mismatch means this and the
  // timeline hold divergent caches for the same patient and `dbDraft` below
  // can go stale relative to what the timeline shows.
  const { data: progressNotesResponse } = useProgressNotes(patientId || null, 1, 100);
  // !n.isDeleted matches NoteTimeline.tsx's own `draftProgressNote` filter —
  // without it, "+ New Note" could silently reopen a note whose DB row is
  // already gone (soft-tracked only via DeletedNote), instead of a truly
  // blank editor.
  const dbDraft = progressNotesResponse?.data?.find(n => n.status === 'DRAFT' && !n.isDeleted);
  const hasNoInitialNote = patientId && !initialNoteLoading && (!initialNote || initialNote.status !== 'PUBLISHED');

  const prevPatientIdRef = useRef(patientId);
  useEffect(() => {
    if (patientId && prevPatientIdRef.current && patientId !== prevPatientIdRef.current) {
      closeNoteEditor();
      setDocumentationPanelOpen(false);
    }
    prevPatientIdRef.current = patientId;
  }, [patientId, closeNoteEditor, setDocumentationPanelOpen]);


  // The two panels' clamps used to be independent — 45% of the viewport for the
  // sidebar, 60% for this one — so dragging both to their maxima asked for 105%
  // and drove the center column to zero. Both now budget around a guaranteed
  // minimum for the chart in the middle.
  const getMax = useCallback(() => {
    // See Sidebar.tsx's getMax for why 0 (unmeasured) means "unconstrained".
    if (appWidth <= 0) return Infinity;
    const sidebarW = sidebarCollapsed
      ? 0
      : (document.querySelector<HTMLElement>('[data-panel="sidebar"]')?.offsetWidth ?? 0);
    return Math.max(DOC_PANEL_MIN_PX, appWidth - sidebarW - MIN_CENTER_W);
  }, [appWidth, sidebarCollapsed]);

  const { isResizing, handleProps } = usePanelResize({
    side: 'right',
    cssVar: '--doc-panel-w-user',
    elementRef: panelRef,
    min: DOC_PANEL_MIN_PX,
    getMax,
    persistedPx: docPanelWidthPx,
    onCommit: setDocPanelWidthPx,
    enabled: !isOverlay,
  });

  const panelContent = (
    <>
      {activeNoteEditor.mode !== null ? (
        <ProgressNoteForm
          patientId={activeNoteEditor.patientId!}
          // Only fall back to the standing DB draft in 'edit' mode.
          // 'new' mode means the user explicitly clicked "+ New Note"
          // (uiStore.openNewProgressNote sets noteId: null deliberately) —
          // falling back to dbDraft?.id there silently reopens an existing
          // draft instead of starting blank.
          noteId={activeNoteEditor.mode === 'new' ? (activeNoteEditor.noteId ?? undefined) : (activeNoteEditor.noteId ?? dbDraft?.id ?? undefined)}
          onClose={() => {
            closeNoteEditor();
            // Match the branch the panel is actually rendering in. This was a
            // hardcoded `window.innerWidth < 768` paired with a 448px CSS
            // switch, so the two never agreed at any width.
            if (isOverlay) {
              setDocumentationPanelOpen(false);
            }
          }} 
        />
      ) : initialNoteLoading ? (
        <>
          {/* Panel header (Section 7.5) */}
          <div className="flex items-center gap-2 px-4 py-3 bg-accent-light border-b border-accent-mid flex-shrink-0">
            <button
              onClick={() => setDocumentationPanelOpen(false)}
              className="p-1 -ml-1.5 hover:bg-accent/10 rounded-md transition-colors cursor-pointer text-text-secondary hover:text-accent-hover shrink-0"
              title="Close panel"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
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
            <button
              onClick={() => setDocumentationPanelOpen(false)}
              className="p-1 -ml-1.5 hover:bg-accent/10 rounded-md transition-colors cursor-pointer text-text-secondary hover:text-accent-hover shrink-0"
              title="Close panel"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
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
                  {(user?.role === 'DOCTOR' || user?.role === 'ADMIN')
                    ? "Before documenting progress notes, you must first create and publish an Initial Consultation Note for this patient."
                    : "An Initial Consultation Note must be created and published by a doctor before progress notes can be documented for this patient."}
                </p>
                {(user?.role === 'DOCTOR' || user?.role === 'ADMIN') ? (
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
                ) : (
                  <Button
                    onClick={() => {
                      setDocumentationPanelOpen(false);
                      router.push(`/dashboard/${patientId}/initial-note`);
                    }}
                    className="group text-[12px] h-[34px] px-4 bg-surface-2 hover:bg-surface-3 text-text-primary border border-border rounded-btn font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    View Initial Note Tab
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1 duration-200" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <ProgressNoteForm 
          patientId={patientId!} 
          noteId={dbDraft?.id}
          onClose={() => {
            closeNoteEditor();
            // Match the branch the panel is actually rendering in. This was a
            // hardcoded `window.innerWidth < 768` paired with a 448px CSS
            // switch, so the two never agreed at any width.
            if (isOverlay) {
              setDocumentationPanelOpen(false);
            }
          }} 
        />
      )}
    </>
  );

  /*
    ONE <aside>, one React position, one mount of `panelContent`.

    This used to be two asides — an in-flow column and a `fixed` overlay —
    toggled with `@md:hidden` / `@md:flex`. That is CSS-only, so BOTH subtrees
    were always mounted: two ProgressNoteForm instances, two autosave loops
    writing the same localStorage key, and two registrations against the single
    global publish-handler slot in uiStore, where the last mount won and either
    one unmounting cleared the other's handler.

    Keeping it to one element also makes crossing the breakpoint a class swap
    rather than a remount, so half-typed note text survives a window resize.
  */
  return (
    <aside
      ref={panelRef}
      data-panel="documentation"
      style={isOverlay ? undefined : { width: documentationPanelOpen ? 'var(--documentation-panel-width, 420px)' : 0 }}
      className={cn(
        "bg-surface flex flex-col",
        isResizing ? "transition-none" : "transition-[width,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        isOverlay
          // Non-modal by design: no scrim and no focus trap, so the chart and
          // the tab bar behind stay readable and clickable while the clinician
          // writes. Sits below the topbar rather than over it, which the old
          // `top-0` overlay did not.
          ? cn(
              "fixed top-[var(--topbar-h)] right-0 bottom-0 z-[410] shadow-modal border-l border-border",
              "w-[min(var(--documentation-panel-width,420px),100vw)]",
              documentationPanelOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
            )
          : cn(
              "shrink-0 relative h-full",
              documentationPanelOpen ? "" : "overflow-hidden",
            ),
      )}
      aria-hidden={!documentationPanelOpen}
    >
      {/* Continuous left border line */}
      {documentationPanelOpen && !isOverlay && (
        <div className="absolute top-0 left-0 w-[1px] h-full bg-border z-20 pointer-events-none" />
      )}
      {/*
        Resize handle. Widened the hit target from 6px to 10px and given it a
        permanent low-opacity grip line — at 6px fully-transparent it only
        showed anything on a pixel-perfect hover, which read as "this can't be
        resized" rather than as a control that's merely quiet at rest.
      */}
      {documentationPanelOpen && !isOverlay && (
        <div
          {...handleProps}
          className={cn(
            "group/handle absolute top-0 -left-[5px] w-[10px] h-full cursor-ew-resize touch-none z-30 flex items-center justify-center",
            "focus-visible:outline-none"
          )}
        >
          <div
            className={cn(
              "w-[3px] h-10 rounded-full transition-colors duration-150",
              isResizing
                ? "bg-accent"
                : "bg-border-strong/50 group-hover/handle:bg-accent group-focus-visible/handle:bg-accent"
            )}
          />
        </div>
      )}
      <div
        className={cn(
          "flex flex-col h-full overflow-hidden",
          isOverlay
            ? "w-full"
            : "w-[var(--documentation-panel-width,420px)] min-w-[var(--documentation-panel-width,420px)]",
        )}
      >
        {panelContent}
      </div>
    </aside>
  );
}

