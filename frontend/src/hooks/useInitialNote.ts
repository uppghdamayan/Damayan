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
  medicationSnapshot?: any[];
  mgmtNonpharm?: string;
  diagnostics?: string[];
  status: 'DRAFT' | 'PUBLISHED';
  lastEditedBy?: string;
  lastEditedAt?: string;
  createdAt: string;
  updatedAt: string;
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
  isDeleted: boolean;
}

export function useInitialNote(patientId: string | null) {
  return useQuery({
    queryKey: ['initial-note', patientId],
    queryFn: () => apiRequest<InitialNote>(`/patients/${patientId}/initial-note`),
    enabled: !!patientId,
    retry: false, // 404 = no note yet; don't retry-storm
  });
}

export function useInitialNotes(patientId: string | null) {
  return useQuery({
    queryKey: ['initial-notes-all', patientId],
    queryFn: () => apiRequest<InitialNote[]>(`/patients/${patientId}/initial-note/all`),
    enabled: !!patientId,
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
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
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
      queryClient.invalidateQueries({ queryKey: ['initial-note', patientId] });
      queryClient.invalidateQueries({ queryKey: ['progress-notes', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits-infinite', patientId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
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
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['initial-note', patientId] });
      await queryClient.cancelQueries({ queryKey: ['initial-notes-all', patientId] });
      
      const previousNote = queryClient.getQueryData<InitialNote>(['initial-note', patientId]);
      const previousAllNotes = queryClient.getQueryData<InitialNote[]>(['initial-notes-all', patientId]);

      if (previousNote?.id === id) {
        queryClient.setQueryData(['initial-note', patientId], { ...previousNote, status: 'PUBLISHED' });
      }
      
      if (previousAllNotes) {
        queryClient.setQueryData(['initial-notes-all', patientId], 
          previousAllNotes.map(n => n.id === id ? { ...n, status: 'PUBLISHED' } : n)
        );
      }
      return { previousNote, previousAllNotes };
    },
    onError: (err, id, context) => {
      if (context?.previousNote !== undefined) {
        queryClient.setQueryData(['initial-note', patientId], context.previousNote);
      }
      if (context?.previousAllNotes !== undefined) {
        queryClient.setQueryData(['initial-notes-all', patientId], context.previousAllNotes);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['initial-note', patientId], data);
      queryClient.invalidateQueries({ queryKey: ['initial-notes-all', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits-infinite', patientId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
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
      queryClient.invalidateQueries({ queryKey: ['initial-notes-all', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits-infinite', patientId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}
