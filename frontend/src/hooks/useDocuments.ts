import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface DocumentDraftData {
  patient: any;
  physician: { id: string; firstName: string; lastName: string } | null;
  candidateDoctors: { id: string; firstName: string; lastName: string }[];
  assessment: { title: string; icdCode?: string }[] | null;
  diagnostics: string[] | null;
  medications: any[];
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
