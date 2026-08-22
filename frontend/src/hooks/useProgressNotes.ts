import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { useProblems } from './useProblems';
import { useMedications } from './useMedications';
import { progressDraftKey, clearProgressDrafts } from '@/lib/note-drafts';

export interface NoteVisit {
  id: string;
  visitDatetime: string;
  visitType: 'INITIAL' | 'PROGRESS';
  status: 'DRAFT' | 'PUBLISHED';
}

export interface ProgressNote {
  id: string;
  visitId: string;
  authorId: string | null;
  subjective: string;
  objective: string;
  labs?: string;
  mgmtNonpharm?: string;
  mgmtPharm?: string;
  diagnostics?: string[];
  problemListSnapshot?: any[];
  medicationSnapshot?: any[];
  status: 'DRAFT' | 'PUBLISHED';
  lastEditedBy?: string;
  lastEditedAt?: string;
  createdAt: string;
  updatedAt: string;
  visit?: NoteVisit;
  author?: {
    firstName: string;
    lastName: string;
    role: 'DOCTOR' | 'NURSE' | 'PHARMACIST' | 'ADMIN';
  } | null;
  lastEditor?: {
    firstName: string;
    lastName: string;
    role: 'DOCTOR' | 'NURSE' | 'PHARMACIST' | 'ADMIN';
  } | null;
  isDeleted: boolean;
}

export function useProgressNotes(patientId: string | null, page = 1, limit = 10, excludeDeleted = false) {
  return useQuery({
    queryKey: ['progress-notes', patientId, page, limit, excludeDeleted],
    queryFn: () => apiRequest<{ data: ProgressNote[], meta: any }>(`/patients/${patientId}/progress-notes?page=${page}&limit=${limit}${excludeDeleted ? '&excludeDeleted=true' : ''}`),
    enabled: !!patientId,
    staleTime: 1000 * 20,
    // Consistent with the other patient-scoped paginated hooks — prevents a
    // full-skeleton flash if/when pagination controls are added for the timeline.
    placeholderData: keepPreviousData,
  });
}

export function useProgressNote(noteId: string | null) {
  return useQuery({
    queryKey: ['progress-note', noteId],
    queryFn: () => apiRequest<ProgressNote>(`/patients/dummy/progress-notes/${noteId}`), // patientId doesn't matter for single note get
    enabled: !!noteId,
  });
}

export interface CarryForwardSource {
  sourceNoteId: string | null;
  sourceKind: 'progress' | 'initial' | null;
  sourceVisitDatetime: string | null;
  mgmtNonpharm: string;
  mgmtPharm: string;
  diagnostics: string[];
}

// The single source of truth for "what would the next progress note inherit
// from" — resolved server-side (ProgressNotesService.resolveCarryForwardSource)
// so the form's prefill, the timeline's "Inherited by today's note" pin, and
// the note actually created by POST /progress-notes can never disagree.
// `excludeNoteId` must be passed when prefilling an already-existing draft
// (the note being edited), so it can never resolve to itself.
export function useCarryForwardSource(patientId: string | null, excludeNoteId?: string | null) {
  return useQuery({
    queryKey: ['carry-forward', patientId, excludeNoteId ?? null],
    queryFn: () => apiRequest<CarryForwardSource>(
      `/patients/${patientId}/progress-notes/carry-forward${excludeNoteId ? `?excludeNoteId=${excludeNoteId}` : ''}`
    ),
    enabled: !!patientId,
    staleTime: 1000 * 20,
  });
}

