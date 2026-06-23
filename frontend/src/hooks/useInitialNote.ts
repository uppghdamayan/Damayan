import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface InitialNote {
  id: string;
  visitId: string;
  authorId: string | null;
  chiefComplaint: string;
  hpi: string;
  pmhComorbidities?: string;
  pmhSurgeries?: string;
  pmhHospitalizations?: string;
  allergies?: string;
  familyHistory?: string;
  socialHistory?: string;
  obHistory?: string;
  psychosocialHistory?: string;
  physicalExam: string;
  assessment: any[];
  mgmtNonpharm?: string;
  diagnostics?: string[];
  status: 'DRAFT' | 'PUBLISHED';
  lastEditedBy?: string;
  lastEditedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function useInitialNote(patientId: string | null) {
  return useQuery({
    queryKey: ['initial-note', patientId],
    queryFn: () => apiRequest<InitialNote>(`/patients/${patientId}/initial-note`),
    enabled: !!patientId,
    retry: false, // 404 = no note yet; don't retry-storm
  });
}

export function useCreateInitialNote(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InitialNote>) => 
      apiRequest<InitialNote>(`/patients/${patientId}/initial-note`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['initial-note', patientId], data);
    },
    onError: (err, variables) => {
      localStorage.setItem(`damayan:draft:${patientId}:initial`, JSON.stringify(variables));
    }
  });
}

export function useUpdateInitialNote(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InitialNote> }) => 
      apiRequest<InitialNote>(`/patients/${patientId}/initial-note/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['initial-note', patientId], data);
    },
    onError: (err, variables) => {
      localStorage.setItem(`damayan:draft:${patientId}:initial`, JSON.stringify(variables.data));
    }
  });
}

export function usePublishInitialNote(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => 
      apiRequest<InitialNote>(`/patients/${patientId}/initial-note/${id}/publish`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['initial-note', patientId], data);
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits-infinite', patientId] });
    },
  });
}

export function useDeleteInitialNote(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => 
      apiRequest<{ success: boolean }>(`/patients/${patientId}/initial-note/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.setQueryData(['initial-note', patientId], null);
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits-infinite', patientId] });
    },
  });
}
