'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isDescendant } from '@/lib/problem-utils';
import type { Problem } from '@/types/problem';

interface ProblemEditModalProps {
  open: boolean;
  onClose: () => void;
  editing: Problem | null;
  allOptions: Problem[];
  saving: boolean;
  onSave: (values: { title: string; icdCode?: string | null; parentId?: string | null }) => void;
}

export function ProblemEditModal({ open, onClose, editing, allOptions, saving, onSave }: ProblemEditModalProps) {
  const [title, setTitle] = useState('');
  const [icdCode, setIcdCode] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? '');
      setIcdCode(editing?.icdCode ?? '');
      setParentId(editing?.parentId ?? '');
      setError('');
    }
  }, [open, editing]);

  if (!open) return null;

  // Filter out the problem being edited itself, any of its descendants, and non-active problems.
  const selectableParents = allOptions.filter((p) => {
    if (p.status !== 'ACTIVE') return false;
    if (editing) {
      if (p.id === editing.id) return false;
      if (isDescendant(allOptions, p.id, editing.id)) return false;
    }
    return true;
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('Problem title is required.');
      return;
    }
    onSave({ title: title.trim(), icdCode: icdCode.trim() || null, parentId: parentId || null });
  };

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center animate-in fade-in duration-150"
    >
      <div className="bg-surface border border-border rounded-[10px] w-[460px] max-h-[80vh] overflow-y-auto shadow-modal">
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border">
          <h2 className="text-[15px] font-bold flex-1 text-text-primary">
            {editing ? 'Edit Problem' : 'Add Problem'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-6 h-6 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-[18px] py-[18px]">
          <div className="flex flex-col gap-1.5 mb-3.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
              Problem Title <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
              placeholder="e.g. Hypertension, Stage 2"
              className={cn(
                'h-[34px] w-full px-2.5 bg-surface border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150',
                error
                  ? 'border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
                  : 'border-border focus:border-accent focus:shadow-accent-focus',
              )}
            />
            {error && <p className="text-[12px] text-red mt-1">{error}</p>}
          </div>

          <div className="flex flex-col gap-1.5 mb-3.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
              ICD-10 Code (optional)
            </label>
            <input
              value={icdCode}
              onChange={(e) => setIcdCode(e.target.value)}
              placeholder="e.g. I10"
              className="h-[34px] w-full px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
              Nest Under (optional)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="h-[34px] w-full px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none cursor-pointer focus:border-accent focus:shadow-accent-focus"
            >
              <option value="">— None (root-level problem) —</option>
              {selectableParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-[18px] py-3 border-t border-border">
          <button
            onClick={onClose}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all duration-150 cursor-pointer disabled:bg-text-muted disabled:border-border-strong disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Problem'}
          </button>
        </div>
      </div>
    </div>
  );
}
