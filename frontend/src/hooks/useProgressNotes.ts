import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { useProblems } from './useProblems';
import { useMedications } from './useMedications';

export interface ProgressNote {
  id: string;
  visitId: string;
  authorId: string | null;
  subjective: string;
  objective: string;
  labs?: string;
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
  author?: {
    firstName: string;
    lastName: string;
    role: 'DOCTOR' | 'NURSE' | 'ADMIN';
  } | null;
  lastEditor?: {
    firstName: string;
    lastName: string;
    role: 'DOCTOR' | 'NURSE' | 'ADMIN';
  } | null;
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
  const { data: notesData, isLoading: notesLoading } = useProgressNotes(patientId, 1, 1);

  const data = useMemo(() => {
    const activeProblems = problemsData?.data.filter(p => p.status === 'ACTIVE') || [];
    const activeMedications = medicationsData?.data.filter(m => m.isActive) || [];
    const latestDiagnostics = notesData?.data?.[0]?.diagnostics || [];
    return { activeProblems, activeMedications, latestDiagnostics };
  }, [problemsData, medicationsData, notesData]);

  return {
    data,
    isLoading: problemsLoading || medicationsLoading || notesLoading,
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
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (err, variables) => {
      localStorage.setItem(`damayan:draft:${patientId}:progress`, JSON.stringify(variables));
    }
  });
}

export function useCreateAndPublishProgressNote(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProgressNote>) => 
      apiRequest<ProgressNote>(`/patients/${patientId}/progress-notes/create-and-publish`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-notes', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits', patientId] });
      queryClient.invalidateQueries({ queryKey: ['latest-vitals', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
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
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
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
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useDeleteAllDraftProgressNotes(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => 
      apiRequest<{ count: number }>(`/patients/${patientId}/progress-notes/drafts`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-notes', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits-infinite', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      localStorage.removeItem(`damayan:draft:${patientId}:progress`);
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useDeleteProgressNote(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => 
      apiRequest<{ success: boolean }>(`/patients/${patientId}/progress-notes/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['progress-notes', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits-infinite', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.removeQueries({ queryKey: ['progress-note', deletedId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}
