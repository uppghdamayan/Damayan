'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, clear, requiresPasswordChange } = useAuthStore();

  // Passive guard: redirect to change-password if required
  useEffect(() => {
    if (user && requiresPasswordChange) {
      router.replace('/change-password');
    }
  }, [user, requiresPasswordChange, router]);

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    clear();
    window.location.href = '/login';
  };

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'AD';

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-sans">
      {/* Topbar */}
      <header className="h-14 bg-white border-b border-[#D1D5E0] flex items-center px-5 gap-3 sticky top-0 z-[100]">
        {/* Logo */}
        <div className="w-[22px] h-[22px] bg-[#0A6E5F] rounded-[5px]" />
        <span className="text-base font-bold text-[#0D1117]">DAMAYAN</span>

        {/* Role pill */}
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] bg-[#D4EDE9] text-[#0A6E5F] border border-[#0A6E5F] rounded-[20px] px-2 py-0.5">
          {user?.role ?? 'Admin'}
        </span>

        <div className="ml-auto flex items-center gap-2.5">
          {/* User avatar */}
          <div className="w-8 h-8 rounded-full bg-[#085A4E] text-white flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>

          {/* Sign out button */}
          <button
            onClick={handleSignOut}
            className="h-7 px-3 bg-[#F7F8FA] border border-[#D1D5E0] rounded-md text-[11px] font-semibold text-[#374151] cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="py-6 px-5 max-w-[1200px] mx-auto">
        {children}
      </main>
    </div>
  );
}
