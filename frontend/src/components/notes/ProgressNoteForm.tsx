import { useEffect, useState, useRef, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getCreatorName, buildAssessmentFlatOrder } from '@/lib/problem-utils';
import type { NoteAssessmentItem } from '@/lib/problem-utils';
import { flattenActiveProblemTree, mergeActiveProblems, mergeActiveMedications, problemTombstoneTokens } from '@/lib/note-snapshot-merge';
import { compareDoses } from '@/lib/notes-utils';
import { progressDraftKey } from '@/lib/note-drafts';
import { 
  progressNoteDraftSchema, 
  progressNotePublishSchema, 
  ProgressNoteDraftValues 
} from '@/lib/validation/progress-note-schema';
import { 
  useProgressNote, 
  useCreateProgressNote, 
  useCreateAndPublishProgressNote,
  useUpdateProgressNote, 
  usePublishProgressNote,
  useCopyForwardData,
  useDeleteProgressNote
} from '@/hooks/useProgressNotes';
import { usePatient } from '@/hooks/usePatients';
import { useLatestVitals } from '@/hooks/useVitals';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useUploadAttachment } from '@/hooks/useAttachments';
import { useMedications } from '@/hooks/useMedications';
import { buildMedicationSuggestions } from '@/lib/medication-utils';
import { VitalsSummaryRow } from './VitalsSummaryRow';
import { TagInputField } from './TagInputField';
import { NoteFormSkeleton } from './NoteFormSkeleton';
import { MedicationSnapshotModal } from './MedicationSnapshotModal';
import { NoteProblemListEditor } from './NoteProblemListEditor';
import { NoteMedicationEditor } from './NoteMedicationEditor';
import { AttachmentsSection } from '../attachments/AttachmentsSection';
import { Trash2, FileText, RotateCcw, Check, Save, PanelRightClose, X, Loader2 } from 'lucide-react';
import { formatBloodPressure, formatTemperature } from '@/lib/vitals-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useDraftSnapshotStore } from '@/stores/draftSnapshotStore';
import { useNoteOverridesStore, medNoteOverrideKey, problemNoteOverrideKey, clearNoteOverrides } from '@/stores/noteOverridesStore';
import { useProblemEditLock } from '@/hooks/useProblemEditLock';
import { useMedicationEditLock } from '@/hooks/useMedicationEditLock';

import { useQueryClient } from '@tanstack/react-query';
import { formatErrorMessage } from '@/lib/error-utils';

interface ProgressNoteFormProps {
  patientId: string;
  noteId?: string; // If null/undefined, we are creating a new one
  onClose: () => void;
}

function PatientContextBlock({ patientId, copyForward }: { patientId: string; copyForward: any }) {
  const { data: patient } = usePatient(patientId);
  const { data: vitals } = useLatestVitals(patientId);

  const activeProblemsStr = copyForward?.activeProblems?.length > 0 
    ? copyForward.activeProblems.map((p: any) => p.title).join(', ') 
    : 'None';
  const currentMedsStr = copyForward?.activeMedications?.length > 0
    ? copyForward.activeMedications.map((m: any) => m.name).join(', ')
    : 'None';
  const vitalsStr = vitals 
    ? `BP ${formatBloodPressure(vitals.sbp, vitals.dbp)}, HR ${vitals.heartRate ?? '-'}, Temp ${formatTemperature(Number(vitals.temperature))}` 
    : 'None';

  return (
    <details className="border border-border rounded-lg overflow-hidden bg-surface mb-3" open>
      <summary className="flex items-center gap-2 px-2.5 py-[7px] bg-[rgba(10,110,95,0.1)] border-b border-accent-mid text-accent-hover font-bold text-[10px] uppercase tracking-[0.5px] cursor-pointer select-none">
        ▼ PATIENT CONTEXT
      </summary>
      <div className="bg-surface py-2 px-3 flex flex-col gap-2">
        <div className="flex items-center gap-[7px] px-2.5 py-1 border-b border-border last:border-b-0 text-[11px]">
          <span className="text-text-secondary font-semibold shrink-0">Active Problems:</span>
          <span className="font-mono text-[10px] text-text-primary">{activeProblemsStr}</span>
        </div>
        <div className="flex items-center gap-[7px] px-2.5 py-1 border-b border-border last:border-b-0 text-[11px]">
          <span className="text-text-secondary font-semibold shrink-0">Current Medications:</span>
          <span className="font-mono text-[10px] text-text-primary">{currentMedsStr}</span>
        </div>
        <div className="flex items-center gap-[7px] px-2.5 py-1 border-b border-border last:border-b-0 text-[11px]">
          <span className="text-text-secondary font-semibold shrink-0">Latest Vitals:</span>
          <span className="font-mono text-[10px] text-text-primary">{vitalsStr}</span>
        </div>
        <div className="flex items-center gap-[7px] px-2.5 py-1 border-b border-border last:border-b-0 text-[11px]">
          <span className="text-red font-semibold shrink-0">Allergies:</span>
          <span className="font-mono text-[10px] text-red font-bold">N/A</span>
        </div>
      </div>
    </details>
  );
}

