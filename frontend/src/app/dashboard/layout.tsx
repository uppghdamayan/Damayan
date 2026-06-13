'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Topbar } from '@/components/layout/Topbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { DocumentationPanel } from '@/components/layout/DocumentationPanel';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, requiresPasswordChange } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Redirect admins back to their panel; redirect unauthenticated users to login
    if (user === null) {
      // user is null means not yet loaded from zustand — don't redirect yet
      return;
    }
    if (requiresPasswordChange) {
      router.replace('/change-password');
      return;
    }
    if (user.role === 'ADMIN') {
      router.replace('/admin/accounts');
    }
  }, [user, requiresPasswordChange, router]);

  return (
    <div
      id="shell"
      style={{
        height: '100vh',
        background: '#F0F2F5',
        fontFamily: "'IBM Plex Sans', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Topbar />
      <div
        id="body"
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <Sidebar />
        <div
          id="middle-column"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
        <DocumentationPanel />
      </div>
    </div>
  );
}
