import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { Medication, MedicationsResponse, MedUnitValue } from '@/types/medication';

export function useMedications(patientId: string | null, includeInactive = false) {
  return useQuery<MedicationsResponse>({
    queryKey: ['medications', patientId, includeInactive],
    queryFn: () =>
      apiRequest<MedicationsResponse>(
        `/patients/${patientId}/medications${includeInactive ? '?includeInactive=true' : ''}`,
      ),
    enabled: !!patientId,
    staleTime: 1000 * 20,
  });
}

interface CreateMedicationInput {
  name: string;
  dose: number;
  unit: MedUnitValue;
  instructions?: string;
  quantity?: number;
}
interface UpdateMedicationInput {
  id: string;
  name?: string;
  dose?: number;
  unit?: MedUnitValue;
  instructions?: string | null;
  quantity?: number | null;
}

function invalidateMedications(qc: ReturnType<typeof useQueryClient>, patientId: string) {
  qc.invalidateQueries({ queryKey: ['medications', patientId] });
  qc.invalidateQueries({ queryKey: ['patient', patientId] }); // refreshes any banner-level counts
}

export function useCreateMedication(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMedicationInput) =>
      apiRequest<Medication>(`/patients/${patientId}/medications`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateMedications(qc, patientId),
  });
}

export function useUpdateMedication(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateMedicationInput) =>
      apiRequest<Medication>(`/patients/${patientId}/medications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ['medications', patientId, false] });
      const previous = qc.getQueryData<MedicationsResponse>(['medications', patientId, false]);
      if (previous) {
        qc.setQueryData<MedicationsResponse>(['medications', patientId, false], {
          data: previous.data.map((m) => (m.id === variables.id ? { ...m, ...variables, dose: variables.dose !== undefined ? String(variables.dose) : m.dose } : m)),
        });
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) qc.setQueryData(['medications', patientId, false], context.previous);
    },
    onSettled: () => invalidateMedications(qc, patientId),
  });
}

export function useDeleteMedication(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<Medication>(`/patients/${patientId}/medications/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateMedications(qc, patientId),
  });
}
