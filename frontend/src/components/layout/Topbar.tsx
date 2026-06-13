'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { createSupabaseClient } from '@/lib/supabase/client';
import { initials } from '@/lib/patient-utils';
import { PanelRightOpen, PanelRightClose } from 'lucide-react';

export function Topbar() {
  const { user, clear } = useAuthStore();
  const { toggleSidebar, documentationPanelOpen, setDocumentationPanelOpen } = useUiStore();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    clear();
    window.location.href = '/login';
  };

  const userInitials = user ? initials(user.firstName, user.lastName) : '??';
  const roleLabel = user?.role ?? 'USER';

  return (
    <header className="h-14 bg-white border-b border-[#D1D5E0] flex items-center px-4 gap-2.5 sticky top-0 z-[200] shrink-0">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
        className="w-8 h-8 border-none bg-transparent hover:bg-[#F7F8FA] cursor-pointer flex flex-col items-center justify-center gap-[5px] rounded-md shrink-0 transition-colors"
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-4 h-0.5 bg-[#374151] rounded-sm" />
        ))}
      </button>

      {/* Logo */}
      <div className="w-[22px] h-[22px] bg-[#0A6E5F] rounded-[5px] shrink-0" />
      <span className="text-base font-bold text-[#0D1117] tracking-[-0.3px] shrink-0">
        DAMAYAN
      </span>

      {/* Role pill */}
      <span className="text-[10px] font-bold uppercase tracking-[0.6px] bg-[#D4EDE9] text-[#0A6E5F] border border-[#0A6E5F] rounded-[20px] px-2 py-0.5 shrink-0">
        {roleLabel}
      </span>

      <div className="flex-1" />

      {/* + New Note button */}
      <button
        onClick={() => {/* Phase 6+ — note creation flow */}}
        className="h-[34px] px-3.5 bg-[#0A6E5F] text-white border border-[#085A4E] rounded-md text-[11px] font-semibold cursor-pointer shrink-0 shadow-[0_2px_4px_rgba(10,110,95,0.15)] font-sans"
      >
        + New Note
      </button>

      {/* Documentation panel toggle */}
      <button
        onClick={() => setDocumentationPanelOpen(!documentationPanelOpen)}
        aria-label="Toggle documentation panel"
        title={documentationPanelOpen ? 'Close documentation panel' : 'Open documentation panel'}
        className="h-[34px] px-2.5 bg-[#F7F8FA] border border-transparent rounded-md cursor-pointer flex items-center justify-center shrink-0 transition-all duration-150 ease-in hover:bg-[#EFF1F5] hover:border-[#D1D5E0]"
      >
        {documentationPanelOpen ? (
          <PanelRightClose size={16} color="#374151" strokeWidth={1.5} />
        ) : (
          <PanelRightOpen size={16} color="#374151" strokeWidth={1.5} />
        )}
      </button>

      {/* User avatar */}
      <div 
        className="w-8 h-8 rounded-full bg-[#085A4E] text-white flex items-center justify-center text-xs font-semibold shrink-0 cursor-default"
        title={user ? `${user.firstName} ${user.lastName}` : ''}
      >
        {userInitials}
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="h-7 px-3 bg-[#F7F8FA] border border-[#D1D5E0] rounded-md text-[11px] font-semibold text-[#374151] cursor-pointer shrink-0 font-sans"
      >
        Sign Out
      </button>
    </header>
  );
}
