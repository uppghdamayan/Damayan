import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export function useDocuments(patientId: string) {
  return useQuery({
    queryKey: ['documents', patientId],
    queryFn: () => apiRequest<any[]>(`/patients/${patientId}/documents`),
    enabled: !!patientId,
  });
}

export function useGenerateDocument(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { type: string; visitId?: string }) => 
      apiRequest<any>(`/patients/${patientId}/documents/generate`, {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', patientId] }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', patientId] }),
  });
}
