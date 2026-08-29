'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { usePatientStore } from '@/stores/patientStore';
import { createSupabaseClient } from '@/lib/supabase/client';
import { initials } from '@/lib/patient-utils';
import { useNewProgressNoteAction } from '@/hooks/useNewProgressNoteAction';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Menu, PlusCircle, Plus } from 'lucide-react';

const roleBadgeClass = (role?: string) =>
  role === 'DOCTOR' || role === 'NURSE'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : role === 'PHARMACIST'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-purple-50 text-purple-700 border-purple-200';

const roleLabel = (role?: string) =>
  role === 'DOCTOR' ? 'Doctor' : role === 'NURSE' ? 'Nurse' : role === 'PHARMACIST' ? 'Pharmacist' : 'Admin';

export function Topbar() {
  const { user, clear } = useAuthStore();
  const {
    toggleSidebar,
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

  const identityBlock = (
    <>
      <span className="text-[12px] font-semibold text-text-primary mb-1">
        {user ? `${user.firstName} ${user.lastName}` : ''}
      </span>
      {user && (
        <span className={`inline-flex items-center justify-center px-1.5 py-[2px] rounded text-[9px] font-bold uppercase tracking-wider border ${roleBadgeClass(user.role)}`}>
          {roleLabel(user.role)}
        </span>
      )}
      {user?.role === 'DOCTOR' && user.licenseNumber && (
        <span className="text-[10px] text-text-muted mt-0.5">
          Lic: {user.licenseNumber}
        </span>
      )}
    </>
  );

  return (
    // No local @container here on purpose. The header spans the full app
    // width, so a second container that measures the same box only invited the
    // two to drift. Everything below names /app explicitly.
    <header className="h-[var(--topbar-h)] bg-surface border-b border-border flex items-center px-4 @max-laptop/app:px-3 gap-3 sticky top-0 z-[200] shrink-0">
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
      <div className="flex items-center gap-2 @laptop/app:w-[var(--sidebar-w)] flex-shrink-0 overflow-hidden">
        <div className="w-[22px] h-[22px] bg-accent rounded-[5px] flex items-center justify-center flex-shrink-0">
          <PlusCircle size={12} color="white" strokeWidth={3} />
        </div>
        <span className="text-[16px] font-bold tracking-[0.5px] whitespace-nowrap text-text-primary @max-laptop/app:hidden">
          DAMAYAN <small className="text-[9px] font-semibold text-text-muted tracking-[1px] uppercase mt-[3px]">EMR</small>
        </span>
      </div>

      {/*
        Active patient chip.

        At >=1024px it stays absolutely centered on the header, exactly as
        before — there is room, and centering reads better.

        Below that it joins the flex row instead. Absolute positioning takes an
        element out of flow, so the chip used to be laid over the New Note
        button and the zoom control at mid widths rather than pushing them
        aside: two controls occupying the same pixels, one of them unclickable.
      */}
      {activePatient && (
        <div
          onClick={() => router.push(`/dashboard/${activePatient.id}`)}
          className="flex items-center gap-2 min-w-0 shrink @max-laptop/app:max-w-[240px] bg-surface-2 border border-accent rounded-full px-3.5 py-1 @max-tablet/app:px-1.5 @max-tablet/app:py-1 cursor-pointer shadow-sm z-10 @laptop/app:absolute @laptop/app:left-1/2 @laptop/app:-translate-x-1/2"
        >
          <div className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[9px] font-bold shrink-0">
            {initials(activePatient.firstName, activePatient.lastName)}
          </div>
          <span className="text-[11px] font-semibold text-text-primary truncate @max-tablet/app:hidden">
            {activePatient.lastName}, {activePatient.firstName}
          </span>
          <span className="font-mono text-[9px] text-text-muted shrink-0 @max-laptop/app:hidden">
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
          className="h-[34px] px-3.5 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center justify-center gap-[5px] whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50 @max-laptop/app:w-9 @max-laptop/app:px-0 @max-laptop/app:gap-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="@max-laptop/app:hidden">New Note</span>
        </button>

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
            className="h-full px-2 inline-flex items-center justify-center font-mono text-[10px] text-text-secondary hover:bg-surface-3 hover:text-accent font-semibold transition-all duration-150 cursor-pointer select-none tabular-nums @max-laptop/app:hidden border-r border-border/60"
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
        </div>

        {/* User name + avatar — >=1024px, unchanged */}
        <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border shrink-0 @max-laptop/app:hidden">
          <div className="flex flex-col items-center leading-tight justify-center">
            {identityBlock}
          </div>
          <div className="w-8 h-8 rounded-full bg-accent-hover text-white text-[11px] font-bold border-2 border-border flex items-center justify-center shrink-0 cursor-default">
            {userInitials}
          </div>
        </div>

        {/* Sign out — >=1024px, unchanged */}
        <button
          onClick={handleSignOut}
          className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center justify-center gap-[5px] whitespace-nowrap cursor-pointer shrink-0 @max-laptop/app:hidden"
        >
          Sign Out
        </button>

        {/*
          Below 1024px the identity block and Sign Out collapse into the avatar.
          Sign Out previously had no hiding rule at any width and stayed a
          whitespace-nowrap shrink-0 button, so it kept its full footprint right
          where the header ran out of room.
        */}
        <Popover>
          <PopoverTrigger
            aria-label="Account"
            title="Account"
            className="w-8 h-8 rounded-full bg-accent-hover text-white text-[11px] font-bold border-2 border-border flex items-center justify-center shrink-0 cursor-pointer @laptop/app:hidden"
          >
            {userInitials}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto min-w-[180px] gap-3 p-3">
            <div className="flex flex-col items-center leading-tight justify-center">
              {identityBlock}
            </div>
            <button
              onClick={handleSignOut}
              className="h-[28px] w-full px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center justify-center gap-[5px] whitespace-nowrap cursor-pointer"
            >
              Sign Out
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
