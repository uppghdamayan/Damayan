'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { usePatientStore } from '@/stores/patientStore';
import { createSupabaseClient } from '@/lib/supabase/client';
import { initials } from '@/lib/patient-utils';
import { useNewProgressNoteAction } from '@/hooks/useNewProgressNoteAction';
import { Menu, PlusCircle, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function ActivePatientChip({ activePatient }: { activePatient: any }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleChipClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      router.push(`/dashboard/${activePatient.id}`);
    }
  };

  const ini = initials(activePatient.firstName, activePatient.lastName);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          onClick={handleChipClick}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface-2 border border-accent rounded-full px-3.5 py-1 max-[767px]:px-1.5 max-[767px]:py-1 cursor-pointer shadow-sm z-10"
        >
          <div className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[9px] font-bold">
            {ini}
          </div>
          <span className="text-[11px] font-semibold text-text-primary max-[767px]:hidden">
            {activePatient.lastName}, {activePatient.firstName}
          </span>
          <span className="font-mono text-[9px] text-text-muted max-[767px]:hidden">
            {activePatient.patientCode}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 text-[12px] font-sans min-[768px]:hidden">
        <div className="flex flex-col gap-1.5">
          <div className="font-semibold text-text-primary">
            {activePatient.lastName}, {activePatient.firstName}
          </div>
          <div className="font-mono text-[10px] text-text-muted">
            Patient Code: #{activePatient.patientCode}
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              router.push(`/dashboard/${activePatient.id}`);
            }}
            className="w-full h-[28px] mt-1 bg-accent text-white font-semibold rounded-btn hover:bg-accent-hover text-[11px] flex items-center justify-center cursor-pointer"
          >
            Go to Dashboard
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DoctorUserBlock({ user, userInitials, handleSignOut }: { user: any; userInitials: string; handleSignOut: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border max-[1023px]:pl-0 max-[1023px]:ml-0 max-[1023px]:border-l-0 shrink-0">
        <div className="flex flex-col items-end leading-tight max-[1023px]:hidden">
          <span className="text-[12px] font-semibold text-text-primary">
            {user ? `${user.firstName} ${user.lastName}` : ''}
          </span>
          {user && (
            <span className="text-[10px] text-text-muted mt-0.5">
              {user.role === 'DOCTOR' ? 'Attending Physician' : user.role === 'NURSE' ? 'Nurse Practitioner' : 'Administrator'}
            </span>
          )}
        </div>
        
        <PopoverTrigger asChild>
          <div 
            onClick={() => setIsOpen(true)}
            className="w-8 h-8 rounded-full bg-accent-hover text-white text-[11px] font-bold border-2 border-border flex items-center justify-center shrink-0 cursor-pointer"
          >
            {userInitials}
          </div>
        </PopoverTrigger>
      </div>
      
      <PopoverContent className="w-48 p-3 text-[12px] font-sans max-[1023px]:block min-[1024px]:hidden">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <span className="font-semibold text-text-primary">
              {user ? `${user.firstName} ${user.lastName}` : ''}
            </span>
            <span className="text-[10px] text-text-muted mt-0.5">
              {user?.role === 'DOCTOR' ? 'Attending Physician' : user?.role === 'NURSE' ? 'Nurse Practitioner' : 'Administrator'}
            </span>
          </div>
          <div className="border-t border-border my-1" />
          <button
            onClick={() => {
              setIsOpen(false);
              handleSignOut();
            }}
            className="w-full h-[28px] bg-red-bg text-red font-semibold rounded-btn hover:bg-red/15 border border-red-border text-[11px] flex items-center justify-center cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Topbar() {
  const { user, clear } = useAuthStore();
  const { toggleSidebar } = useUiStore();
  const { activePatient } = usePatientStore();
  const { triggerNewNote } = useNewProgressNoteAction(activePatient?.id || null);

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    clear();
    window.location.href = '/login';
  };

  const userInitials = user ? initials(user.firstName, user.lastName) : '??';

  return (
    <header className="h-[var(--topbar-h)] bg-surface border-b border-border flex items-center px-4 max-[1023px]:px-3 gap-3 sticky top-0 z-[200] shrink-0">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        aria-label="Toggle patient list"
        title="Toggle patient list"
        className="w-8 h-8 bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center rounded-btn cursor-pointer shrink-0"
      >
        <Menu className="w-[18px] h-[18px] text-text-secondary" />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 min-[1280px]:w-[var(--sidebar-w)] flex-shrink-0 overflow-hidden">
        <div className="w-[22px] h-[22px] bg-accent rounded-[5px] flex items-center justify-center flex-shrink-0">
          <PlusCircle size={12} color="white" strokeWidth={3} />
        </div>
        <span className="text-[16px] font-bold tracking-[0.5px] whitespace-nowrap text-text-primary max-[1023px]:hidden">
          DAMAYAN <small className="text-[9px] font-semibold text-text-muted tracking-[1px] uppercase mt-[3px]">EMR</small>
        </span>
      </div>

      {/* Active patient chip (centered) */}
      {activePatient && (
        <ActivePatientChip activePatient={activePatient} />
      )}

      <div className="flex-1" />

      {/* Right zone */}
      <div className="flex items-center gap-2 shrink-0">
        {/* + New Note button */}
        <button
          onClick={() => triggerNewNote()}
          disabled={!activePatient}
          title="New Note"
          aria-label="New Note"
          className="h-[34px] px-3.5 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center justify-center gap-[5px] whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50 max-[1023px]:w-9 max-[1023px]:px-0 max-[1023px]:justify-center"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="max-[1023px]:hidden">New Note</span>
        </button>

        {/* Doctor name + avatar block */}
        <DoctorUserBlock user={user} userInitials={userInitials} handleSignOut={handleSignOut} />

        {/* Sign out (desktop-only button) */}
        <button
          onClick={handleSignOut}
          className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center justify-center gap-[5px] whitespace-nowrap cursor-pointer shrink-0 max-[1023px]:hidden"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
