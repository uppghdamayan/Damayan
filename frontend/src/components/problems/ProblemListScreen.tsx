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
} from '@/hooks/useProblems';
import { usePatient } from '@/hooks/usePatients';
import { buildProblemTree, isDescendant } from '@/lib/problem-utils';
import { useAuthStore } from '@/stores/authStore';
import { ActiveProblemTable, ActiveProblemRow } from './ActiveProblemTable';
import { ResolvedProblemTable, ResolvedRow } from './ResolvedProblemTable';
import { ProblemEditModal } from './ProblemEditModal';
import { ProblemListSkeleton } from './ProblemListSkeleton';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import type { Problem, ProblemNode, ProblemStatusValue } from '@/types/problem';

export function ProblemListScreen({ patientId }: { patientId: string }) {
  const { user } = useAuthStore();
  const canManage = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const { data, isLoading } = useProblems(patientId);
  const { data: patient } = usePatient(patientId);
  const createProblem = useCreateProblem(patientId);
  const updateProblem = useUpdateProblem(patientId);
  const deleteProblem = useDeleteProblem(patientId);
  const reorderProblems = useReorderProblems(patientId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Problem | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [problemToDelete, setProblemToDelete] = useState<Problem | null>(null);

  const problems = data?.data ?? [];
  
  const activeProblems = useMemo(() => problems.filter(p => p.status === 'ACTIVE'), [problems]);
  const resolvedProblems = useMemo(() => problems.filter(p => p.status === 'RESOLVED'), [problems]);
  
  const tree = useMemo(() => buildProblemTree(activeProblems), [activeProblems]);

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

  // Drag and drop state
  const [dragOverState, setDragOverState] = useState<{ id: string; isMerge: boolean } | null>(null);
  const [isTableDragging, setIsTableDragging] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState<{ problem: ProblemNode; depth: number } | null>(null);
  const [activeResolvedDragItem, setActiveResolvedDragItem] = useState<Problem | null>(null);
  const [activeDragRect, setActiveDragRect] = useState<DOMRect | null>(null);

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
        toast.success('Problem updated.');
      } else {
        await createProblem.mutateAsync({ title: values.title, icdCode: values.icdCode, parentId: values.parentId ?? undefined });
        toast.success('Problem added to the list.');
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
        ACTIVE: 'Problem reactivated.',
        RESOLVED: 'Problem marked resolved.',
        REMOVED: 'Problem removed from the active list.',
      };
      toast.success(messages[status]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleParentChange = async (p: Problem, newParentId: string | null) => {
    try {
      await updateProblem.mutateAsync({ id: p.id, parentId: newParentId });
      if (newParentId) {
        const parent = activeProblems.find((x) => x.id === newParentId);
        toast.success(`'${p.title}' nested under '${parent?.title || 'Unknown'}'.`);
      } else {
        toast.success(`'${p.title}' moved to top level.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update nesting.');
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
        toast.success('Problem removed.');
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
      const activeItem = flatActiveProblems.find((p) => p.problem.id === active.id);
      setActiveDragItem(activeItem || null);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { over, active } = event;
    const activeData = active.data.current;

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
    if (over.id === 'resolved-table') {
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
      if (isDescendant(activeProblems, newParentId, activeProblem.id)) {
        toast.error('Cannot nest a problem under its own descendant.');
        return;
      }
      handleParentChange(activeProblem, newParentId);
    } else {
      if (activeProblem.parentId !== targetProblem.parentId) {
        if (targetProblem.parentId && isDescendant(activeProblems, targetProblem.parentId, activeProblem.id)) {
          toast.error('Cannot nest a problem under its own descendant.');
          return;
        }
        try {
          handleParentChange(activeProblem, targetProblem.parentId);
        } catch (err) {
          return;
        }
      }

      const oldIndex = flatActiveProblems.findIndex((p) => p.problem.id === active.id);
      const newIndex = flatActiveProblems.findIndex((p) => p.problem.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedList = arrayMove(flatActiveProblems, oldIndex, newIndex);
        handleReorder(
          reorderedList.map((item, index) => ({
            id: item.problem.id,
            sortOrder: index,
          }))
        );
      }
    }
  };

  if (isLoading) return <ProblemListSkeleton />;

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
        }}
      >
        {/* MASTER PROBLEM LIST */}
        <div className="bg-surface border border-border border-l-[3px] border-l-accent rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 rounded-t-lg">
            <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
              📋
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">
              Master Problem List
            </span>
            <span className="ch-badge badge-active text-[9px] font-bold uppercase tracking-[0.5px] px-2 py-0.5 rounded border border-accent text-accent-hover bg-accent-light">
              {activeProblems.length} Active
            </span>
            <span className="ml-auto text-[10px] text-text-muted">
              Drag rows to reorder · Priority auto-sorts within each level
            </span>
          </div>

          <ActiveProblemTable
            nodes={tree}
            flatProblems={flatActiveProblems}
            isTableDragging={isTableDragging}
            activeDragItem={activeDragItem}
            dragOverState={dragOverState}
            allOptions={activeProblems}
            canManage={canManage}
            onEdit={handleEdit}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onParentChange={handleParentChange}
          />
        </div>

        {/* RESOLVED PROBLEMS */}
        <div className="bg-surface border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 rounded-t-lg">
            <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
              ✅
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">
              Resolved Problems
            </span>
            <span className="ch-badge badge-resolved text-[9px] font-bold uppercase tracking-[0.5px] px-2 py-0.5 rounded border border-green-border text-green bg-green-bg">
              {resolvedProblems.length} Resolved
            </span>
          </div>

          <ResolvedProblemTable
            problems={resolvedProblems}
            canManage={canManage}
            onReactivate={(p) => handleStatusChange(p, 'ACTIVE')}
            onDelete={handleDelete}
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

