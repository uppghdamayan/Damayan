'use client';

import { useInitialNote } from '@/hooks/useInitialNote';
import { useProgressNotes } from '@/hooks/useProgressNotes';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

export function NonPharmacologicCard({ patientId }: { patientId: string }) {
  const { data: initialNote, isLoading: initialLoading } = useInitialNote(patientId);
  const { data: progressResponse, isLoading: progressLoading } = useProgressNotes(patientId);

  const { text, dateStr, userStr } = useMemo(() => {
    const progressNotes = progressResponse?.data || [];
    const notes: { mgmtNonpharm?: string; createdAt: string; status: string; author?: any; lastEditor?: any }[] = [...progressNotes];
    if (initialNote) {
      notes.push(initialNote);
    }

    // Filter to published notes with non-empty non-pharmacologic management content
    const publishedWithContent = notes
      .filter((n) => n.status === 'PUBLISHED' && n.mgmtNonpharm && n.mgmtNonpharm.trim() !== '' && n.mgmtNonpharm.trim().toLowerCase() !== 'none')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (publishedWithContent.length > 0) {
      const latest = publishedWithContent[0];
      const d = new Date(latest.createdAt).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const user = latest.lastEditor || latest.author;
      const userStr = user ? `${user.firstName} ${user.lastName}` : null;
      return { text: latest.mgmtNonpharm, dateStr: d, userStr };
    }

    return { text: 'No non-pharmacologic management recorded.', dateStr: null, userStr: null };
  }, [initialNote, progressResponse]);

  if (initialLoading || progressLoading) {
    return (
      <div className="bg-surface border border-border border-l-[3px] border-l-green-border rounded-card shadow-card overflow-hidden animate-pulse">
        <div className="px-3.5 py-2.5 bg-surface-2 border-b border-border h-9" />
        <div className="p-4 h-20 bg-surface" />
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border border-l-[3px] border-l-green-border rounded-card shadow-card overflow-hidden">
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex items-center gap-2.5">
        <div className="w-[26px] h-[26px] bg-green-bg text-green rounded-icon flex items-center justify-center text-[12px] flex-shrink-0">
          🏃
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">
              Non-pharmacologic Management
            </span>
            {dateStr && (
              <span className="font-mono text-[9px] text-text-muted normal-case font-normal">
                Last updated: {dateStr}
              </span>
            )}
          </div>
          {userStr && (
            <span className="text-[9px] text-text-muted mt-0.5 normal-case tracking-normal">
              Last updated by: <span className="font-medium text-text-secondary">{userStr}</span>
            </span>
          )}
        </div>
      </div>
      <div className="p-3 px-3.5 text-[12px] leading-relaxed text-text-secondary whitespace-pre-wrap max-h-[80px] overflow-hidden relative">
        {text}
        <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
