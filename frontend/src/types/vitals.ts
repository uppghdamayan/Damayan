export interface VitalsMeasuredByUser {
  firstName: string;
  lastName: string;
  role: 'DOCTOR' | 'NURSE' | 'ADMIN';
}

export interface VitalSign {
  id: string;
  patientId: string;
  visitId: string | null;
  sbp: number | null;
  dbp: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  temperature: string | null; // Prisma Decimal serializes as string
  oxygenSaturation: number | null;
  measuredBy: string | null;
  measuredAt: string;
  createdAt: string;
  measuredByUser?: VitalsMeasuredByUser | null;
}

export interface VitalsResponse {
  data: VitalSign[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateVitalsInput {
  sbp?: number;
  dbp?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  measuredAt: string;
}

export type UpdateVitalsInput = Partial<CreateVitalsInput>;
