export interface VisitPhysician {
  firstName: string;
  lastName: string;
  middleName?: string | null;
}

export interface Visit {
  id: string;
  patientId: string;
  physicianId: string;
  visitDatetime: string;
  visitType: 'INITIAL' | 'PROGRESS';
  status: 'DRAFT' | 'PUBLISHED';
  problemChanges?: { added: any[]; removed: any[] } | null;
  medicationChanges?: { added: any[]; removed: any[] } | null;
  createdAt: string;
  updatedAt: string;
  physician?: VisitPhysician;
  initialNote?: { status: string; chiefComplaint: string } | null;
  progressNote?: { status: string; subjective: string } | null;
}

export interface VisitsResponse {
  data: Visit[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
