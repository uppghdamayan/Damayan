'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '@/stores/uiStore';
import { usePatientStore } from '@/stores/patientStore';
import { usePatients } from '@/hooks/usePatients';
import { useAuthStore } from '@/stores/authStore';
import { groupByLetter, calcAge, initials } from '@/lib/patient-utils';
import { NewPatientModal } from '@/components/patients/NewPatientModal';
import { SidebarSkeleton } from '@/components/layout/SidebarSkeleton';
import { apiRequest } from '@/lib/api';
import type { Patient } from '@/types/patient';

export function Sidebar() {
  const { sidebarCollapsed } = useUiStore();
  const { activePatient, setActivePatient } = usePatientStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [newPatientOpen, setNewPatientOpen] = useState(false);

  const { data, isLoading } = usePatients(search, 1, 200);
  const patients = data?.data ?? [];

  const grouped = useMemo(() => groupByLetter(patients), [patients]);

  const canCreatePatient = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const handleSelect = (p: Patient) => {
    setActivePatient(p);
    router.push(`/dashboard/${p.id}`);
  };

  const handlePrefetch = (patientId: string) => {
    qc.prefetchQuery({
      queryKey: ['patient', patientId],
      queryFn: () => apiRequest(`/patients/${patientId}`),
      staleTime: 30000,
    });
  };

  return (
    <>
      <aside
        suppressHydrationWarning
        className={`bg-white flex flex-col h-full shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarCollapsed ? 'w-0 border-r border-transparent' : 'w-[280px] border-r border-[#D1D5E0]'}`}
      >
        {/* Inner wrapper to prevent content from squishing during collapse */}
        <div className="w-[280px] min-w-[280px] flex flex-col h-full">
          {/* Search + Add zone */}
          <div className="pt-2.5 pb-1.5 px-2.5 border-b border-[#D1D5E0] shrink-0">
            {/* Search */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients…"
              className="w-full h-[34px] px-2.5 bg-[#F7F8FA] border border-[#D1D5E0] rounded-md text-xs text-[#0D1117] outline-none box-border mb-2 font-sans focus:border-[#0A6E5F] focus:ring-[3px] focus:ring-[#0A6E5F]/12 transition-all"
            />
            {/* Add new patient */}
            {canCreatePatient && (
              <button
                onClick={() => setNewPatientOpen(true)}
                className="w-full h-[30px] bg-[#0A6E5F] text-white border border-[#085A4E] rounded-md text-[11px] font-semibold cursor-pointer box-border font-sans"
              >
                + New Patient
              </button>
            )}
          </div>

          {/* Patient list */}
          <div className="flex-1 overflow-y-auto py-1">
            {isLoading && <SidebarSkeleton />}
            {!isLoading && patients.length === 0 && (
              <p className="px-3 py-4 text-xs text-[#6B7280]">No patients found.</p>
            )}
            {grouped.map(({ letter, patients: group }) => (
              <div key={letter}>
                {/* Letter marker */}
                <div className="pt-1.5 pb-0.5 px-3 text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B7280] sticky top-0 bg-white z-10">
                  {letter}
                </div>

                {group.map((p) => {
                  const isActive = activePatient?.id === p.id;
                  const age = calcAge(p.dateOfBirth);
                  const sexLabel = p.sex === 'MALE' ? 'M' : p.sex === 'FEMALE' ? 'F' : 'O';
                  const hasAllergy = !!p.allergies;
                  const ini = initials(p.firstName, p.lastName);

                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      onMouseEnter={() => handlePrefetch(p.id)}
                      className={`w-full flex items-center gap-2 py-[7px] px-3 border-none border-l-[3px] cursor-pointer text-left font-sans ${isActive ? 'border-l-[#0A6E5F] bg-[#F7F8FA]' : 'border-l-transparent bg-transparent hover:bg-[#F7F8FA]'}`}
                    >
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${isActive ? 'bg-[#085A4E] text-white' : 'bg-[#D4EDE9] text-[#0A6E5F]'}`}>
                        {ini}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={`text-xs whitespace-nowrap overflow-hidden text-ellipsis ${isActive ? 'font-semibold text-[#0D1117]' : 'font-normal text-[#374151]'}`}>
                          {p.lastName}, {p.firstName}
                        </div>
                        <div className="text-[11px] text-[#6B7280] flex gap-1">
                          <span>{sexLabel}</span>
                          <span>·</span>
                          <span>{age}y</span>
                          <span>·</span>
                          <span className="font-mono">{p.patientCode}</span>
                        </div>
                      </div>

                      {/* Allergy indicator */}
                      {hasAllergy && (
                        <span
                          title={`Allergies: ${p.allergies}`}
                          className="text-[13px] shrink-0 text-[#F59E0B]"
                          aria-label={`Allergies: ${p.allergies}`}
                        >
                          ⚠
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </aside>

      <NewPatientModal
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        onCreated={(p) => {
          setNewPatientOpen(false);
          handleSelect(p as Patient);
        }}
      />
    </>
  );
}
