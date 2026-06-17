'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { PlusCircle } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, clear, requiresPasswordChange } = useAuthStore();

  // Active guard: check session and redirect if necessary
  useEffect(() => {
    const checkAuth = async () => {
      const { createSupabaseClient } = await import('@/lib/supabase/client');
      const supabase = createSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace('/login');
        return;
      }
      
      if (user === null) {
        if (useAuthStore.persist?.hasHydrated?.()) {
          await supabase.auth.signOut();
          useAuthStore.getState().clear();
          router.replace('/login');
        }
        return;
      }
      
      if (requiresPasswordChange) {
        router.replace('/change-password');
        return;
      }
      
      if (user.role !== 'ADMIN') {
        router.replace('/dashboard');
      }
    };
    checkAuth();
  }, [user, requiresPasswordChange, router]);

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    clear();
    window.location.href = '/login';
  };

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'AD';
  return (
    <div className="min-h-screen bg-bg font-sans">
      {/* Topbar */}
      <header className="h-[56px] bg-surface border-b border-border flex items-center px-4 gap-3 sticky top-0 z-[200]">
        {/* Logo */}
        <div className="flex items-center gap-2 w-[var(--sidebar-w)] flex-shrink-0 overflow-hidden">
          <div className="w-[22px] h-[22px] bg-accent rounded-[5px] flex items-center justify-center flex-shrink-0">
            <PlusCircle size={12} color="white" strokeWidth={3} />
          </div>
          <span className="text-[16px] font-bold tracking-[0.5px] whitespace-nowrap text-text-primary">
            DAMAYAN <small className="text-[9px] font-semibold text-text-muted tracking-[1px] uppercase mt-[3px]">EMR</small>
          </span>
        </div>

        {/* Role pill */}
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] px-2 py-[3px] rounded-full bg-accent-light text-text-primary border border-accent">
          {user?.role ?? 'ADMIN'}
        </span>

        {/* Right zone */}
        <div className="ml-auto flex items-center gap-2">
          {/* User details */}
          <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border">
            <div className="flex flex-col items-end leading-tight">
              <span className="text-[12px] font-semibold text-text-primary">
                {user ? `${user.firstName} ${user.lastName}` : 'System Admin'}
              </span>
              <span className="text-[10px] text-text-muted">
                System Administrator
              </span>
            </div>
            <div className="w-8 h-8 bg-accent-hover text-white text-[11px] font-bold border-2 border-border rounded-full flex items-center justify-center">
              {initials}
            </div>
          </div>

          {/* Sign out button */}
          <button
            onClick={handleSignOut}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="py-6 px-5 max-w-[1200px] mx-auto">
        <div className="mb-6">
          <AdminTabsNav />
        </div>
        {children}
      </main>
    </div>
  );
}

function AdminTabsNav() {
  const pathname = require('next/navigation').usePathname();
  const router = require('next/navigation').useRouter();
  const activeTab = pathname.includes('/admin/dashboard') ? 'dashboard' : 'accounts';

  return (
    <div className="border-b border-border">
      <div className="flex gap-6">
        <button
          onClick={() => router.push('/admin/accounts')}
          className={`pb-3 text-[13px] font-semibold transition-colors relative ${
            activeTab === 'accounts'
              ? 'text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Accounts
          {activeTab === 'accounts' && (
            <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-accent rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => router.push('/admin/dashboard')}
          className={`pb-3 text-[13px] font-semibold transition-colors relative ${
            activeTab === 'dashboard'
              ? 'text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Dashboard
          {activeTab === 'dashboard' && (
            <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-accent rounded-t-full" />
          )}
        </button>
      </div>
    </div>
  );
}
