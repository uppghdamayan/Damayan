import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { VisitsResponse } from '@/types/visit';

export function useVisits(patientId: string | null, page = 1, limit = 5) {
  return useQuery<VisitsResponse>({
    queryKey: ['visits', patientId, page, limit],
    queryFn: () =>
      apiRequest<VisitsResponse>(
        `/patients/${patientId}/visits?page=${page}&limit=${limit}`,
      ),
    enabled: !!patientId,
    staleTime: 1000 * 30,
  });
}
