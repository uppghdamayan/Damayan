import { NoteStatusBadge } from './NoteStatusBadge';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NoteCardProps {
  note: any;
  onClickEdit: () => void;
}

export function NoteCard({ note, onClickEdit }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isInitial = note.visit?.visitType === 'INITIAL' || note.chiefComplaint !== undefined;

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden shadow-sm hover:shadow-card transition-shadow">
      <div 
        className="flex flex-col p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-[var(--text-primary)]">
              {isInitial ? 'Initial Note' : 'Progress Note'}
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              {new Date(note.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <NoteStatusBadge status={note.status} />
            {expanded ? <ChevronUpIcon className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDownIcon className="w-4 h-4 text-[var(--text-muted)]" />}
          </div>
        </div>
        
        {/* Preview snippet */}
        {!expanded && (
          <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2 mt-1">
            {isInitial ? note.chiefComplaint : note.subjective}
          </p>
        )}

        {expanded && (
          <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-border">
            {isInitial ? (
              <>
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Chief Complaint</span>
                  <p className="text-[12px] mt-0.5">{note.chiefComplaint}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">HPI</span>
                  <p className="text-[12px] mt-0.5 whitespace-pre-wrap">{note.hpi}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Subjective</span>
                  <p className="text-[12px] mt-0.5 whitespace-pre-wrap">{note.subjective}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Objective</span>
                  <p className="text-[12px] mt-0.5 whitespace-pre-wrap">{note.objective}</p>
                </div>
              </>
            )}
            
            <button 
              className="mt-2 text-[11px] font-semibold text-accent hover:underline self-start"
              onClick={(e) => {
                e.stopPropagation();
                onClickEdit();
              }}
            >
              {note.status === 'PUBLISHED' ? 'View Full Note' : 'Edit Draft'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
