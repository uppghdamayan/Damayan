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
      className="h-screen bg-[#F0F2F5] font-sans flex flex-col overflow-hidden"
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
    </div>
  );
}
