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
