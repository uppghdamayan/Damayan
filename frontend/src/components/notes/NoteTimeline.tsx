import { useProgressNotes } from '@/hooks/useProgressNotes';
import { useInitialNote } from '@/hooks/useInitialNote';
import { NoteCard } from './NoteCard';
import { useRouter } from 'next/navigation';

interface NoteTimelineProps {
  patientId: string;
  onSelectNote: (id: string) => void;
}

export function NoteTimeline({ patientId, onSelectNote }: NoteTimelineProps) {
  const router = useRouter();
  const { data: initialNote, isLoading: initialLoading } = useInitialNote(patientId);
  const { data: progressNotesResponse, isLoading: progressLoading } = useProgressNotes(patientId);

  if (initialLoading || progressLoading) {
    return <div className="animate-pulse flex flex-col gap-4 p-4">
      <div className="h-24 bg-surface-2 rounded-card" />
      <div className="h-24 bg-surface-2 rounded-card" />
    </div>;
  }

  const progressNotes = progressNotesResponse?.data || [];
  
  // Combine and sort
  const allNotes = [...progressNotes];
  if (initialNote) {
    allNotes.push(initialNote as any);
  }

  allNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleNewNote = () => {
    if (initialNote && initialNote.status === 'PUBLISHED') {
      onSelectNote('new');
    } else {
      router.push(`/dashboard/${patientId}/initial-note`);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-[var(--timeline-w)] flex-shrink-0 border-r border-border h-full bg-surface-2 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Timeline</h2>
        <button 
          onClick={handleNewNote}
          className="h-[24px] px-2 bg-accent text-white rounded text-[10px] font-bold"
        >
          + New Note
        </button>
      </div>

      <div className="flex flex-col gap-3 relative">
        {/* Simple timeline line */}
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border -z-10" />

        {allNotes.length === 0 ? (
          <div className="text-[12px] text-[var(--text-muted)] text-center mt-4">
            No notes yet. Create an Initial Note to begin.
          </div>
        ) : (
          allNotes.map((note) => (
            <div key={note.id} className="relative pl-8">
              <div className="absolute left-1.5 top-5 w-3.5 h-3.5 rounded-full bg-surface border-2 border-accent" />
              <NoteCard 
                note={note} 
                onClickEdit={() => {
                  if (note.visitId && (!note.visit || note.visit.visitType === 'INITIAL') && 'chiefComplaint' in note) {
                    router.push(`/dashboard/${patientId}/initial-note`);
                  } else {
                    onSelectNote(note.id);
                  }
                }} 
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
