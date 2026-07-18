'use client';

import { useEffect, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { usePatient } from '@/hooks/usePatients';
import { usePatientStore } from '@/stores/patientStore';
import { ScreenNav } from '@/components/layout/ScreenNav';
import { PatientProvider } from '@/contexts/PatientContext';
import { calcAge, initials } from '@/lib/patient-utils';

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

  const age = patient ? calcAge(patient.dateOfBirth) : 0;
  const dob = patient
    ? new Date(patient.dateOfBirth).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const sexLabel = patient
    ? patient.sex === 'MALE'
      ? 'Male'
      : patient.sex === 'FEMALE'
      ? 'Female'
      : 'Other'
    : '';
  const addressParts = patient
    ? [
        patient.addressStreet,
        patient.addressBarangay,
        patient.addressCity,
        patient.addressRegion,
        'Philippines',
      ].filter(Boolean)
    : [];
  const addressStr = addressParts.length > 0 ? addressParts.join(', ') : 'Not documented';

  const patientName = patient ? `${patient.lastName}, ${patient.firstName}` : '';
  const { title, subtitle } = getHeaderInfo(pathname, patientId);

  // Sync patient data into store when loaded (handles direct URL navigation)
  useEffect(() => {
    if (patient) setActivePatient(patient);
  }, [patient, setActivePatient]);

  // Dashboard route gets its own inline header — skip the standalone title block
  const isDashboard = useMemo(() => {
    const cleanPath = pathname.replace(`/dashboard/${patientId}`, '').toLowerCase();
    return cleanPath === '' || cleanPath === '/';
  }, [pathname, patientId]);

  const displaySubtitle = pathname.includes('/logs')
    ? `Track changes, updates, and events${patientName ? ` · ${patientName}` : ''}`
    : subtitle;

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
                    {displaySubtitle}
                  </span>
                </div>
              </div>
            )}
            {!isDashboard && patient && (
              <div className="bg-surface border border-border rounded-card p-4 flex gap-5 items-stretch flex-wrap shadow-card w-full mb-1">
                {/* Left Column: Avatar + Name */}
                <div className="flex gap-3.5 items-center flex-[1.2] min-w-[250px] border-r border-border pr-5">
                  <div className="w-11 h-11 rounded-full bg-accent-light border-2 border-accent flex items-center justify-center text-[15px] font-bold text-accent-hover flex-shrink-0">
                    {initials(patient.firstName, patient.lastName)}
                  </div>
                  <div className="text-[12px] flex flex-col gap-1 min-w-0">
                    <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px]">Patient Name</span>
                    <span className="text-[18px] font-bold text-text-primary leading-tight truncate" title={`${patient.lastName}, ${patient.firstName}`}>
                      {patient.lastName}, {patient.firstName}
                      {patient.middleName ? ` ${patient.middleName}` : ''}
                      {patient.extension ? ` ${patient.extension}` : ''}
                    </span>
                    <span className="font-mono text-[10px] text-text-muted mt-1 bg-surface-2 border border-border rounded px-1.5 py-[1px] w-fit leading-none">
                      #{patient.patientCode}
                    </span>
                  </div>
                </div>

                {/* Right Column: Demographics */}
                <div className="flex flex-col gap-2 flex-1 min-w-[280px] justify-center pl-5">
                  <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                    <div>
                      <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px] block">Sex</span>
                      <strong className="text-text-primary text-[12px]">{sexLabel}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px] block">Age</span>
                      <strong className="text-text-primary text-[12px]">{age} yrs</strong>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px] block">Birthdate</span>
                      <strong className="text-text-primary text-[12px]" title={dob}>{dob}</strong>
                    </div>
                    <div className="col-span-3">
                      <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px] block">Address</span>
                      <span className="text-text-secondary text-[12px] truncate block" title={addressStr}>{addressStr}</span>
                    </div>
                  </div>
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

