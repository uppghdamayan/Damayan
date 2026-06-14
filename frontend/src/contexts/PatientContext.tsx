'use client';

import { createContext, useContext } from 'react';
import type { Patient } from '@/types/patient';

interface PatientContextValue {
  patient: Patient | undefined;
  isLoading: boolean;
}

const PatientContext = createContext<PatientContextValue>({
  patient: undefined,
  isLoading: false,
});

export const PatientProvider = PatientContext.Provider;
export const usePatientContext = () => useContext(PatientContext);
