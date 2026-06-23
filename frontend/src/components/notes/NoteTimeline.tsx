import { useProgressNotes } from '@/hooks/useProgressNotes';
import { useInitialNote, useDeleteInitialNote } from '@/hooks/useInitialNote';
import { useNewProgressNoteAction } from '@/hooks/useNewProgressNoteAction';
import { TimelineEntry } from './TimelineEntry';
import { useRouter } from 'next/navigation';
import { useUiStore } from '@/stores/uiStore';
import { useState, useMemo } from 'react';
import { mapNoteToTimelineView } from '@/lib/notes-utils';
import { Button } from '@/components/ui/button';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { ClipboardList, ArrowRight, Trash2 } from 'lucide-react';
import { useDeleteAllDraftProgressNotes, useDeleteProgressNote } from '@/hooks/useProgressNotes';


interface NoteTimelineProps {
  patientId: string;
}

export function NoteTimeline({ patientId }: NoteTimelineProps) {
  const router = useRouter();
  const { data: initialNote, isLoading: initialLoading } = useInitialNote(patientId);
  const { data: progressNotesResponse, isLoading: progressLoading } = useProgressNotes(patientId);
  const { openExistingProgressNote, activeNoteEditor } = useUiStore();
  const { triggerNewNote, isLoading: actionLoading } = useNewProgressNoteAction(patientId);
  const deleteMutation = useDeleteInitialNote(patientId);

  // Set to track expanded notes (intentional: multiple notes can be open at once)
  // Decided per fix.md §6.4.
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteDraftNoteId, setDeleteDraftNoteId] = useState<string | null>(null);
  const [showClearDraftsModal, setShowClearDraftsModal] = useState(false);

  const deleteAllDraftsMutation = useDeleteAllDraftProgressNotes(patientId);
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
  if (initialNote) {
    allNotesRaw.push(initialNote as any);
  }

  const hasDrafts = allNotesRaw.some((note) => note.status === 'DRAFT' && 'subjective' in note);

  // Sort chronologically (newest first)
  allNotesRaw.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Map to TimelineNoteView and identify latest
  const mappedNotes = useMemo(() => {
    return allNotesRaw.map((note, index) => {
      // The latest note is the first one in the sorted list (since newest first)
      const isLatest = index === 0;
      return mapNoteToTimelineView(note, isLatest);
    });
  }, [allNotesRaw]);

  if (initialLoading || progressLoading || actionLoading) {
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
          {hasDrafts && (
            <button 
              onClick={() => setShowClearDraftsModal(true)}
              className="h-[24px] px-3 bg-red hover:bg-red-hover text-white rounded text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Clear Drafts
            </button>
          )}
          {initialNote?.status === 'PUBLISHED' && !hasDrafts && (
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
        {/* Simple timeline line */}
        {mappedNotes.length > 0 && (
          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border -z-10" />
        )}

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

            return (
              <div key={note.id} className="relative pl-8">
                <div className="absolute left-1.5 top-5 w-3.5 h-3.5 rounded-full bg-surface border-2 border-accent" />
                <TimelineEntry 
                  note={note}
                  previousNote={previousNote}
                  isOpen={expandedNotes.has(note.id)}
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
                    (note.kind === 'initial' && mappedNotes.length === 1 && note.status !== 'DRAFT')
                      ? () => setDeleteNoteId(note.id)
                      : (note.kind === 'progress' && note.status === 'DRAFT')
                        ? () => setDeleteDraftNoteId(note.id)
                        : undefined
                  }
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
        open={showClearDraftsModal}
        onClose={() => setShowClearDraftsModal(false)}
        onConfirm={() => {
          deleteAllDraftsMutation.mutate(undefined, {
            onSuccess: () => setShowClearDraftsModal(false),
          });
        }}
        isDeleting={deleteAllDraftsMutation.isPending}
        title="Clear Draft Progress Notes"
        message="Are you sure you want to delete all draft progress notes for this patient? This action cannot be undone."
      />

      <DeleteConfirmModal
        open={!!deleteDraftNoteId}
        onClose={() => setDeleteDraftNoteId(null)}
        onConfirm={() => {
          if (deleteDraftNoteId) {
            deleteProgressNoteMutation.mutate(deleteDraftNoteId, {
              onSuccess: () => setDeleteDraftNoteId(null),
            });
          }
        }}
        isDeleting={deleteProgressNoteMutation.isPending}
        title="Delete Progress Note Draft"
        message="Are you sure you want to delete this draft? This action cannot be undone."
      />
    </div>
  );
}
