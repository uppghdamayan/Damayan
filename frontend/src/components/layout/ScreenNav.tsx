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
    <nav className="h-[52px] bg-white border-b border-[#D1D5E0] flex items-center px-4 gap-1.5 shrink-0 overflow-x-auto">
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <button
            key={tab.id}
            onClick={() => router.push(`${basePath}${tab.path}`)}
            className={`h-8 px-3 border rounded-md text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 transition-all duration-[120ms] ${active ? 'border-transparent bg-[#0A6E5F] text-white shadow-[0_4px_12px_rgba(10,110,95,0.25)]' : 'border-[#D1D5E0] bg-[#F7F8FA] text-[#374151] hover:bg-[#EFF1F5] hover:border-[#9BA3B5]'}`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
