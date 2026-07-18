import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { Medication, MedicationsResponse, MedicationLogsResponse } from '@/types/medication';

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
  dose: string;
  formulation?: string;
  instructions?: string;
  quantity?: number;
}
interface UpdateMedicationInput {
  id: string;
  name?: string;
  dose?: string;
  formulation?: string | null;
  instructions?: string | null;
  quantity?: number | null;
  isActive?: boolean;
}

function invalidateMedications(qc: ReturnType<typeof useQueryClient>, patientId: string) {
  qc.invalidateQueries({ queryKey: ['medications', patientId] });
  qc.invalidateQueries({ queryKey: ['medication-logs', patientId] });
  qc.invalidateQueries({ queryKey: ['patient', patientId] }); // refreshes any banner-level counts
  qc.invalidateQueries({ queryKey: ['audit-logs'] });
}

export function useCreateMedication(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMedicationInput) =>
      apiRequest<Medication>(`/patients/${patientId}/medications`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['medications', patientId, false] });
      await qc.cancelQueries({ queryKey: ['medications', patientId, true] });

      const previousFalse = qc.getQueryData<MedicationsResponse>(['medications', patientId, false]);
      const previousTrue = qc.getQueryData<MedicationsResponse>(['medications', patientId, true]);

      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      const optimisticMedication: Medication = {
        id: optimisticId,
        patientId,
        name: input.name,
        dose: input.dose,
        formulation: input.formulation ?? null,
        instructions: input.instructions ?? null,
        quantity: input.quantity ?? null,
        isActive: true,
        addedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: null,
      };

      if (previousFalse) {
        qc.setQueryData<MedicationsResponse>(['medications', patientId, false], {
          ...previousFalse,
          data: [...previousFalse.data, optimisticMedication],
        });
      }
      if (previousTrue) {
        qc.setQueryData<MedicationsResponse>(['medications', patientId, true], {
          ...previousTrue,
          data: [...previousTrue.data, optimisticMedication],
        });
      }

      return { previousFalse, previousTrue, optimisticId };
    },
    onError: (_err, _input, context) => {
      if (context?.previousFalse) qc.setQueryData(['medications', patientId, false], context.previousFalse);
      if (context?.previousTrue) qc.setQueryData(['medications', patientId, true], context.previousTrue);
    },
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
      await qc.cancelQueries({ queryKey: ['medications', patientId, true] });

      const previousFalse = qc.getQueryData<MedicationsResponse>(['medications', patientId, false]);
      const previousTrue = qc.getQueryData<MedicationsResponse>(['medications', patientId, true]);

      const updater = (previous: MedicationsResponse | undefined) => {
        if (!previous) return previous;
        return {
          ...previous,
          data: previous.data.map((m) =>
            m.id === variables.id
              ? {
                  ...m,
                  ...variables,
                  dose: variables.dose !== undefined ? String(variables.dose) : m.dose,
                }
              : m
          ),
        };
      };

      if (previousFalse) qc.setQueryData<MedicationsResponse>(['medications', patientId, false], updater(previousFalse));
      if (previousTrue) qc.setQueryData<MedicationsResponse>(['medications', patientId, true], updater(previousTrue));

      return { previousFalse, previousTrue };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousFalse) qc.setQueryData(['medications', patientId, false], context.previousFalse);
      if (context?.previousTrue) qc.setQueryData(['medications', patientId, true], context.previousTrue);
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

export function useMedicationLogs(patientId: string | null) {
  return useQuery<MedicationLogsResponse>({
    queryKey: ['medication-logs', patientId],
    queryFn: () => apiRequest<MedicationLogsResponse>(`/patients/${patientId}/medications/logs`),
    enabled: !!patientId,
    staleTime: 1000 * 20,
  });
}
