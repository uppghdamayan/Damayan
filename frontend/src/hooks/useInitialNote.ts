import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type {
  InitialNoteLogsResponse,
  InitialNoteVersionDetail,
  InitialNoteVersionsResponse,
} from '@/types/initial-note';

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
    role: 'DOCTOR' | 'NURSE' | 'PHARMACIST' | 'ADMIN';
  } | null;
  lastEditor?: {
    firstName: string;
    lastName: string;
    role: 'DOCTOR' | 'NURSE' | 'PHARMACIST' | 'ADMIN';
  } | null;
  isDeleted: boolean;
}

/**
 * Every Initial Note mutation refreshes the same set of caches. Centralised so
 * a new dependent query only has to be added in one place — the individual
 * mutations used to each maintain their own partial list.
 */
function invalidateInitialNote(
  qc: ReturnType<typeof useQueryClient>,
  patientId: string,
) {
  qc.invalidateQueries({ queryKey: ['initial-note', patientId] });
  qc.invalidateQueries({ queryKey: ['initial-notes-all', patientId] });
  qc.invalidateQueries({ queryKey: ['initial-note-logs', patientId] });
  qc.invalidateQueries({ queryKey: ['initial-note-versions'] });
  qc.invalidateQueries({ queryKey: ['progress-notes', patientId] });
  qc.invalidateQueries({ queryKey: ['problems', patientId] });
  // Editing a published note cascades into the problem/medication master lists,
  // so their logs move too.
  qc.invalidateQueries({ queryKey: ['problem-logs', patientId] });
  qc.invalidateQueries({ queryKey: ['medications', patientId] });
  qc.invalidateQueries({ queryKey: ['medication-logs', patientId] });
  qc.invalidateQueries({ queryKey: ['patient', patientId] });
  qc.invalidateQueries({ queryKey: ['visits-infinite', patientId] });
  qc.invalidateQueries({ queryKey: ['audit-logs'] });
}

/** Client-only assessment keys the API does not whitelist. */
const TRANSIENT_ASSESSMENT_KEYS = ['isNew', 'id'];

/**
 * Strips transient client-only keys before the request. The API runs
 * `forbidNonWhitelisted`, so an extra key like the assessment rows' `isNew`
 * flag is a 400 rather than a silently ignored field.
 */
function sanitizeNotePayload(data: Partial<InitialNote>): Partial<InitialNote> {
  if (!Array.isArray(data.assessment)) return data;
  return {
    ...data,
    assessment: data.assessment.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(item)) {
        if (!TRANSIENT_ASSESSMENT_KEYS.includes(key)) clean[key] = value;
      }
      return clean;
    }),
  };
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

/** Patient-scoped master change log for the Initial Note. */
export function useInitialNoteLogs(patientId: string | null) {
  return useQuery<InitialNoteLogsResponse>({
    queryKey: ['initial-note-logs', patientId],
    queryFn: () =>
      apiRequest<InitialNoteLogsResponse>(
        `/patients/${patientId}/initial-note/logs`,
      ),
    enabled: !!patientId,
    staleTime: 1000 * 20,
  });
}

/** Version metadata for the history rail (no snapshot payload). */
export function useInitialNoteVersions(
  patientId: string | null,
  noteId: string | null,
) {
  return useQuery<InitialNoteVersionsResponse>({
    queryKey: ['initial-note-versions', noteId],
    queryFn: () =>
      apiRequest<InitialNoteVersionsResponse>(
        `/patients/${patientId}/initial-note/${noteId}/versions`,
      ),
    enabled: !!patientId && !!noteId,
  });
}

/** One version with its full snapshot. Snapshots are immutable — never stale. */
export function useInitialNoteVersion(
  patientId: string | null,
  noteId: string | null,
  versionId: string | null,
) {
  return useQuery<InitialNoteVersionDetail>({
    queryKey: ['initial-note-version', versionId],
    queryFn: () =>
      apiRequest<InitialNoteVersionDetail>(
        `/patients/${patientId}/initial-note/${noteId}/versions/${versionId}`,
      ),
    enabled: !!patientId && !!noteId && !!versionId,
    staleTime: Infinity,
  });
}

export function useCreateInitialNote(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InitialNote>) =>
      apiRequest<InitialNote>(`/patients/${patientId}/initial-note`, {
        method: 'POST',
        body: JSON.stringify(sanitizeNotePayload(data)),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['initial-note', patientId], data);
      invalidateInitialNote(queryClient, patientId);
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
        body: JSON.stringify(sanitizeNotePayload(data)),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['initial-note', patientId], data);
      invalidateInitialNote(queryClient, patientId);
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
      invalidateInitialNote(queryClient, patientId);
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
      invalidateInitialNote(queryClient, patientId);
    },
  });
}
