'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { usePatientStore } from '@/stores/patientStore';
import { createSupabaseClient } from '@/lib/supabase/client';
import { initials } from '@/lib/patient-utils';
import { useNewProgressNoteAction } from '@/hooks/useNewProgressNoteAction';
import { PanelRightOpen, PanelRightClose, Menu, PlusCircle, Plus } from 'lucide-react';

export function Topbar() {
  const { user, clear } = useAuthStore();
  const { 
    toggleSidebar, 
    sidebarCollapsed, 
    documentationPanelOpen, 
    setDocumentationPanelOpen,
    uiScale,
    increaseUiScale,
    decreaseUiScale,
    resetUiScale
  } = useUiStore();
  const { activePatient } = usePatientStore();
  const router = useRouter();
  const { triggerNewNote } = useNewProgressNoteAction(activePatient?.id || null);

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    clear();
    // Use replace() so the dashboard is removed from history —
    // the browser Back button won't return to the dashboard after sign-out.
    window.location.replace('/login');
  };

  const userInitials = user ? initials(user.firstName, user.lastName) : '??';

  return (
    <header className="@container h-[var(--topbar-h)] bg-surface border-b border-border flex items-center px-4 @max-[1023px]:px-3 gap-3 sticky top-0 z-[200] shrink-0">
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
      <div className="flex items-center gap-2 @min-[1024px]:w-[var(--sidebar-w)] flex-shrink-0 overflow-hidden">
        <div className="w-[22px] h-[22px] bg-accent rounded-[5px] flex items-center justify-center flex-shrink-0">
          <PlusCircle size={12} color="white" strokeWidth={3} />
        </div>
        <span className="text-[16px] font-bold tracking-[0.5px] whitespace-nowrap text-text-primary @max-[1023px]:hidden">
          DAMAYAN <small className="text-[9px] font-semibold text-text-muted tracking-[1px] uppercase mt-[3px]">EMR</small>
        </span>
      </div>

      {/* Active patient chip (centered) */}
      {activePatient && (
        <div
          onClick={() => router.push(`/dashboard/${activePatient.id}`)}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface-2 border border-accent rounded-full px-3.5 py-1 @max-[767px]:px-1.5 @max-[767px]:py-1 cursor-pointer shadow-sm z-10"
        >
          <div className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[9px] font-bold">
            {initials(activePatient.firstName, activePatient.lastName)}
          </div>
          <span className="text-[11px] font-semibold text-text-primary @max-[767px]:hidden">
            {activePatient.lastName}, {activePatient.firstName}
          </span>
          <span className="font-mono text-[9px] text-text-muted @max-[767px]:hidden">
            {activePatient.patientCode}
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* Right zone */}
      <div className="flex items-center gap-2 shrink-0">
        {/* + New Note button */}
        <button
          onClick={() => triggerNewNote()}
          disabled={!activePatient}
          aria-label="New Note"
          title="New Note"
          className="h-[34px] px-3.5 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center justify-center gap-[5px] whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50 @max-[1023px]:w-9 @max-[1023px]:px-0 @max-[1023px]:gap-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="@max-[1023px]:hidden">New Note</span>
        </button>

        {/* Documentation panel toggle */}
        {/* Text zoom control */}
        <div className="flex items-center rounded-btn border border-border bg-surface-2 shadow-sm overflow-hidden shrink-0 h-[34px]">
          <button
            onClick={decreaseUiScale}
            disabled={uiScale <= 80}
            aria-label="Decrease text size"
            title="Decrease text size"
            className="h-full px-2.5 inline-flex items-center justify-center text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-r border-border/60"
          >
            <span className="text-[10px] font-bold leading-none">A-</span>
          </button>

          <button
            onClick={resetUiScale}
            aria-live="polite"
            aria-label="Reset text size to 100%"
            title="Reset text size to 100% (Click to reset)"
            className="h-full px-2 inline-flex items-center justify-center font-mono text-[10px] text-text-secondary hover:bg-surface-3 hover:text-accent font-semibold transition-all duration-150 cursor-pointer select-none tabular-nums @max-[767px]:hidden border-r border-border/60"
          >
            {uiScale}%
          </button>

          <button
            onClick={increaseUiScale}
            disabled={uiScale >= 150}
            aria-label="Increase text size"
            title="Increase text size"
            className="h-full px-2.5 inline-flex items-center justify-center text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="text-[13px] font-bold leading-none">A+</span>
          </button>
        </div>        {/* User name + avatar */}
        <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border shrink-0 @max-[1023px]:pl-0 @max-[1023px]:ml-0 @max-[1023px]:border-l-0">
          <div className="flex flex-col items-center leading-tight justify-center @max-[1023px]:hidden">
            <span className="text-[12px] font-semibold text-text-primary mb-1">
              {user ? `${user.firstName} ${user.lastName}` : ''}
            </span>
            {user && (
              <span className={`inline-flex items-center justify-center px-1.5 py-[2px] rounded text-[9px] font-bold uppercase tracking-wider border ${
                user.role === 'DOCTOR' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : user.role === 'NURSE' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                {user.role === 'DOCTOR' ? 'Doctor' : user.role === 'NURSE' ? 'Nurse' : 'Admin'}
              </span>
            )}
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



