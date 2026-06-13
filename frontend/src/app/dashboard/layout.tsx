'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Topbar } from '@/components/layout/Topbar';
import { Sidebar } from '@/components/layout/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Redirect admins back to their panel; redirect unauthenticated users to login
    if (user === null) {
      // user is null means not yet loaded from zustand — don't redirect yet
      return;
    }
    if (user.role === 'ADMIN') {
      router.replace('/admin/accounts');
    }
  }, [user, router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F0F2F5',
        fontFamily: "'IBM Plex Sans', sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Topbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 56px)' }}>
        <Sidebar />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
