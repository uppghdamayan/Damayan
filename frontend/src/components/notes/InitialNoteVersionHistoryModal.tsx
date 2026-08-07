'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, History, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useInitialNoteVersion,
  useInitialNoteVersions,
} from '@/hooks/useInitialNote';
import {
  formatEditorName,
  formatLogDate,
  formatLogTime,
  getFieldShortLabel,
} from '@/lib/initial-note-log-utils';
import {
  buildVersionCsv,
  buildVersionCsvFilename,
  downloadCsv,
} from '@/lib/initial-note-csv';
import { usePatient } from '@/hooks/usePatients';
import { InitialNoteVersionView } from './InitialNoteVersionView';

interface InitialNoteVersionHistoryModalProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  noteId: string;
  /** Pre-select this version on open (used by the "View version" log chip). */
  initialVersionId?: string | null;
}

/**
 * Read-only viewer for the Initial Note's version history: a rail of versions
 * on the left, the selected snapshot rendered on the right. There is
 * deliberately no revert action — this answers "what did the note say then?",
 * it does not roll the record back.
 */
export function InitialNoteVersionHistoryModal({
  open,
  onClose,
  patientId,
  noteId,
  initialVersionId,
}: InitialNoteVersionHistoryModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const { data: versionsResponse, isLoading: versionsLoading } =
    useInitialNoteVersions(open ? patientId : null, open ? noteId : null);
  const versions = useMemo(
    () => versionsResponse?.data ?? [],
    [versionsResponse],
  );

  const activeId = selectedId ?? initialVersionId ?? versions[0]?.id ?? null;
  const { data: version, isLoading: versionLoading } = useInitialNoteVersion(
    open ? patientId : null,
    open ? noteId : null,
    activeId,
  );

  const activeSummary = versions.find((v) => v.id === activeId);
  const latestVersionNumber = versions[0]?.versionNumber;
  const activeChangedFields = activeSummary?.changedFields ?? version?.changedFields ?? [];

  // Identifies the record in the exported file; the query is already cached by
  // the surrounding screen, so this costs nothing extra.
  const { data: patient } = usePatient(open ? patientId : null);
  const csvPatient = patient
    ? {
        patientCode: patient.patientCode,
        fullName: [patient.firstName, patient.middleName, patient.lastName]
          .filter(Boolean)
          .join(' '),
      }
    : undefined;

  const handleExportCsv = () => {
    if (!version) return;
    const changedFields = activeSummary?.changedFields ?? version.changedFields;
    downloadCsv(
      buildVersionCsvFilename(version, csvPatient),
      buildVersionCsv(version, changedFields, csvPatient),
    );
  };

  // Clearing the local selection on close lets the next open honour whatever
  // initialVersionId the caller passes (e.g. a log row's "View version" chip).
  const handleClose = useCallback(() => {
    setSelectedId(null);
    onClose();
  }, [onClose]);

  // Escape to close; focus moves into the dialog and returns to the trigger
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Trap focus inside the dialog
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center animate-in fade-in duration-150 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Initial Note version history"
        tabIndex={-1}
        className="bg-surface border border-border rounded-[10px] w-[900px] max-[1439px]:w-[840px] max-[1279px]:w-[92vw] max-[767px]:w-[94vw] max-h-[85vh] flex flex-col overflow-hidden shadow-modal outline-none"
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border flex-shrink-0">
          <History className="w-4 h-4 text-accent" />
          <h2 className="text-[15px] font-bold flex-1 text-text-primary">
            Version History — Initial Note
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close modal"
            className="w-6 h-6 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body: rail + pane. Below 768px the rail becomes a top strip. */}
        <div className="flex flex-1 min-h-0 max-[767px]:flex-col">
          {/* Version rail */}
          <div className="w-[240px] flex-shrink-0 border-r border-border overflow-y-auto bg-surface-2/40 max-[767px]:w-full max-[767px]:border-r-0 max-[767px]:border-b max-[767px]:max-h-[128px]">
            {versionsLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <Skeleton height={12} width={70} borderRadius={3} />
                    <Skeleton height={10} width={120} borderRadius={3} />
                  </div>
                ))}
              </div>
            ) : versions.length === 0 ? (
              <div className="p-4 text-[12px] text-text-muted italic">
                No versions recorded yet.
              </div>
            ) : (
              versions.map((v) => {
                const isActive = v.id === activeId;
                const fieldList = v.changedFields ?? [];
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    aria-current={isActive}
                    className={cn(
                      'w-full text-left px-3 py-2.5 border-b border-border/60 border-l-[3px] border-l-transparent transition-colors duration-150 cursor-pointer',
                      isActive
                        ? 'bg-accent-light border-l-accent'
                        : 'hover:bg-surface-2',
                    )}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[12px] font-bold text-text-primary">
                        v{v.versionNumber}
                      </span>
                      {v.versionNumber === latestVersionNumber && (
                        <Badge variant="published">Current</Badge>
                      )}
                      {v.versionNumber === 1 && <Badge variant="info">Original</Badge>}
                    </div>
                    <div className="text-[11px] text-text-secondary truncate mt-0.5">
                      {formatEditorName(v.editor)}
                    </div>
                    <div className="font-mono text-[10px] text-text-muted mt-0.5">
                      {formatLogDate(v.createdAt)} · {formatLogTime(v.createdAt)}
                    </div>
                    {fieldList.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {fieldList.map((f) => (
                          <span
                            key={f}
                            className="text-[9px] font-semibold bg-surface-3 text-text-secondary border border-border px-1.5 py-0.5 rounded leading-none"
                          >
                            {getFieldShortLabel(f)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-text-muted mt-1 line-clamp-2 leading-snug">
                      {v.versionNumber === 1
                        ? 'Original published version'
                        : v.changeSummary}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Snapshot pane */}
          <div className="flex-1 overflow-y-auto p-4 min-w-0">
            {versionLoading || !version ? (
              versions.length === 0 && !versionsLoading ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center text-text-muted border border-border/80 mb-3 shadow-sm">
                    <History className="w-4 h-4 text-text-muted/80" />
                  </div>
                  <h4 className="text-[13px] font-bold text-text-primary mb-1">
                    No versions yet
                  </h4>
                  <p className="text-[12px] text-text-muted max-w-xs leading-relaxed">
                    A version is recorded when the note is published and on every
                    edit made afterwards.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <Skeleton height={11} width={140} borderRadius={3} />
                      <Skeleton height={12} borderRadius={3} className="w-full" />
                      <Skeleton height={12} borderRadius={3} className="w-[80%]" />
                    </div>
                  ))}
                </div>
              )
            ) : (
              <>
                <div className="flex flex-col gap-1.5 pb-3 mb-4 border-b border-border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-text-primary">
                      Version {version.versionNumber}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      {version.versionNumber === 1 ? 'published by' : 'saved by'}{' '}
                      {formatEditorName(version.editor)} ·{' '}
                      {formatLogDate(version.createdAt)} ·{' '}
                      {formatLogTime(version.createdAt)}
                    </span>
                  </div>
                  {activeChangedFields.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                        Changed:
                      </span>
                      {activeChangedFields.map((f) => (
                        <span
                          key={f}
                          className="text-[9.5px] font-bold bg-amber-bg text-amber border border-amber-border px-1.5 py-0.5 rounded uppercase tracking-wider"
                        >
                          {getFieldShortLabel(f)}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="text-[11px] text-text-secondary leading-relaxed">
                    {version.versionNumber === 1
                      ? 'Original published version — nothing precedes it to compare against.'
                      : activeSummary?.changeSummary ??
                        version.changeSummary ??
                        'No section changes recorded.'}
                  </span>
                </div>
                <InitialNoteVersionView
                  snapshot={version.snapshot}
                  changedFields={activeChangedFields}
                />
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-[18px] py-3 border-t border-border bg-surface-2/30 flex-shrink-0">
          <span className="text-[11px] text-text-muted max-[767px]:hidden">
            Viewing history only — earlier versions cannot be restored.
          </span>
          <div className="flex items-center gap-2 max-[767px]:w-full max-[767px]:justify-end">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!version}
              className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 cursor-pointer inline-flex items-center gap-[5px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-2 disabled:hover:text-text-secondary"
              title={
                version
                  ? `Export version ${version.versionNumber} as a CSV file`
                  : 'Select a version to export'
              }
            >
              <Download className="w-3.5 h-3.5" />
              {version ? `Export v${version.versionNumber} (CSV)` : 'Export CSV'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
