'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { usePatient } from '@/hooks/usePatients';
import { PatientBanner } from '@/components/patients/PatientBanner';
import { PatientBannerSkeleton } from '@/components/patients/PatientBannerSkeleton';
import { VitalsStripEmpty } from '@/components/vitals/VitalsStripEmpty';
import { VitalsStripSkeleton } from '@/components/vitals/VitalsStripSkeleton';
import { ProblemListCardEmpty } from '@/components/problems/ProblemListCardEmpty';
import { MedicationListCardEmpty } from '@/components/medications/MedicationListCardEmpty';
import { VisitHistoryCard } from '@/components/visits/VisitHistoryCard';

// Suspense-wrapped data components
function PatientBannerSection({ patientId }: { patientId: string }) {
  const { data: patient, isLoading, isError } = usePatient(patientId);

  if (isLoading) return <PatientBannerSkeleton />;
  if (isError || !patient) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <span style={{ fontSize: 13, color: '#991B1B' }}>Patient record not found.</span>
      </div>
    );
  }

  return <PatientBanner patient={patient} />;
}

function VitalsSection({ patientId }: { patientId: string }) {
  return <VitalsStripEmpty patientId={patientId} />;
}

function ProblemsAndMedsSection() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <ProblemListCardEmpty />
      <MedicationListCardEmpty />
    </div>
  );
}

function VisitHistorySection({ patientId }: { patientId: string }) {
  return <VisitHistoryCard patientId={patientId} />;
}

export default function PatientDashboardPage() {
  const { patientId } = useParams<{ patientId: string }>();

  return (
    <>
      {/* Suspense 1: Patient Banner */}
      <Suspense fallback={<PatientBannerSkeleton />}>
        <PatientBannerSection patientId={patientId} />
      </Suspense>

      {/* Suspense 2: Vitals Strip */}
      <Suspense fallback={<VitalsStripSkeleton />}>
        <VitalsSection patientId={patientId} />
      </Suspense>

      {/* Suspense 3: Problem List + Medications */}
      <Suspense fallback={null}>
        <ProblemsAndMedsSection />
      </Suspense>

      {/* Suspense 4: Visit History */}
      <Suspense fallback={null}>
        <VisitHistorySection patientId={patientId} />
      </Suspense>
    </>
  );
}
