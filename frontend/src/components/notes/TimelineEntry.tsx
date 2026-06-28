"use client";

import React from 'react';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Pin, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimelineNoteView } from '@/lib/notes-utils';
import { NoteFormattedSections } from './NoteFormattedSections';

interface TimelineEntryProps {
  note: TimelineNoteView;
  previousNote: TimelineNoteView | null;
  isOpen: boolean;
  onToggle: () => void;
  onClickEdit: () => void;
  onDelete?: () => void;
}

export function TimelineEntry({
  note,
  previousNote,
  isOpen,
  onToggle,
  onClickEdit,
  onDelete,
}: TimelineEntryProps) {
  const isInitial = note.kind === 'initial';
  const formattedDate = new Date(note.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = new Date(note.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const showEditActions = isInitial || note.status === 'DRAFT';

  return (
    <div 
      className={cn(
        "nt-entry transition-all duration-200 border border-border rounded-card bg-surface overflow-hidden shadow-sm hover:shadow-card",
        isOpen ? "border-l-[3px] border-l-accent bg-accent-light/10" : ""
      )}
    >
      <div 
        onClick={(e) => {
          // Do not toggle if the user is clicking a button or link inside the card
          const target = e.target as HTMLElement;
          if (target.closest('button') || target.closest('a')) {
            return;
          }
          onToggle();
        }}
        className="p-3.5 cursor-pointer flex flex-col gap-2 select-none"
      >
        {/* Header line */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-bold text-[var(--text-primary)]">
                {isInitial ? 'Initial Consultation Note' : 'Progress Note'}
              </span>
              <Badge variant={note.status === 'PUBLISHED' ? 'published' : 'draft'}>
                {note.status}
              </Badge>
              {note.isLatest && (
                <Badge variant="active">Latest Note</Badge>
              )}
              {isInitial && note.status === 'PUBLISHED' && (
                // Inherited badge condition: only show if the Initial Note is published.
                <Badge variant="published" className="flex items-center gap-1 normal-case font-medium">
                  <Pin className="w-2.5 h-2.5 shrink-0" />
                  <span>Inherited by today's note</span>
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-medium">
              {formattedDate} · {formattedTime}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* Edit / View Action */}
            {showEditActions && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClickEdit();
                }}
                className="h-6 w-6 rounded-btn border border-border bg-surface-2 hover:bg-surface-3 text-[var(--text-secondary)] flex items-center justify-center transition-all cursor-pointer"
                title={note.status === 'PUBLISHED' ? 'View Full Note' : 'Edit Draft'}
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
            
            <ChevronDown 
              className={cn(
                "w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 shrink-0",
                isOpen ? "rotate-180 text-accent" : ""
              )}
            />
          </div>
        </div>

        {/* 1-line italic preview of subjective complaint */}
        {!isOpen && note.previewText && (
          <p className="text-[12px] text-[var(--text-secondary)] italic line-clamp-1 mt-0.5 pl-2 border-l-2 border-border-strong">
            {note.previewText}
          </p>
        )}
      </div>

      {/* Expanded SOAP contents using shadcn Collapsible */}
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleContent className="border-t border-border bg-surface p-4">
          <NoteFormattedSections note={note} previousNote={previousNote} />
          
          {/* Action button inside the panel */}
          <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
            {onDelete ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="h-[26px] px-3 rounded-btn text-[11px] font-semibold bg-red/10 text-red border border-red/20 hover:bg-red hover:text-white transition-all cursor-pointer"
              >
                {note.status === 'DRAFT' && !isInitial ? 'Undraft Note' : 'Delete Note'}
              </button>
            ) : (
              <div /> // Spacer to keep Edit button on the right
            )}
            
            {showEditActions && (
              <button
                type="button"
                onClick={onClickEdit}
                className="h-[26px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-[var(--text-secondary)] border border-border hover:bg-surface-3 hover:text-[var(--text-primary)] transition-all cursor-pointer"
              >
                {note.status === 'PUBLISHED' ? 'View Full Note ↗' : 'Edit Draft ↗'}
              </button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
