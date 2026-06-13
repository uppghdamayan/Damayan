import { create } from 'zustand';

interface PatientSummary {
  id: string;
  patientCode: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  extension?: string | null;
  sex: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth: string;
  allergies?: string | null;
  addressBarangay?: string | null;
  addressCity?: string | null;
  addressRegion?: string | null;
}

interface PatientState {
  activePatient: PatientSummary | null;
  setActivePatient: (patient: PatientSummary | null) => void;
}

export const usePatientStore = create<PatientState>((set) => ({
  activePatient: null,
  setActivePatient: (patient) => set({ activePatient: patient }),
}));
