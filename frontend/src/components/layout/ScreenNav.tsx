'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import {
  PanelRightOpen,
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
  { id: 'dashboard', label: 'Dashboard', short: 'Dashboard', path: '', icon: LayoutDashboard },
  { id: 'vitals', label: 'Vital Signs', short: 'Vitals', path: '/vitals', icon: Activity },
  { id: 'note-timeline', label: 'Note Timeline', short: 'Timeline', path: '/notes', icon: Clock },
  { id: 'initial-note', label: 'History', short: 'History', path: '/initial-note', icon: FileText },
  { id: 'problems', label: 'Problem List', short: 'Problems', path: '/problems', icon: ListTodo },
  { id: 'medications', label: 'Medications', short: 'Meds', path: '/medications', icon: Pill },
  { id: 'documents', label: 'Documents', short: 'Docs', path: '/documents', icon: Printer },
  { id: 'logs', label: 'Logs', short: 'Logs', path: '/logs', icon: Scroll },
] as const;

export function ScreenNav({ patientId }: { patientId: string }) {
  const pathname = usePathname();
  const [optimisticPath, setOptimisticPath] = useState(pathname);
  const queryClient = useQueryClient();

  useEffect(() => {
    setOptimisticPath(pathname);
  }, [pathname]);

  const { user } = useAuthStore();
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

  // Prefetch tab data on hover so first-visit latency is eliminated
  const handleTabHover = useCallback((tabId: string) => {
    const prefetchHandlers: Record<string, () => void> = {
      documents: () => queryClient.prefetchQuery({
        queryKey: ['documents', patientId],
        queryFn: () => apiRequest<any[]>(`/patients/${patientId}/documents`),
      }),
      problems: () => queryClient.prefetchQuery({
        queryKey: ['problems', patientId],
        queryFn: () => apiRequest<any>(`/patients/${patientId}/problems`),
      }),
      medications: () => queryClient.prefetchQuery({
        queryKey: ['medications', patientId, false],
        queryFn: () => apiRequest<any>(`/patients/${patientId}/medications`),
      }),
      vitals: () => queryClient.prefetchQuery({
        queryKey: ['vitals', patientId],
        queryFn: () => apiRequest<any>(`/patients/${patientId}/vitals`),
      }),
    };
    prefetchHandlers[tabId]?.();
  }, [queryClient, patientId]);

  // Overflow affordance. The scroller hides its scrollbar in both engines, so
  // without these fades a row of tabs that runs off the edge looks identical to
  // one that ends there — the tabs past the edge read as simply not existing.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const syncOverflow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setOverflow({
      start: el.scrollLeft > 1,
      end: maxScroll > 1 && el.scrollLeft < maxScroll - 1,
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    syncOverflow();
    const observer = new ResizeObserver(syncOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncOverflow, tabs.length]);

  return (
    <div className="flex items-center bg-surface border-b border-border h-[52px] flex-shrink-0">
      {/*
        @container/nav measures the tab row itself.

        These breakpoints used to read `@max-[1100px]` against the *window*,
        which is not the space the tabs have: with the patient sidebar and the
        documentation panel open, the centre column is ~700px narrower. A
        `forceIconOnly` boolean (`!sidebarCollapsed || documentationPanelOpen`)
        tried to stand in for that, but every class it gated was itself
        `@max-[1100px]`-prefixed, so above 1100px it did nothing at all and the
        tabs simply ran off the edge. Measuring the row removes the need for the
        proxy entirely: opening a panel shrinks this container, which is the
        signal.
      */}
      <div className="@container/nav relative flex-1 min-w-0">
        <div
          ref={scrollerRef}
          onScroll={syncOverflow}
          className="flex items-center gap-1.5 px-4 @max-[820px]/nav:px-2.5 h-[52px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const active = isActive(tab);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={`${basePath}${tab.path}`}
                prefetch={true}
                onClick={() => setOptimisticPath(`${basePath}${tab.path}`)}
                onMouseEnter={() => handleTabHover(tab.id)}
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
                title={tab.label}
                className={cn(
                  "group h-8 text-[12px] font-medium rounded-btn border whitespace-nowrap transition-all duration-300 ease-in-out flex-shrink-0 cursor-pointer flex items-center justify-start overflow-hidden",
                  "px-3.5",
                  // Thresholds are measured, not guessed: with IBM Plex Sans at
                  // 12px, eight tabs need 931px with full labels and 786px with
                  // the abbreviated ones, and 362px as icons. 940 / 820 leaves
                  // each tier a little headroom.
                  active
                    ? ""
                    : "@max-[820px]/nav:w-auto @max-[820px]/nav:min-w-[36px] @max-[820px]/nav:max-w-[36px] @max-[820px]/nav:px-[11px] hover:@max-[820px]/nav:max-w-[200px] hover:@max-[820px]/nav:px-3.5",
                  active
                    ? "bg-accent text-white border-accent shadow-[0_4px_12px_rgba(10,110,95,0.25)]"
                    : "bg-surface-2 text-text-secondary border-border hover:bg-surface-3 hover:border-border-strong hover:text-text-primary"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span
                  className={cn(
                    "transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden inline-block ml-1.5 max-w-[120px]",
                    active
                      ? ""
                      : "@max-[820px]/nav:opacity-0 @max-[820px]/nav:max-w-0 @max-[820px]/nav:ml-0 group-hover:@max-[820px]/nav:opacity-100 group-hover:@max-[820px]/nav:max-w-[120px] group-hover:@max-[820px]/nav:ml-1.5"
                  )}
                >
                  {/* Full label above 940px, abbreviated below. Rendering both
                      and toggling with CSS keeps this a container-query decision
                      rather than a JS measurement that would flicker on
                      resize. */}
                  <span className="@max-[940px]/nav:hidden">{tab.label}</span>
                  <span className="hidden @max-[940px]/nav:inline">{tab.short}</span>
                </span>
              </Link>
            );
          })}
        </div>

        {/* Edge fades — pointer-events-none so they never eat a tab click. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-surface to-transparent transition-opacity duration-150",
            overflow.start ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-surface to-transparent transition-opacity duration-150",
            overflow.end ? "opacity-100" : "opacity-0"
          )}
        />
      </div>

      {/*
        Pinned outside the scroller. This button used to live inside the
        overflowing row with `ml-auto`, so it scrolled out of reach exactly when
        the panel was closed and you needed it to get the panel back.
      */}
      {!documentationPanelOpen && (
        <button
          onClick={() => setDocumentationPanelOpen(true)}
          className="mr-4 h-8 px-3 rounded-btn bg-surface-2 hover:bg-surface-3 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-150"
          aria-label="Open documentation panel"
          title="Open documentation panel"
        >
          <PanelRightOpen className="w-4 h-4 text-text-secondary" />
        </button>
      )}
    </div>
  );
}
