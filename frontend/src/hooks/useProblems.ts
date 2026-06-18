import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { Problem, ProblemsResponse, ProblemStatusValue } from '@/types/problem';

export function useProblems(patientId: string | null) {
  return useQuery<ProblemsResponse>({
    queryKey: ['problems', patientId],
    queryFn: () => apiRequest<ProblemsResponse>(`/patients/${patientId}/problems`),
    enabled: !!patientId,
    staleTime: 1000 * 20,
  });
}

interface CreateProblemInput {
  title: string;
  icdCode?: string | null;
  parentId?: string;
}
interface UpdateProblemInput {
  id: string;
  title?: string;
  icdCode?: string | null;
  status?: ProblemStatusValue;
  parentId?: string | null;
}
interface ReorderInput {
  items: { id: string; sortOrder: number }[];
}

function invalidateProblems(qc: ReturnType<typeof useQueryClient>, patientId: string) {
  qc.invalidateQueries({ queryKey: ['problems', patientId] });
  qc.invalidateQueries({ queryKey: ['patient', patientId] }); // refreshes Patient._count.problems
}

export function useCreateProblem(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProblemInput) =>
      apiRequest<Problem>(`/patients/${patientId}/problems`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateProblems(qc, patientId),
  });
}

export function useUpdateProblem(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProblemInput) =>
      apiRequest<Problem>(`/patients/${patientId}/problems/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateProblems(qc, patientId),
  });
}

export function useDeleteProblem(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<Problem>(`/patients/${patientId}/problems/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateProblems(qc, patientId),
  });
}

export function useReorderProblems(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReorderInput) =>
      apiRequest<{ updated: number }>(`/patients/${patientId}/problems/reorder`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onMutate: async (input: ReorderInput) => {
      await qc.cancelQueries({ queryKey: ['problems', patientId] });
      const previous = qc.getQueryData<ProblemsResponse>(['problems', patientId]);
      if (previous) {
        const sortMap = new Map(input.items.map((i) => [i.id, i.sortOrder]));
        qc.setQueryData<ProblemsResponse>(['problems', patientId], {
          data: previous.data.map((p) => (sortMap.has(p.id) ? { ...p, sortOrder: sortMap.get(p.id)! } : p)),
        });
      }
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(['problems', patientId], context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['problems', patientId] }),
  });
}
