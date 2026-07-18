import { useProgressNotes } from '@/hooks/useProgressNotes';
import { useInitialNote, useInitialNotes, useDeleteInitialNote } from '@/hooks/useInitialNote';
import { useNewProgressNoteAction } from '@/hooks/useNewProgressNoteAction';
import { TimelineEntry } from './TimelineEntry';
import { useRouter } from 'next/navigation';
import { useUiStore } from '@/stores/uiStore';
import { useState, useMemo } from 'react';
import { mapNoteToTimelineView } from '@/lib/notes-utils';
import { Button } from '@/components/ui/button';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { useDeleteProgressNote } from '@/hooks/useProgressNotes';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';


interface NoteTimelineProps {
  patientId: string;
}

export function NoteTimeline({ patientId }: NoteTimelineProps) {
  const router = useRouter();
  const { data: initialNotes, isLoading: initialLoading } = useInitialNotes(patientId);
  const { data: activeInitialNote } = useInitialNote(patientId);
  const { data: progressNotesResponse, isLoading: progressLoading } = useProgressNotes(patientId);
  const { openExistingProgressNote, activeNoteEditor } = useUiStore();
  const { triggerNewNote, isLoading: actionLoading } = useNewProgressNoteAction(patientId);
  const deleteMutation = useDeleteInitialNote(patientId);
  const { user } = useAuthStore();

  // Set to track expanded notes (intentional: multiple notes can be open at once)
  // Decided per fix.md §6.4.
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteDraftNoteId, setDeleteDraftNoteId] = useState<string | null>(null);
  const deleteProgressNoteMutation = useDeleteProgressNote(patientId);

  const handleToggleNote = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCloseAll = () => {
    setExpandedNotes(new Set());
  };

  const progressNotes = progressNotesResponse?.data || [];
  
  // Combine and sort
  const allNotesRaw = [...progressNotes];
  if (initialNotes && initialNotes.length > 0) {
    allNotesRaw.push(...initialNotes as any[]);
  }

  const hasDrafts = allNotesRaw.some((note) => note.status === 'DRAFT' && 'subjective' in note);

  // Map to TimelineNoteView and identify latest
  const mappedNotes = useMemo(() => {
    const initialNoteAuthorId = activeInitialNote?.authorId;
    return allNotesRaw.sort((a, b) => {
      const aTime = new Date((a as any).visitDatetime || a.createdAt).getTime();
      const bTime = new Date((b as any).visitDatetime || b.createdAt).getTime();
      return bTime - aTime;
    }).map((note, index) => {
      // The latest note is the first one in the sorted list (since newest first)
      const isLatest = index === 0;
      return mapNoteToTimelineView(note, isLatest, initialNoteAuthorId);
    });
  }, [allNotesRaw, activeInitialNote]);

  const inheritedSourceId = useMemo(() => {
    const latestPublished = mappedNotes.find(n => n.status === 'PUBLISHED' && !n.isDeleted);
    return latestPublished?.id;
  }, [mappedNotes]);

  // Only show skeleton on initial load when there's no data yet.
  // This prevents brief loading flashes when queries are invalidated after mutations.
  const isInitialLoading = initialLoading && initialNotes === undefined;
  const isProgressLoading = progressLoading && progressNotesResponse === undefined;
  const isActionLoading = actionLoading && activeInitialNote === undefined;

  if (isInitialLoading || isProgressLoading || isActionLoading) {
    return (
      <div className="animate-pulse flex flex-col gap-4 p-4 w-full">
        <div className="h-24 bg-surface-2 rounded-card" />
        <div className="h-24 bg-surface-2 rounded-card" />
      </div>
    );
  }

  const handleNewNote = () => {
    triggerNewNote();
  };

  const firstProgressNoteId = mappedNotes.find(n => n.kind === 'progress')?.id;
  const hasActiveProgressNotes = mappedNotes.some(n => n.kind === 'progress' && !n.isDeleted);

  return (
    <div className="flex flex-col gap-4 w-full flex-shrink-0 border-r border-border h-full bg-surface-2 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Timeline</h2>
          {expandedNotes.size > 0 && (
            <Button 
              variant="ghost" 
              size="xs" 
              className="h-5 px-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              onClick={handleCloseAll}
            >
              Close All
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">

          {activeInitialNote?.status === 'PUBLISHED' && !hasDrafts && (
            <button 
              onClick={handleNewNote}
              className="h-[24px] px-3 bg-accent hover:bg-accent-hover text-white rounded text-[10px] font-bold cursor-pointer transition-all"
            >
              + New Note
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 relative">
        {mappedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-surface border border-border rounded-card shadow-card mt-4 min-h-[260px]">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent mb-4 transition-transform hover:scale-110 duration-300">
              <ClipboardList className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-[14px] font-semibold text-text-primary mb-1.5">
              No consultation notes yet
            </h3>
            <p className="text-[12px] text-text-muted max-w-[240px] mb-5 leading-relaxed">
              Every patient record starts with an initial note. Create one to begin tracking the patient's history.
            </p>
            <Button
              onClick={() => router.push(`/dashboard/${patientId}/initial-note`)}
              className="group text-[12px] h-[34px] px-4 bg-accent hover:bg-accent-hover text-white rounded-btn font-bold flex items-center gap-1.5 cursor-pointer shadow-btn-primary hover:shadow-btn-primary-hover transition-all"
            >
              Create Initial Note
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1 duration-200" />
            </Button>
          </div>
        ) : (
          mappedNotes.map((note, index) => {
            // Diff baseline: chronologically diff against the next note older in sorted order (index index + 1).
            // Decided per fix.md §6.3.
            const previousNote = index < mappedNotes.length - 1 ? mappedNotes[index + 1] : null;
            const isOpenNote = expandedNotes.has(note.id);

            return (
              <div key={note.id} className="relative pl-8 pb-5 last:pb-0">
                {/* Connecting line to the next item */}
                {index < mappedNotes.length - 1 && (
                  <div 
                    className="absolute bg-border-strong/50" 
                    style={{ left: '15px', top: '36px', bottom: '-34px', width: '2px' }} 
                  />
                )}
                {/* Modern timeline dot */}
                {(() => {
                  const isInitial = note.kind === 'initial';
                  const isDraft = note.status === 'DRAFT';
                  
                  let borderClass = "";
                  let shadowClass = "";
                  let bgClass = "";

                  if (isDraft) {
                    borderClass = "border-[var(--amber-border)]";
                    shadowClass = isOpenNote ? "shadow-[0_0_0_5px_rgba(245,158,11,0.2)] scale-110" : "shadow-[0_0_0_3px_rgba(245,158,11,0.08)]";
                    bgClass = "bg-[var(--amber-border)]";
                  } else if (isInitial) {
                    borderClass = "border-[var(--purple-border)]";
                    shadowClass = isOpenNote ? "shadow-[0_0_0_5px_rgba(139,92,246,0.2)] scale-110" : "shadow-[0_0_0_3px_rgba(139,92,246,0.08)]";
                    bgClass = "bg-[var(--purple-border)]";
                  } else {
                    borderClass = "border-accent";
                    shadowClass = isOpenNote ? "shadow-[0_0_0_5px_rgba(10,110,95,0.2)] scale-110" : "shadow-[0_0_0_3px_rgba(10,110,95,0.08)]";
                    bgClass = "bg-accent";
                  }

                  return (
                    <div 
                      className={cn(
                        "absolute w-3.5 h-3.5 rounded-full bg-surface border-2 flex items-center justify-center z-10 transition-all duration-200",
                        borderClass,
                        shadowClass,
                        note.isDeleted && "opacity-40"
                      )}
                      style={{ left: '9px', top: '22px' }}
                    >
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-200",
                        isOpenNote ? "scale-125" : "",
                        bgClass
                      )} />
                    </div>
                  );
                })()}
                <TimelineEntry 
                  note={note}
                  previousNote={previousNote}
                  isOpen={isOpenNote}
                  onToggle={() => handleToggleNote(note.id)}
                  onClickEdit={() => {
                    const rawNote = allNotesRaw[index];
                    if (rawNote.visitId && (!rawNote.visit || rawNote.visit.visitType === 'INITIAL') && 'chiefComplaint' in rawNote) {
                      router.push(`/dashboard/${patientId}/initial-note`);
                    } else {
                      openExistingProgressNote(patientId, note.id);
                    }
                  }} 
                  onDelete={
                    !note.isDeleted && note.authorId === user?.id && note.kind === 'initial' && !hasActiveProgressNotes
                      ? () => setDeleteNoteId(note.id)
                      : !note.isDeleted && note.authorId === user?.id && note.kind === 'progress'
                        ? () => setDeleteDraftNoteId(note.id)
                        : undefined
                  }
                  isInheritedSource={note.id === inheritedSourceId}
                />
              </div>
            );
          })
        )}
      </div>

      <DeleteConfirmModal
        open={!!deleteNoteId}
        onClose={() => setDeleteNoteId(null)}
        onConfirm={() => {
          if (deleteNoteId) {
            deleteMutation.mutate(deleteNoteId, {
              onSuccess: () => setDeleteNoteId(null),
            });
          }
        }}
        isDeleting={deleteMutation.isPending}
        title="Delete Initial Note"
        message="Are you sure you want to delete this Initial Note? This action cannot be undone."
      />



      <DeleteConfirmModal
        open={!!deleteDraftNoteId}
        onClose={() => setDeleteDraftNoteId(null)}
        onConfirm={() => {
          if (deleteDraftNoteId) {
            deleteProgressNoteMutation.mutate(deleteDraftNoteId, {
              onSuccess: () => {
                if (activeNoteEditor.noteId === deleteDraftNoteId) {
                  useUiStore.getState().closeNoteEditor();
                  useUiStore.getState().setDocumentationPanelOpen(false);
                }
                setDeleteDraftNoteId(null);
              },
            });
          }
        }}
        isDeleting={deleteProgressNoteMutation.isPending}
        title={mappedNotes.find(n => n.id === deleteDraftNoteId)?.status === 'DRAFT' ? "Undraft Progress Note" : "Delete Progress Note"}
        message={mappedNotes.find(n => n.id === deleteDraftNoteId)?.status === 'DRAFT' ? "Are you sure you want to undraft this progress note? This action cannot be undone." : "Are you sure you want to delete this progress note? This action cannot be undone."}
      />
    </div>
  );
}
