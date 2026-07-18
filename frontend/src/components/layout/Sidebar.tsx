'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '@/stores/uiStore';
import { usePatientStore } from '@/stores/patientStore';
import { usePatients } from '@/hooks/usePatients';
import { useAuthStore } from '@/stores/authStore';
import { groupByLetter, calcAge, initials } from '@/lib/patient-utils';
import { NewPatientModal } from '@/components/patients/NewPatientModal';
import { UnpublishedNotesModal } from '@/components/ui/UnpublishedNotesModal';
import { SidebarSkeleton } from '@/components/layout/SidebarSkeleton';
import { apiRequest } from '@/lib/api';
import type { Patient } from '@/types/patient';
import { cn } from '@/lib/utils';
import { Search, Plus } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

export function Sidebar() {
  const { 
    sidebarCollapsed, 
    setSidebarCollapsed, 
    onPublishAndSwitch, 
    closeNoteEditor, 
    setDocumentationPanelOpen 
  } = useUiStore();
  const { activePatient, setActivePatient } = usePatientStore();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [pendingPatient, setPendingPatient] = useState<Patient | null>(null);
  const [isPublishingPending, setIsPublishingPending] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = usePatients(debouncedSearch, 1, 200);
  const patients = data?.data ?? [];

  const grouped = useMemo(() => groupByLetter(patients), [patients]);

  const canCreatePatient = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const handleSelect = (p: Patient) => {
    setActivePatient(p);
  };

  const handleConfirmPublish = async () => {
    if (!onPublishAndSwitch || !pendingPatient) return;
    setIsPublishingPending(true);
    try {
      const success = await onPublishAndSwitch();
      if (success) {
        const target = pendingPatient;
        setPendingPatient(null);
        closeNoteEditor();
        setDocumentationPanelOpen(false);
        setActivePatient(target);
        router.push(`/dashboard/${target.id}`);
      } else {
        setPendingPatient(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPublishingPending(false);
    }
  };

  const handleKeepDraft = () => {
    if (!pendingPatient) return;
    const target = pendingPatient;
    setPendingPatient(null);
    closeNoteEditor();
    setDocumentationPanelOpen(false);
    setActivePatient(target);
    router.push(`/dashboard/${target.id}`);
  };

  const handlePrefetch = (patientId: string) => {
    qc.prefetchQuery({
      queryKey: ['patient', patientId],
      queryFn: () => apiRequest(`/patients/${patientId}`),
      staleTime: 30000,
    });
    // First page of visits
    qc.prefetchQuery({
      queryKey: ['visits', patientId, 1, 5],
      queryFn: () => apiRequest(`/patients/${patientId}/visits?page=1&limit=5`),
      staleTime: 30000,
    });
  };

  const sidebarContent = (
    <div className="w-[var(--sidebar-w)] min-w-[var(--sidebar-w)] flex flex-col h-full">
      {/* Search + Add zone (Section 5.2) */}
      <div className="sticky top-0 z-10 flex flex-col gap-2 p-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2 h-[34px] bg-surface-2 border border-border rounded-btn px-3 focus-within:border-accent focus-within:shadow-accent-focus transition-all">
          <Search className="w-4 h-4 text-text-muted shrink-0" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted font-sans"
            placeholder="Search patients…"
          />
          {isLoading && search.length > 0 && (
            <Spinner size="xs" className="text-text-muted shrink-0" />
          )}
        </div>
        {canCreatePatient && (
          <button
            onClick={() => setNewPatientOpen(true)}
            className="w-full h-[28px] bg-accent hover:bg-accent-hover text-white text-[11px] font-semibold justify-center gap-1 inline-flex items-center rounded-btn cursor-pointer transition-colors duration-150"
          >
            <Plus className="w-3 h-3" /> New Patient
          </button>
        )}
      </div>

      {/* Patient list */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading && <SidebarSkeleton />}
        {!isLoading && patients.length === 0 && (
          <div className="px-3.5 py-6 text-center">
            <p className="text-[12px] text-text-muted">
              {search ? `No patients match "${search}"` : 'No patients registered yet.'}
            </p>
            {!search && canCreatePatient && (
              <button
                onClick={() => setNewPatientOpen(true)}
                className="mt-2 text-[11px] text-accent hover:underline cursor-pointer"
              >
                Register first patient →
              </button>
            )}
          </div>
        )}
        {grouped.map(({ letter, patients: group }) => (
          <div key={letter}>
            {/* Letter marker */}
            <div className="pt-2.5 pb-0.5 px-3.5 text-[10px] font-bold uppercase tracking-[0.6px] text-text-muted sticky top-0 bg-surface z-10">
              {letter}
            </div>

            {group.map((p) => {
              const isActive = activePatient?.id === p.id;
              const age = calcAge(p.dateOfBirth);
              const sexLabel = p.sex === 'MALE' ? 'M' : p.sex === 'FEMALE' ? 'F' : 'O';
              const hasAllergy = !!p.allergies;
              const ini = initials(p.firstName, p.lastName);

              return (
                <Link
                  key={p.id}
                  href={`/dashboard/${p.id}`}
                  prefetch={false}
                  onClick={(e) => {
                    if (onPublishAndSwitch && activePatient?.id !== p.id) {
                      e.preventDefault();
                      setPendingPatient(p);
                    } else {
                      handleSelect(p);
                      // Close sidebar overlay on selection for smaller screens
                      if (window.innerWidth < 768) {
                        setSidebarCollapsed(true);
                      }
                    }
                  }}
                  onMouseEnter={() => handlePrefetch(p.id)}
                  className={cn(
                    "flex items-center gap-2.5 mx-3.5 my-[6px] px-3 py-2.5 rounded-card border cursor-pointer transition-all duration-150 text-left w-[calc(100%-28px)] font-sans",
                    isActive
                      ? "bg-accent-light border-accent shadow-sm"
                      : "bg-surface border-border hover:bg-surface-2 hover:border-border-strong"
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "w-8 h-8 text-[11px] font-bold flex-shrink-0 rounded-full flex items-center justify-center border transition-colors duration-150",
                      isActive
                        ? "bg-accent text-white border-accent"
                        : "bg-surface-2 text-text-secondary border-border"
                    )}
                  >
                    {ini}
                  </div>

                  {/* Info details */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-text-primary truncate">
                      {p.lastName}, {p.firstName}
                    </div>
                    <div className="font-mono text-[10px] text-text-muted truncate mt-0.5">
                      {sexLabel} · {age} yrs · #{p.patientCode}
                    </div>
                  </div>

                  {/* Status indicators */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {hasAllergy && (
                      <span
                        className="text-red text-[12px] font-bold"
                        title={`Allergies: ${p.allergies}`}
                        aria-label={`Allergies: ${p.allergies}`}
                      >
                        ⚠
                      </span>
                    )}
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar: inline */}
      <aside
        suppressHydrationWarning
        className={cn(
          "bg-surface flex flex-col h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out border-r border-border hidden @md:flex",
          sidebarCollapsed ? "w-0 border-r-transparent" : "w-[var(--sidebar-w)]"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile/Tablet overlay sidebar */}
      <div
        onClick={() => setSidebarCollapsed(true)}
        className={cn(
          "fixed inset-0 bg-transparent z-[300] transition-opacity @md:hidden",
          sidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      />
      <aside
        className={cn(
          "fixed top-[var(--topbar-h)] left-0 bottom-0 z-[310] bg-surface border-r border-border overflow-y-auto @md:hidden",
          "w-[var(--sidebar-w)] transition-transform duration-200 ease-out flex flex-col",
          sidebarCollapsed ? "-translate-x-full" : "translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>

      <NewPatientModal
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        onCreated={(p) => {
          setNewPatientOpen(false);
          handleSelect(p as Patient);
        }}
      />

      <UnpublishedNotesModal
        open={pendingPatient !== null}
        onClose={() => setPendingPatient(null)}
        onPublish={handleConfirmPublish}
        onKeepDraft={handleKeepDraft}
        patientName={activePatient ? `${activePatient.firstName} ${activePatient.lastName}` : ''}
        isPublishing={isPublishingPending}
      />
    </>
  );
}

