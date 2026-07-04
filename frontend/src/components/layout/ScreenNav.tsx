'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { usePatientStore } from '@/stores/patientStore';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { 
  LayoutDashboard, 
  Activity, 
  Clock, 
  FileText, 
  ClipboardList, 
  Pill, 
  FolderOpen, 
  History,
  PanelRightOpen, 
  PanelRightClose 
} from 'lucide-react';

const ALL_TABS = [
  { id: 'dashboard',     label: 'Dashboard',     shortLabel: 'Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" />, path: '' },
  { id: 'vitals',        label: 'Vital Signs',   shortLabel: 'Vitals',    icon: <Activity className="w-3.5 h-3.5" />,        path: '/vitals' },
  { id: 'note-timeline', label: 'Note Timeline', shortLabel: 'Timeline',  icon: <Clock className="w-3.5 h-3.5" />,           path: '/notes' },
  { id: 'initial-note',  label: 'Initial Note',  shortLabel: 'Initial',   icon: <FileText className="w-3.5 h-3.5" />,        path: '/initial-note' },
  { id: 'problems',      label: 'Problem List',  shortLabel: 'Problems',  icon: <ClipboardList className="w-3.5 h-3.5" />,   path: '/problems' },
  { id: 'medications',   label: 'Medications',   shortLabel: 'Meds',      icon: <Pill className="w-3.5 h-3.5" />,            path: '/medications' },
  { id: 'documents',     label: 'Documents',     shortLabel: 'Docs',      icon: <FolderOpen className="w-3.5 h-3.5" />,      path: '/documents' },
  { id: 'logs',          label: 'Logs',          shortLabel: 'Logs',      icon: <History className="w-3.5 h-3.5" />,         path: '/logs' },
] as const;

export function ScreenNav({ patientId }: { patientId: string }) {
  const pathname = usePathname();
  const [optimisticPath, setOptimisticPath] = useState(pathname);
  const { width } = useBreakpoint();

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
    <nav className="flex items-center gap-1.5 bg-surface border-b border-border px-4 max-[1023px]:px-2.5 h-[52px] flex-shrink-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {patientName && (
        <span className="text-[11px] font-bold text-accent-mid uppercase tracking-[1px] mr-3.5 whitespace-nowrap flex-shrink-0 max-[767px]:hidden">
          {patientName}
        </span>
      )}

      {tabs.map((tab) => {
        const active = isActive(tab);
        const label = width >= 1280 ? tab.label : tab.shortLabel;

        return (
          <Link
            key={tab.id}
            href={`${basePath}${tab.path}`}
            prefetch={true}
            onClick={() => setOptimisticPath(`${basePath}${tab.path}`)}
            aria-label={tab.label}
            title={tab.label}
            className={cn(
              "h-8 text-[12px] font-medium rounded-btn border whitespace-nowrap transition-all duration-150 flex-shrink-0 inline-flex items-center justify-center gap-1.5 cursor-pointer",
              width >= 1024 ? "px-3.5" : (active ? "px-3.5" : "w-9 px-0"),
              active
                ? "bg-accent text-white border-accent shadow-[0_4px_12px_rgba(10,110,95,0.25)]"
                : "bg-surface-2 text-text-secondary border-border hover:bg-surface-3 hover:border-border-strong hover:text-text-primary"
            )}
          >
            {tab.icon}
            <span className={cn(
              width >= 1024 ? "inline" : (active ? "inline" : "hidden")
            )}>
              {label}
            </span>
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
