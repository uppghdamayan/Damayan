import React from 'react';
import { 
  MessageSquare, 
  Microscope, 
  FlaskConical, 
  ClipboardList, 
  Stethoscope, 
  Search, 
  Pill 
} from 'lucide-react';
import { TimelineNoteView, diffListItems } from '@/lib/notes-utils';
import { Badge } from '@/components/ui/badge';

interface NoteFormattedSectionsProps {
  note: TimelineNoteView;
  previousNote: TimelineNoteView | null;
}

export function NoteFormattedSections({ note, previousNote }: NoteFormattedSectionsProps) {
  // Diff diagnostics
  const currentDiags = note.sections.diagnostics || [];
  const prevDiags = previousNote?.sections.diagnostics || null;
  const diagDiff = diffListItems(currentDiags, prevDiags);

  // Diff medications
  const currentMeds = note.sections.medications || [];
  const prevMeds = previousNote?.sections.medications || null;
  const medDiff = diffListItems(currentMeds, prevMeds);

  // Diff assessment
  const currentAssessment = note.sections.assessment || [];
  const prevAssessment = previousNote?.sections.assessment || null;
  const assessmentDiff = diffListItems(currentAssessment, prevAssessment);

  return (
    <div className="flex flex-col gap-4 text-[13px] text-[var(--text-secondary)] leading-relaxed">
      {/* Subjective (Chief Complaint + HPI, or Subjective for progress notes) */}
      {note.sections.subjective && note.sections.subjective.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--blue)] pb-1 w-full text-[var(--blue)] font-bold">
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="text-[11.5px] uppercase tracking-[0.6px]">Subjective</span>
          </div>
          <div className="flex flex-col gap-2 mt-1 pl-1">
            {note.sections.subjective.map((sub, idx) => (
              <div key={idx} className="flex flex-col gap-0.5">
                {note.kind === 'initial' && (
                  <span className="text-[11px] font-semibold text-[var(--text-primary)]">{sub.label}</span>
                )}
                <p className="whitespace-pre-wrap pl-1">{sub.body || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Objective (Physical Exam) */}
      {note.sections.objective && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--amber)] pb-1 w-full text-[var(--amber)] font-bold">
            <Microscope className="w-3.5 h-3.5" />
            <span className="text-[11.5px] uppercase tracking-[0.6px]">Objective</span>
          </div>
          <p className="whitespace-pre-wrap mt-1 pl-2">{note.sections.objective}</p>
        </div>
      )}

      {/* Labs / Imaging */}
      {note.sections.labs && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--purple)] pb-1 w-full text-[var(--purple)] font-bold">
            <FlaskConical className="w-3.5 h-3.5" />
            <span className="text-[11.5px] uppercase tracking-[0.6px]">Labs / Imaging</span>
          </div>
          <p className="whitespace-pre-wrap mt-1 pl-2">{note.sections.labs}</p>
        </div>
      )}

      {/* Assessment */}
      {((note.sections.assessment && note.sections.assessment.length > 0) || assessmentDiff.length > 0) && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--red)] pb-1 w-full text-[var(--red)] font-bold">
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="text-[11.5px] uppercase tracking-[0.6px]">Assessment</span>
          </div>
          <div className="flex flex-col gap-1.5 mt-1 pl-2">
            {assessmentDiff.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  item.status === 'removed' ? 'bg-[var(--text-muted)]' : 'bg-[var(--red)]'
                }`} />
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className={`text-[12px] font-medium ${
                    item.status === 'removed' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'
                  }`}>
                    {item.text}
                  </span>
                  {item.status === 'removed' && (
                    <Badge variant="removed" className="px-1 py-0 h-3 text-[8px]">Removed</Badge>
                  )}
                  {item.status === 'added' && (
                    <Badge variant="saved" className="px-1 py-0 h-3 text-[8px]">New</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan (Non-pharmacologic) */}
      {note.sections.nonPharm && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--green)] pb-1 w-full text-[var(--green)] font-bold">
            <Stethoscope className="w-3.5 h-3.5" />
            <span className="text-[11.5px] uppercase tracking-[0.6px]">Plan</span>
          </div>
          <p className="whitespace-pre-wrap mt-1 pl-2">{note.sections.nonPharm}</p>
        </div>
      )}

      {/* Diagnostics */}
      {((note.sections.diagnostics && note.sections.diagnostics.length > 0) || diagDiff.length > 0) && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--green)] pb-1 w-full text-[var(--green)] font-bold">
            <Search className="w-3.5 h-3.5" />
            <span className="text-[11.5px] uppercase tracking-[0.6px]">Diagnostics</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1 pl-2">
            {diagDiff.map((item, idx) => (
              <React.Fragment key={idx}>
                {item.status === 'removed' ? (
                  <Badge variant="removed" className="border-dashed line-through opacity-70">
                    <span>{item.text}</span>
                    <Badge variant="critical" className="ml-1 px-1 py-0 h-3 text-[8px]">Removed</Badge>
                  </Badge>
                ) : item.status === 'added' ? (
                  <Badge variant="active" className="shadow-sm">
                    <span>{item.text}</span>
                    <Badge variant="saved" className="ml-1 px-1 py-0 h-3 text-[8px]">New</Badge>
                  </Badge>
                ) : (
                  <Badge variant="resolved" className="shadow-sm">
                    <span>{item.text}</span>
                  </Badge>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Medications */}
      {((note.sections.medications && note.sections.medications.length > 0) || medDiff.length > 0) && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--green)] pb-1 w-full text-[var(--green)] font-bold">
            <Pill className="w-3.5 h-3.5" />
            <span className="text-[11.5px] uppercase tracking-[0.6px]">Medications</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1 pl-2">
            {medDiff.map((item, idx) => (
              <React.Fragment key={idx}>
                {item.status === 'removed' ? (
                  <Badge variant="removed" className="border-dashed line-through opacity-70">
                    <span>{item.text}</span>
                    <Badge variant="critical" className="ml-1 px-1 py-0 h-3 text-[8px]">Removed</Badge>
                  </Badge>
                ) : item.status === 'added' ? (
                  <Badge variant="active" className="shadow-sm">
                    <span>{item.text}</span>
                    <Badge variant="saved" className="ml-1 px-1 py-0 h-3 text-[8px]">New</Badge>
                  </Badge>
                ) : (
                  <Badge variant="resolved" className="shadow-sm">
                    <span>{item.text}</span>
                  </Badge>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
