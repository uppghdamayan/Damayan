import { useRouter } from 'next/navigation';
import { useInitialNote } from '@/hooks/useInitialNote';
import { useUiStore } from '@/stores/uiStore';

export function useNewProgressNoteAction(patientId: string | null) {
  const router = useRouter();
  const { data: initialNote, isLoading } = useInitialNote(patientId || '');
  const { openNewProgressNote } = useUiStore();

  const triggerNewNote = () => {
    if (!patientId) return;
    if (initialNote && initialNote.status === 'PUBLISHED') {
      router.push(`/dashboard/${patientId}/notes`);
      openNewProgressNote(patientId);
    } else {
      router.push(`/dashboard/${patientId}/initial-note`);
    }
  };

  return { triggerNewNote, isLoading };
}
