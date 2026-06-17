'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { usePatientStore } from '@/stores/patientStore';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { PanelRightOpen, PanelRightClose } from 'lucide-react';

const ALL_TABS = [
  { id: 'dashboard',     label: 'Dashboard',     path: '' },
  { id: 'vitals',        label: 'Vital Signs',   path: '/vitals' },
  { id: 'note-timeline', label: 'Note Timeline', path: '/notes' },
  { id: 'initial-note',  label: 'Initial Note',  path: '/initial-note' },
  { id: 'problems',      label: 'Problem List',  path: '/problems' },
  { id: 'medications',   label: 'Medications',   path: '/medications' },
  { id: 'documents',     label: 'Documents',     path: '/documents' },
  { id: 'logs',          label: 'Logs',          path: '/logs' },
] as const;

export function ScreenNav({ patientId }: { patientId: string }) {
  const pathname = usePathname();
  const [optimisticPath, setOptimisticPath] = useState(pathname);

  useEffect(() => {
    setOptimisticPath(pathname);
  }, [pathname]);

  const { user } = useAuthStore();
  const { activePatient } = usePatientStore();
  const { documentationPanelOpen, setDocumentationPanelOpen } = useUiStore();

  // Hide Logs tab for non-Admin/Doctor
  const tabs = ALL_TABS.filter(
    (t) => t.id !== 'logs' || user?.role === 'ADMIN' || user?.role === 'DOCTOR',
  );

  const basePath = `/dashboard/${patientId}`;

  const isActive = (tab: (typeof ALL_TABS)[number]) => {
    if (tab.id === 'dashboard') {
      return optimisticPath === basePath || optimisticPath === `${basePath}/`;
    }
    return optimisticPath.startsWith(`${basePath}${tab.path}`);
  };

  const patientName = activePatient ? `${activePatient.lastName}, ${activePatient.firstName}` : '';

  return (
    <nav className="flex items-center gap-1.5 bg-surface border-b border-border px-4 h-[52px] flex-shrink-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.id}
            href={`${basePath}${tab.path}`}
            prefetch={true}
            onClick={() => setOptimisticPath(`${basePath}${tab.path}`)}
            className={cn(
              "h-8 px-3.5 text-[12px] font-medium rounded-btn border whitespace-nowrap transition-all duration-150 flex-shrink-0 cursor-pointer flex items-center justify-center",
              active
                ? "bg-accent text-white border-accent shadow-[0_4px_12px_rgba(10,110,95,0.25)]"
                : "bg-surface-2 text-text-secondary border-border hover:bg-surface-3 hover:border-border-strong hover:text-text-primary"
            )}
          >
            {tab.label}
          </Link>
        );
      })}

      {/* Toggle doc panel button — far right */}
      <button
        onClick={() => setDocumentationPanelOpen(!documentationPanelOpen)}
        className="ml-auto h-8 px-3 rounded-btn border border-border bg-surface-2 hover:bg-surface-3 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-150"
        aria-label="Toggle documentation panel"
        title={documentationPanelOpen ? 'Close documentation panel' : 'Open documentation panel'}
      >
        {documentationPanelOpen ? (
          <PanelRightClose className="w-3.5 h-3.5 text-text-secondary" />
        ) : (
          <PanelRightOpen className="w-3.5 h-3.5 text-text-secondary" />
        )}
      </button>
    </nav>
  );
}
