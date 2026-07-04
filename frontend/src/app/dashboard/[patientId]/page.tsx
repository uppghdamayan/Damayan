'use client';

import { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePatient } from '@/hooks/usePatients';
import { useAuthStore } from '@/stores/authStore';
import { PatientBanner } from '@/components/patients/PatientBanner';
import { PatientBannerSkeleton } from '@/components/patients/PatientBannerSkeleton';
import { VitalsCard } from '@/components/vitals/VitalsCard';
import { VitalsStripSkeleton } from '@/components/vitals/VitalsStripSkeleton';
import { ProblemListCard } from '@/components/problems/ProblemListCard';
import { MedicationListCard } from '@/components/medications/MedicationListCard';
import { NonPharmacologicCard } from '@/components/patients/NonPharmacologicCard';
import { VisitHistoryCard } from '@/components/visits/VisitHistoryCard';

// Suspense-wrapped data components
function PatientBannerSection({ patientId }: { patientId: string }) {
  const { data: patient, isLoading, isError } = usePatient(patientId);

  if (isLoading) return <PatientBannerSkeleton />;
  if (isError || !patient) {
    return (
      <div className="flex justify-center p-10">
        <span className="text-[13px] text-[#991B1B]">Patient record not found.</span>
      </div>
    );
  }

  return <PatientBanner patient={patient} />;
}

function VitalsSection({ patientId }: { patientId: string }) {
  return <VitalsCard patientId={patientId} />;
}

function ProblemsAndMedsSection({ patientId }: { patientId: string }) {
  return (
    <div className="grid grid-cols-2 @max-[1023px]:grid-cols-1 gap-3">
      <ProblemListCard patientId={patientId} />
      <MedicationListCard patientId={patientId} />
    </div>
  );
}

function VisitHistorySection({ patientId }: { patientId: string }) {
  return <VisitHistoryCard patientId={patientId} />;
}

export default function PatientDashboardPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const canCreateNote = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  return (
    <>
      {/* Inline Dashboard Header — matches wireframe3 pattern */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-text-primary leading-tight font-sans">
            Patient Dashboard
          </h1>
          <span className="text-[12px] text-text-muted">
            Overview · Clinical summary and vitals tracking
          </span>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => router.push(`/dashboard/${patientId}/vitals`)}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer"
          >
            Record Vitals
          </button>
          {canCreateNote && (
            <button
              onClick={() => router.push(`/dashboard/${patientId}/notes`)}
              className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer"
            >
              New Progress Note
            </button>
          )}
        </div>
      </div>

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
        <ProblemsAndMedsSection patientId={patientId} />
      </Suspense>

      {/* Suspense 4: Non-pharmacologic Management */}
      <Suspense fallback={null}>
        <NonPharmacologicCard patientId={patientId} />
      </Suspense>

      {/* Suspense 5: Visit History */}
      <Suspense fallback={null}>
        <VisitHistorySection patientId={patientId} />
      </Suspense>
    </>
  );
}

