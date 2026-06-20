import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { VitalSign, VitalsResponse, CreateVitalsInput, UpdateVitalsInput } from '@/types/vitals';

export function useVitals(patientId: string | null, page = 1, limit = 10) {
  return useQuery<VitalsResponse>({
    queryKey: ['vitals', patientId, page, limit],
    queryFn: () => apiRequest<VitalsResponse>(`/patients/${patientId}/vitals?page=${page}&limit=${limit}`),
    enabled: !!patientId,
    staleTime: 1000 * 20,
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

function invalidateVitals(qc: ReturnType<typeof useQueryClient>, patientId: string) {
  qc.invalidateQueries({ queryKey: ['vitals', patientId] });
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
