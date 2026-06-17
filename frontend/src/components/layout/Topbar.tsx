'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { usePatientStore } from '@/stores/patientStore';
import { createSupabaseClient } from '@/lib/supabase/client';
import { initials } from '@/lib/patient-utils';
import { PanelRightOpen, PanelRightClose, Menu, PlusCircle } from 'lucide-react';

export function Topbar() {
  const { user, clear } = useAuthStore();
  const { toggleSidebar, sidebarCollapsed, documentationPanelOpen, setDocumentationPanelOpen } = useUiStore();
  const { activePatient } = usePatientStore();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    clear();
    window.location.href = '/login';
  };

  const userInitials = user ? initials(user.firstName, user.lastName) : '??';

  return (
    <header className="h-[var(--topbar-h)] bg-surface border-b border-border flex items-center px-4 gap-3 sticky top-0 z-[200] shrink-0">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
        className="w-8 h-8 bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center rounded-btn cursor-pointer shrink-0"
      >
        <Menu className="w-[18px] h-[18px] text-text-secondary" />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 w-[var(--sidebar-w)] flex-shrink-0 overflow-hidden">
        <div className="w-[22px] h-[22px] bg-accent rounded-[5px] flex items-center justify-center flex-shrink-0">
          <PlusCircle size={12} color="white" strokeWidth={3} />
        </div>
        <span className="text-[16px] font-bold tracking-[0.5px] whitespace-nowrap text-text-primary">
          DAMAYAN <small className="text-[9px] font-semibold text-text-muted tracking-[1px] uppercase mt-[3px]">EMR</small>
        </span>
      </div>

      {/* Active patient chip (centered) */}
      {activePatient && (
        <div
          onClick={() => router.push(`/dashboard/${activePatient.id}`)}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface-2 border border-accent rounded-full px-3.5 py-1 cursor-pointer shadow-sm z-10"
        >
          <div className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[9px] font-bold">
            {initials(activePatient.firstName, activePatient.lastName)}
          </div>
          <span className="text-[11px] font-semibold text-text-primary">
            {activePatient.lastName}, {activePatient.firstName}
          </span>
          <span className="font-mono text-[9px] text-text-muted">
            {activePatient.patientCode}
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* Right zone */}
      <div className="flex items-center gap-2 shrink-0">
        {/* + New Note button */}
        <button
          onClick={() => {/* Phase 6+ — note creation flow */}}
          className="h-[34px] px-3.5 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center justify-center gap-[5px] whitespace-nowrap cursor-pointer shrink-0"
        >
          ＋ New Note
        </button>

        {/* Documentation panel toggle */}


        {/* User name + avatar */}
        <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border shrink-0">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[12px] font-semibold text-text-primary">
              {user ? `${user.firstName} ${user.lastName}` : ''}
            </span>
            <span className="text-[10px] text-text-muted">
              {user?.role === 'DOCTOR' ? 'Attending Physician' : user?.role === 'NURSE' ? 'Attending Nurse' : 'System Administrator'}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-accent-hover text-white text-[11px] font-bold border-2 border-border flex items-center justify-center shrink-0 cursor-default">
            {userInitials}
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center justify-center gap-[5px] whitespace-nowrap cursor-pointer shrink-0"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}

