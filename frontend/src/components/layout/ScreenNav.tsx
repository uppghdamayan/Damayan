'use client';

import { useRouter, useParams, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

const ALL_TABS = [
  { id: 'dashboard',     label: 'Dashboard',     path: '' },
  { id: 'vitals',        label: 'Vital Signs',   path: '/vitals' },
  { id: 'note-timeline', label: 'Note Timeline ★', path: '/notes' },
  { id: 'initial-note',  label: 'Initial Note',  path: '/initial-note' },
  { id: 'problems',      label: 'Problem List',  path: '/problems' },
  { id: 'medications',   label: 'Medications',   path: '/medications' },
  { id: 'documents',     label: 'Documents',     path: '/documents' },
  { id: 'logs',          label: 'Logs',          path: '/logs' },
] as const;

export function ScreenNav({ patientId }: { patientId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();

  // Hide Logs tab for non-Admin
  const tabs = ALL_TABS.filter(
    (t) => t.id !== 'logs' || user?.role === 'ADMIN',
  );

  const basePath = `/dashboard/${patientId}`;

  const isActive = (tab: (typeof ALL_TABS)[number]) => {
    if (tab.id === 'dashboard') {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname.startsWith(`${basePath}${tab.path}`);
  };

  return (
    <nav style={{
      height: 52, background: '#FFFFFF', borderBottom: '1px solid #D1D5E0',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 6,
      flexShrink: 0, overflowX: 'auto',
    }}>
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <button
            key={tab.id}
            onClick={() => router.push(`${basePath}${tab.path}`)}
            style={{
              height: 32, padding: '0 12px', border: '1px solid',
              borderColor: active ? 'transparent' : '#D1D5E0',
              borderRadius: 6, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              background: active ? '#0A6E5F' : '#F7F8FA',
              color: active ? '#FFFFFF' : '#374151',
              boxShadow: active ? '0 4px 12px rgba(10,110,95,0.25)' : 'none',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = '#EFF1F5'; e.currentTarget.style.borderColor = '#9BA3B5'; } }}
            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = '#F7F8FA'; e.currentTarget.style.borderColor = '#D1D5E0'; } }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