export function useCopyForwardData(patientId: string | null, excludeNoteId?: string | null) {
  const { data: problemsData, isLoading: problemsLoading, isFetching: problemsFetching, refetch: refetchProblems } = useProblems(patientId);
  const { data: medicationsData, isLoading: medicationsLoading, isFetching: medicationsFetching, refetch: refetchMedications } = useMedications(patientId);
  const { data: carryForwardData, isLoading: carryForwardLoading, isFetching: carryForwardFetching, refetch: refetchCarryForward } = useCarryForwardSource(patientId, excludeNoteId);

  const data = useMemo(() => {
    const activeProblems = problemsData?.data.filter(p => p.status === 'ACTIVE') || [];
    // findAll (used by this hook) sorts isActive desc, createdAt desc for the
    // Medications module's own display — re-sort to insertion order (oldest
    // first) here to match the backend's findActiveForPatient, which is what
    // actually gets written into medicationSnapshot on note create/publish.
    const activeMedications = (medicationsData?.data.filter(m => m.isActive) || [])
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return {
      activeProblems,
      activeMedications,
      sourceNoteId: carryForwardData?.sourceNoteId ?? null,
      inheritedDiagnostics: [],
      inheritedMgmtPharm: carryForwardData?.mgmtPharm || '',
      inheritedMgmtNonpharm: carryForwardData?.mgmtNonpharm || '',
    };
  }, [problemsData, medicationsData, carryForwardData]);

  const refetch = useMemo(() => () => {
    refetchProblems();
    refetchMedications();
    refetchCarryForward();
  }, [refetchProblems, refetchMedications, refetchCarryForward]);

  return {
    data,
    isLoading: problemsLoading || medicationsLoading || carryForwardLoading,
    isFetching: problemsFetching || medicationsFetching || carryForwardFetching,
    refetch,
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
      queryClient.invalidateQueries({ queryKey: ['carry-forward', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problem-logs', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (err, variables) => {
      // Not-yet-created note — no id to scope by.
      localStorage.setItem(progressDraftKey(patientId), JSON.stringify(variables));
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
      queryClient.invalidateQueries({ queryKey: ['initial-notes-all', patientId] });
      queryClient.invalidateQueries({ queryKey: ['initial-note', patientId] });
      queryClient.invalidateQueries({ queryKey: ['carry-forward', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits', patientId] });
      queryClient.invalidateQueries({ queryKey: ['latest-vitals', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problem-logs', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (err, variables) => {
      // Not-yet-created note — no id to scope by.
      localStorage.setItem(progressDraftKey(patientId), JSON.stringify(variables));
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
      queryClient.invalidateQueries({ queryKey: ['initial-notes-all', patientId] });
      queryClient.invalidateQueries({ queryKey: ['initial-note', patientId] });
      queryClient.invalidateQueries({ queryKey: ['carry-forward', patientId] });
      queryClient.setQueryData(['progress-note', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problem-logs', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (err, variables) => {
      localStorage.setItem(progressDraftKey(patientId, variables.id), JSON.stringify(variables.data));
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
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['progress-notes', patientId] });
      const previousNotes = queryClient.getQueryData<{ data: ProgressNote[] }>(['progress-notes', patientId]);
      
      if (previousNotes?.data) {
        queryClient.setQueryData(['progress-notes', patientId], {
          ...previousNotes,
          data: previousNotes.data.map((n) => 
            n.id === id ? { ...n, status: 'PUBLISHED' } : n
          )
        });
      }
      return { previousNotes };
    },
    onError: (err, id, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(['progress-notes', patientId], context.previousNotes);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['progress-notes', patientId] });
      queryClient.invalidateQueries({ queryKey: ['initial-notes-all', patientId] });
      queryClient.invalidateQueries({ queryKey: ['initial-note', patientId] });
      queryClient.invalidateQueries({ queryKey: ['carry-forward', patientId] });
      queryClient.setQueryData(['progress-note', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problem-logs', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits-infinite', patientId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      clearProgressDrafts(patientId);
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
      queryClient.invalidateQueries({ queryKey: ['carry-forward', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits-infinite', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problem-logs', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      clearProgressDrafts(patientId);
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
      clearProgressDrafts(patientId);
      queryClient.invalidateQueries({ queryKey: ['progress-notes', patientId] });
      queryClient.invalidateQueries({ queryKey: ['carry-forward', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits-infinite', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['problem-logs', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['initial-note', patientId] });
      queryClient.removeQueries({ queryKey: ['progress-note', deletedId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-notes', patientId] });
    },
  });
}
