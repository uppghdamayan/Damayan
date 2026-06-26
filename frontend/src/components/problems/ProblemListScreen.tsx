'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
import { usePatient } from '@/hooks/usePatients';
import { buildProblemTree, isDescendant } from '@/lib/problem-utils';
import { useAuthStore } from '@/stores/authStore';
import { ActiveProblemTable, ActiveProblemRow } from './ActiveProblemTable';
import { ResolvedProblemTable, ResolvedRow } from './ResolvedProblemTable';
import { ProblemLogTable } from './ProblemLogTable';
import { ProblemEditModal } from './ProblemEditModal';
import { ProblemListSkeleton } from './ProblemListSkeleton';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import type { Problem, ProblemNode, ProblemStatusValue } from '@/types/problem';

export function ProblemListScreen({ patientId }: { patientId: string }) {
  const { user } = useAuthStore();
  const canManage = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

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
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);

  // Ref to always hold the latest draft values for cleanup functions (avoids stale closures)
  const draftRef = useRef<{ isEditMode: boolean; draftOrder: string[] | null, draftParents: Record<string, string | null> | null }>({ isEditMode: false, draftOrder: null, draftParents: null });
  // Ref to track which patient's draft has been restored (prevents double-restore)
  const lastRestoredPatientRef = useRef<string | null>(null);

  const draftStorageKey = `damayan_problem_draft_${patientId}`;

  // Keep draftRef in sync so cleanup functions always see current values
  useEffect(() => {
    draftRef.current = { isEditMode, draftOrder, draftParents };
  }, [isEditMode, draftOrder, draftParents]);

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
    if (!lastPublishedEdit || !lastPublishedEdit.editor) return 'System';
    const user = lastPublishedEdit.editor;
    if (user.role === 'DOCTOR') return `Dr. ${user.lastName}`;
    if (user.role === 'NURSE') return `Nurse ${user.lastName}`;
    return `${user.firstName} ${user.lastName}`;
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
    if (!isEditMode || !draftParents) return activeProblems;
    return activeProblems.map(p => {
      if (p.id in draftParents) {
        return { ...p, parentId: draftParents[p.id] };
      }
      return p;
    });
  }, [activeProblems, isEditMode, draftParents]);

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
    setLastAutoSaved(null);
    const saved = localStorage.getItem(`damayan_problem_draft_${patientId}`);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { order: string[]; parents?: Record<string, string | null>; savedAt: string };
      if (Array.isArray(parsed.order) && parsed.order.length > 0) {
        setDraftOrder(parsed.order);
        setDraftParents(parsed.parents || null);
        setIsEditMode(true);
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
        JSON.stringify({ order: draftOrder, parents: draftParents, savedAt: new Date().toISOString() })
      );
      setLastAutoSaved(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, [isEditMode, draftOrder, patientId]);

  // Persist draft to localStorage on unmount (patient switch, tab close) and on page reload
  useEffect(() => {
    const persistDraft = () => {
      const { isEditMode: editMode, draftOrder: order, draftParents: parents } = draftRef.current;
      if (editMode && order) {
        localStorage.setItem(
          `damayan_problem_draft_${patientId}`,
          JSON.stringify({ order, parents, savedAt: new Date().toISOString() })
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
  const [dragOverState, setDragOverState] = useState<{ id: string; isMerge: boolean } | null>(null);
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
    setEditing(null);
    setModalOpen(true);
  };
  const handleEdit = (p: Problem) => {
    setEditing(p);
    setModalOpen(true);
  };

  const handleSave = async (values: { title: string; icdCode?: string | null; parentId?: string | null }) => {
    try {
      if (editing) {
        await updateProblem.mutateAsync({ id: editing.id, title: values.title, icdCode: values.icdCode, parentId: values.parentId });
        toast.success(`'${values.title}' updated successfully.`);
      } else {
        await createProblem.mutateAsync({ title: values.title, icdCode: values.icdCode, parentId: values.parentId ?? undefined });
        toast.success(`'${values.title}' added to the list.`);
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save problem.');
    }
  };

  const handleStatusChange = async (p: Problem, status: ProblemStatusValue) => {
    try {
      await updateProblem.mutateAsync({ id: p.id, status });
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
    if (!isEditMode) setIsEditMode(true);
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

  const handleDelete = (p: Problem) => {
    setProblemToDelete(p);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!problemToDelete) return;
    deleteProblem.mutate(problemToDelete.id, {
      onSuccess: () => {
        toast.success(`'${problemToDelete.title}' has been permanently deleted.`);
        setDeleteModalOpen(false);
        setProblemToDelete(null);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to remove problem.');
      },
    });
  };

  const handleReorder = (items: { id: string; sortOrder: number }[]) => {
    reorderProblems.mutate({ items });
  };

  const handleRevert = () => {
    setIsEditMode(false);
    setDraftOrder(null);
    setDraftParents(null);
    setLastAutoSaved(null);
    localStorage.removeItem(draftStorageKey);
    toast.info('Changes reverted to original order and nesting.');
  };

  // Save Draft: persists to localStorage only — does NOT call the API
  // so other co-doctors never see unpublished edits
  const handleSaveDraft = () => {
    if (!draftOrder) return;
    localStorage.setItem(draftStorageKey, JSON.stringify({ order: draftOrder, parents: draftParents, savedAt: new Date().toISOString() }));
    setLastAutoSaved(new Date());
    toast.success('Draft saved locally. Publish when ready to share with co-doctors.');
  };

  const handlePublish = () => {
    const items = displayFlatProblems.map((item, index) => ({ 
      id: item.problem.id, 
      sortOrder: index,
      ...(draftParents && draftParents[item.problem.id] !== undefined ? { parentId: draftParents[item.problem.id] } : {})
    }));
    reorderProblems.mutate({ items }, {
      onSuccess: () => {
        setIsEditMode(false);
        setDraftOrder(null);
        setDraftParents(null);
        setLastAutoSaved(null);
        localStorage.removeItem(draftStorageKey);
        toast.success('Problem order and nesting published successfully.');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to publish order.'),
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
    if (overElement) {
      const rect = overElement.getBoundingClientRect();
      const x = pointerPosition.current.x - rect.left;
      const isMerge = x > 150;
      setDragOverState({ id: over.id as string, isMerge });
    } else {
      setDragOverState(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setIsTableDragging(false);
    setActiveDragItem(null);
    setActiveResolvedDragItem(null);
    setActiveDragRect(null);
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

    // Dragging from Active
    if (over.id === 'resolved-table' || resolvedProblems.some(p => p.id === over.id)) {
      const activeProblem = flatActiveProblems.find(p => p.problem.id === active.id)?.problem;
      if (activeProblem) {
        handleStatusChange(activeProblem, 'RESOLVED');
      }
      return;
    }

    if (active.id === over.id) return;

    const activeProblem = findProblemById(active.id as string, tree);
    const targetProblem = findProblemById(over.id as string, tree);
    
    if (!activeProblem || !targetProblem) return;

    const overElement = document.getElementById(`row-${over.id}`);
    let isMerge = false;
    if (overElement) {
      const rect = overElement.getBoundingClientRect();
      const x = pointerPosition.current.x - rect.left;
      isMerge = x > 150;
    }

    if (isMerge) {
      const newParentId = targetProblem.id;
      if (activeProblem.id === newParentId) return;
      if (isDescendant(draftActiveProblems, newParentId, activeProblem.id)) {
        toast.error('Cannot nest a problem under its own descendant.');
        return;
      }
      handleParentChange(activeProblem, newParentId);
    } else {
      if (activeProblem.parentId !== targetProblem.parentId) {
        if (targetProblem.parentId && isDescendant(draftActiveProblems, targetProblem.parentId, activeProblem.id)) {
          toast.error('Cannot nest a problem under its own descendant.');
          return;
        }
        try {
          handleParentChange(activeProblem, targetProblem.parentId);
        } catch (err) {
          return;
        }
      }

      const oldIndex = displayFlatProblems.findIndex((p) => p.problem.id === active.id);
      const newIndex = displayFlatProblems.findIndex((p) => p.problem.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedList = arrayMove(displayFlatProblems, oldIndex, newIndex);
        // Enter edit mode — do NOT call API yet
        if (!isEditMode) setIsEditMode(true);
        setDraftOrder(reorderedList.map(item => item.problem.id));
      }
    }
  };

  if (isLoading) return <ProblemListSkeleton />;

  const isOverResolvedTableOrItem = currentOverId === 'resolved-table' || resolvedProblems.some(p => p.id === currentOverId);
  const showResolvedDropOverlay = isOverResolvedTableOrItem && activeDragItem !== null;

  const isOverActiveTableOrItem = currentOverId === 'active-table' || displayFlatProblems.some(p => p.problem.id === currentOverId);
  const showActiveDropOverlay = isOverActiveTableOrItem && activeResolvedDragItem !== null;

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <div className="flex justify-end -mb-2">
          <button
            onClick={handleAdd}
            className="h-8 px-4 rounded-btn text-[12px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all duration-150 cursor-pointer"
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

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 bg-surface-2 rounded-t-lg border-b border-border">
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
              ) : (
                <span className="text-[10px] text-text-muted font-medium bg-surface-3 border border-border px-2 py-1 rounded-[4px]">
                  Drag rows to reorder · Priority auto-sorts within levels
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
            canManage={canManage}
            isEditMode={isEditMode}
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

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 bg-surface-2 rounded-t-lg border-b border-border">
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
          </div>

          <ResolvedProblemTable
            problems={resolvedProblems}
            canManage={canManage}
            onReactivate={(p) => handleStatusChange(p, 'ACTIVE')}
            onDelete={handleDelete}
          />
        </div>

        {/* PROBLEM LOGS */}
        <div 
          className="bg-surface border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] relative overflow-hidden transition-all duration-200 min-h-[140px]"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 bg-surface-2 rounded-t-lg border-b border-border">
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

        {/* Drag Overlays can be placed here */}
        <DragOverlay>
          {activeDragItem ? (
            <div 
              style={{ width: activeDragRect?.width }} 
              className="bg-surface shadow-lg border border-accent rounded ring-2 ring-accent/20 opacity-60 overflow-hidden"
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
            </div>
          ) : activeResolvedDragItem ? (
            <div 
              style={{ width: activeDragRect?.width }} 
              className="bg-surface shadow-lg border border-accent rounded ring-2 ring-accent/20 opacity-60 overflow-hidden"
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

