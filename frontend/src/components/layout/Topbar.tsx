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
    <header
      style={{
        height: 56,
        background: '#FFFFFF',
        borderBottom: '1px solid #D1D5E0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 10,
        position: 'sticky',
        top: 0,
        zIndex: 200,
        flexShrink: 0,
      }}
    >
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
        style={{
          width: 32, height: 32, border: 'none', background: 'none',
          cursor: 'pointer', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 5,
          borderRadius: 6, flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#F7F8FA')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 16, height: 2, background: '#374151', borderRadius: 2 }} />
        ))}
      </button>

      {/* Logo */}
      <div style={{ width: 22, height: 22, background: '#0A6E5F', borderRadius: 5, flexShrink: 0 }} />
      <span style={{ fontSize: 16, fontWeight: 700, color: '#0D1117', letterSpacing: '-0.3px', flexShrink: 0 }}>
        DAMAYAN
      </span>

      {/* Role pill */}
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.6px', background: '#D4EDE9', color: '#0A6E5F',
        border: '1px solid #0A6E5F', borderRadius: 20, padding: '2px 8px',
        flexShrink: 0,
      }}>
        {roleLabel}
      </span>

      <div style={{ flex: 1 }} />

      {/* + New Note button */}
      <button
        onClick={() => {/* Phase 6+ — note creation flow */}}
        style={{
          height: 34, padding: '0 14px', background: '#0A6E5F', color: '#FFFFFF',
          border: '1px solid #085A4E', borderRadius: 6, fontSize: 11,
          fontWeight: 600, cursor: 'pointer', flexShrink: 0,
          boxShadow: '0 2px 4px rgba(10,110,95,0.15)',
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        + New Note
      </button>

      {/* Documentation panel toggle */}
      <button
        onClick={() => setDocumentationPanelOpen(!documentationPanelOpen)}
        aria-label="Toggle documentation panel"
        title={documentationPanelOpen ? 'Close documentation panel' : 'Open documentation panel'}
        style={{
          height: 34, padding: '0 10px',
          background: '#F7F8FA',
          border: '1px solid transparent',
          borderRadius: 6,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#EFF1F5'; e.currentTarget.style.borderColor = '#D1D5E0'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#F7F8FA'; e.currentTarget.style.borderColor = 'transparent'; }}
      >
        {documentationPanelOpen ? (
          <PanelRightClose size={16} color="#374151" strokeWidth={1.5} />
        ) : (
          <PanelRightOpen size={16} color="#374151" strokeWidth={1.5} />
        )}
      </button>

      {/* User avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: '#085A4E',
        color: '#FFFFFF', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0,
        cursor: 'default',
      }}
        title={user ? `${user.firstName} ${user.lastName}` : ''}
      >
        {userInitials}
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        style={{
          height: 28, padding: '0 12px', background: '#F7F8FA',
          border: '1px solid #D1D5E0', borderRadius: 6, fontSize: 11,
          fontWeight: 600, color: '#374151', cursor: 'pointer', flexShrink: 0,
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        Sign Out
      </button>
    </header>
  );
}
