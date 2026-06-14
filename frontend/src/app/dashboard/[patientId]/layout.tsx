'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { usePatient } from '@/hooks/usePatients';
import { usePatientStore } from '@/stores/patientStore';
import { ScreenNav } from '@/components/layout/ScreenNav';
import { PatientProvider } from '@/contexts/PatientContext';

export default function PatientWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { patientId } = useParams<{ patientId: string }>();
  const { data: patient, isLoading } = usePatient(patientId);
  const { setActivePatient } = usePatientStore();

  // Sync patient data into store when loaded (handles direct URL navigation)
  useEffect(() => {
    if (patient) setActivePatient(patient);
  }, [patient, setActivePatient]);

  return (
    <PatientProvider value={{ patient, isLoading }}>
      <div className="flex flex-col flex-1 overflow-hidden">
        <ScreenNav patientId={patientId} />
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {children}
        </div>
      </div>
    </PatientProvider>
  );
}
