'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useProblems,
  useCreateProblem,
  useUpdateProblem,
  useDeleteProblem,
  useReorderProblems,
} from '@/hooks/useProblems';
import { usePatient } from '@/hooks/usePatients';
import { buildProblemTree } from '@/lib/problem-utils';
import { useAuthStore } from '@/stores/authStore';
import { ActiveProblemTable } from './ActiveProblemTable';
import { ResolvedProblemTable } from './ResolvedProblemTable';
import { ProblemEditModal } from './ProblemEditModal';
import { ProblemListSkeleton } from './ProblemListSkeleton';
import type { Problem, ProblemStatusValue } from '@/types/problem';

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

  const problems = data?.data ?? [];
  
  const activeProblems = useMemo(() => problems.filter(p => p.status === 'ACTIVE'), [problems]);
  const resolvedProblems = useMemo(() => problems.filter(p => p.status === 'RESOLVED'), [problems]);
  
  const tree = useMemo(() => buildProblemTree(activeProblems), [activeProblems]);
  const rootOptions = useMemo(() => problems.filter((p) => p.parentId === null), [problems]);

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
      toast.success('Problem nesting updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update nesting.');
    }
  };

  const handleDelete = (p: Problem) => {
    deleteProblem.mutate(p.id, {
      onSuccess: () => toast.success('Problem removed.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove problem.'),
    });
  };

  const handleReorder = (items: { id: string; sortOrder: number }[]) => {
    reorderProblems.mutate({ items });
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

      {/* MASTER PROBLEM LIST */}
      <div className="bg-surface border border-border border-l-[3px] border-l-accent rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-lg">
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

        {activeProblems.length === 0 ? (
          <div className="py-8 px-[14px] text-center text-[13px] text-text-muted italic bg-surface rounded-b-lg">
            No active problems recorded.
          </div>
        ) : (
          <ActiveProblemTable
            nodes={tree}
            rootOptions={rootOptions}
            canManage={canManage}
            onEdit={handleEdit}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onReorder={handleReorder}
            onParentChange={handleParentChange}
          />
        )}
      </div>

      {/* RESOLVED PROBLEMS */}
      <div className="bg-surface border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-lg">
          <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
            ✅
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">
            Resolved Problems
          </span>
          <span className="ch-badge badge-resolved ml-auto text-[9px] font-bold uppercase tracking-[0.5px] px-2 py-0.5 rounded border border-border text-text-secondary bg-surface-2">
            {resolvedProblems.length} Resolved
          </span>
        </div>

        {resolvedProblems.length === 0 ? (
          <div className="py-8 px-[14px] text-center text-[13px] text-text-muted italic bg-surface rounded-b-lg">
            No resolved problems.
          </div>
        ) : (
          <ResolvedProblemTable
            problems={resolvedProblems}
            canManage={canManage}
            onReactivate={(p) => handleStatusChange(p, 'ACTIVE')}
            onDelete={handleDelete}
          />
        )}
      </div>


      <ProblemEditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        rootOptions={rootOptions}
        onSave={handleSave}
        saving={createProblem.isPending || updateProblem.isPending}
      />
    </div>
  );
}

