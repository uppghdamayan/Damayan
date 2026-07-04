'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { usePatientStore } from '@/stores/patientStore';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import {
  PanelRightOpen,
  PanelRightClose,
  LayoutDashboard,
  Activity,
  Clock,
  FileText,
  ListTodo,
  Pill,
  Printer,
  Scroll
} from 'lucide-react';

const ALL_TABS = [
  { id: 'dashboard', label: 'Dashboard', path: '', icon: LayoutDashboard },
  { id: 'vitals', label: 'Vital Signs', path: '/vitals', icon: Activity },
  { id: 'note-timeline', label: 'Note Timeline', path: '/notes', icon: Clock },
  { id: 'initial-note', label: 'Initial Note', path: '/initial-note', icon: FileText },
  { id: 'problems', label: 'Problem List', path: '/problems', icon: ListTodo },
  { id: 'medications', label: 'Medications', path: '/medications', icon: Pill },
  { id: 'documents', label: 'Documents', path: '/documents', icon: Printer },
  { id: 'logs', label: 'Logs', path: '/logs', icon: Scroll },
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
    <nav className="flex items-center gap-1.5 bg-surface border-b border-border px-4 max-[1023px]:px-2.5 h-[52px] flex-shrink-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

      {tabs.map((tab) => {
        const active = isActive(tab);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={`${basePath}${tab.path}`}
            prefetch={true}
            onClick={() => setOptimisticPath(`${basePath}${tab.path}`)}
            aria-label={tab.label}
            title={tab.label}
            className={cn(
              "h-8 text-[12px] font-medium rounded-btn border whitespace-nowrap transition-all duration-150 flex-shrink-0 cursor-pointer flex items-center justify-center gap-1.5",
              active || "min-[1024px]:px-3.5",
              !active && "max-[1023px]:w-9 max-[1023px]:px-0 max-[1023px]:justify-center",
              active && "px-3.5",
              active
                ? "bg-accent text-white border-accent shadow-[0_4px_12px_rgba(10,110,95,0.25)]"
                : "bg-surface-2 text-text-secondary border-border hover:bg-surface-3 hover:border-border-strong hover:text-text-primary"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className={cn(active ? "inline" : "max-[1023px]:hidden")}>
              {tab.label}
            </span>
          </Link>
        );
      })}

      {/* Open doc panel button — far right (only visible when closed) */}
      {!documentationPanelOpen && (
        <button
          onClick={() => setDocumentationPanelOpen(true)}
          className="ml-auto h-8 px-3 rounded-btn  bg-surface-2 hover:bg-surface-3 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-150"
          aria-label="Open documentation panel"
          title="Open documentation panel"
        >
          <PanelRightOpen className="w-4 h-4 text-text-secondary" />
        </button>
      )}
    </nav>
  );
}

