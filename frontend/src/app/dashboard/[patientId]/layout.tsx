'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { usePatient } from '@/hooks/usePatients';
import { usePatientStore } from '@/stores/patientStore';
import { ScreenNav } from '@/components/layout/ScreenNav';

export default function PatientWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { patientId } = useParams<{ patientId: string }>();
  const { data: patient } = usePatient(patientId);
  const { setActivePatient } = usePatientStore();

  // Sync patient data into store when loaded (handles direct URL navigation)
  useEffect(() => {
    if (patient) setActivePatient(patient);
  }, [patient, setActivePatient]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <ScreenNav patientId={patientId} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}
