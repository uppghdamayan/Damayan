'use client';

import { useEffect, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { usePatient } from '@/hooks/usePatients';
import { usePatientStore } from '@/stores/patientStore';
import { ScreenNav } from '@/components/layout/ScreenNav';
import { PatientProvider } from '@/contexts/PatientContext';

const getHeaderInfo = (pathname: string, patientId: string) => {
  const cleanPath = pathname.replace(`/dashboard/${patientId}`, '').toLowerCase();
  
  if (cleanPath === '' || cleanPath === '/') {
    return {
      title: 'Patient Dashboard',
      subtitle: 'Clinical summary and vitals tracking',
    };
  }
  if (cleanPath.startsWith('/vitals')) {
    return {
      title: 'Vital Signs',
      subtitle: 'Complete history of recorded vitals',
    };
  }
  if (cleanPath.startsWith('/notes')) {
    return {
      title: 'Note Timeline',
      subtitle: 'View history of consultation notes',
    };
  }
  if (cleanPath.startsWith('/initial-note')) {
    return {
      title: 'Initial Consultation Note',
      subtitle: 'Complete clinical note for this visit',
    };
  }
  if (cleanPath.startsWith('/problems')) {
    return {
      title: 'Problem List',
      subtitle: 'Master Problem List',
    };
  }
  if (cleanPath.startsWith('/medications')) {
    return {
      title: 'Medication List',
      subtitle: 'Carries forward to all subsequent consultations',
    };
  }
  if (cleanPath.startsWith('/documents')) {
    return {
      title: 'Document Generation',
      subtitle: 'Generate clinical reports',
    };
  }
  if (cleanPath.startsWith('/logs')) {
    return {
      title: 'Activity Logs',
      subtitle: 'Audit trail of patient record updates',
    };
  }
  return {
    title: 'Patient Workspace',
    subtitle: 'Clinical summary',
  };
};

export default function PatientWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { patientId } = useParams<{ patientId: string }>();
  const pathname = usePathname();
  const { data: patient, isLoading } = usePatient(patientId);
  const { setActivePatient } = usePatientStore();

  // Sync patient data into store when loaded (handles direct URL navigation)
  useEffect(() => {
    if (patient) setActivePatient(patient);
  }, [patient, setActivePatient]);

  const patientName = patient ? `${patient.lastName}, ${patient.firstName}` : '';
  const { title, subtitle } = getHeaderInfo(pathname, patientId);

  // Dashboard route gets its own inline header — skip the standalone title block
  const isDashboard = useMemo(() => {
    const cleanPath = pathname.replace(`/dashboard/${patientId}`, '').toLowerCase();
    return cleanPath === '' || cleanPath === '/';
  }, [pathname, patientId]);

  return (
    <PatientProvider value={{ patient, isLoading }}>
      <div className="flex flex-col flex-1 overflow-hidden">
        <ScreenNav patientId={patientId} />
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3">
            {!isDashboard && (
              <div className="border-b border-border/40 pb-3">
                <div className="flex flex-col gap-0.5">
                  <h1 className="text-[20px] font-bold tracking-tight text-text-primary leading-tight font-sans">
                    {title}
                  </h1>
                  <span className="text-[11px] text-text-muted font-medium mt-0.5">
                    {subtitle}
                  </span>
                </div>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </PatientProvider>
  );
}

