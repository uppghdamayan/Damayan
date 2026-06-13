import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { PatientsResponse, Patient } from '@/types/patient';

export function usePatients(search = '', page = 1, limit = 100) {
  const params = new URLSearchParams({
    ...(search && { search }),
    page: String(page),
    limit: String(limit),
  });
  return useQuery<PatientsResponse>({
    queryKey: ['patients', search, page, limit],
    queryFn: () => apiRequest<PatientsResponse>(`/patients?${params}`),
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes — retain data after navigating away
    placeholderData: keepPreviousData, // Prevent sidebar blanking on search change
  });
}

export function usePatient(id: string | null) {
  const qc = useQueryClient();
  return useQuery<Patient>({
    queryKey: ['patient', id],
    queryFn: () => apiRequest<Patient>(`/patients/${id}`),
    enabled: !!id,
    // Populate from sidebar list cache before fetching
    initialData: () => {
      if (!id) return undefined;
      const listData = qc.getQueriesData<PatientsResponse>({ queryKey: ['patients'] });
      for (const [, data] of listData) {
        const found = data?.data?.find((p) => p.id === id);
        if (found) return found;
      }
      return undefined;
    },
    initialDataUpdatedAt: () => {
      const state = qc.getQueryState(['patients', '', 1, 200]);
      return state?.dataUpdatedAt;
    },
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: unknown) =>
      apiRequest<Patient>('/patients', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
  });
}
