export interface DeletedNote {
  id: string;
  patientId: string;
  visitId: string | null;
  originalNoteId: string;
  noteType: 'INITIAL_NOTE' | 'PROGRESS_NOTE';
  content: any; // The original JSON of the note
  authorId: string | null;
  deletedBy: string | null;
  deletedAt: string;
  originalCreatedAt: string;
  author: { id: string; firstName: string; lastName: string; role: string } | null;
  deletedByUser: { id: string; firstName: string; lastName: string; role: string } | null;
}
