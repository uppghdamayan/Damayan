import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useAttachmentsByNote(noteType: 'INITIAL_NOTE' | 'PROGRESS_NOTE', noteId: string | undefined) {
  const isUuid = !!noteId && UUID_REGEX.test(noteId);

  return useQuery({
    queryKey: ['attachments', noteType, noteId],
    queryFn: () => apiRequest<any[]>(`/attachments?noteType=${noteType}&noteId=${noteId}`),
    enabled: isUuid,
    staleTime: 1000 * 20,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { file?: File; patientId: string; noteType: string; noteId: string; tag: string; textResult?: string; onProgress?: (percent: number) => void }) => {
      const formData = new FormData();
      if (params.file) formData.append('file', params.file);
      formData.append('patientId', params.patientId);
      formData.append('noteType', params.noteType);
      formData.append('noteId', params.noteId);
      formData.append('tag', params.tag);
      if (params.textResult) formData.append('textResult', params.textResult);
      
      return apiRequest<any>('/attachments/upload', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function usePriorLabs(patientId: string) {
  const isUuid = !!patientId && UUID_REGEX.test(patientId);
  return useQuery({
    queryKey: ['attachments', 'patient', patientId],
    queryFn: () => apiRequest<any[]>(`/attachments?patientId=${patientId}`),
    enabled: isUuid,
    staleTime: 1000 * 20,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useAttachmentDownloadUrl(id: string) {
  return useQuery({
    queryKey: ['attachments', id, 'download'],
    queryFn: () => apiRequest<{url: string}>(`/attachments/${id}/download`).then(res => res.url),
    enabled: false, 
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string, noteType: string, noteId: string }) => apiRequest<any>(`/attachments/${params.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}
