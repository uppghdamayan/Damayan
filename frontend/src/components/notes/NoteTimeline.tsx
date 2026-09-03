import { useProgressNotes, useCarryForwardSource, useCopyForwardData, ProgressNote } from '@/hooks/useProgressNotes';
import { useInitialNote, useInitialNotes, useDeleteInitialNote, InitialNote } from '@/hooks/useInitialNote';
import { useNewProgressNoteAction } from '@/hooks/useNewProgressNoteAction';
import { TimelineEntry } from './TimelineEntry';
import { useRouter } from 'next/navigation';
import { useUiStore } from '@/stores/uiStore';
import { useDraftSnapshotStore } from '@/stores/draftSnapshotStore';
import { useNoteOverridesStore, medNoteOverrideKey, problemNoteOverrideKey } from '@/stores/noteOverridesStore';
import { useDeletedNotes } from '@/hooks/useDeletedNotes';
import { DeletedNote } from '@/types/deleted-note';
import { useState, useMemo, useEffect, useRef } from 'react';
import { mapNoteToTimelineView } from '@/lib/notes-utils';
import { flattenActiveProblemTree, mergeActiveProblems, mergeActiveMedications } from '@/lib/note-snapshot-merge';
import { Button } from '@/components/ui/button';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { ClipboardList, ArrowRight, ChevronDown } from 'lucide-react';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { useDeleteProgressNote } from '@/hooks/useProgressNotes';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Mirrors ProgressNoteForm's branch selection for a snapshot-less draft
 * (see ProgressNoteForm.tsx's hydration effect, `hasProblemSnapshot`/
 * `hasMedSnapshot` branches) so a draft's timeline entry never diverges
 * from what the editor would show for the same note, whether or not the
 * editor is actually mounted right now.
 */
function mergeProblemsForDraft(
  problemListSnapshot: unknown,
  activeProblems: any[],
  removedKeys?: Set<string>,
): any[] {
  const hasSnapshot = Array.isArray(problemListSnapshot);
  const validProblems = (hasSnapshot ? (problemListSnapshot as any[]) : [])
    .filter((p: any) => p && (typeof p === 'string' ? p.trim() : p.title))
    .map((p: any) => (typeof p === 'string' ? { title: p } : p));

  if (hasSnapshot) return mergeActiveProblems(validProblems, activeProblems, removedKeys);

  return flattenActiveProblemTree(activeProblems)
    .filter(({ problem: p }) => {
      const titleKey = p.title?.trim().toLowerCase();
      return !(removedKeys?.has(`id:${p.id}`) || (titleKey && removedKeys?.has(`title:${titleKey}`)));
    })
    .map(({ problem: p, depth }) => ({
      id: p.id || undefined,
      title: p.title,
      parentId: p.parentId || undefined,
      depth,
      diagnosisDate: p.diagnosisDate || null,
    }));
}

function mergeMedsForDraft(
  medicationSnapshot: unknown,
  activeMedications: any[],
  inheritedMedications: any[],
  removedNames?: Set<string>,
): any[] {
  const hasSnapshot = Array.isArray(medicationSnapshot);
  const validMeds = (hasSnapshot ? (medicationSnapshot as any[]) : [])
    .filter((m: any) => m && (typeof m === 'string' ? m.trim() : m.name))
    .map((m: any) => (typeof m === 'string' ? { name: m, dose: '' } : m));

  if (hasSnapshot) return mergeActiveMedications(validMeds, activeMedications, removedNames);
  if (inheritedMedications.length > 0) return mergeActiveMedications(inheritedMedications, activeMedications, removedNames);

  // No snapshot and nothing inherited — raw active meds, minus anything the
  // clinician just discontinued in this note (the same guard the two
  // branches above get for free from mergeActiveMedications).
  return activeMedications
    .filter((m: any) => !removedNames?.has(String(m.name || '').trim().toLowerCase()))
    .map((m: any) => ({
      name: m.name,
      dose: m.dose || undefined,
      formulation: m.formulation || undefined,
      quantity: m.quantity || undefined,
      instructions: m.instructions || undefined,
      fromPast: m.fromPast || false,
    }));
}


