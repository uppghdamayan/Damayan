'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Topbar } from '@/components/layout/Topbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { DocumentationPanel } from '@/components/layout/DocumentationPanel';
import { NarrowScreenNotice } from '@/components/layout/NarrowScreenNotice';
import { AppStartupLoader } from '@/components/layout/AppStartupLoader';
import { AppLoadingScreen } from '@/components/layout/AppLoadingScreen';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, requiresPasswordChange } = useAuthStore();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Validate session and redirect unauthenticated users to login.
    // We track `authChecked` so we render nothing until we know the user is
    // legitimately authenticated — this prevents the "??" avatar flash that
    // occurs when pressing Back after logout (the store is cleared but the
    // browser serves the cached page before the guard can redirect).
    const checkAuth = async () => {
      const { createSupabaseClient } = await import('@/lib/supabase/client');
      const supabase = createSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      const storeState = useAuthStore.getState();
      const currentUser = storeState.user;

      if (currentUser === null) {
        if (useAuthStore.persist?.hasHydrated?.()) {
          await supabase.auth.signOut();
          storeState.clear();
          router.replace('/login');
        }
        return;
      }

      if (currentUser.requiresPasswordChange) {
        router.replace('/change-password');
        return;
      }
      if (currentUser.role === 'ADMIN') {
        router.replace('/admin/accounts');
        return;
      }

      // User is authenticated and authorized for this layout
      setAuthChecked(true);
    };
    checkAuth();
  }, [user, requiresPasswordChange, router]);

  // Show the branded loading screen (not a blank page) while the session is
  // being verified — the guard still prevents any flash of stale/unauthenticated
  // UI, but the user now gets visible feedback instead of a silent white screen.
  if (!authChecked) return <AppLoadingScreen />;

  return (
    <AppStartupLoader>
      <div
        id="shell"
        className="h-full bg-bg font-sans flex flex-col overflow-hidden"
      >
        <Topbar />
        <div
          id="body"
          className="flex flex-1 overflow-hidden"
        >
          <Sidebar />
          <div
            id="middle-column"
            className="flex-1 flex flex-col overflow-hidden"
          >
            {children}
          </div>
          <DocumentationPanel />
        </div>
        <NarrowScreenNotice />
      </div>
    </AppStartupLoader>
  );
}
