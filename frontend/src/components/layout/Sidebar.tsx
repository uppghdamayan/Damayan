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
        style={{
          width: sidebarCollapsed ? 0 : 280,
          background: '#FFFFFF',
          borderRight: sidebarCollapsed ? '1px solid transparent' : '1px solid #D1D5E0',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-right-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Inner wrapper to prevent content from squishing during collapse */}
        <div style={{ width: 280, minWidth: 280, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Search + Add zone */}
          <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid #D1D5E0', flexShrink: 0 }}>
            {/* Search */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients…"
              style={{
                width: '100%', height: 34, padding: '0 10px',
                background: '#F7F8FA', border: '1px solid #D1D5E0',
                borderRadius: 6, fontSize: 12, color: '#0D1117',
                outline: 'none', boxSizing: 'border-box', marginBottom: 8,
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
              onFocus={(e) => { e.target.style.borderColor = '#0A6E5F'; e.target.style.boxShadow = '0 0 0 3px rgba(10,110,95,0.12)'; }}
              onBlur={(e)  => { e.target.style.borderColor = '#D1D5E0'; e.target.style.boxShadow = 'none'; }}
            />
            {/* Add new patient */}
            {canCreatePatient && (
              <button
                onClick={() => setNewPatientOpen(true)}
                style={{
                  width: '100%', height: 30, background: '#0A6E5F', color: '#FFFFFF',
                  border: '1px solid #085A4E', borderRadius: 6, fontSize: 11,
                  fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}
              >
                + New Patient
              </button>
            )}
          </div>

          {/* Patient list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {isLoading && <SidebarSkeleton />}
            {!isLoading && patients.length === 0 && (
              <p style={{ padding: '16px 12px', fontSize: 12, color: '#6B7280' }}>No patients found.</p>
            )}
            {grouped.map(({ letter, patients: group }) => (
              <div key={letter}>
                {/* Letter marker */}
                <div style={{
                  padding: '6px 12px 2px',
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.6px', color: '#6B7280',
                  position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 1,
                }}>
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
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = '#F7F8FA';
                        handlePrefetch(p.id);
                      }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        gap: 8, padding: '7px 12px', border: 'none',
                        borderLeft: isActive ? '3px solid #0A6E5F' : '3px solid transparent',
                        background: isActive ? '#F7F8FA' : 'transparent',
                        cursor: 'pointer', textAlign: 'left',
                        fontFamily: "'IBM Plex Sans', sans-serif",
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: isActive ? '#085A4E' : '#D4EDE9',
                        color: isActive ? '#FFFFFF' : '#0A6E5F',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>
                        {ini}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: isActive ? 600 : 400,
                          color: isActive ? '#0D1117' : '#374151',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {p.lastName}, {p.firstName}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', gap: 4 }}>
                          <span>{sexLabel}</span>
                          <span>·</span>
                          <span>{age}y</span>
                          <span>·</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{p.patientCode}</span>
                        </div>
                      </div>

                      {/* Allergy indicator */}
                      {hasAllergy && (
                        <span
                          title={`Allergies: ${p.allergies}`}
                          style={{ fontSize: 13, flexShrink: 0, color: '#F59E0B' }}
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
