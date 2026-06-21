import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useProblems } from './useProblems';
import { useMedications } from './useMedications';

export interface ProgressNote {
  id: string;
  visitId: string;
  authorId: string | null;
  subjective: string;
  objective: string;
  mgmtNonpharm?: string;
  diagnostics?: string[];
  problemListSnapshot?: any[];
  medicationSnapshot?: any[];
  status: 'DRAFT' | 'PUBLISHED';
  lastEditedBy?: string;
  lastEditedAt?: string;
  createdAt: string;
  updatedAt: string;
  visit?: any;
}

export function useProgressNotes(patientId: string | null, page = 1, limit = 10) {
  return useQuery({
    queryKey: ['progress-notes', patientId, page, limit],
    queryFn: () => apiRequest<{ data: ProgressNote[], meta: any }>(`/patients/${patientId}/progress-notes?page=${page}&limit=${limit}`),
    enabled: !!patientId,
  });
}

export function useProgressNote(noteId: string | null) {
  return useQuery({
    queryKey: ['progress-note', noteId],
    queryFn: () => apiRequest<ProgressNote>(`/patients/dummy/progress-notes/${noteId}`), // patientId doesn't matter for single note get
    enabled: !!noteId,
  });
}

export function useCopyForwardData(patientId: string | null) {
  const { data: problemsData, isLoading: problemsLoading } = useProblems(patientId);
  const { data: medicationsData, isLoading: medicationsLoading } = useMedications(patientId);

  const activeProblems = problemsData?.data.filter(p => p.status === 'ACTIVE') || [];
  const activeMedications = medicationsData?.data.filter(m => m.isActive) || [];

  return {
    data: { activeProblems, activeMedications },
    isLoading: problemsLoading || medicationsLoading,
  };
}

export function useCreateProgressNote(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProgressNote>) => 
      apiRequest<ProgressNote>(`/patients/${patientId}/progress-notes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-notes', patientId] });
    },
    onError: (err, variables) => {
      localStorage.setItem(`damayan:draft:${patientId}:progress`, JSON.stringify(variables));
    }
  });
}

export function useUpdateProgressNote(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProgressNote> }) => 
      apiRequest<ProgressNote>(`/patients/${patientId}/progress-notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['progress-notes', patientId] });
      queryClient.setQueryData(['progress-note', data.id], data);
    },
    onError: (err, variables) => {
      localStorage.setItem(`damayan:draft:${patientId}:progress`, JSON.stringify(variables.data));
    }
  });
}

export function usePublishProgressNote(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => 
      apiRequest<ProgressNote>(`/patients/${patientId}/progress-notes/${id}/publish`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['progress-notes', patientId] });
      queryClient.setQueryData(['progress-note', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits-infinite', patientId] });
    },
  });
}