interface NoteTimelineProps {
  patientId: string;
}

const PAGE_SIZE_OPTIONS = [1, 5, 10, 20, 50];

export function NoteTimeline({ patientId }: NoteTimelineProps) {
  const router = useRouter();
  const { data: initialNotes, isLoading: initialLoading } = useInitialNotes(patientId);
  const { data: activeInitialNote } = useInitialNote(patientId);
  // limit=100: at the previous default of 10, the timeline silently lost
  // every note past the 10th (and #10 lost its diff baseline). This args
  // tuple is part of the TanStack query key, so DocumentationPanel's
  // useProgressNotes(patientId) call must stay in sync with it — otherwise
  // the two hold divergent caches for the same patient.
  const { data: progressNotesResponse, isLoading: progressLoading } = useProgressNotes(patientId, 1, 100);
  // What a *new* note would inherit from — same resolver the backend uses to
  // build that note, so the pin below points at exactly the right note.
  const { data: carryForwardSource } = useCarryForwardSource(patientId);
  const { openExistingProgressNote, activeNoteEditor } = useUiStore();
  const { triggerNewNote, isLoading: actionLoading } = useNewProgressNoteAction(patientId);
  const deleteMutation = useDeleteInitialNote(patientId);
  const { data: deletedNotes = [], isLoading: deletedLoading } = useDeletedNotes(patientId);
  const { user } = useAuthStore();

  // Set to track expanded notes (intentional: multiple notes can be open at once)
  // Decided per fix.md §6.4.
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteDraftNoteId, setDeleteDraftNoteId] = useState<string | null>(null);
  const deleteProgressNoteMutation = useDeleteProgressNote(patientId);

  // Timeline pagination. Deliberately client-side over the fully merged
  // `mappedNotes` list rather than server-side: initial notes and deleted
  // notes come from unpaginated endpoints and are merged/re-sorted here, and
  // the diff baseline below walks the whole older history, so a server page
  // of progress notes alone could not represent this list correctly.
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  const handleToggleNote = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCloseAll = () => {
    setExpandedNotes(new Set());
  };

  const progressNotes = progressNotesResponse?.data || [];

  // The one DRAFT progress note (if any) this patient has open — its
  // timeline entry is kept 1:1 with the editor sidebar (see mappedNotes
  // below). Only one draft is ever active at a time per NoteTimeline.tsx's
  // own "+ New Note" gating (hasDrafts below), so `.find` is unambiguous.
  const draftProgressNote = progressNotes.find((n: any) => n.status === 'DRAFT' && !n.isDeleted);
  // excludeNoteId matches ProgressNoteForm's own useCopyForwardData call for
  // this same note (ProgressNoteForm.tsx:99) — same cache entry, no extra
  // request, and `inheritedMedications` resolves to exactly what the editor
  // sees (never the draft's own still-blank snapshot).
  const { data: copyForward } = useCopyForwardData(patientId, draftProgressNote?.id ?? null);
  const liveDraftSnapshot = useDraftSnapshotStore((s) =>
    draftProgressNote ? s.byKey[`${patientId}:${draftProgressNote.id}`] : undefined
  );
  // In-note discontinuations/deletions for the open draft — durable
  // (persisted) so this stays correct even with the editor panel closed,
  // unlike liveDraftSnapshot above. See noteOverridesStore.ts.
  const removedMedNamesList = useNoteOverridesStore((s) =>
    draftProgressNote ? s.byKey[medNoteOverrideKey(patientId, draftProgressNote.id)] : undefined
  );
  const removedMedNames = useMemo(
    () => new Set(removedMedNamesList || []),
    [removedMedNamesList],
  );
  const removedProblemKeysList = useNoteOverridesStore((s) =>
    draftProgressNote ? s.byKey[problemNoteOverrideKey(patientId, draftProgressNote.id)] : undefined
  );
  const removedProblemKeys = useMemo(
    () => new Set(removedProblemKeysList || []),
    [removedProblemKeysList],
  );

  // Live editor state for a genuinely unsaved note (noteId === null): there
  // is no server-side DRAFT row yet, so `draftProgressNote` above is
  // undefined and this note would otherwise have no timeline entry at all
  // until the first Save Draft — an in-note problem/medication addition
  // was invisible here until then. draftSnapshotStore now always writes
  // under `${patientId}:new` while the editor is mounted (see
  // ProgressNoteForm's draftSnapshotKey), so read it directly; no merge
  // needed, the editor's live state already is the truth pre-save.
  const pendingDraftSnapshot = useDraftSnapshotStore((s) => s.byKey[`${patientId}:new`]);
  const hasPendingNewNote =
    !draftProgressNote &&
    activeNoteEditor.mode === 'new' &&
    activeNoteEditor.patientId === patientId &&
    !!pendingDraftSnapshot;

  // Combine and sort
  const allNotesRaw = useMemo(() => {
    const combined: any[] = [...progressNotes];
    if (hasPendingNewNote) {
      combined.push({
        id: '__pending__',
        status: 'DRAFT',
        subjective: '',
        objective: '',
        mgmtPharm: '',
        problemListSnapshot: pendingDraftSnapshot!.problemListSnapshot || [],
        medicationSnapshot: pendingDraftSnapshot!.medicationSnapshot || [],
        createdAt: new Date().toISOString(),
      });
    }
    const initialList = (initialNotes && initialNotes.length > 0)
      ? initialNotes
      : (activeInitialNote ? [activeInitialNote] : []);

    const existingIds = new Set(combined.map((n) => n.id));
    for (const initNote of initialList) {
      if (!existingIds.has(initNote.id)) {
        combined.push(initNote);
        existingIds.add(initNote.id);
      }
    }
    for (const delNote of deletedNotes) {
      if (!existingIds.has(delNote.id)) {
        combined.push(delNote);
        existingIds.add(delNote.id);
      }
    }
    return combined;
  }, [progressNotes, initialNotes, activeInitialNote, deletedNotes, hasPendingNewNote, pendingDraftSnapshot]);

  // The synthetic pending entry must never count toward "+ New Note"
  // gating — it isn't a real DB draft, it's a preview of the one being
  // typed right now.
  const hasDrafts = allNotesRaw.some((note) => note.status === 'DRAFT' && 'subjective' in note && note.id !== '__pending__');

  // Sort by visit.visitDatetime (falling back to createdAt when the visit
  // relation is missing), tied on createdAt — the exact same key and
  // tiebreaker the backend orders by, so the order shown here always matches
  // what a new note actually inherits from. Sorts a copy: the previous
  // `.sort()` mutated `allNotesRaw` in place while living inside a useMemo
  // that never actually memoized (a fresh array every render), and
  // `onClickEdit` below indexed into that same mutated array.
  const sortedRaw = useMemo(() => {
    return [...allNotesRaw].sort((a, b) => {
      const aTime = new Date(a.visit?.visitDatetime || (a.deletedAt ? a.originalCreatedAt : a.createdAt)).getTime();
      const bTime = new Date(b.visit?.visitDatetime || (b.deletedAt ? b.originalCreatedAt : b.createdAt)).getTime();
      if (bTime !== aTime) return bTime - aTime;
      const aCreated = new Date(a.deletedAt ? a.originalCreatedAt : a.createdAt).getTime();
      const bCreated = new Date(b.deletedAt ? b.originalCreatedAt : b.createdAt).getTime();
      return bCreated - aCreated;
    });
  }, [allNotesRaw]);

  // Map to TimelineNoteView and identify latest
  const mappedNotes = useMemo(() => {
    const initialNoteAuthorId = activeInitialNote?.authorId;
    return sortedRaw.map((note, index) => {
      // The latest note is the first one in the sorted list (since newest first)
      const isLatest = index === 0;
      // Keep the one open DRAFT's timeline entry 1:1 with ProgressNoteForm:
      // prefer the editor's own live form state when it's mounted
      // (liveDraftSnapshot — covers in-note discontinuations and unsaved
      // isNew rows the merge below can't see), else run the identical merge
      // against the live master lists so the entry still isn't stuck on a
      // stale/null persisted snapshot with the panel closed.
      let noteForView = note;
      if (draftProgressNote && note.id === draftProgressNote.id && copyForward) {
        noteForView = {
          ...note,
          // Merge-always, seeded by live-if-present — same shape as the
          // medication merge below and for the same reason: the editor's
          // frozen array (while the problem edit lock is held) is only
          // used to decide membership, not to skip the master-list resync,
          // so a stale title/nesting never leaks into this read-only view.
          // `removedKeys` covers in-note deletions even once the editor
          // unmounts and liveDraftSnapshot goes away.
          problemListSnapshot: mergeProblemsForDraft(
            liveDraftSnapshot?.problemListSnapshot ?? note.problemListSnapshot,
            copyForward.activeProblems,
            removedProblemKeys,
          ),
          // Merge-always, seeded by the editor's live form state when
          // mounted (else the persisted snapshot): the editor's array is
          // only used to decide *membership* (in-progress isNew rows,
          // just-clicked discontinuations), while this call still resyncs
          // dose/formulation/quantity/instructions from the live master
          // list itself. This is what keeps the timeline correct while the
          // medication edit lock is held — ProgressNoteForm deliberately
          // freezes its own merge in that state (to protect in-progress
          // typing), but that freeze must not leak a stale field into this
          // read-only view. `removedNames` covers discontinuations even
          // once the editor unmounts and liveDraftSnapshot goes away.
          medicationSnapshot: mergeMedsForDraft(
            liveDraftSnapshot?.medicationSnapshot ?? note.medicationSnapshot,
            copyForward.activeMedications,
            copyForward.inheritedMedications,
            removedMedNames,
          ),
        };
      }
      return mapNoteToTimelineView(noteForView, isLatest, initialNoteAuthorId);
    });
  }, [sortedRaw, activeInitialNote, draftProgressNote, copyForward, liveDraftSnapshot, removedMedNames, removedProblemKeys]);

  const inheritedSourceId = carryForwardSource?.sourceNoteId ?? undefined;

  const totalPages = Math.max(1, Math.ceil(mappedNotes.length / limit));
  // Clamped on read rather than corrected in an effect, so a list that shrinks
  // under the current page (e.g. deleting the only note on the last page) can
  // never render a blank page and never costs a cascading re-render.
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * limit;
  const pageNotes = mappedNotes.slice(pageStart, pageStart + limit);

  // Reset to page 1 when the patient changes, or when a brand-new note
  // appears — it's inserted at the top of this newest-first list, so it's
  // only visible from page 1. Adjusted during render (React's "adjusting
  // state when a prop changes" pattern) instead of in an effect.
  const [pageAnchor, setPageAnchor] = useState({ patientId, pending: hasPendingNewNote });
  if (pageAnchor.patientId !== patientId || pageAnchor.pending !== hasPendingNewNote) {
    const shouldReset = pageAnchor.patientId !== patientId || hasPendingNewNote;
    setPageAnchor({ patientId, pending: hasPendingNewNote });
    if (shouldReset) setPage(1);
  }

  // Without this, page 2 opens at whatever scroll offset page 1 was left at.
  useEffect(() => {
    listScrollRef.current?.scrollTo({ top: 0 });
  }, [safePage]);

  const handlePageChange = (newPage: number) => {
    setPage(Math.min(Math.max(1, newPage), totalPages));
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  // Only show skeleton on initial load when there's no data yet.
  // This prevents brief loading flashes when queries are invalidated after mutations.
  const isInitialLoading = initialLoading && initialNotes === undefined;
  const isProgressLoading = progressLoading && progressNotesResponse === undefined;
  const isActionLoading = actionLoading && activeInitialNote === undefined;
  const isDeletedLoading = deletedLoading && deletedNotes.length === 0;

  if (isInitialLoading || isProgressLoading || isActionLoading || isDeletedLoading) {
    return (
      <div className="flex flex-col gap-4 w-full flex-shrink-0 border-r border-border h-full min-h-0 bg-surface-2 p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Timeline</h2>
          </div>
        </div>

        <div className="flex flex-col gap-3 relative flex-1 min-h-0 overflow-y-auto">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="relative pl-8 pb-5 last:pb-0">
              {/* Connecting line to the next item */}
              {index < 2 && (
                <div 
                  className="absolute bg-border-strong/30 animate-pulse" 
                  style={{ left: '15px', top: '36px', bottom: '-34px', width: '2px' }} 
                />
              )}
              {/* Modern timeline dot */}
              <div 
                className="absolute w-3.5 h-3.5 rounded-full bg-surface border-2 border-border-strong/30 flex items-center justify-center z-10 animate-pulse"
                style={{ left: '9px', top: '22px' }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-border-strong/30" />
              </div>
              
              {/* Skeleton Entry Card */}
              <div className="border border-border rounded-card bg-surface overflow-hidden shadow-sm p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-2 min-w-0 flex-1">
                    {/* Note title placeholder */}
                    <Skeleton className="h-4 w-32" />
                    {/* Note meta details placeholder */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Skeleton className="h-3 w-16" />
                      <span className="text-[var(--text-muted)] text-[10px]">•</span>
                      <Skeleton className="h-3 w-12" />
                      <span className="text-[var(--text-muted)] text-[10px]">•</span>
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                  {/* Note traits/badges placeholder */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </div>
                {/* Note preview body placeholder */}
                <div className="pl-2 border-l-2 border-border-strong/30">
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handleNewNote = () => {
    triggerNewNote();
  };

  const firstProgressNoteId = mappedNotes.find(n => n.kind === 'progress')?.id;
  const hasActiveProgressNotes = mappedNotes.some(n => n.kind === 'progress' && !n.isDeleted);

  return (
    <div className="flex flex-col gap-4 w-full flex-shrink-0 border-r border-border h-full min-h-0 bg-surface-2 p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Timeline</h2>
          {expandedNotes.size > 0 && (
            <Button 
              variant="ghost" 
              size="xs" 
              className="h-5 px-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              onClick={handleCloseAll}
            >
              Close All
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mappedNotes.length > PAGE_SIZE_OPTIONS[0] && (
            <div className="relative flex items-center">
              <select
                value={limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                aria-label="Notes per page"
                className="h-8 pl-3 pr-7 rounded-full bg-surface border border-border text-[11px] font-semibold text-text-secondary outline-none cursor-pointer appearance-none hover:border-border-strong hover:text-text-primary focus:border-accent transition-all duration-150"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt} / page</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-text-muted absolute right-2.5 pointer-events-none" />
            </div>
          )}

          {activeInitialNote?.status === 'PUBLISHED' && !hasDrafts && (
            <button 
              onClick={handleNewNote}
              className="h-[24px] px-3 bg-accent hover:bg-accent-hover text-white rounded text-[10px] font-bold cursor-pointer transition-all"
            >
              + New Note
            </button>
          )}
        </div>
      </div>

      <div ref={listScrollRef} className="flex flex-col gap-3 relative flex-1 min-h-0 overflow-y-auto">
        {mappedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-surface border border-border rounded-card shadow-card mt-4 min-h-[260px]">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent mb-4 transition-transform hover:scale-110 duration-300">
              <ClipboardList className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-[14px] font-semibold text-text-primary mb-1.5">
              No consultation notes yet
            </h3>
            <p className="text-[12px] text-text-muted max-w-[260px] mb-5 leading-relaxed">
              {(user?.role === 'DOCTOR' || user?.role === 'ADMIN')
                ? "Every patient record starts with an initial note. Create one to begin tracking the patient's history."
                : "An initial consultation note must be created and published by a doctor before notes can be viewed."}
            </p>
            {(user?.role === 'DOCTOR' || user?.role === 'ADMIN') ? (
              <Button
                onClick={() => router.push(`/dashboard/${patientId}/initial-note`)}
                className="group text-[12px] h-[34px] px-4 bg-accent hover:bg-accent-hover text-white rounded-btn font-bold flex items-center gap-1.5 cursor-pointer shadow-btn-primary hover:shadow-btn-primary-hover transition-all"
              >
                Create Initial Note
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1 duration-200" />
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/${patientId}/initial-note`)}
                className="text-[12px] h-[34px] px-4 rounded-btn font-semibold cursor-pointer"
              >
                View Initial Note
              </Button>
            )}
          </div>
        ) : (
          pageNotes.map((note, localIndex) => {
            // `localIndex` positions the entry within the current page (used
            // only for the connector rail); `absoluteIndex` is its position in
            // the full history, which is what the diff baseline must search
            // from — otherwise the "Inherited by today's note" chain would
            // break at every page boundary.
            const absoluteIndex = pageStart + localIndex;
            // Diff baseline: chronologically diff against the next note older in sorted order that is authored by a DOCTOR.
            // Decided per fix.md §6.3, and updated to skip NURSE/PHARMACIST notes which lack clinical snapshots.
            // Strict linear guard: deleted notes (soft-deleted or hard-deleted-but-tracked via
            // DeletedNote) must never be picked as a diff baseline. They can still appear in
            // `mappedNotes` (struck-through, for audit visibility) sitting chronologically between
            // two live notes, but their snapshot is a ghost of a reverted state — diffing against
            // it fragments the "Inherited by today's note" chain instead of the linear live history.
            const previousNote = note.kind === 'initial'
              ? null
              : (mappedNotes.slice(absoluteIndex + 1).find(n => !n.isDeleted && n.status !== 'DRAFT' && n.authorRole !== 'NURSE' && n.authorRole !== 'PHARMACIST') || (inheritedSourceId ? mappedNotes.find(n => n.id === inheritedSourceId && n.id !== note.id && !n.isDeleted && n.status !== 'DRAFT') : null) || null);
            const isOpenNote = expandedNotes.has(note.id);

            return (
              <div key={note.id} className="relative pl-8 pb-5 last:pb-0">
                {/* Connecting line to the next item on THIS page — the last
                    entry of a page terminates the rail at its own dot instead
                    of trailing into the pagination bar. */}
                {localIndex < pageNotes.length - 1 && (
                  <div 
                    className="absolute bg-border-strong/50" 
                    style={{ left: '15px', top: '36px', bottom: '-34px', width: '2px' }} 
                  />
                )}
                {/* Modern timeline dot */}
                {(() => {
                  const isInitial = note.kind === 'initial';
                  const isDraft = note.status === 'DRAFT';
                  
                  let borderClass = "";
                  let shadowClass = "";
                  let bgClass = "";

                  if (isDraft) {
                    borderClass = "border-[var(--amber-border)]";
                    shadowClass = isOpenNote ? "shadow-[0_0_0_5px_rgba(245,158,11,0.2)] scale-110" : "shadow-[0_0_0_3px_rgba(245,158,11,0.08)]";
                    bgClass = "bg-[var(--amber-border)]";
                  } else if (isInitial) {
                    borderClass = "border-[var(--purple-border)]";
                    shadowClass = isOpenNote ? "shadow-[0_0_0_5px_rgba(139,92,246,0.2)] scale-110" : "shadow-[0_0_0_3px_rgba(139,92,246,0.08)]";
                    bgClass = "bg-[var(--purple-border)]";
                  } else {
                    borderClass = "border-accent";
                    shadowClass = isOpenNote ? "shadow-[0_0_0_5px_rgba(10,110,95,0.2)] scale-110" : "shadow-[0_0_0_3px_rgba(10,110,95,0.08)]";
                    bgClass = "bg-accent";
                  }

                  return (
                    <div 
                      className={cn(
                        "absolute w-3.5 h-3.5 rounded-full bg-surface border-2 flex items-center justify-center z-10 transition-all duration-200",
                        borderClass,
                        shadowClass,
                        note.isDeleted && "opacity-40"
                      )}
                      style={{ left: '9px', top: '22px' }}
                    >
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-200",
                        isOpenNote ? "scale-125" : "",
                        bgClass
                      )} />
                    </div>
                  );
                })()}
                <TimelineEntry 
                  note={note}
                  previousNote={previousNote}
                  isOpen={isOpenNote}
                  onToggle={() => handleToggleNote(note.id)}
                  onClickEdit={
                    // The synthetic pending entry has no DB row to open —
                    // it's already the note the editor has open.
                    note.id === '__pending__' ? () => {} : () => {
                    // Branches on the mapped view model instead of indexing
                    // back into the raw array by position — that indexing
                    // only worked because the old sort mutated the array in
                    // place, tying correctness to sort order never changing
                    // between render and click.
                    if (note.kind === 'initial') {
                      router.push(`/dashboard/${patientId}/initial-note`);
                    } else {
                      openExistingProgressNote(patientId, note.id);
                    }
                  }}
                  onDelete={
                    note.id === '__pending__'
                      ? undefined
                    : !note.isDeleted && note.authorId === user?.id && note.kind === 'initial' && !hasActiveProgressNotes
                      ? () => setDeleteNoteId(note.id)
                      : !note.isDeleted && note.authorId === user?.id && note.kind === 'progress'
                        ? () => setDeleteDraftNoteId(note.id)
                        : undefined
                  }
                  isInheritedSource={note.id === inheritedSourceId}
                />
              </div>
            );
          })
        )}
      </div>

      {/* -mt-2 trims the parent's gap-4 so the divider reads as the panel's
          footer rather than a floating line. The bar brings its own py-2. */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 -mt-2 border-t border-border">
          <PaginationBar page={safePage} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}

      <DeleteConfirmModal
        open={!!deleteNoteId}
        onClose={() => setDeleteNoteId(null)}
        onConfirm={() => {
          if (deleteNoteId) {
            deleteMutation.mutate(deleteNoteId, {
              onSuccess: () => {
                useUiStore.getState().closeNoteEditor();
                useUiStore.getState().setDocumentationPanelOpen(false);
                useUiStore.getState().releaseProblemEditLock('note');
                useUiStore.getState().releaseMedicationEditLock('note');
                setDeleteNoteId(null);
              },
            });
          }
        }}
        isDeleting={deleteMutation.isPending}
        title="Delete Initial Note"
        message="Are you sure you want to delete this Initial Note? This action cannot be undone."
      />



      <DeleteConfirmModal
        open={!!deleteDraftNoteId}
        onClose={() => setDeleteDraftNoteId(null)}
        onConfirm={() => {
          if (deleteDraftNoteId) {
            deleteProgressNoteMutation.mutate(deleteDraftNoteId, {
              onSuccess: () => {
                useUiStore.getState().closeNoteEditor();
                useUiStore.getState().setDocumentationPanelOpen(false);
                useUiStore.getState().releaseProblemEditLock('note');
                useUiStore.getState().releaseMedicationEditLock('note');
                setDeleteDraftNoteId(null);
              },
            });
          }
        }}
        isDeleting={deleteProgressNoteMutation.isPending}
        title={mappedNotes.find(n => n.id === deleteDraftNoteId)?.status === 'DRAFT' ? "Undraft Progress Note" : "Delete Progress Note"}
        message={mappedNotes.find(n => n.id === deleteDraftNoteId)?.status === 'DRAFT' ? "Are you sure you want to undraft this progress note? This action cannot be undone." : "Are you sure you want to delete this progress note? This action cannot be undone."}
      />
    </div>
  );
}
