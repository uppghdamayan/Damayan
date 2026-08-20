import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

// Assessment row: the live ACTIVE Problem list, DFS-flattened server-side
// (backend/src/problems/problem-tree.util.ts) — same shape and nesting the
// Problem List and Progress Note assessment use, so `depth` always reflects
// real parent/child structure rather than a guessed indent.
export interface DocumentDraftAssessmentItem {
  id: string;
  title: string;
  parentId: string | null;
  diagnosisDate?: string | null;
  depth: number;
}

export interface DocumentDraftMedicationItem {
  id: string;
  name: string;
  dose: string;
  formulation: string | null;
  instructions: string | null;
  quantity: number | null;
}

export interface DocumentDraftData {
  patient: any;
  physician: { id: string; firstName: string; lastName: string; role?: string } | null;
  candidateDoctors: { id: string; firstName: string; lastName: string; role?: string }[];
  assessment: DocumentDraftAssessmentItem[] | null;
  diagnostics: string[] | null;
  medications: DocumentDraftMedicationItem[];
  chiefComplaintDefault?: string;
  latestVisitDate?: string | null;
}

export function useDocumentDraft(patientId: string, type: string, visitId?: string, enabled = true) {
  return useQuery({
    queryKey: ['documents', patientId, 'draft', type, visitId],
    queryFn: () => apiRequest<DocumentDraftData>(
      `/patients/${patientId}/documents/draft?type=${type}${visitId ? `&visitId=${visitId}` : ''}`
    ),
    enabled: enabled && !!patientId && !!type,
    staleTime: 0, // always fresh — clinical data changes frequently
  });
}

export function useDocuments(patientId: string) {
  return useQuery({
    queryKey: ['documents', patientId],
    queryFn: () => apiRequest<any[]>(`/patients/${patientId}/documents`),
    enabled: !!patientId,
    staleTime: 1000 * 20,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useGenerateDocument(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, any>) => 
      apiRequest<any>(`/patients/${patientId}/documents/generate`, {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', patientId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useDocumentDownloadUrl(patientId: string, documentId: string) {
  return useQuery({
    queryKey: ['documents', documentId, 'download'],
    queryFn: () => apiRequest<{url: string}>(`/patients/${patientId}/documents/${documentId}/download`).then(res => res.url),
    enabled: false,
  });
}

export function useDeleteDocument(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => 
      apiRequest<any>(`/patients/${patientId}/documents/${documentId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', patientId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}
