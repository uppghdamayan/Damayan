'use client';

import { useParams } from 'next/navigation';
import { usePatient } from '@/hooks/usePatients';
import { PatientBanner } from '@/components/patients/PatientBanner';
import { VitalsStripEmpty } from '@/components/vitals/VitalsStripEmpty';
import { ProblemListCardEmpty } from '@/components/problems/ProblemListCardEmpty';
import { MedicationListCardEmpty } from '@/components/medications/MedicationListCardEmpty';
import { VisitHistoryCard } from '@/components/visits/VisitHistoryCard';

export default function PatientDashboardPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { data: patient, isLoading, isError } = usePatient(patientId);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>Loading patient record…</span>
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <span style={{ fontSize: 13, color: '#991B1B' }}>Patient record not found.</span>
      </div>
    );
  }

  return (
    <>
      {/* Patient Banner */}
      <PatientBanner patient={patient} />

      {/* Vitals Strip (empty state — Phase 10 will replace) */}
      <VitalsStripEmpty patientId={patientId} />

      {/* Problem List + Medications — side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ProblemListCardEmpty />
        <MedicationListCardEmpty />
      </div>

      {/* Visit History */}
      <VisitHistoryCard patientId={patientId} />
    </>
  );
}
