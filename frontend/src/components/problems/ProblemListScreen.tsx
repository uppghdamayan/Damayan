'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ClipboardList, ArrowRight } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';

import {
  useProblems,
  useCreateProblem,
  useUpdateProblem,
  useDeleteProblem,
  useReorderProblems,
  useProblemLogs,
} from '@/hooks/useProblems';
import { useInitialNote } from '@/hooks/useInitialNote';
import { useProgressNotes } from '@/hooks/useProgressNotes';
import { usePatient } from '@/hooks/usePatients';
import { buildProblemTree, isDescendant, getCreatorName } from '@/lib/problem-utils';
import { zoomModifier } from '@/lib/dnd-utils';
import { useProblemEditLock } from '@/hooks/useProblemEditLock';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { ActiveProblemTable, ActiveProblemRow, type DragOverState } from './ActiveProblemTable';
import { ResolvedProblemTable, ResolvedRow } from './ResolvedProblemTable';
import { ProblemLogTable } from './ProblemLogTable';
import { ProblemEditModal } from './ProblemEditModal';
import { ProblemListSkeleton } from './ProblemListSkeleton';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import type { Problem, ProblemNode, ProblemStatusValue } from '@/types/problem';

export function ProblemListScreen({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const uiScale = useUiStore((state) => state.uiScale);
  const openExistingProgressNote = useUiStore((state) => state.openExistingProgressNote);
  const scale = uiScale / 100;
  const canManage = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const { data: initialNote, isLoading: initialNoteLoading } = useInitialNote(patientId);
  const hasPublishedInitialNote = Boolean(initialNote && initialNote.status === 'PUBLISHED');

  // Same query args as NoteTimeline's useProgressNotes(patientId, 1, 100) —
  // keep them in sync so the two hooks share one cached fetch instead of
  // holding divergent caches for the same patient.
  const { data: progressNotesResponse } = useProgressNotes(patientId, 1, 100);
  // The Master Problem List is read-only unless a note draft is currently in
  // progress — an unpublished Initial Note, or an unpublished (DRAFT)
  // Progress Note — so doctors never edit the master list "cold", outside
  // the context of a note. Once every note for this patient is published,
  // editing locks again.
  const hasDraftNoteInProgress = Boolean(
    (initialNote && initialNote.status === 'DRAFT') ||
      (progressNotesResponse?.data ?? []).some((n) => n.status === 'DRAFT'),
  );

  // Mutual-exclusion lock vs. the Progress Note's in-note Assessment editor —
  // see useProblemEditLock for the full rationale. While a note holds it,
  // this list stays read-only (all edit/add/drag/status/delete affordances
  // disabled) rather than risk a data mismatch between the two drafts.
  const { isLockedByOther, lockNoteId, tryAcquire, release } = useProblemEditLock(patientId, 'master');
  const effectiveCanManage = canManage && !isLockedByOther && hasPublishedInitialNote && hasDraftNoteInProgress;
  // Visual/read-only gate for the two tables — distinct from effectiveCanManage
  // in that it ignores isLockedByOther (that state gets its own banner and
  // "Locked" badge rather than the generic grayed-out treatment).
  const isMasterListLocked = !hasPublishedInitialNote || !hasDraftNoteInProgress;

  const { data, isLoading } = useProblems(patientId);
  const { data: logsData, isLoading: logsLoading } = useProblemLogs(patientId);
  const { data: patient } = usePatient(patientId);
  const createProblem = useCreateProblem(patientId);
  const updateProblem = useUpdateProblem(patientId);
  const deleteProblem = useDeleteProblem(patientId);
  const reorderProblems = useReorderProblems(patientId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Problem | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [problemToDelete, setProblemToDelete] = useState<Problem | null>(null);

  // Edit mode — local draft ordering, not yet published
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[] | null>(null);
  const [draftParents, setDraftParents] = useState<Record<string, string | null> | null>(null);
  const [draftTitles, setDraftTitles] = useState<Record<string, string> | null>(null);
  const [draftDiagnosisDates, setDraftDiagnosisDates] = useState<Record<string, string | null> | null>(null);
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);

  // Acquires the edit lock (if not already held) before entering draft mode.
  // Returns false — and leaves state untouched — if the note holds it, so
  // every call site can bail out of its edit before mutating draft state.
  const ensureEditMode = () => {
    if (!hasPublishedInitialNote || !hasDraftNoteInProgress) return false;
    if (isEditMode) return true;
    if (!tryAcquire()) return false;
    setIsEditMode(true);
    return true;
  };

  // Ref to always hold the latest draft values for cleanup functions (avoids stale closures)
  const draftRef = useRef<{ isEditMode: boolean; draftOrder: string[] | null, draftParents: Record<string, string | null> | null, draftTitles: Record<string, string> | null, draftDiagnosisDates: Record<string, string | null> | null }>({ isEditMode: false, draftOrder: null, draftParents: null, draftTitles: null, draftDiagnosisDates: null });
  // Ref to track which patient's draft has been restored (prevents double-restore)
  const lastRestoredPatientRef = useRef<string | null>(null);

  const draftStorageKey = `damayan_problem_draft_${patientId}`;

  // Keep draftRef in sync so cleanup functions always see current values
  useEffect(() => {
    draftRef.current = { isEditMode, draftOrder, draftParents, draftTitles, draftDiagnosisDates };
  }, [isEditMode, draftOrder, draftParents, draftTitles, draftDiagnosisDates]);

  const problems = data?.data ?? [];

  const lastPublishedEdit = useMemo(() => {
    if (problems.length === 0) return null;
    let latestProblem = problems[0];
    let latestTime = new Date(latestProblem.updatedAt).getTime();
    for (const p of problems) {
      const t = new Date(p.updatedAt).getTime();
      if (t > latestTime) {
        latestTime = t;
        latestProblem = p;
      }
    }
    const editor = latestProblem.updatedByUser || latestProblem.addedByUser;
    const editedAt = latestProblem.updatedBy ? latestProblem.updatedAt : latestProblem.createdAt;
    return { editor, editedAt };
  }, [problems]);

  const editorDisplayName = useMemo(() => {
    if (!lastPublishedEdit) return 'System';
    return getCreatorName(lastPublishedEdit.editor);
  }, [lastPublishedEdit]);

  const formattedLastEditedTime = useMemo(() => {
    if (!lastPublishedEdit) return '';
    const date = new Date(lastPublishedEdit.editedAt);
    return date.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' · ' + date.toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, [lastPublishedEdit]);
  
  const activeProblems = useMemo(() => problems.filter(p => p.status === 'ACTIVE'), [problems]);
  const resolvedProblems = useMemo(() => problems.filter(p => p.status === 'RESOLVED'), [problems]);
  
  const draftActiveProblems = useMemo(() => {
    if (!isEditMode) return activeProblems;
    return activeProblems.map(p => {
      let overrides: Partial<Problem> = {};
      if (draftParents && p.id in draftParents) {
        overrides.parentId = draftParents[p.id];
      }
      if (draftTitles && p.id in draftTitles) {
        overrides.title = draftTitles[p.id];
      }
      if (draftDiagnosisDates && p.id in draftDiagnosisDates) {
        overrides.diagnosisDate = draftDiagnosisDates[p.id];
      }
      if (Object.keys(overrides).length > 0) {
        return { ...p, ...overrides };
      }
      return p;
    });
  }, [activeProblems, isEditMode, draftParents, draftTitles, draftDiagnosisDates]);

  const tree = useMemo(() => buildProblemTree(draftActiveProblems), [draftActiveProblems]);

  const flatActiveProblems = useMemo(() => {
    const list: { problem: ProblemNode; depth: number }[] = [];
    const traverse = (nodesList: ProblemNode[], depth: number) => {
      nodesList.forEach(node => {
        list.push({ problem: node, depth });
        traverse(node.children, depth + 1);
      });
    };
    traverse(tree, 0);
    return list;
  }, [tree]);

  // In edit mode show the locally-reordered list; otherwise fall back to server order
  const displayFlatProblems = useMemo(() => {
    if (!draftOrder) return flatActiveProblems;
    const ordered = draftOrder
      .map(id => flatActiveProblems.find(item => item.problem.id === id))
      .filter((item): item is { problem: ProblemNode; depth: number } => item !== undefined);
    // Append any problems added after edit mode was entered
    const missing = flatActiveProblems.filter(item => !draftOrder.includes(item.problem.id));
    return [...ordered, ...missing];
  }, [draftOrder, flatActiveProblems]);

  // Restore a saved draft from localStorage once data has loaded for this patient
  useEffect(() => {
    if (isLoading) return;
    if (lastRestoredPatientRef.current === patientId) return;
    lastRestoredPatientRef.current = patientId;
    // Reset any leftover edit state from a previous patient
    setIsEditMode(false);
    setDraftOrder(null);
    setDraftParents(null);
    setDraftTitles(null);
    setDraftDiagnosisDates(null);
    setLastAutoSaved(null);
    const saved = localStorage.getItem(`damayan_problem_draft_${patientId}`);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { order: string[]; parents?: Record<string, string | null>; titles?: Record<string, string>; diagnosisDates?: Record<string, string | null>; savedAt: string };
      if (Array.isArray(parsed.order) && parsed.order.length > 0) {
        setDraftOrder(parsed.order);
        setDraftParents(parsed.parents || null);
        setDraftTitles(parsed.titles || null);
        setDraftDiagnosisDates(parsed.diagnosisDates || null);
        setIsEditMode(true);
        // Best-effort: a restored draft implies this side already held the
        // lock before reload (the persisted lock should already reflect
        // that), but re-acquiring here keeps it consistent even if the
        // store's rehydration raced this effect.
        tryAcquire();
        toast.info('Restored your unsaved draft order. Publish or revert when ready.', { duration: 5000 });
      }
    } catch {
      localStorage.removeItem(`damayan_problem_draft_${patientId}`);
    }
  }, [patientId, isLoading]);

  // Auto-save draft to localStorage every 10 seconds while in edit mode
  useEffect(() => {
    if (!isEditMode || !draftOrder) return;
    const interval = setInterval(() => {
      localStorage.setItem(
        `damayan_problem_draft_${patientId}`,
        JSON.stringify({ order: draftOrder, parents: draftParents, titles: draftTitles, diagnosisDates: draftDiagnosisDates, savedAt: new Date().toISOString() })
      );
      setLastAutoSaved(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, [isEditMode, draftOrder, draftParents, draftTitles, draftDiagnosisDates, patientId]);

  // Persist draft to localStorage on unmount (patient switch, tab close) and on page reload
  useEffect(() => {
    const persistDraft = () => {
      const { isEditMode: editMode, draftOrder: order, draftParents: parents, draftTitles: titles, draftDiagnosisDates: diagnosisDates } = draftRef.current;
      if (editMode && order) {
        localStorage.setItem(
          `damayan_problem_draft_${patientId}`,
          JSON.stringify({ order, parents, titles, diagnosisDates, savedAt: new Date().toISOString() })
        );
      }
    };
    window.addEventListener('beforeunload', persistDraft);
    return () => {
      window.removeEventListener('beforeunload', persistDraft);
      persistDraft(); // also runs when component unmounts (patient switch / navigation)
    };
  }, [patientId]);

  // Drag and drop state
  const [dragOverState, setDragOverState] = useState<DragOverState | null>(null);
  const [isTableDragging, setIsTableDragging] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState<{ problem: ProblemNode; depth: number } | null>(null);
  const [activeResolvedDragItem, setActiveResolvedDragItem] = useState<Problem | null>(null);
  const [activeDragRect, setActiveDragRect] = useState<DOMRect | null>(null);
  const [currentOverId, setCurrentOverId] = useState<string | null>(null);

  const pointerPosition = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      pointerPosition.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAdd = () => {
    if (!hasPublishedInitialNote) {
      toast.error('An Initial Note must be created and published first.');
      return;
    }
    if (!hasDraftNoteInProgress) {
      toast.error('Editing requires a note draft in progress — start or open an unpublished Initial or Progress Note first.');
      return;
    }
    if (isLockedByOther) {
      tryAcquire(); // surfaces the "locked by a note" toast
      return;
    }
    setEditing(null);
    setModalOpen(true);
  };
  const handleEdit = (p: Problem) => {
    if (!hasPublishedInitialNote || !hasDraftNoteInProgress) return;
    setEditing(p);
    setModalOpen(true);
  };

  const handleSave = async (values: { title: string; parentId?: string | null; diagnosisDate?: string | null }) => {
    if (!hasPublishedInitialNote || !hasDraftNoteInProgress) return;
    try {
      if (editing) {
        if (!ensureEditMode()) return;

        // If draftOrder hasn't been initialized yet, initialize it
        let currentOrder = draftOrder;
        if (!currentOrder) {
          currentOrder = flatActiveProblems.map(x => x.problem.id);
          setDraftOrder(currentOrder);
        }

        setDraftTitles(prev => ({ ...prev, [editing.id]: values.title }));
        setDraftDiagnosisDates(prev => ({ ...prev, [editing.id]: values.diagnosisDate || null }));

        const oldParentId = draftParents && draftParents[editing.id] !== undefined ? draftParents[editing.id] : editing.parentId;
        if (values.parentId !== undefined && values.parentId !== oldParentId) {
          setDraftParents(prev => ({ ...prev, [editing.id]: values.parentId || null }));
          
          // Reorder it visually below its new parent
          const activeIdx = currentOrder.indexOf(editing.id);
          let newOrder = [...currentOrder];
          
          if (activeIdx !== -1) {
            newOrder.splice(activeIdx, 1);
            if (values.parentId) {
              const targetIdx = newOrder.indexOf(values.parentId);
              if (targetIdx !== -1) {
                newOrder.splice(targetIdx + 1, 0, editing.id);
              } else {
                newOrder.push(editing.id);
              }
            } else {
              newOrder.push(editing.id);
            }
            setDraftOrder(newOrder);
          }
        }
        
        toast.success(`Draft updated for '${values.title}'.`);
      } else {
        if (isLockedByOther) {
          tryAcquire(); // surfaces the "locked by a note" toast
          return;
        }
        await createProblem.mutateAsync({ title: values.title, parentId: values.parentId ?? undefined, diagnosisDate: values.diagnosisDate });
        toast.success(`'${values.title}' added to the list.`);
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save problem.');
    }
  };

  const handleStatusChange = async (p: Problem, status: ProblemStatusValue) => {
    if (!hasPublishedInitialNote || !hasDraftNoteInProgress) return;
    if (isLockedByOther) {
      tryAcquire(); // surfaces the "locked by a note" toast
      return;
    }
    try {
      await updateProblem.mutateAsync({ id: p.id, status });
      if (status === 'RESOLVED' || status === 'REMOVED') {
        mirrorPromotionInDraft(p);
      }
      const messages: Record<ProblemStatusValue, string> = {
        ACTIVE: `'${p.title}' has been reactivated.`,
        RESOLVED: `'${p.title}' has been resolved.`,
        REMOVED: `'${p.title}' has been removed.`,
      };
      toast.success(messages[status]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleParentChange = (p: Problem, newParentId: string | null) => {
    if (!hasPublishedInitialNote || !ensureEditMode()) return;
    setDraftParents(prev => ({ ...prev, [p.id]: newParentId }));
    
    // Also move it visually below its new parent
    const currentOrder = draftOrder || flatActiveProblems.map(x => x.problem.id);
    const activeIdx = currentOrder.indexOf(p.id);
    let newOrder = [...currentOrder];
    
    if (activeIdx !== -1) {
      newOrder.splice(activeIdx, 1);
      
      if (newParentId) {
        const targetIdx = newOrder.indexOf(newParentId);
        if (targetIdx !== -1) {
          newOrder.splice(targetIdx + 1, 0, p.id);
        } else {
          newOrder.push(p.id);
        }
      } else {
        newOrder.push(p.id); // move to bottom if made root
      }
      setDraftOrder(newOrder);
    }

    if (newParentId) {
      const parent = draftActiveProblems.find((x) => x.id === newParentId);
      toast.success(`'${p.title}' nested under '${parent?.title || 'Unknown'}' (Draft).`);
    } else {
      toast.success(`'${p.title}' moved to top level (Draft).`);
    }
  };

  // Shared by delete (status -> REMOVED, item leaves the tree entirely) and
  // resolve (status -> RESOLVED, item stays in the Resolved section but
  // drops out of the *active* tree). Either way the server has already
  // promoted the problem's first surviving child into its slot (see
  // problems.service.ts "Business rule 5") and the refetch will carry that
  // through — this just keeps the *unpublished* local draft (draftOrder/
  // draftParents/draftTitles/draftDiagnosisDates) from disagreeing with it.
  // Left unpruned, a stale draftParents entry could re-nest a promoted child
  // back under the now-inactive problem on the next Publish.
  const mirrorPromotionInDraft = (changedProblem: Problem) => {
    if (!isEditMode) return;
    const changedId = changedProblem.id;
    const children = draftActiveProblems.filter(
      (p) =>
        p.id !== changedId &&
        (draftParents && p.id in draftParents ? draftParents[p.id] : p.parentId) === changedId,
    );
    if (children.length === 0) return;
    const changedParentId =
      draftParents && changedId in draftParents ? draftParents[changedId] : changedProblem.parentId;

    setDraftParents((prev) => {
      const base = { ...(prev || {}) };
      const [heir, ...rest] = children;
      base[heir.id] = changedParentId;
      rest.forEach((sibling) => {
        base[sibling.id] = heir.id;
      });
      return base;
    });
  };

  const handleDelete = (p: Problem) => {
    if (!hasPublishedInitialNote || !hasDraftNoteInProgress) return;
    setProblemToDelete(p);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!problemToDelete || !hasPublishedInitialNote || !hasDraftNoteInProgress) return;
    if (isLockedByOther) {
      tryAcquire(); // surfaces the "locked by a note" toast
      setDeleteModalOpen(false);
      setProblemToDelete(null);
      return;
    }
    const deletedId = problemToDelete.id;
    deleteProblem.mutate(deletedId, {
      onSuccess: () => {
        mirrorPromotionInDraft(problemToDelete);

        if (isEditMode) {
          // The deleted problem itself leaves the draft entirely (unlike
          // resolve, which keeps it in the tree at its old slot/status).
          setDraftOrder((prev) => (prev ? prev.filter((id) => id !== deletedId) : prev));
          setDraftParents((prev) => {
            if (!prev || !(deletedId in prev)) return prev;
            const next = { ...prev };
            delete next[deletedId];
            return next;
          });
          setDraftTitles((prev) => {
            if (!prev || !(deletedId in prev)) return prev;
            const next = { ...prev };
            delete next[deletedId];
            return next;
          });
          setDraftDiagnosisDates((prev) => {
            if (!prev || !(deletedId in prev)) return prev;
            const next = { ...prev };
            delete next[deletedId];
            return next;
          });
        }

        toast.success(`'${problemToDelete.title}' has been removed from the problem list.`);
        setDeleteModalOpen(false);
        setProblemToDelete(null);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to remove problem.');
      },
    });
  };

  const handleReorder = (items: { id: string; sortOrder: number }[]) => {
    if (!hasPublishedInitialNote || !hasDraftNoteInProgress) return;
    reorderProblems.mutate({ items });
  };

  const handleRevert = () => {
    setIsEditMode(false);
    setDraftOrder(null);
    setDraftParents(null);
    setDraftTitles(null);
    setDraftDiagnosisDates(null);
    setLastAutoSaved(null);
    localStorage.removeItem(draftStorageKey);
    release();
    toast.info('Changes reverted to original order and nesting.');
  };

  // Save Draft: persists to localStorage only — does NOT call the API
  // so other co-doctors never see unpublished edits
  const handleSaveDraft = () => {
    if (!hasPublishedInitialNote || !hasDraftNoteInProgress || !draftOrder) return;
    localStorage.setItem(draftStorageKey, JSON.stringify({ order: draftOrder, parents: draftParents, titles: draftTitles, diagnosisDates: draftDiagnosisDates, savedAt: new Date().toISOString() }));
    setLastAutoSaved(new Date());
    toast.success('Draft saved locally. Publish when ready to share with co-doctors.');
  };

  const handlePublish = () => {
    if (!hasPublishedInitialNote || !hasDraftNoteInProgress) return;
    const items = displayFlatProblems.map((item, index) => ({ 
      id: item.problem.id, 
      sortOrder: index,
      ...(draftParents && draftParents[item.problem.id] !== undefined ? { parentId: draftParents[item.problem.id] } : {}),
      ...(draftTitles && draftTitles[item.problem.id] !== undefined ? { title: draftTitles[item.problem.id] } : {}),
      ...(draftDiagnosisDates && draftDiagnosisDates[item.problem.id] !== undefined ? { diagnosisDate: draftDiagnosisDates[item.problem.id] } : {})
    }));
    reorderProblems.mutate({ items }, {
      onSuccess: () => {
        setIsEditMode(false);
        setDraftOrder(null);
        setDraftParents(null);
        setDraftTitles(null);
        setDraftDiagnosisDates(null);
        setLastAutoSaved(null);
        localStorage.removeItem(draftStorageKey);
        release();
        toast.success('Problem list changes published successfully.');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to publish changes.'),
    });
  };

  const findProblemById = (id: string, currentNodes: ProblemNode[]): ProblemNode | undefined => {
    for (const node of currentNodes) {
      if (node.id === id) return node;
      const child = findProblemById(id, node.children);
      if (child) return child;
    }
    return undefined;
  };

  const handleDragStart = (event: any) => {
    if (!effectiveCanManage) return;
    setIsTableDragging(true);
    const { active } = event;
    const activeData = active.data.current;

    setActiveDragRect(active.rect.current.initial ?? null);

    if (activeData?.type === 'resolved') {
      const p = resolvedProblems.find(x => x.id === active.id);
      setActiveResolvedDragItem(p || null);
    } else {
      const activeItem = displayFlatProblems.find((p) => p.problem.id === active.id);
      setActiveDragItem(activeItem || null);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { over, active } = event;
    const activeData = active.data.current;

    setCurrentOverId(over?.id as string | null);

    // Only apply merge styles for active items
    if (!over || activeData?.type === 'resolved') {
      setDragOverState(null);
      return;
    }

    const overElement = document.getElementById(`row-${over.id}`);
    if (!overElement) {
      setDragOverState(null);
      return;
    }

    const rect = overElement.getBoundingClientRect();
    const x = (pointerPosition.current.x - rect.left) / scale;

    const activeItem = displayFlatProblems.find((p) => p.problem.id === active.id);
    const targetItem = displayFlatProblems.find((p) => p.problem.id === over.id);

    if (!activeItem || !targetItem) {
      setDragOverState(null);
      return;
    }

    const isNestedProblem = activeItem.problem.parentId !== null;
    const isUnnestZone = isNestedProblem && x < 50;
    const isSelfOrDescendant = over.id === active.id || isDescendant(draftActiveProblems, over.id as string, activeItem.problem.id);
    const isNestZone = !isSelfOrDescendant && x > 120;

    if (isUnnestZone) {
      setDragOverState({
        id: over.id as string,
        action: 'unnest',
        targetTitle: targetItem.problem.title,
      });
    } else if (isNestZone) {
      setDragOverState({
        id: over.id as string,
        action: 'nest',
        targetTitle: targetItem.problem.title,
      });
    } else {
      setDragOverState({
        id: over.id as string,
        action: 'reorder',
        targetTitle: targetItem.problem.title,
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!effectiveCanManage) return;
    setIsTableDragging(false);
    setActiveDragItem(null);
    setActiveResolvedDragItem(null);
    setActiveDragRect(null);
    const currentAction = dragOverState?.action;
    setDragOverState(null);
    setCurrentOverId(null);

    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;

    // Dragging from Resolved
    if (activeData?.type === 'resolved') {
      if (over.id === 'active-table' || flatActiveProblems.some(p => p.problem.id === over.id)) {
        const problem = resolvedProblems.find(p => p.id === active.id);
        if (problem) {
          handleStatusChange(problem, 'ACTIVE');
        }
      } else if (over.id !== 'resolved-table' && active.id !== over.id) {
        const oldIndex = resolvedProblems.findIndex((p) => p.id === active.id);
        const newIndex = resolvedProblems.findIndex((p) => p.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedList = arrayMove(resolvedProblems, oldIndex, newIndex);
          handleReorder(reorderedList.map((item, index) => ({ id: item.id, sortOrder: index })));
        }
      }
      return;
    }

    // Dragging from Active to Resolved
    if (over.id === 'resolved-table' || resolvedProblems.some(p => p.id === over.id)) {
      const activeProblem = flatActiveProblems.find(p => p.problem.id === active.id)?.problem;
      if (activeProblem) {
        handleStatusChange(activeProblem, 'RESOLVED');
      }
      return;
    }

    if (active.id === over.id && currentAction !== 'unnest') return;

    const activeProblem = findProblemById(active.id as string, tree);
    const targetProblem = findProblemById(over.id as string, tree);

    if (!activeProblem) return;

    if (currentAction === 'unnest') {
      if (activeProblem.parentId) {
        handleParentChange(activeProblem, null);
      }
      return;
    }

    if (currentAction === 'nest' && targetProblem) {
      const newParentId = targetProblem.id;
      if (activeProblem.id !== newParentId) {
        if (isDescendant(draftActiveProblems, newParentId, activeProblem.id)) {
          toast.error('Cannot nest a problem under its own descendant.');
          return;
        }
        handleParentChange(activeProblem, newParentId);
      }
      return;
    }

    // Default: Reorder
    if (targetProblem) {
      if (activeProblem.parentId !== targetProblem.parentId) {
        if (targetProblem.parentId && isDescendant(draftActiveProblems, targetProblem.parentId, activeProblem.id)) {
          toast.error('Cannot nest a problem under its own descendant.');
          return;
        }
        handleParentChange(activeProblem, targetProblem.parentId);
      }

      const oldIndex = displayFlatProblems.findIndex((p) => p.problem.id === active.id);
      const newIndex = displayFlatProblems.findIndex((p) => p.problem.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        if (!ensureEditMode()) return;
        const reorderedList = arrayMove(displayFlatProblems, oldIndex, newIndex);
        setDraftOrder(reorderedList.map(item => item.problem.id));
      }
    }
  };

  if (isLoading || initialNoteLoading) return <ProblemListSkeleton />;

  const isOverResolvedTableOrItem = currentOverId === 'resolved-table' || resolvedProblems.some(p => p.id === currentOverId);
  const showResolvedDropOverlay = isOverResolvedTableOrItem && activeDragItem !== null;

  const isOverActiveTableOrItem = currentOverId === 'active-table' || displayFlatProblems.some(p => p.problem.id === currentOverId);
  const showActiveDropOverlay = isOverActiveTableOrItem && activeResolvedDragItem !== null;

  return (
    <div className="flex flex-col gap-6">
      {!hasPublishedInitialNote && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-surface border border-accent/20 bg-accent-light shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-text-primary">Initial Note Required</h4>
              <p className="text-[12px] text-text-secondary mt-0.5">
                {canManage
                  ? 'An Initial Consultation Note must be created and published before problems can be added or edited.'
                  : 'An Initial Consultation Note must be created and published by a doctor before problems can be added or edited.'}
              </p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => router.push(`/dashboard/${patientId}/initial-note`)}
              className="h-[32px] px-3.5 rounded-btn text-[11px] font-bold bg-accent hover:bg-accent-hover text-white flex items-center gap-1.5 whitespace-nowrap shadow-btn-primary transition-all flex-shrink-0 cursor-pointer"
            >
              Create Initial Note
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {hasPublishedInitialNote && !hasDraftNoteInProgress && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-surface border border-slate-400/30 bg-slate-500/5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-500/10 flex items-center justify-center text-slate-600 flex-shrink-0 text-[16px]">
              🔒
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-text-primary">Editing Locked — No Note Draft in Progress</h4>
              <p className="text-[12px] text-text-secondary mt-0.5">
                {canManage
                  ? 'The Master Problem List can only be edited while an Initial or Progress Note draft is in progress. Start or open an unpublished note to make changes.'
                  : 'The Master Problem List can only be edited while an Initial or Progress Note draft is in progress.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {canManage && (
        <div className="flex justify-end -mb-2">
          <button
            onClick={handleAdd}
            disabled={!effectiveCanManage}
            title={
              !hasPublishedInitialNote
                ? 'An Initial Note must be published before adding problems'
                : !hasDraftNoteInProgress
                ? 'Editing requires a note draft in progress — start or open an unpublished Initial or Progress Note first'
                : isLockedByOther
                ? 'Locked — a Progress Note draft is currently editing problems'
                : undefined
            }
            className="h-8 px-4 rounded-btn text-[12px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Problem
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        autoScroll={false}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDragOverState(null);
          setIsTableDragging(false);
          setActiveDragItem(null);
          setActiveResolvedDragItem(null);
          setActiveDragRect(null);
          setCurrentOverId(null);
        }}
      >
        {/* MASTER PROBLEM LIST */}
        <div 
          className={cn(
            "bg-surface border border-border border-l-[3px] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] relative overflow-hidden transition-all duration-200 min-h-[140px]",
            isEditMode ? 'border-l-amber-500' : 'border-l-accent',
            isMasterListLocked && 'opacity-65 grayscale-[30%] bg-surface-2/30 pointer-events-none select-none',
            showActiveDropOverlay && "outline-dashed outline-2 outline-green outline-offset-[-2px]"
          )}
        >
          {showActiveDropOverlay && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface/60 backdrop-blur-[3px] pointer-events-none">
              <div className="w-10 h-10 rounded-full bg-green-light border-2 border-green flex items-center justify-center text-green text-xl font-bold mb-2 shadow-sm">
                +
              </div>
              <div className="text-green font-bold text-[13px] bg-white/90 px-4 py-1.5 rounded-full shadow-sm">
                Drop to mark as Active
              </div>
            </div>
          )}

          <div className="flex flex-col @md:flex-row @md:items-center justify-between gap-3 px-4 py-3 bg-surface-2 rounded-t-lg border-b border-border">
            {/* Left side */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0 shadow-sm border border-border">
                  📋
                </div>
                <h3 className="text-[13px] font-bold tracking-[0.3px] text-text-primary">
                  Master Problem List
                </h3>
                <span className="ch-badge badge-active text-[9px] font-bold uppercase tracking-[0.5px] px-2 py-0.5 rounded border border-accent text-accent-hover bg-accent-light">
                  {activeProblems.length} Active
                </span>
              </div>
              
              {!isEditMode && lastPublishedEdit && (
                <div className="text-[11px] text-text-muted flex items-center gap-1.5 pl-[34px] animate-in fade-in duration-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                  <span className="bg-accent/5 dark:bg-accent/10 border border-accent/15 px-2.5 py-0.5 rounded-md text-text-secondary flex items-center gap-1 flex-wrap">
                    Last edited by <span className="font-semibold text-accent">{editorDisplayName}</span> on <span className="font-mono text-text-primary font-medium">{formattedLastEditedTime}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {isEditMode ? (
                <span className="text-[10px] font-bold uppercase tracking-[0.5px] px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-700 border border-amber-200 dark:border-amber-900/30 rounded-[4px] flex items-center gap-1.5 animate-pulse">
                  <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                  </span>
                  Draft Mode (Unpublished)
                </span>
              ) : isMasterListLocked ? (
                <span className="text-[10px] font-medium text-text-muted bg-surface-3 border border-border px-2.5 py-1 rounded-[4px] flex items-center gap-1 select-none">
                  🔒 {hasPublishedInitialNote ? 'Locked — No Draft' : 'Read Only'}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-text-muted bg-surface-3 border border-border px-2.5 py-1 rounded-[4px] flex items-center gap-1.5 select-none">
                  <span>⇄ Drag to reorder</span>
                  <span className="text-border">·</span>
                  <span className="text-accent font-semibold">→ Nest</span>
                  <span className="text-border">·</span>
                  <span className="text-amber-600 font-semibold">← Un-nest</span>
                </span>
              )}
            </div>
          </div>

          <ActiveProblemTable
            nodes={tree}
            flatProblems={displayFlatProblems}
            isTableDragging={isTableDragging}
            activeDragItem={activeDragItem}
            dragOverState={dragOverState}
            allOptions={activeProblems}
            canManage={effectiveCanManage}
            hasInitialNote={hasPublishedInitialNote}
            isEditMode={isEditMode}
            isLocked={isLockedByOther}
            onJumpToLockOwner={
              lockNoteId ? () => openExistingProgressNote(patientId, lockNoteId) : undefined
            }
            onRevert={handleRevert}
            onSaveDraft={handleSaveDraft}
            onPublish={handlePublish}
            isSaving={reorderProblems.isPending}
            lastAutoSaved={lastAutoSaved}
            onEdit={handleEdit}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onParentChange={handleParentChange}
          />
        </div>

        {/* RESOLVED PROBLEMS */}
        <div 
          className={cn(
            "bg-surface border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] relative overflow-hidden transition-all duration-200 min-h-[140px]",
            isMasterListLocked && 'opacity-65 grayscale-[30%] bg-surface-2/30 pointer-events-none select-none',
            showResolvedDropOverlay && "outline-dashed outline-2 outline-green outline-offset-[-2px]"
          )}
        >
          {showResolvedDropOverlay && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface/60 backdrop-blur-[3px] pointer-events-none">
              <div className="w-10 h-10 rounded-full bg-green-light border-2 border-green flex items-center justify-center text-green text-xl font-bold mb-2 shadow-sm">
                +
              </div>
              <div className="text-green font-bold text-[13px] bg-white/90 px-4 py-1.5 rounded-full shadow-sm">
                Drop to mark as Resolved
              </div>
            </div>
          )}

          <div className="flex flex-col @md:flex-row @md:items-center justify-between gap-3 px-4 py-3 bg-surface-2 rounded-t-lg border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0 shadow-sm border border-border">
                ✅
              </div>
              <h3 className="text-[13px] font-bold tracking-[0.3px] text-text-primary">
                Resolved Problems
              </h3>
              <span className="ch-badge badge-resolved text-[9px] font-bold uppercase tracking-[0.5px] px-2 py-0.5 rounded border border-green-border text-green bg-green-bg">
                {resolvedProblems.length} Resolved
              </span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {isMasterListLocked && (
                <span className="text-[10px] font-medium text-text-muted bg-surface-3 border border-border px-2.5 py-1 rounded-[4px] flex items-center gap-1 select-none">
                  🔒 {hasPublishedInitialNote ? 'Locked — No Draft' : 'Read Only'}
                </span>
              )}
            </div>
          </div>

          <ResolvedProblemTable
            problems={resolvedProblems}
            canManage={effectiveCanManage}
            onReactivate={(p) => handleStatusChange(p, 'ACTIVE')}
            onDelete={handleDelete}
          />
        </div>

        {/* PROBLEM LOGS */}
        <div 
          className="bg-surface border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] relative overflow-hidden transition-all duration-200 min-h-[140px]"
        >
          <div className="flex flex-col @md:flex-row @md:items-center justify-between gap-3 px-4 py-3 bg-surface-2 rounded-t-lg border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0 shadow-sm border border-border">
                📝
              </div>
              <h3 className="text-[13px] font-bold tracking-[0.3px] text-text-primary">
                Master Problem List Logs
              </h3>
              <span className="ch-badge text-[9px] font-bold uppercase tracking-[0.5px] px-2 py-0.5 rounded border border-border text-text-secondary bg-surface-3">
                14-Day History
              </span>
            </div>
          </div>

          <ProblemLogTable
            logs={logsData?.data ?? []}
            isLoading={logsLoading}
          />
        </div>

        {/* Drag Overlays */}
        <DragOverlay modifiers={[zoomModifier]}>
          {activeDragItem ? (
            <div 
              style={{ width: activeDragRect ? activeDragRect.width / scale : undefined }} 
              className="bg-surface shadow-2xl border-2 border-accent rounded-lg ring-4 ring-accent/20 opacity-95 overflow-hidden backdrop-blur-sm min-w-[880px]"
            >
              <ActiveProblemRow
                problem={activeDragItem.problem}
                depth={activeDragItem.depth}
                canManage={canManage}
                isDragging={false}
                allOptions={activeProblems}
                dragOverState={null}
                onEdit={() => {}}
                onStatusChange={() => {}}
                onDelete={() => {}}
                onParentChange={() => {}}
              />
              {activeDragItem.problem.children && activeDragItem.problem.children.length > 0 && (
                <div className="bg-accent/10 border-t border-accent/20 px-4 py-1 flex items-center justify-between text-[11px] text-accent font-semibold">
                  <span>Sub-tree Drag</span>
                  <span>Includes {activeDragItem.problem.children.length} sub-problem{activeDragItem.problem.children.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          ) : activeResolvedDragItem ? (
            <div 
              style={{ width: activeDragRect ? activeDragRect.width / scale : undefined }} 
              className="bg-surface shadow-2xl border-2 border-accent rounded-lg ring-4 ring-accent/20 opacity-95 overflow-hidden backdrop-blur-sm min-w-[760px]"
            >
              <ResolvedRow
                problem={activeResolvedDragItem}
                canManage={canManage}
                isDragging={false}
                onReactivate={() => {}}
                onDelete={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>

      </DndContext>

      <ProblemEditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        allOptions={activeProblems}
        onSave={handleSave}
        saving={createProblem.isPending || updateProblem.isPending}
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setProblemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Remove Problem"
        message={`Are you sure you want to remove "${problemToDelete?.title}" from the problem list? This action cannot be undone.`}
        isDeleting={deleteProblem.isPending}
      />
    </div>
  );
}

