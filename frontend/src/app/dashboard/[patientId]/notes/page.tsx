'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { NoteTimeline } from '@/components/notes/NoteTimeline';
import { ProgressNoteForm } from '@/components/notes/ProgressNoteForm';

export default function NotesPage() {
  const params = useParams();
  const patientId = params.patientId as string;
  const [selectedNoteId, setSelectedNoteId] = useState<string | null | undefined>(null);

  return (
    <div className="flex h-full bg-bg overflow-hidden">
      <NoteTimeline 
        patientId={patientId} 
        onSelectNote={(id) => setSelectedNoteId(id === 'new' ? undefined : id)} 
      />
      <div className="flex-1 border-l border-border bg-surface overflow-hidden">
        {selectedNoteId !== null || selectedNoteId === undefined ? (
          <ProgressNoteForm 
            patientId={patientId} 
            noteId={selectedNoteId === 'new' ? undefined : selectedNoteId} 
            onClose={() => setSelectedNoteId(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[13px] text-[var(--text-muted)]">
            Select a note from the timeline or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}
