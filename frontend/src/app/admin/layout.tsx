'use client';

import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, clear } = useAuthStore();

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    clear();
    window.location.href = '/login';
  };

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'AD';

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* Topbar */}
      <header
        style={{
          height: 56,
          background: '#FFFFFF',
          borderBottom: '1px solid #D1D5E0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div style={{ width: 22, height: 22, background: '#0A6E5F', borderRadius: 5 }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: '#0D1117' }}>DAMAYAN</span>

        {/* Role pill */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            background: '#D4EDE9',
            color: '#0A6E5F',
            border: '1px solid #0A6E5F',
            borderRadius: 20,
            padding: '2px 8px',
          }}
        >
          {user?.role ?? 'Admin'}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* User avatar */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#085A4E',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {initials}
          </div>

          {/* Sign out button */}
          <button
            onClick={handleSignOut}
            style={{
              height: 28,
              padding: '0 12px',
              background: '#F7F8FA',
              border: '1px solid #D1D5E0',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
        {children}
      </main>
    </div>
  );
}
