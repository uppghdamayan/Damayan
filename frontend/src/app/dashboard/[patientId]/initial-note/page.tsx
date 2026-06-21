'use client';

import { InitialNoteForm } from '@/components/notes/InitialNoteForm';
import { useParams } from 'next/navigation';

export default function InitialNotePage() {
  const params = useParams();
  const patientId = params.patientId as string;

  return (
    <div className="h-full bg-bg">
      <InitialNoteForm patientId={patientId} />
    </div>
  );
}
