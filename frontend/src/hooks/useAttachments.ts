import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export function useAttachmentsByNote(noteType: 'INITIAL_NOTE' | 'PROGRESS_NOTE', noteId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', noteType, noteId],
    queryFn: () => apiRequest<any[]>(`/attachments?noteType=${noteType}&noteId=${noteId}`),
    enabled: !!noteId,
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
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', vars.noteType, vars.noteId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function usePriorLabs(patientId: string) {
  return useQuery({
    queryKey: ['attachments', 'patient', patientId],
    queryFn: () => apiRequest<any[]>(`/attachments?patientId=${patientId}`),
    enabled: !!patientId,
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
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', vars.noteType, vars.noteId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}
