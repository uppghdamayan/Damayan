export type MedUnitValue = 'MG' | 'G' | 'MCG' | 'ML' | 'UNITS';

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dose: string; // Prisma Decimal serializes as string over JSON
  unit: MedUnitValue;
  formulation: string | null;
  instructions: string | null;
  quantity: number | null;
  isActive: boolean;
  addedBy: string | null;
  createdAt: string;
  updatedAt: string;
  addedByUser?: {
    firstName: string;
    lastName: string;
    role: 'DOCTOR' | 'NURSE' | 'ADMIN';
  } | null;
}

export interface MedicationsResponse {
  data: Medication[];
}

export interface MedicationLog {
  id: string;
  patientId: string;
  medicationId: string | null;
  action: string;
  description: string;
  editorId: string;
  createdAt: string;
  editor: {
    firstName: string;
    lastName: string;
    role: 'DOCTOR' | 'NURSE' | 'ADMIN';
  };
}

export interface MedicationLogsResponse {
  data: MedicationLog[];
}
