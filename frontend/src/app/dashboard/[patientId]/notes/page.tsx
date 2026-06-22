'use client';

import { useParams } from 'next/navigation';
import { NoteTimeline } from '@/components/notes/NoteTimeline';

export default function NotesPage() {
  const params = useParams();
  const patientId = params.patientId as string;

  return (
    <div className="flex h-full bg-bg overflow-hidden">
      <NoteTimeline patientId={patientId} />
    </div>
  );
}
