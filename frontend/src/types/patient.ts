export interface Patient {
  id: string;
  patientCode: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  extension?: string | null;
  sex: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth: string;
  addressStreet?: string | null;
  addressBarangay?: string | null;
  addressCity?: string | null;
  addressRegion?: string | null;
  addressCountry: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  allergies?: string | null;
  _count?: {
    problems: number;
    medications: number;
    visits: number;
  };
}

export interface PatientsResponse {
  data: Patient[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
