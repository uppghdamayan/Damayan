import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { VitalSign, VitalsResponse, CreateVitalsInput, UpdateVitalsInput } from '@/types/vitals';

export function useVitals(patientId: string | null, page = 1, limit = 10) {
  return useQuery<VitalsResponse>({
    queryKey: ['vitals', patientId, page, limit],
    queryFn: () => apiRequest<VitalsResponse>(`/patients/${patientId}/vitals?page=${page}&limit=${limit}`),
    enabled: !!patientId,
    staleTime: 1000 * 20,
    // Keep the current page visible while the next page loads so paging never
    // tears the whole table out for a full skeleton (isLoading stays false after
    // the first fetch). Only the paginated list uses this — not useLatestVitals,
    // whose result must never show a different patient's reading during a switch.
    placeholderData: keepPreviousData,
  });
}

export function useLatestVitals(patientId: string | null) {
  return useQuery<VitalSign | null>({
    queryKey: ['vitals', patientId, 'latest'],
    queryFn: () => apiRequest<VitalSign | null>(`/patients/${patientId}/vitals/latest`),
    enabled: !!patientId,
    staleTime: 1000 * 20,
  });
}

// First vitals recorded at or before `cutoff` (e.g. a published note's createdAt) —
// pins a note's vitals snapshot to the time of the visit instead of drifting to
// whatever is most recent as new vitals get logged later.
export function useVitalsAsOf(patientId: string | null, cutoff: string | null) {
  return useQuery<VitalSign | null>({
    queryKey: ['vitals', patientId, 'as-of', cutoff],
    queryFn: () => apiRequest<VitalSign | null>(`/patients/${patientId}/vitals/as-of?cutoff=${encodeURIComponent(cutoff!)}`),
    enabled: !!patientId && !!cutoff,
    staleTime: 1000 * 20,
  });
}

function invalidateVitals(qc: ReturnType<typeof useQueryClient>, patientId: string) {
  qc.invalidateQueries({ queryKey: ['vitals', patientId] });
  qc.invalidateQueries({ queryKey: ['audit-logs'] });
}

export function useCreateVitals(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVitalsInput) =>
      apiRequest<VitalSign>(`/patients/${patientId}/vitals`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateVitals(qc, patientId),
  });
}

export function useUpdateVitals(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateVitalsInput & { id: string }) =>
      apiRequest<VitalSign>(`/patients/${patientId}/vitals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateVitals(qc, patientId),
  });
}

export function useDeleteVitals(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<VitalSign>(`/patients/${patientId}/vitals/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateVitals(qc, patientId),
  });
}