export function ProgressNoteForm({ patientId, noteId, onClose }: ProgressNoteFormProps) {
  const queryClient = useQueryClient();
  const { data: note, isLoading: noteLoading, isFetching: noteFetching } = useProgressNote(noteId || null);
  // Exclude the note currently being edited from its own carry-forward
  // source — otherwise an open draft can resolve to itself and "inherit"
  // its own (possibly still-blank) fields, skipping the real previous note.
  const { data: copyForward, isLoading: copyLoading, isFetching: copyFetching, refetch: refetchCopyForward } = useCopyForwardData(patientId, noteId ?? null);

  const hasLocalDraft = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(progressDraftKey(patientId, noteId));
  }, [patientId, noteId]);

  const isInitialLoading = noteId
    ? (noteLoading && !note)
    : (copyLoading && !copyForward && !hasLocalDraft);

  const isSyncing = (noteId ? (noteFetching && !!note) : (copyFetching && !!copyForward)) || (copyFetching && !copyLoading && !isInitialLoading);
  const createMutation = useCreateProgressNote(patientId);
  const createAndPublishMutation = useCreateAndPublishProgressNote(patientId);
  const updateMutation = useUpdateProgressNote(patientId);
  const publishMutation = usePublishProgressNote(patientId);
  const deleteMutation = useDeleteProgressNote(patientId);
  const { openExistingProgressNote, setActiveScreen, setDocumentationPanelOpen, registerPublishHandler } = useUiStore();
  const { user } = useAuthStore();
  const isNonDoctor = user?.role === 'NURSE' || user?.role === 'PHARMACIST';

  const [publishError, setPublishError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [localAttachments, setLocalAttachments] = useState<{ tag: string, textResult: string, file: File | null }[]>([]);
  const uploadAttachment = useUploadAttachment();

  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedFormulation, setNewMedFormulation] = useState('');
  const [newMedInstructions, setNewMedInstructions] = useState('');
  const [newMedQuantity, setNewMedQuantity] = useState('');
  const [medError, setMedError] = useState('');
  const [editMedIndex, setEditMedIndex] = useState<number | null>(null);

  const [newProbTitle, setNewProbTitle] = useState('');

  // Mutual-exclusion lock vs. the Master Problem List — see
  // useProblemEditLock. While the master list holds it, this section stays
  // read-only; entering edit mode here locks the master list instead.
  const {
    isLockedByOther: problemListLockedByOther,
    lockOwner: problemListLockOwner,
    tryAcquire: tryAcquireProblemLock,
    release: releaseProblemLock,
  } = useProblemEditLock(patientId, 'note', { noteId, hasOpenDbDraft: !!noteId });
  const [isProblemEditMode, setIsProblemEditMode] = useState(false);

  // A persisted lock already held by this note (e.g. restored after reload,
  // or the panel was closed mid-edit without Reverting/Saving) should put
  // the section straight back into edit mode instead of showing it as idle.
  useEffect(() => {
    if (problemListLockOwner === 'note' && !isProblemEditMode) {
      setIsProblemEditMode(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemListLockOwner]);

  // Mutual-exclusion lock vs. the Master Medications List — mirrors the
  // Problem List lock above exactly, see useMedicationEditLock.
  const {
    isLockedByOther: medicationListLockedByOther,
    lockOwner: medicationListLockOwner,
    tryAcquire: tryAcquireMedicationLock,
    release: releaseMedicationLock,
  } = useMedicationEditLock(patientId, 'note', { noteId, hasOpenDbDraft: !!noteId });
  const [isMedicationEditMode, setIsMedicationEditMode] = useState(false);

  // Names (lowercased) the clinician explicitly discontinued from this note's
  // medication list via the trash icon. A discontinued medication stays
  // ACTIVE on the master Medication row until this note is actually
  // published (see MedicationsService#upsertFromNoteMedications) — so a
  // Save Draft in between triggers a `note`/`copyForward` refetch, and
  // mergeActiveMedications' "add missing active meds back" step would
  // otherwise silently resurrect the removal, since the med still reads as
  // active in the master list. Consulted there to keep a deliberate removal
  // removed until Revert or a fresh note load clears it.
  const removedMedNamesRef = useRef<Set<string>>(new Set());
  // Tokens (see problemTombstoneTokens) for problems the clinician deleted
  // from this note's in-note Problem List — same rationale as
  // removedMedNamesRef, mirrored for problems.
  const removedProblemKeysRef = useRef<Set<string>>(new Set());
  // Durable keys for this note's in-note removal tombstones — see
  // noteOverridesStore.ts. The refs stay the synchronous read the merge
  // call sites below already use; the store is what makes the sets survive
  // an unmount/reload instead of resetting on every noteId change (that
  // reset was the root cause of removals reappearing once the editor
  // closed). `noteId ?? 'new'` means an unsaved note's tombstones live
  // under a `:new` key until §migrateOverrideKeys below moves them once a
  // real note id exists — losing that migration is how a discontinuation/
  // deletion resurrected right after the first Save Draft.
  const medOverrideKey = medNoteOverrideKey(patientId, noteId);
  const problemOverrideKey = problemNoteOverrideKey(patientId, noteId);

  // Self-heals the `'new'` → real-noteId transition: whenever noteId flips
  // from this patient's unsaved key to a real id (whether via
  // executeDraftToggle's own create success below, or any other path that
  // changes `noteId`, e.g. DocumentationPanel resolving an existing DB
  // draft), migrate rather than drop the tombstones recorded so far.
  const prevOverrideNoteIdRef = useRef<string | null | undefined>(noteId);
  useEffect(() => {
    const store = useNoteOverridesStore.getState();
    const prevNoteId = prevOverrideNoteIdRef.current;
    if (noteId && !prevNoteId) {
      store.migrateKey(medNoteOverrideKey(patientId, null), medOverrideKey);
      store.migrateKey(problemNoteOverrideKey(patientId, null), problemOverrideKey);
    }
    prevOverrideNoteIdRef.current = noteId;
    removedMedNamesRef.current = new Set(store.byKey[medOverrideKey] || []);
    removedProblemKeysRef.current = new Set(store.byKey[problemOverrideKey] || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medOverrideKey, problemOverrideKey, noteId, patientId]);

  useEffect(() => {
    if (medicationListLockOwner === 'note' && !isMedicationEditMode) {
      setIsMedicationEditMode(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicationListLockOwner]);

  const [diagnosticsInput, setDiagnosticsInput] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<{ hasFile: boolean; tag: string; textResult: string; fileName?: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const { data: patientMedicationsResponse } = useMedications(patientId);
  const patientMedications = patientMedicationsResponse?.data || [];
  const nameOptions = buildMedicationSuggestions(patientMedications);

  // Refetch patient active problems, medications, vitals every time sidebar opens or patient changes
  useEffect(() => {
    if (patientId) {
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['latest-vitals', patientId] });
      refetchCopyForward();
    }
  }, [patientId, queryClient, refetchCopyForward]);

  const form = useForm<ProgressNoteDraftValues>({
    resolver: zodResolver(progressNoteDraftSchema),
    defaultValues: {
      subjective: '',
      objective: '',
      labs: '',
      mgmtNonpharm: '',
      mgmtPharm: '',
      diagnostics: [],
      problemListSnapshot: [],
      medicationSnapshot: [],
      visitDatetime: new Date().toISOString(),
    },
  });

  const handleMedicationSnapshotChange = (next: any[]) => {
    const prev = form.getValues('medicationSnapshot') || [];
    const nextNames = new Set(
      (next || [])
        .map((m: any) => (typeof m === 'string' ? m : m?.name)?.trim().toLowerCase())
        .filter(Boolean),
    );
    const newlyRemoved: string[] = [];
    for (const m of prev) {
      if (!m) continue;
      const isNewItem = typeof m === 'object' && m.isNew;
      if (isNewItem) continue; // never persisted to the master list — nothing to "resurrect"
      const name = (typeof m === 'string' ? m : m.name)?.trim().toLowerCase();
      if (name && !nextNames.has(name)) {
        removedMedNamesRef.current.add(name);
        newlyRemoved.push(name);
      }
    }
    // A name back in `next` (e.g. re-added via the sub-form) is no longer a
    // pending discontinuation.
    const noLongerRemoved: string[] = [];
    for (const name of nextNames) {
      if (removedMedNamesRef.current.delete(name)) {
        noLongerRemoved.push(name);
      }
    }
    // Mirror onto the durable store so the removal (or its reversal)
    // survives an unmount/reload and is visible to NoteTimeline.
    if (newlyRemoved.length > 0) {
      useNoteOverridesStore.getState().addRemoved(medOverrideKey, newlyRemoved);
    }
    if (noLongerRemoved.length > 0) {
      useNoteOverridesStore.getState().removeRemoved(medOverrideKey, noLongerRemoved);
    }
    form.setValue('medicationSnapshot', next, { shouldDirty: true, shouldTouch: true });
  };

  // Mirrors handleMedicationSnapshotChange for the Problem List: diffs old
  // vs next by tombstone token (id-first, title fallback — see
  // problemTombstoneTokens), records/clears durable removal tombstones so a
  // problem deleted in-note stays deleted even though it's still ACTIVE on
  // the master list, and writes the new array to form state. `isNew`
  // entries are never tombstoned (no master row to delete).
  const handleProblemSnapshotChange = (next: any[]) => {
    const prev = form.getValues('problemListSnapshot') || [];
    const nextTokens = new Set((next || []).flatMap((p: any) => problemTombstoneTokens(p)));
    const newlyRemoved: string[] = [];
    for (const p of prev) {
      if (!p || typeof p !== 'object' || p.isNew) continue;
      const tokens = problemTombstoneTokens(p);
      if (tokens.length > 0 && !tokens.some((t) => nextTokens.has(t))) {
        tokens.forEach((t) => removedProblemKeysRef.current.add(t));
        newlyRemoved.push(...tokens);
      }
    }
    const noLongerRemoved: string[] = [];
    for (const token of nextTokens) {
      if (removedProblemKeysRef.current.delete(token)) {
        noLongerRemoved.push(token);
      }
    }
    if (newlyRemoved.length > 0) {
      useNoteOverridesStore.getState().addRemoved(problemOverrideKey, newlyRemoved);
    }
    if (noLongerRemoved.length > 0) {
      useNoteOverridesStore.getState().removeRemoved(problemOverrideKey, noLongerRemoved);
    }
    form.setValue('problemListSnapshot', next, { shouldDirty: true, shouldTouch: true });
  };

  const activeProblemTree = useMemo(() => {
    return flattenActiveProblemTree(copyForward?.activeProblems || []);
  }, [copyForward?.activeProblems]);

  // Baseline dose per medication name, taken from the patient's current active
  // medications (unaffected by this draft's edits — meds only get upserted on
  // publish). Used to flag dose increases/decreases made within this note.
  const originalDoseByMedName = useMemo(() => {
    const map = new Map<string, string>();
    (copyForward?.activeMedications || []).forEach((m: any) => {
      if (m?.name) map.set(String(m.name).trim().toLowerCase(), String(m.dose ?? '').trim());
    });
    return map;
  }, [copyForward?.activeMedications]);

  const originalSigByMedName = useMemo(() => {
    const map = new Map<string, string>();
    (copyForward?.activeMedications || []).forEach((m: any) => {
      if (m?.name) map.set(String(m.name).trim().toLowerCase(), String(m.instructions ?? '').trim());
    });
    return map;
  }, [copyForward?.activeMedications]);

  // A medication added within this note via the "Add Medication" sub-form
  // carries `isNew: true` and exists only in local form state until it's
  // persisted (Save Draft, Update Draft, or Publish). If a `note`/
  // `copyForward` refetch reruns the hydration effect in that window, the
  // recomputed snapshot is built from the server + master list — sources
  // that don't have this medication yet — and it would otherwise vanish.
  // Union any such medication still present in current form state back into
  // `base`, deduped by name so it isn't doubled once it does land server-side.
  const reuniteLocallyAddedMeds = (base: any[]) => {
    const localOnlyNew = (form.getValues('medicationSnapshot') || []).filter(
      (m: any) => m && typeof m === 'object' && m.isNew && m.name,
    );
    if (localOnlyNew.length === 0) return base;
    const seen = new Set(
      base.map((m: any) => (typeof m === 'string' ? m : m.name)?.trim().toLowerCase()).filter(Boolean),
    );
    const additions = localOnlyNew.filter(
      (m: any) => !seen.has(String(m.name).trim().toLowerCase()),
    );
    return additions.length > 0 ? [...base, ...additions] : base;
  };

  // Tracks the free-text fields' resolution across hydration re-runs so a
  // `copyForward`/`problems`/`medications` invalidation — which changes
  // this note's identity not at all — never wipes in-progress typing. Keyed
  // by `noteId ?? '__new__'` so the very first hydration for any given note
  // (including a brand-new one) always counts as an identity change and
  // takes the server value, matching prior behavior for reload/switch/open.
  const hydratedNoteKeyRef = useRef<string | null>(null);
  const hydratedServerTextRef = useRef<Record<string, string>>({});
  const FREE_TEXT_FIELDS = ['subjective', 'objective', 'labs', 'mgmtNonpharm', 'mgmtPharm'] as const;

  useEffect(() => {
    const activeProblems = copyForward?.activeProblems || [];
    const activeMeds = copyForward?.activeMedications || [];

    if (noteId && note) {
      const isPublished = note.status === 'PUBLISHED';
      const noteKey = noteId ?? '__new__';
      const identityChanged = hydratedNoteKeyRef.current !== noteKey;
      // Per free-text field: server wins on identity change or publish
      // (legitimate — reload, note switch, published view); server also
      // wins if it changed since the last hydration AND the field isn't
      // currently dirty (a genuine out-of-band update landing untouched);
      // otherwise keep whatever's in form state right now, so an
      // invalidation that doesn't actually change this note's own text
      // never clobbers what the clinician is typing.
      const resolveText = (field: string, serverValue: string): string => {
        if (isPublished || identityChanged) return serverValue;
        const lastServerValue = hydratedServerTextRef.current[field];
        const isDirty = (form.formState.dirtyFields as any)[field];
        if (lastServerValue !== undefined && serverValue !== lastServerValue && !isDirty) {
          return serverValue;
        }
        return form.getValues(field as any) ?? serverValue;
      };
      const draftProblems = note.problemListSnapshot as any[] | null | undefined;
      const hasProblemSnapshot = Array.isArray(draftProblems);
      const validProblems = (draftProblems || []).filter((p: any) => p && (typeof p === 'string' ? p.trim() : p.title)).map((p: any) => typeof p === 'string' ? { title: p } : p);

      const draftMeds = note.medicationSnapshot as any[] | null | undefined;
      const hasMedSnapshot = Array.isArray(draftMeds);
      const validMeds = (draftMeds || []).filter((m: any) => m && (typeof m === 'string' ? m.trim() : m.name)).map((m: any) => typeof m === 'string' ? { name: m, dose: '' } : m);

      // While this section is in its own draft-edit mode, the mutual lock
      // guarantees the Master Problem List can't be changing — keep
      // whatever's currently in form state rather than re-merging from
      // master, so a `note` refetch mid-edit never clobbers in-progress
      // title/nesting/date edits.
      const currentProblemsWhileEditing = isProblemEditMode ? form.getValues('problemListSnapshot') : undefined;
      const finalProblems = isPublished
        ? validProblems
        : currentProblemsWhileEditing && currentProblemsWhileEditing.length > 0
          ? currentProblemsWhileEditing
          : hasProblemSnapshot
            ? mergeActiveProblems(validProblems, activeProblems, removedProblemKeysRef.current)
            : activeProblemTree.map(({ problem: p, depth }) => ({
                id: p.id || undefined,
                title: p.title,
                parentId: p.parentId || undefined,
                depth,
                diagnosisDate: p.diagnosisDate || null,
              }));

      const currentMedicationsWhileEditing = isMedicationEditMode ? form.getValues('medicationSnapshot') : undefined;
      const baseMeds = isPublished
        ? validMeds
        : currentMedicationsWhileEditing && currentMedicationsWhileEditing.length > 0
          ? currentMedicationsWhileEditing
          : hasMedSnapshot
            ? mergeActiveMedications(validMeds, activeMeds, removedMedNamesRef.current)
            : copyForward?.inheritedMedications && copyForward.inheritedMedications.length > 0
              ? mergeActiveMedications(copyForward.inheritedMedications, activeMeds, removedMedNamesRef.current, false)
              : activeMeds.map((m: any) => ({
                  name: m.name,
                  dose: m.dose || undefined,
                  formulation: m.formulation || undefined,
                  quantity: m.quantity || undefined,
                  instructions: m.instructions || undefined,
                  fromPast: m.fromPast || false,
                }));
      // A med added in-note but not yet persisted to the server lives only
      // in current form state (neither the server snapshot nor the master
      // list carries it yet). A refetch of `note`/`copyForward` between
      // adding it and it actually landing in the DB would otherwise
      // recompute `baseMeds` from stale sources and silently drop it — union
      // it back in here, sourced from live form state so a deliberate
      // deletion isn't resurrected.
      const finalMeds = isPublished ? baseMeds : reuniteLocallyAddedMeds(baseMeds);

      const finalDiagnostics = note.diagnostics || [];
      // Inherit from the previous note only on this note's very first
      // hydration and only while the field is genuinely null/unset — once
      // it's been persisted as an empty string, that's a deliberate empty
      // and must never be re-substituted (previously `!note.mgmtPharm`
      // matched both cases, so a cleared field could never stay cleared).
      const serverMgmtPharm = note.mgmtPharm ?? (identityChanged && !isPublished ? copyForward?.inheritedMgmtPharm || '' : '');
      const serverMgmtNonpharm = note.mgmtNonpharm ?? (identityChanged && !isPublished ? copyForward?.inheritedMgmtNonpharm || '' : '');

      const serverText: Record<string, string> = {
        subjective: note.subjective || '',
        objective: note.objective || '',
        labs: (note as any).labs || '',
        mgmtNonpharm: serverMgmtNonpharm,
        mgmtPharm: serverMgmtPharm,
      };
      const resolvedText: Record<string, string> = {};
      for (const field of FREE_TEXT_FIELDS) {
        resolvedText[field] = resolveText(field, serverText[field]);
      }
      hydratedNoteKeyRef.current = noteKey;
      hydratedServerTextRef.current = serverText;

      form.reset({
        subjective: resolvedText.subjective,
        objective: resolvedText.objective,
        labs: resolvedText.labs,
        mgmtNonpharm: resolvedText.mgmtNonpharm,
        mgmtPharm: resolvedText.mgmtPharm,
        diagnostics: finalDiagnostics,
        problemListSnapshot: finalProblems,
        medicationSnapshot: finalMeds,
        visitDatetime: note.visit?.visitDatetime || note.createdAt,
      });
    } else if (!noteId && !copyLoading) {
      // Ensure the eventual transition to a real noteId (first Save Draft)
      // is seen as an identity change by `resolveText` above, so the newly
      // created note's own server text is trusted on that first hydration
      // rather than being compared against this branch's local-only state.
      hydratedNoteKeyRef.current = '__new__';
      const draft = localStorage.getItem(progressDraftKey(patientId, noteId));
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          const draftProblems = parsed.problemListSnapshot as any[] | null | undefined;
          const hasProblemSnapshot = Array.isArray(draftProblems);
          const validProblems = (draftProblems || []).filter((p: any) => p && (typeof p === 'string' ? p.trim() : p.title)).map((p: any) => typeof p === 'string' ? { title: p } : p);

          const currentProblemsWhileEditing = isProblemEditMode ? form.getValues('problemListSnapshot') : undefined;
          parsed.problemListSnapshot = currentProblemsWhileEditing && currentProblemsWhileEditing.length > 0
            ? currentProblemsWhileEditing
            : hasProblemSnapshot
              ? mergeActiveProblems(validProblems, activeProblems, removedProblemKeysRef.current)
              : activeProblemTree.map(({ problem: p, depth }) => ({
                  id: p.id || undefined,
                  title: p.title,
                  parentId: p.parentId || undefined,
                  depth,
                  diagnosisDate: p.diagnosisDate || null,
                }));

          const draftMeds = parsed.medicationSnapshot as any[] | null | undefined;
          const hasMedSnapshot = Array.isArray(draftMeds);
          const validMeds = (draftMeds || []).filter((m: any) => m && (typeof m === 'string' ? m.trim() : m.name)).map((m: any) => typeof m === 'string' ? { name: m, dose: '' } : m);
          const currentMedicationsWhileEditing = isMedicationEditMode ? form.getValues('medicationSnapshot') : undefined;
          const baseDraftMeds = currentMedicationsWhileEditing && currentMedicationsWhileEditing.length > 0
            ? currentMedicationsWhileEditing
            : hasMedSnapshot
              ? mergeActiveMedications(validMeds, activeMeds, removedMedNamesRef.current)
              : copyForward?.inheritedMedications && copyForward.inheritedMedications.length > 0
                ? mergeActiveMedications(copyForward.inheritedMedications, activeMeds, removedMedNamesRef.current, false)
                : activeMeds.map((m: any) => ({
                    name: m.name,
                    dose: m.dose || undefined,
                    formulation: m.formulation || undefined,
                    quantity: m.quantity || undefined,
                    instructions: m.instructions || undefined,
                    fromPast: m.fromPast || false,
                  }));
          parsed.medicationSnapshot = isMedicationEditMode ? baseDraftMeds : reuniteLocallyAddedMeds(baseDraftMeds);
          
          if (!parsed.diagnostics) {
            parsed.diagnostics = [];
          }
          if (!parsed.mgmtPharm) {
            parsed.mgmtPharm = copyForward?.inheritedMgmtPharm || '';
          }
          if (!parsed.mgmtNonpharm) {
            parsed.mgmtNonpharm = copyForward?.inheritedMgmtNonpharm || '';
          }

          // Never trust a visitDatetime restored from a previous session —
          // it's how a stale stamp bleeds from one draft into the next and
          // silently inverts ordering. Always re-stamp to now.
          parsed.visitDatetime = new Date().toISOString();

          form.reset(parsed);
          return;
        } catch (e) {}
      }

      const initialMeds = (copyForward?.inheritedMedications && copyForward.inheritedMedications.length > 0)
        ? mergeActiveMedications(copyForward.inheritedMedications, activeMeds, removedMedNamesRef.current, false)
        : activeMeds.map((m: any) => ({
            name: m.name,
            dose: m.dose || undefined,
            formulation: m.formulation || undefined,
            quantity: m.quantity || undefined,
            instructions: m.instructions || undefined,
            fromPast: m.fromPast || false,
          }));

      form.reset({
        subjective: '',
        objective: '',
        labs: '',
        mgmtNonpharm: copyForward?.inheritedMgmtNonpharm || '',
        mgmtPharm: copyForward?.inheritedMgmtPharm || '',
        diagnostics: [],
        problemListSnapshot: activeProblemTree.map(({ problem: p, depth }) => ({
          id: p.id || undefined,
          title: p.title,
          parentId: p.parentId || undefined,
          depth,
          diagnosisDate: p.diagnosisDate || null,
        })),
        medicationSnapshot: initialMeds,
        visitDatetime: new Date().toISOString(),
      });
    }
  }, [noteId, note, copyForward, copyLoading, patientId, form, activeProblemTree]);

  const previousCopyForward = useRef<any>(null);

  useEffect(() => {
    if (!copyForward || copyLoading || note?.status === 'PUBLISHED') return;

    // Sync newly added active problems or medications into form state live
    if (previousCopyForward.current) {
      const oldProblems = JSON.stringify(previousCopyForward.current.activeProblems);
      const newProblems = JSON.stringify(copyForward.activeProblems);
      const oldMeds = JSON.stringify(previousCopyForward.current.activeMedications);
      const newMeds = JSON.stringify(copyForward.activeMedications);

      if (oldProblems !== newProblems || oldMeds !== newMeds) {
        const currentValues = form.getValues();
        // While this section is in its own draft-edit mode, the mutual lock
        // guarantees the Master Problem List can't be changing right now —
        // skip the merge so a background refetch never clobbers in-progress
        // title/nesting/date edits made in this note.
        const mergedProbs = isProblemEditMode
          ? currentValues.problemListSnapshot || []
          : mergeActiveProblems(currentValues.problemListSnapshot || [], copyForward.activeProblems, removedProblemKeysRef.current);

        const currentMeds = currentValues.medicationSnapshot || [];
        const mergedMeds = isMedicationEditMode
          ? currentMeds
          : mergeActiveMedications(currentMeds, copyForward.activeMedications, removedMedNamesRef.current);

        form.reset({
          ...currentValues,
          problemListSnapshot: mergedProbs,
          medicationSnapshot: mergedMeds,
        });
      }
    }
    previousCopyForward.current = copyForward;
  }, [copyForward, copyLoading, note, form]);

  const formValues = form.watch();

  // Publishes this draft's live Assessment/Medications form state to
  // NoteTimeline (via draftSnapshotStore) so the timeline entry for this
  // note stays 1:1 with what's shown here, including editor-local state
  // (in-note discontinuations, unsaved isNew rows) the timeline's own merge
  // can't otherwise see. Keyed the same way as noteOverridesStore
  // (`noteId ?? 'new'`) so an UNSAVED note also gets a live channel —
  // NoteTimeline synthesizes a pending timeline entry from this key before
  // the note is ever saved (see its `${patientId}:new` read). A PUBLISHED
  // note's timeline entry is the persisted content, matching the hydration
  // bail below.
  const { setDraftSnapshot, clearDraftSnapshot } = useDraftSnapshotStore.getState();
  const draftSnapshotKey = `${patientId}:${noteId ?? 'new'}`;
  useEffect(() => {
    if (note?.status === 'PUBLISHED') return;
    // A brand-new, unsaved note (no DB row yet) seeds its snapshot with
    // copy-forward defaults the instant this form mounts — writing that
    // straight to the store would make NoteTimeline's synthetic pending
    // entry (hasPendingNewNote) appear immediately, so "+ New Note" would
    // look like it created a DRAFT card before the clinician touched
    // anything. Only start publishing once the form is actually dirty —
    // an existing DB draft (noteId set) has no such concern, its Timeline
    // entry already exists independently of this snapshot.
    if (!noteId && !form.formState.isDirty) return;
    setDraftSnapshot(draftSnapshotKey, {
      problemListSnapshot: formValues.problemListSnapshot || [],
      medicationSnapshot: formValues.medicationSnapshot || [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSnapshotKey, formValues.problemListSnapshot, formValues.medicationSnapshot, note?.status, noteId, form.formState.isDirty]);

  useEffect(() => {
    if (!draftSnapshotKey) return;
    return () => clearDraftSnapshot(draftSnapshotKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSnapshotKey]);

  // Acquires the mutual edit lock (if not already held) before entering the
  // Problem List's own draft-edit mode. No-ops (staying read-only) if the
  // Master Problem List already holds it — tryAcquire surfaces the toast.
  const enterProblemEditMode = () => {
    if (isProblemEditMode) return;
    if (!tryAcquireProblemLock()) return;
    setIsProblemEditMode(true);
  };

  // Discards this session's in-note problem edits, resyncing the snapshot
  // back to the master list's current state (same shape as the fresh-note
  // seed below), then exits edit mode and releases the lock.
  const handleRevertProblemList = () => {
    form.setValue(
      'problemListSnapshot',
      activeProblemTree.map(({ problem: p, depth }) => ({
        id: p.id || undefined,
        title: p.title,
        parentId: p.parentId || undefined,
        depth,
        diagnosisDate: p.diagnosisDate || null,
      })),
      { shouldDirty: true },
    );
    removedProblemKeysRef.current.clear();
    useNoteOverridesStore.getState().clearRemoved(problemOverrideKey);
    setIsProblemEditMode(false);
    releaseProblemLock();
  };

  // Persists this session's in-note edits — useAutoSave only writes to
  // localStorage on a 5s debounce, so without an explicit flush here a
  // refetch of `note`/`copyForward` between now and the next autosave tick
  // (or the note's own Draft/Update Draft action) can re-hydrate the form
  // from the stale server snapshot and silently drop what was just added.
  // Then exits edit mode, releasing the lock so the Master Problem List
  // unlocks.
  const handleSaveDraftProblemList = () => {
    persistDraftSnapshot(() => {
      setIsProblemEditMode(false);
      releaseProblemLock();
    });
  };

  // Mirrors enterProblemEditMode/handleRevertProblemList/
  // handleSaveDraftProblemList exactly, for the Medications section.
  const enterMedicationEditMode = () => {
    if (isMedicationEditMode) return;
    if (!tryAcquireMedicationLock()) return;
    setIsMedicationEditMode(true);
  };

  const handleRevertMedications = () => {
    const activeMeds = copyForward?.activeMedications || [];
    const initialMeds = (copyForward?.inheritedMedications && copyForward.inheritedMedications.length > 0)
      ? mergeActiveMedications(copyForward.inheritedMedications, activeMeds, undefined, false)
      : activeMeds.map((m: any) => ({
          name: m.name,
          dose: m.dose || undefined,
          formulation: m.formulation || undefined,
          quantity: m.quantity || undefined,
          instructions: m.instructions || undefined,
          fromPast: m.fromPast || false,
        }));
    form.setValue(
      'medicationSnapshot',
      initialMeds,
      { shouldDirty: true },
    );
    removedMedNamesRef.current.clear();
    useNoteOverridesStore.getState().clearRemoved(medOverrideKey);
    setIsMedicationEditMode(false);
    releaseMedicationLock();
  };

  const handleSaveDraftMedications = () => {
    persistDraftSnapshot(() => {
      setIsMedicationEditMode(false);
      releaseMedicationLock();
    });
  };

  const scrollToError = (fieldName?: string) => {
    if (!fieldName) return;
    setTimeout(() => {
      const element =
        document.getElementsByName(fieldName)[0] ||
        document.getElementById(`field-${fieldName}`) ||
        document.getElementById(fieldName) ||
        document.getElementById(`${fieldName}-section`);

      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (element as HTMLElement).focus?.();
      }
    }, 50);
  };

  const validateForPublish = (): { isValid: boolean; firstErrorField?: string; errorMessage?: string } => {
    if (isProblemEditMode) {
      return {
        isValid: false,
        firstErrorField: 'problem-list',
        errorMessage: 'Finish editing the Problem List — Save Draft or Revert — before publishing.',
      };
    }

    if (isMedicationEditMode) {
      return {
        isValid: false,
        firstErrorField: 'medications',
        errorMessage: 'Finish editing Medications — Save Draft or Revert — before publishing.',
      };
    }

    const subjectiveMissing = !formValues.subjective || !formValues.subjective.trim();
    const objectiveMissing = !isNonDoctor && (!formValues.objective || !formValues.objective.trim());

    if (subjectiveMissing && objectiveMissing) {
      return {
        isValid: false,
        firstErrorField: 'subjective',
        errorMessage: 'Please fill out Subjective and Objective fields.',
      };
    }

    if (subjectiveMissing) {
      return {
        isValid: false,
        firstErrorField: 'subjective',
        errorMessage: isNonDoctor ? 'Please fill out Note Details.' : 'Subjective is required to publish this note.',
      };
    }

    if (objectiveMissing) {
      return {
        isValid: false,
        firstErrorField: 'objective',
        errorMessage: 'Objective is required to publish this note.',
      };
    }

    const publishCheck = progressNotePublishSchema.safeParse(formValues);
    if (!publishCheck.success) {
      const firstIssue = publishCheck.error.issues[0];
      const fieldName = firstIssue?.path[0]?.toString() || 'subjective';
      return {
        isValid: false,
        firstErrorField: fieldName,
        errorMessage: firstIssue?.message || 'Please fill out all required fields.',
      };
    }

    return { isValid: true };
  };

  const publishAndSwitchRef = useRef<() => Promise<boolean>>(undefined);

  publishAndSwitchRef.current = async (): Promise<boolean> => {
    setPublishError(null);
    const validation = validateForPublish();
    if (!validation.isValid) {
      setPublishError(validation.errorMessage || (isNonDoctor ? "Please fill out Note Details." : "Please fill out Subjective and Objective fields."));
      scrollToError(validation.firstErrorField);
      return false;
    }
    
    return new Promise((resolve) => {
      if (noteId) {
        updateMutation.mutate({ id: noteId, data: cleanFormValues(formValues) }, {
          onSuccess: () => {
            publishMutation.mutate(noteId, {
              onSuccess: () => {
                localStorage.removeItem(progressDraftKey(patientId, noteId));
                clearNoteOverrides(patientId, noteId);
                releaseProblemLock();
                releaseMedicationLock();
                resolve(true);
              },
          onError: (err: any) => {
            setPublishError(formatErrorMessage(err, 'Failed to publish note'));
            resolve(false);
          }
        });
      },
      onError: (err: any) => {
        setPublishError(formatErrorMessage(err, 'Failed to update note before publishing'));
        resolve(false);
      }
    });
  } else {
    createAndPublishMutation.mutate(cleanFormValues(formValues), {
      onSuccess: () => {
        localStorage.removeItem(progressDraftKey(patientId, noteId));
        clearNoteOverrides(patientId, noteId);
        releaseProblemLock();
        releaseMedicationLock();
        resolve(true);
      },
      onError: (err: any) => {
        setPublishError(formatErrorMessage(err, 'Failed to create and publish note'));
        resolve(false);
          }
        });
      }
    });
  };

  const isPublished = note?.status === 'PUBLISHED';
  const isDraftActive = !!noteId || form.formState.isDirty || localAttachments.length > 0;

  useEffect(() => {
    if (isPublished || !isDraftActive) {
      registerPublishHandler(null);
      return;
    }

    const handler = () => {
      if (publishAndSwitchRef.current) {
        return publishAndSwitchRef.current();
      }
      return Promise.resolve(false);
    };

    registerPublishHandler(handler);
    return () => {
      registerPublishHandler(null);
    };
  }, [isPublished, isDraftActive, registerPublishHandler]);

  const getUnaddedSections = () => {
    const list: string[] = [];
    if (newProbTitle.trim() || isProblemEditMode) {
      list.push('Problem List');
    }
    if (newMedName.trim() || newMedDose.trim() || newMedFormulation.trim() || newMedInstructions.trim() || newMedQuantity.trim() || isMedicationEditMode) {
      list.push('Medications');
    }
    if (diagnosticsInput.trim()) {
      list.push('Diagnostics');
    }
    if (pendingAttachment && (pendingAttachment.hasFile || pendingAttachment.tag.trim() || pendingAttachment.textResult.trim())) {
      list.push('Labs & Imaging');
    }
    return list;
  };

  const cleanFormValues = (values: any) => {
    const rawProblems = (values.problemListSnapshot || []) as NoteAssessmentItem[];
    // DFS parent-then-children flatten via the same helper the editor uses
    // for display order, so submit order can never drift from what the
    // clinician saw (including any drag-to-reorder). Legacy bare-string
    // items pass through untouched — they carry no title/parentId to project.
    const cleanProblems = buildAssessmentFlatOrder(rawProblems).map(({ item: p, depth }) =>
      p && typeof p === 'object'
        ? {
            id: p.id,
            tempId: p.tempId,
            title: p.title,
            parentId: p.parentId || null,
            depth,
            isNew: p.isNew,
            diagnosisDate: p.diagnosisDate,
          }
        : p,
    );

    return {
      ...values,
      subjective: values.subjective ?? '',
      objective: values.objective ?? '',
      // Stamp at submit time rather than trusting the mount-time/localStorage
      // value already sitting in form state — a stale stamp is how two
      // notes end up tied or inverted in every visitDatetime-ordered query.
      // Harmless on updates: the backend discards visitDatetime there.
      visitDatetime: new Date().toISOString(),
      problemListSnapshot: cleanProblems,
      // Project explicitly to the DTO shape rather than spreading — a legacy
      // draft (saved back when UpdateProgressNoteDto had no nested
      // validation at all) can carry stray keys that would now trip
      // forbidNonWhitelisted on PATCH. Whitelisting here keeps the payload
      // deterministic and immune to junk in old snapshots.
      medicationSnapshot: values.medicationSnapshot?.map((m: any) => {
        if (typeof m === 'object' && m !== null) {
          return {
            name: m.name,
            dose: m.dose,
            formulation: m.formulation,
            quantity: m.quantity,
            instructions: m.instructions,
            isNew: m.isNew,
            fromPast: m.fromPast,
            editedFields: m.editedFields,
          };
        }
        return m;
      }),
    };
  };

  const handleGoBack = () => {
    const unadded = getUnaddedSections();
    setPendingAction(null);
    
    if (unadded.length > 0) {
      const sectionElements: { [key: string]: string } = {
        'Problem List': 'problem-list-section',
        'Medications': 'medications-section',
        'Diagnostics': 'diagnostics-section',
        'Labs & Imaging': 'labs-imaging-section'
      };

      const firstUnadded = unadded[0];
      const elId = sectionElements[firstUnadded];
      if (elId) {
        const el = document.getElementById(elId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Wait for smooth scroll to finish, then focus the input field
          setTimeout(() => {
            if (firstUnadded === 'Problem List') {
              const input = document.getElementById('newProbTitle');
              input?.focus();
            } else if (firstUnadded === 'Medications') {
              const input = el.querySelector('input');
              input?.focus();
            } else if (firstUnadded === 'Diagnostics') {
              const input = el.querySelector('input');
              input?.focus();
            } else if (firstUnadded === 'Labs & Imaging') {
              const input = el.querySelector('input');
              input?.focus();
            }
          }, 350);
        }
      }
    }
  };

  const executeDraftToggle = () => {
    if (noteId) {
      deleteMutation.mutate(noteId, {
        onSuccess: () => {
          localStorage.removeItem(progressDraftKey(patientId, noteId));
          clearNoteOverrides(patientId, noteId);
          releaseProblemLock();
          releaseMedicationLock();
          onClose();
        }
      });
    } else {
      createMutation.mutate(cleanFormValues(formValues), {
        onSuccess: async (newNote) => {
          setLastSaved(new Date());
          const newNoteId = (newNote as any)?.data?.id || (newNote as any)?.id;
          
          if (newNoteId && localAttachments.length > 0) {
            for (const att of localAttachments) {
              try {
                await uploadAttachment.mutateAsync({
                  patientId,
                  noteType: 'PROGRESS_NOTE',
                  noteId: newNoteId,
                  tag: att.tag,
                  textResult: att.textResult || undefined,
                  file: att.file || undefined
                });
              } catch (e) {
                console.error('Failed to upload attachment', e);
              }
            }
            setLocalAttachments([]);
          }

          // Every other terminal path (publish, delete, revert) already
          // clears this — without it, a stale draft's body and visitDatetime
          // leak into the very next new note opened for this patient.
          localStorage.removeItem(progressDraftKey(patientId, noteId));
          // Migrate, don't clear: this note's tombstones were recorded
          // under the `:new` key while unsaved (noteId was still null in
          // this closure) — clearing here is exactly how a discontinuation/
          // deletion resurrected right after the first Save Draft.
          if (newNoteId) {
            const store = useNoteOverridesStore.getState();
            store.migrateKey(medNoteOverrideKey(patientId, null), medNoteOverrideKey(patientId, newNoteId));
            store.migrateKey(problemNoteOverrideKey(patientId, null), problemNoteOverrideKey(patientId, newNoteId));
          } else {
            clearNoteOverrides(patientId, null);
          }
          onClose();
          setDocumentationPanelOpen(false);
          setActiveScreen('note-timeline');
        }
      });
    }
  };

  const handleDraftToggle = () => {
    if (!noteId) {
      const unadded = getUnaddedSections();
      if (unadded.length > 0) {
        setPendingAction(() => executeDraftToggle);
        return;
      }
    }
    executeDraftToggle();
  };

  // Flushes the current form state so a section's "Save Draft" action is
  // durable, not just in-memory. For an existing DB draft, PATCH it (skipped
  // if a save is already in flight — the in-flight one will carry the same
  // form state). For a brand-new note with no DB row yet, write straight to
  // localStorage rather than going through `createMutation` — creating a row
  // as a side effect of a sub-section button would flip `noteId` mid-render
  // and change what the header Draft/Undraft toggle and the medication/
  // problem edit locks (keyed off `hasOpenDbDraft: !!noteId`) mean.
  // `onSettled` fires once the edits are actually durable — either the PATCH
  // has landed (noteId case) or synchronously for the localStorage-only
  // case. Callers use it to drop their edit-mode guard: dropping the guard
  // eagerly, before the PATCH resolves, opens a window where a `note`/
  // `copyForward` refetch mid-flight re-hydrates the form from the
  // pre-save snapshot and silently reverts what was just saved (missing
  // "New" tag, reverted title edits, etc.).
  const persistDraftSnapshot = (onSettled?: () => void) => {
    if (noteId) {
      if (updateMutation.isPending) return;
      updateMutation.mutate(
        { id: noteId, data: cleanFormValues(form.getValues()) },
        {
          onSuccess: () => setLastSaved(new Date()),
          onSettled: () => onSettled?.(),
        },
      );
    } else {
      localStorage.setItem(
        progressDraftKey(patientId, noteId),
        JSON.stringify(form.getValues()),
      );
      setLastSaved(new Date());
      onSettled?.();
    }
  };

  const executeUpdateDraft = () => {
    if (!noteId) return;
    const safeNoteId = noteId;
    updateMutation.mutate({ id: safeNoteId, data: cleanFormValues(formValues) }, {
      onSuccess: async () => {
        if (localAttachments.length > 0) {
          for (const att of localAttachments) {
            try {
              await uploadAttachment.mutateAsync({
                patientId,
                noteType: 'PROGRESS_NOTE',
                noteId: safeNoteId,
                tag: att.tag,
                textResult: att.textResult || undefined,
                file: att.file || undefined
              });
            } catch (e) {
              console.error('Failed to upload attachment', e);
            }
          }
          setLocalAttachments([]);
        }
        setLastSaved(new Date());
        form.reset(formValues);
      }
    });
  };

  const handleUpdateDraft = () => {
    const unadded = getUnaddedSections();
    if (unadded.length > 0) {
      setPendingAction(() => executeUpdateDraft);
    } else {
      executeUpdateDraft();
    }
  };

  const executePublish = () => {
    if (noteId) {
      updateMutation.mutate({ id: noteId, data: cleanFormValues(formValues) }, {
        onSuccess: () => {
          publishMutation.mutate(noteId, {
            onSuccess: async () => {
              if (localAttachments.length > 0) {
                for (const att of localAttachments) {
                  try {
                    await uploadAttachment.mutateAsync({
                      patientId,
                      noteType: 'PROGRESS_NOTE',
                      noteId: noteId,
                      tag: att.tag,
                      textResult: att.textResult || undefined,
                      file: att.file || undefined
                    });
                  } catch (e) {
                    console.error('Failed to upload attachment', e);
                  }
                }
                setLocalAttachments([]);
              }
              localStorage.removeItem(progressDraftKey(patientId, noteId));
              clearNoteOverrides(patientId, noteId);
              // Defensive — validateForPublish already blocks publishing
              // while the section is mid-edit, so this is normally already
              // released, but a published note has no further use for the
              // lock either way.
              releaseProblemLock();
              releaseMedicationLock();
              onClose();
              setDocumentationPanelOpen(false);
              setActiveScreen('note-timeline');
            },
            onError: (err: any) => {
              setPublishError(formatErrorMessage(err, 'Failed to publish note'));
            }
          });
        },
        onError: (err: any) => {
          setPublishError(formatErrorMessage(err, 'Failed to update note before publishing'));
        }
      });
    } else {
      createAndPublishMutation.mutate(cleanFormValues(formValues), {
        onSuccess: async (newNote) => {
          const newNoteId = (newNote as any)?.data?.id || (newNote as any)?.id;
          if (newNoteId && localAttachments.length > 0) {
            for (const att of localAttachments) {
              try {
                await uploadAttachment.mutateAsync({
                  patientId,
                  noteType: 'PROGRESS_NOTE',
                  noteId: newNoteId,
                  tag: att.tag,
                  textResult: att.textResult || undefined,
                  file: att.file || undefined
                });
              } catch (e) {
                console.error('Failed to upload attachment', e);
              }
            }
            setLocalAttachments([]);
          }
          localStorage.removeItem(progressDraftKey(patientId, noteId));
          clearNoteOverrides(patientId, noteId);
          releaseProblemLock();
          releaseMedicationLock();
          onClose();
          setDocumentationPanelOpen(false);
          setActiveScreen('note-timeline');
        },
        onError: (err: any) => {
          setPublishError(formatErrorMessage(err, 'Failed to create and publish note'));
        }
      });
    }
  };

  const handlePublish = async () => {
    const unadded = getUnaddedSections();
    
    const proceedWithPublish = () => {
      setPublishError(null);
      const validation = validateForPublish();
      if (!validation.isValid) {
        setPublishError(validation.errorMessage || (isNonDoctor ? "Please fill out Note Details." : "Please fill out Subjective and Objective fields."));
        scrollToError(validation.firstErrorField);
        return;
      }
      executePublish();
    };

    if (unadded.length > 0) {
      setPendingAction(() => proceedWithPublish);
      return;
    }

    proceedWithPublish();
  };

  useAutoSave(formValues, (data) => {
    localStorage.setItem(progressDraftKey(patientId, noteId), JSON.stringify(data));
    setLastSaved(new Date());
  }, progressDraftKey(patientId, noteId), 5000);

  if ((noteId && noteLoading) || (!noteId && copyLoading)) {
    return (
      <div className="flex flex-col h-full bg-surface-2 p-6 animate-pulse gap-6">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center pb-4 border-b border-border">
          <div className="h-6 w-48 bg-surface-3 rounded-[4px]" />
          <div className="flex gap-2">
            <div className="h-6 w-24 bg-surface-3 rounded-[4px]" />
            <div className="h-6 w-24 bg-surface-3 rounded-[4px]" />
          </div>
        </div>

        {/* Text Areas Skeleton */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="h-4 w-32 bg-surface-3 rounded-[4px]" />
          <div className="h-32 w-full bg-surface-3 rounded-[6px]" />
        </div>
        
        <div className="flex flex-col gap-2 mt-4">
          <div className="h-4 w-32 bg-surface-3 rounded-[4px]" />
          <div className="h-32 w-full bg-surface-3 rounded-[6px]" />
        </div>

        {/* Dynamic Sections Skeleton */}
        <div className="flex flex-col gap-3 mt-6">
          <div className="h-5 w-40 bg-surface-3 rounded-[4px]" />
          <div className="h-10 w-full bg-surface-3 rounded-[6px]" />
          <div className="h-10 w-full bg-surface-3 rounded-[6px]" />
        </div>
      </div>
    );
  }

  const isSaving = updateMutation.isPending || createMutation.isPending || publishMutation.isPending || createAndPublishMutation.isPending;
  const isDisabled = isPublished || isSaving || deleteMutation.isPending;
  const isUpdateActive = !!form.formState.isDirty;

  return (
    // @container/notepanel replaces an inline <style> tag that re-injected a
    // stylesheet on every render and defined .panel-container / .title-text /
    // .btn-text / .header-btn nowhere else in the codebase. Naming the
    // container also lets VitalsSummaryRow size against this panel rather than
    // the window. The 410px threshold is deliberately unchanged, so the default
    // 420px panel still shows full labels exactly as before.
    <div className="@container/notepanel flex flex-col h-full bg-surface-2 relative">
      {/* Saving is surfaced inline via the per-button spinner and the "Autosaved"
          indicator (design-standard.md §7.3) — no full-panel blocking overlay, so the
          note stays readable and scrollable while a save round-trips. */}
      {/* Sticky header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 sticky top-0 z-10 shrink-0 bg-accent-light/40 border-b border-accent-mid/40">
        {/* min-w-0 on the title and shrink-0 on the actions: the row is
            justify-between, so without these the title block held its width and
            pushed the buttons off the right edge instead of yielding. */}
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-bold flex items-center gap-2 text-accent-hover">            <button
              onClick={() => {
                const unadded = getUnaddedSections();
                if (unadded.length > 0) {
                  setPendingAction(() => () => {
                    setDocumentationPanelOpen(false);
                    onClose();
                  });
                } else {
                  setDocumentationPanelOpen(false);
                  onClose();
                }
              }}
              className="p-1 -ml-1.5 hover:bg-accent/10 rounded-md transition-colors cursor-pointer text-text-secondary hover:text-accent-hover shrink-0"
              title="Close panel"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
            <span className="shrink-0 truncate @max-[410px]/notepanel:hidden">Progress Note</span>
            {isSyncing && (
              <span title="Syncing patient data..." className="shrink-0 flex items-center">
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Status first to give way: the Autosaved pill and the DRAFT badge
              report state, the buttons do work. */}
          {!noteId && (
            <span className="font-mono text-[10px] text-green flex items-center gap-1 shrink-0 @max-[410px]/notepanel:hidden" title={lastSaved ? `Last saved at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Autosaved'}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4" fill="var(--green-border)" />
                <path d="M3 5l1.5 1.5L7 3.5" stroke="white" strokeWidth="1.2" />
              </svg>
              {!isUpdateActive && 'Autosaved'}
            </span>
          )}
          {isPublished && (
            <Badge variant="published">
              Published
            </Badge>
          )}
          {!isPublished && noteId && (
            <Badge variant="draft">
              Draft
            </Badge>
          )}
          {!isPublished && (
            <div className="flex items-center gap-2 ml-2">
              <Button 
                onClick={handleDraftToggle} 
                disabled={isSaving || deleteMutation.isPending} 
                variant="outline" 
                size="xs"
                className="h-6 px-2.5 text-[11px] font-semibold bg-surface-2 hover:bg-surface-3 border-border text-text-secondary cursor-pointer rounded-[4px] flex items-center justify-center gap-1.5 shrink-0 @max-[410px]/notepanel:px-2 @max-[410px]/notepanel:gap-0"
                title={noteId ? 'Undraft' : 'Draft'}
              >
                {deleteMutation.isPending || (isSaving && !noteId) ? (
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5 shrink-0" />
                ) : noteId ? (
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="@max-[410px]/notepanel:hidden">{noteId ? 'Undraft' : 'Draft'}</span>
              </Button>
              {(form.formState.isDirty || localAttachments.length > 0) && !noteId && (
                <Button 
                  onClick={() => {
                    const defaultProblems = activeProblemTree.map(({ problem: p, depth }) => ({
                      id: p.id || undefined,
                      title: p.title,
                      parentId: p.parentId || undefined,
                      depth,
                      diagnosisDate: null,
                    }));
                    const defaultMeds = (copyForward?.inheritedMedications && copyForward.inheritedMedications.length > 0)
                      ? mergeActiveMedications(copyForward.inheritedMedications, copyForward?.activeMedications || [], removedMedNamesRef.current, false)
                      : (copyForward?.activeMedications || []).map((m: any) => ({
                          name: m.name,
                          dose: m.dose || undefined,
                          formulation: m.formulation || undefined,
                          quantity: m.quantity || undefined,
                          instructions: m.instructions || undefined,
                          fromPast: m.fromPast || false,
                        }));
                    
                    form.reset({
                      subjective: '',
                      objective: '',
                      labs: '',
                      mgmtNonpharm: copyForward?.inheritedMgmtNonpharm || '',
                      mgmtPharm: copyForward?.inheritedMgmtPharm || '',
                      diagnostics: [],
                      problemListSnapshot: defaultProblems,
                      medicationSnapshot: defaultMeds,
                      visitDatetime: formValues.visitDatetime || new Date().toISOString(),
                    });

                    localStorage.removeItem(progressDraftKey(patientId, noteId));
                    clearNoteOverrides(patientId, noteId);
                    removedMedNamesRef.current.clear();
                    removedProblemKeysRef.current.clear();

                    // Clear controlled inputs
                    setNewProbTitle('');
                    setDiagnosticsInput('');

                    // Clear new medication states
                    setNewMedName('');
                    setNewMedDose('');
                    setNewMedFormulation('');
                    setNewMedQuantity('');
                    setNewMedInstructions('');

                    // Clear temporary attachments
                    setLocalAttachments([]);

                    // A whole-note revert also discards any in-progress
                    // Problem List / Medications edit — exit their draft
                    // modes and release the mutual locks along with
                    // everything else.
                    if (isProblemEditMode) {
                      setIsProblemEditMode(false);
                      releaseProblemLock();
                    }
                    if (isMedicationEditMode) {
                      setIsMedicationEditMode(false);
                      releaseMedicationLock();
                    }
                  }}
                  disabled={isDisabled}
                  variant="outline"
                  size="xs"
                  className="h-6 px-2.5 text-[11px] font-semibold bg-surface-2 hover:bg-surface-3 border-border text-text-secondary cursor-pointer rounded-[4px] flex items-center justify-center gap-1.5 shrink-0 @max-[410px]/notepanel:px-2 @max-[410px]/notepanel:gap-0"
                  title="Revert"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span className="@max-[410px]/notepanel:hidden">Revert</span>
                </Button>
              )}
              {(form.formState.isDirty || localAttachments.length > 0) && noteId && (
                <Button 
                  onClick={handleUpdateDraft} 
                  disabled={updateMutation.isPending} 
                  variant="outline" 
                  size="xs"
                  className="h-6 px-2.5 text-[11px] font-semibold bg-surface-2 hover:bg-surface-3 border-border text-text-secondary cursor-pointer rounded-[4px] flex items-center justify-center gap-1.5 shrink-0 @max-[410px]/notepanel:px-2 @max-[410px]/notepanel:gap-0"
                  title="Update Draft"
                >
                  {updateMutation.isPending ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5 shrink-0" />
                  ) : (
                    <Save className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="@max-[410px]/notepanel:hidden">Update Draft</span>
                </Button>
              )}
              <Button 
                onClick={handlePublish} 
                disabled={isSaving || publishMutation.isPending || createAndPublishMutation.isPending} 
                variant="default" 
                size="xs"
                className="h-6 px-2.5 text-[11px] font-semibold bg-accent hover:bg-accent-hover text-white border-accent-hover cursor-pointer rounded-[4px] flex items-center justify-center gap-1.5 shrink-0 @max-[410px]/notepanel:px-2 @max-[410px]/notepanel:gap-0"
                title="Finalize"
              >
                {isSaving || publishMutation.isPending || createAndPublishMutation.isPending ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5 shrink-0" />
                ) : (
                  <Check className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="@max-[410px]/notepanel:hidden">Finalize</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-surface-3">
        {isInitialLoading ? (
          <NoteFormSkeleton />
        ) : (
          <>
            {publishError && (
              <div className="p-3 bg-red-bg border border-red-border rounded-lg text-red text-[12px] font-medium">
                {publishError}
              </div>
            )}

        <PatientContextBlock patientId={patientId} copyForward={copyForward} />

        <div id="notes-workspace-container" className="flex flex-col">
          <VitalsSummaryRow patientId={patientId} />

          <div className="flex flex-col gap-4">

            {/* SUBJECTIVE (or Note Details for Non-Doctors) */}
            <div id="subjective-section" className="note-section">
              <div className="note-section-header">
                <div className="note-section-icon">💬</div>
                <span className="note-section-title">
                  {isNonDoctor ? 'Note Details' : 'Subjective'} <span className="text-red ml-0.5">*</span>
                </span>
              </div>
              <div className="p-[14px]">
                <textarea
                  {...form.register('subjective')}
                  id="field-subjective"
                  className={`w-full min-h-[100px] px-2.5 py-1.5 bg-white border-[1.5px] rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed ${(!formValues.subjective || !formValues.subjective.trim()) && !isPublished ? 'border-red focus:border-red' : 'border-border-strong focus:border-accent'}`}
                  placeholder={isNonDoctor ? "Enter note details..." : "Enter subjective findings..."}
                  disabled={isDisabled}
                />
                {(!formValues.subjective || !formValues.subjective.trim()) && !isPublished && (
                  <p className="text-[10px] text-red mt-1.5 font-medium">{isNonDoctor ? 'Note details are required.' : 'Subjective is required to publish this note.'}</p>
                )}
              </div>
            </div>

            {!isNonDoctor && (
              <>
            {/* OBJECTIVE */}
            <div id="objective-section" className="note-section">
              <div className="note-section-header">
                <div className="note-section-icon">🔬</div>
                <span className="note-section-title">
                  Objective <span className="text-red ml-0.5">*</span>
                </span>
              </div>
              <div className="p-[14px]">
                <textarea
                  {...form.register('objective')}
                  id="field-objective"
                  className={`w-full min-h-[100px] px-2.5 py-1.5 bg-white border-[1.5px] rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed ${(!formValues.objective || !formValues.objective.trim()) && !isPublished ? 'border-red focus:border-red' : 'border-border-strong focus:border-accent'}`}
                  placeholder="Enter objective findings..."
                  disabled={isDisabled}
                />
                {(!formValues.objective || !formValues.objective.trim()) && !isPublished && (
                  <p className="text-[10px] text-red mt-1.5 font-medium">Objective is required to publish this note.</p>
                )}
              </div>
            </div>

            {/* LABS & IMAGING */}
            <div id="labs-imaging-section">
              <AttachmentsSection 
                patientId={patientId}
                noteType="PROGRESS_NOTE"
                noteId={noteId}
                localAttachments={localAttachments}
                onAddLocalAttachment={(att) => {
                  setLocalAttachments(prev => [...prev, att]);
                }}
                onRemoveLocalAttachment={(idx) => setLocalAttachments(prev => prev.filter((_, i) => i !== idx))}
                onPendingChange={setPendingAttachment}
              />
            </div>

            {/* PROBLEM LIST */}
            <div id="problem-list-section" className="note-section">
              <div className="note-section-header">
                <div className="note-section-icon">📊</div>
                <span className="note-section-title">Assessment / Problem List</span>
              </div>
              <div className="p-[14px]">
                <Controller
                  control={form.control}
                  name="problemListSnapshot"
                  render={({ field }) => (
                    <NoteProblemListEditor
                      value={field.value || []}
                      onChange={(next) => handleProblemSnapshotChange(next)}
                      activeProblems={copyForward?.activeProblems || []}
                      isPublished={isPublished}
                      isDisabled={isDisabled}
                      isEditMode={isProblemEditMode}
                      isLockedByOther={problemListLockedByOther}
                      onEnterEditMode={enterProblemEditMode}
                      onRevert={handleRevertProblemList}
                      onSaveDraft={handleSaveDraftProblemList}
                      currentUserLabel={user ? getCreatorName(user) : 'You'}
                      newProbTitle={newProbTitle}
                      setNewProbTitle={setNewProbTitle}
                    />
                  )}
                />
              </div>
            </div>

            {/* NON-PHARMACOLOGIC */}
            <div className="note-section">
              <div className="note-section-header">
                <div className="note-section-icon">🏃</div>
                <span className="note-section-title">Non-pharmacologic Management</span>
              </div>
              <div className="p-[14px]">
                <textarea
                  {...form.register('mgmtNonpharm')}
                  className="w-full min-h-[60px] px-2.5 py-1.5 bg-white border border-border-strong/60 rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter non-pharmacologic management..."
                  disabled={isDisabled}
                />
              </div>
            </div>

            {/* DIAGNOSTICS */}
            <div id="diagnostics-section" className="note-section" style={{ overflow: 'visible' }}>
              <div className="note-section-header">
                <div className="note-section-icon">🔍</div>
                <span className="note-section-title">Diagnostics</span>
              </div>
              <div className="p-[14px]">
                <Controller
                  control={form.control}
                  name="diagnostics"
                  render={({ field }) => (
                    <TagInputField
                      value={field.value || []}
                      onChange={field.onChange}
                      placeholder="Type test name and press Enter"
                      isObjectFormat={false}
                      disabled={isDisabled}
                      onInputChange={setDiagnosticsInput}
                    />
                  )}
                />
              </div>
            </div>

            {/* PHARMACOLOGIC TREATMENT REMARKS */}
            <div className="note-section">
              <div className="note-section-header">
                <div className="note-section-icon">💊</div>
                <span className="note-section-title">Pharmacologic Treatment Remarks</span>
              </div>
              <div className="p-[14px]">
                <textarea
                  {...form.register('mgmtPharm')}
                  className="w-full min-h-[60px] px-2.5 py-1.5 bg-white border border-border-strong/60 rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter pharmacologic treatment remarks..."
                  disabled={isDisabled}
                />
              </div>
            </div>

            {/* MEDICATIONS */}
            <div id="medications-section" className="note-section">
              <div className="note-section-header">
                <div className="note-section-icon">💊</div>
                <span className="note-section-title">Current Medication List</span>
                {formValues.medicationSnapshot && formValues.medicationSnapshot.length > 0 && (
                  <span className="text-[10px] font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
                    {formValues.medicationSnapshot.length} {formValues.medicationSnapshot.length === 1 ? 'med' : 'meds'}
                  </span>
                )}
              </div>
              <div className="p-[14px]">
                <Controller
                  control={form.control}
                  name="medicationSnapshot"
                  render={({ field }) => (
                    <NoteMedicationEditor
                      value={field.value || []}
                      onChange={handleMedicationSnapshotChange}
                      isPublished={isPublished}
                      isDisabled={isDisabled}
                      isEditMode={isMedicationEditMode}
                      isLockedByOther={medicationListLockedByOther}
                      onEnterEditMode={enterMedicationEditMode}
                      onRevert={handleRevertMedications}
                      onSaveDraft={handleSaveDraftMedications}
                      onEditMedication={(idx) => setEditMedIndex(idx)}
                      originalDoseByMedName={originalDoseByMedName}
                      originalSigByMedName={originalSigByMedName}
                      nameOptions={nameOptions}
                      newMedName={newMedName}
                      setNewMedName={setNewMedName}
                      newMedDose={newMedDose}
                      setNewMedDose={setNewMedDose}
                      newMedFormulation={newMedFormulation}
                      setNewMedFormulation={setNewMedFormulation}
                      newMedQuantity={newMedQuantity}
                      setNewMedQuantity={setNewMedQuantity}
                      newMedInstructions={newMedInstructions}
                      setNewMedInstructions={setNewMedInstructions}
                      medError={medError}
                      setMedError={setMedError}
                    />
                  )}
                />
              </div>
            </div>
              </>
            )}

          </div>
        </div>
        </>
      )}
      </div>
      <UnaddedChangesConfirmModal
        open={pendingAction !== null}
        onClose={handleGoBack}
        onConfirm={() => {
          if (pendingAction) {
            pendingAction();
          }
          setPendingAction(null);
        }}
        unaddedItems={getUnaddedSections()}
      />

      <MedicationSnapshotModal
        open={editMedIndex !== null}
        onClose={() => setEditMedIndex(null)}
        editing={editMedIndex !== null ? (form.getValues('medicationSnapshot') || [])[editMedIndex] ?? null : null}
        nameOptions={nameOptions}
        onSave={(values) => {
          if (editMedIndex === null) return;
          const current = form.getValues('medicationSnapshot') || [];
          const updated = [...current];
          const before = updated[editMedIndex] || {};
          // Record which pharmacologic fields the clinician actually changed
          // in-note, so mergeActiveMedications never lets a later, unrelated
          // master-list edit silently clobber them (note-snapshot-merge.ts).
          const changedFields = (['dose', 'formulation', 'quantity', 'instructions'] as const).filter((field) => {
            if (field === 'dose') {
              const prevDose = String((before as any).dose ?? '');
              const nextDose = String((values as any).dose ?? '');
              if (!prevDose && !nextDose) return false;
              return compareDoses(nextDose, prevDose).isDifferent;
            }
            return String((before as any)[field] ?? '').trim() !== String((values as any)[field] ?? '').trim();
          });
          const prevEdited: string[] = Array.isArray((before as any).editedFields) ? (before as any).editedFields : [];
          const editedFields = Array.from(new Set([...prevEdited, ...changedFields]));
          updated[editMedIndex] = { ...before, ...values, editedFields };
          form.setValue('medicationSnapshot', updated, { shouldDirty: true, shouldTouch: true });
          setEditMedIndex(null);
        }}
      />
    </div>
  );
}

function UnaddedChangesConfirmModal({
  open,
  onClose,
  onConfirm,
  unaddedItems
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  unaddedItems: string[];
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // Overlay
    <div className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center animate-in fade-in duration-150">
      {/* Modal box */}
      <div className="bg-surface border border-border rounded-[10px] w-[500px] max-[1439px]:w-[460px] max-[1279px]:w-[420px] max-[767px]:w-[92vw] max-[767px]:max-w-[380px] max-h-[80vh] overflow-y-auto shadow-modal flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border">
          <h2 className="text-[15px] font-bold flex-1 text-text-primary flex items-center gap-1.5">
            <span className="text-[16px]">⚠️</span> Unsaved Changes
          </h2>
          <button 
            onClick={onClose} 
            aria-label="Close modal"
            className="w-6 h-6 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="px-[18px] py-[18px] text-[13px] text-text-secondary leading-relaxed flex flex-col gap-3">
          <p className="text-text-primary">
            You have entered/selected information in the following section(s) but haven't clicked "+ Add" or "Add Result" to attach them to the note:
          </p>
          <ul className="flex flex-col gap-2 bg-surface-2 border border-border p-3 rounded-card">
            {unaddedItems.map((name, idx) => (
              <li key={idx} className="flex items-center gap-2 text-[13px] font-semibold text-accent">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-mid" />
                {name}
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-text-muted mt-1">
            They will be discarded if you proceed. Click "Go Back" to scroll to the section and add them, or "Discard & Proceed" to save/close without them.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-[18px] py-3 border-t border-border bg-surface-2/30">
          <button
            onClick={onClose}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-red-bg text-red border border-red-border hover:bg-red/15 hover:border-red/80 transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer shadow-sm"
          >
            Discard & Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

