import { useInfiniteQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { VisitsResponse } from '@/types/visit';

export function useVisitsInfinite(patientId: string | null) {
  return useInfiniteQuery<VisitsResponse>({
    queryKey: ['visits-infinite', patientId],
    queryFn: ({ pageParam = 1 }) =>
      apiRequest<VisitsResponse>(
        `/patients/${patientId}/visits?page=${pageParam}&limit=10`,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: !!patientId,
    staleTime: 1000 * 30,
    gcTime: 3 * 60 * 1000,
  });
}
