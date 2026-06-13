import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  });
}

export function usePatient(id: string | null) {
  return useQuery<Patient>({
    queryKey: ['patient', id],
    queryFn: () => apiRequest<Patient>(`/patients/${id}`),
    enabled: !!id,
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
