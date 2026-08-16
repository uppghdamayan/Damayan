import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { DeletedNote } from '@/types/deleted-note';

export function useDeletedNotes(patientId: string | null) {
  return useQuery({
    queryKey: ['deleted-notes', patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const res = await apiRequest<DeletedNote[]>(`/patients/${patientId}/deleted-notes`);
      return res;
    },
    enabled: !!patientId,
  });
}
