import { useState } from 'react';
import {
  MessageSquare,
  Microscope,
  FlaskConical,
  ClipboardList,
  Stethoscope,
  Search,
  Pill,
  Download,
  Eye
} from 'lucide-react';
import { TimelineNoteView, diffAssessmentItems, diffMedicationItems } from '@/lib/notes-utils';
import { Badge } from '@/components/ui/badge';
import { useAttachmentsByNote, useAttachmentDownloadUrl } from '@/hooks/useAttachments';
import { AttachmentPeekModal } from './AttachmentPeekModal';
import { cn } from '@/lib/utils';

function SubjectiveItemView({ sub, isInitial }: { sub: { label: string; body: string }; isInitial: boolean }) {
  const isPmh = sub.label === 'Past Medical History (PMH)';

  if (isPmh && sub.body) {
    const lines = sub.body.split('\n');
    return (
      <div className="flex flex-col gap-0.5">
        {isInitial && (
          <span className="text-[11px] font-semibold text-[var(--text-primary)]">{sub.label}</span>
        )}
        <div className="flex flex-col gap-1 pl-1">
          {lines.map((line, lIdx) => {
            const match = line.match(/^(Comorbidities|Surgeries|Hospitalizations|Allergies):\s*(.*)$/);
            if (match) {
              const [, label, content] = match;
              return (
                <div key={lIdx} className="leading-relaxed text-[12.5px]">
                  <span className="font-medium text-[var(--text-primary)] mr-1.5">
                    {label}:
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {content || 'None'}
                  </span>
                </div>
              );
            }
            return (
              <p key={lIdx} className="whitespace-pre-wrap text-[12.5px]">{line}</p>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {isInitial && (
        <span className="text-[11px] font-semibold text-[var(--text-primary)]">{sub.label}</span>
      )}
      <p className="whitespace-pre-wrap pl-1 text-[12.5px]">{sub.body || '—'}</p>
    </div>
  );
}

function NoteAttachmentItem({ att }: { att: any }) {
  const { refetch: getDownloadUrl, isFetching } = useAttachmentDownloadUrl(att.id);
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekUrl, setPeekUrl] = useState<string | null>(null);
  const [peekError, setPeekError] = useState(false);

  const handleDownload = async () => {
    if (!att.storageKey) return;
    try {
      const { data: url } = await getDownloadUrl();
      if (url) {
        window.open(url, '_blank');
      }
    } catch (err) {
      console.error('Failed to get download URL', err);
    }
  };

  const handlePeek = async () => {
    if (!att.storageKey) return;
    setPeekOpen(true);
    setPeekUrl(null);
    setPeekError(false);
    try {
      const { data: url } = await getDownloadUrl();
      if (url) {
        setPeekUrl(url);
      } else {
        setPeekError(true);
      }
    } catch (err) {
      console.error('Failed to get preview URL', err);
      setPeekError(true);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between py-1.5 px-2.5 bg-surface-2 border border-border rounded-[4px] w-fit min-w-[200px] max-w-sm gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">{att.tag}</span>
          {att.textResult && (
            <span className="text-[11px] text-[var(--text-secondary)] italic">"{att.textResult}"</span>
          )}
        </div>
        {att.storageKey && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handlePeek}
              disabled={isFetching}
              className="text-[var(--text-muted)] hover:text-accent transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Peek File"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isFetching}
              className="text-[var(--text-muted)] hover:text-accent transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download File"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <AttachmentPeekModal
        open={peekOpen}
        onClose={() => setPeekOpen(false)}
        tag={att.tag}
        mimeType={att.mimeType}
        url={peekUrl}
        isLoading={peekOpen && !peekUrl && !peekError}
        isError={peekError}
      />
    </>
  );
}

function NoteAttachmentsSection({ note }: { note: TimelineNoteView }) {
  const noteType = note.kind === 'initial' ? 'INITIAL_NOTE' : 'PROGRESS_NOTE';
  const { data: attachments, isLoading } = useAttachmentsByNote(noteType, note.id);

  if (isLoading || !attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--purple)] pb-1 w-full text-[var(--purple)] font-bold">
        <FlaskConical className="w-3.5 h-3.5" />
        <span className="text-[11.5px] uppercase tracking-[0.6px]">Labs / Imaging</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-1 pl-2">
        {attachments.map((att) => (
          <NoteAttachmentItem key={att.id} att={att} />
        ))}
      </div>
    </div>
  );
}

function MedicationDiffItem({ item }: { item: { text: string; status: 'existing' | 'added' | 'removed' | 'dose-up' | 'dose-down' | 'dose-changed'; fromDose?: string; toDose?: string } }) {
  return (
    <div className="flex items-center flex-wrap gap-1.5 min-w-0">
      {item.status === 'removed' ? (
        <Badge variant="removed" className="border-dashed line-through opacity-70">{item.text}</Badge>
      ) : item.status === 'added' ? (
        <Badge variant="active" className="shadow-sm">{item.text}</Badge>
      ) : item.status === 'dose-up' || item.status === 'dose-down' || item.status === 'dose-changed' ? (
        <Badge
          variant="resolved"
          className="shadow-sm"
          title={item.fromDose && item.toDose ? `Dose changed from ${item.fromDose} to ${item.toDose}` : undefined}
        >
          {item.text}
        </Badge>
      ) : (
        <Badge variant="resolved" className="shadow-sm">{item.text}</Badge>
      )}
      {item.status === 'removed' && (
        <Badge variant="critical" className="px-1.5 py-0 h-3.5 text-[8.5px] uppercase font-bold tracking-[0.5px]">REMOVED</Badge>
      )}
      {item.status === 'added' && (
        <Badge variant="saved" className="px-1.5 py-0 h-3.5 text-[8.5px] uppercase font-bold tracking-[0.5px]">NEW</Badge>
      )}
      {(item.status === 'dose-up' || item.status === 'dose-down' || item.status === 'dose-changed') && (
        <Badge
          variant={item.status === 'dose-up' ? 'info' : item.status === 'dose-down' ? 'published' : 'draft'}
          className="px-1.5 py-0 h-3.5 text-[8.5px] uppercase font-bold tracking-[0.5px]"
        >
          {item.status === 'dose-up' ? '↑ DOSE' : item.status === 'dose-down' ? '↓ DOSE' : 'DOSE CHANGED'}
        </Badge>
      )}
    </div>
  );
}

interface NoteFormattedSectionsProps {
  note: TimelineNoteView;
  previousNote: TimelineNoteView | null;
}

export function NoteFormattedSections({ note, previousNote }: NoteFormattedSectionsProps) {
  // An Initial Note is the patient's baseline note — it should never diff against a "previous" note.
  const isInitial = note.kind === 'initial';
  const effectivePreviousNote = isInitial ? null : previousNote;


  // Diff medications (dose-aware — flags dose increases/decreases, not just add/remove)
  const currentMedsDetailed = note.sections.medicationsDetailed || [];
  const prevMedsDetailed = effectivePreviousNote?.sections.medicationsDetailed || null;
  const medDiff = diffMedicationItems(currentMedsDetailed, prevMedsDetailed);

  const diagnostics = note.sections.diagnostics || [];
  const diagCol1 = diagnostics.length <= 5 ? diagnostics : diagnostics.slice(0, Math.ceil(diagnostics.length / 2));
  const diagCol2 = diagnostics.length <= 5 ? [] : diagnostics.slice(Math.ceil(diagnostics.length / 2));

  // Diff assessment — identity-aware (by problem id) so an edited problem (e.g.
  // "CKD stage 3b" -> "CKD stage 4") shows as 'updated', not resolved+new.
  const currentAssessmentItems = note.sections.assessmentItems
    || (note.sections.assessment || []).map((title) => ({ title }));
  const prevAssessmentItems = effectivePreviousNote
    ? (effectivePreviousNote.sections.assessmentItems
        || (effectivePreviousNote.sections.assessment || []).map((title) => ({ title })))
    : null;
  const assessmentDiff = diffAssessmentItems(currentAssessmentItems, prevAssessmentItems);

  const isNonDoctor = note.authorRole === 'NURSE' || note.authorRole === 'PHARMACIST';

  if (isNonDoctor && note.sections.subjective && note.sections.subjective.length > 0) {
    return (
      <div className="flex flex-col gap-4 text-[13px] text-[var(--text-secondary)] leading-relaxed">
        <div className="flex flex-col gap-2 pl-1">
          {note.sections.subjective.map((sub, idx) => (
            <SubjectiveItemView key={idx} sub={sub} isInitial={note.kind === 'initial'} />
          ))}
        </div>
        <NoteAttachmentsSection note={note} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-[13px] text-[var(--text-secondary)] leading-relaxed">
      {/* Subjective (Chief Complaint + HPI, or Subjective for progress notes) */}
      {note.sections.subjective && note.sections.subjective.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--blue)] pb-1 w-full text-[var(--blue)] font-bold">
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="text-[11.5px] uppercase tracking-[0.6px]">Subjective</span>
          </div>
          <div className="flex flex-col gap-2.5 mt-1 pl-1">
            {note.sections.subjective.map((sub, idx) => (
              <SubjectiveItemView key={idx} sub={sub} isInitial={note.kind === 'initial'} />
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

      {/* Labs / Imaging (attachment results) */}
      <NoteAttachmentsSection note={note} />

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
                  <span
                    className={`text-[12px] font-medium ${
                      item.status === 'removed' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'
                    }`}
                    title={item.status === 'updated' && item.fromText ? `Updated from "${item.fromText}"` : undefined}
                  >
                    {item.text}
                  </span>
                  {item.status === 'removed' && (
                    <Badge variant="saved" className="px-1.5 py-0 h-3.5 text-[8.5px] uppercase font-bold tracking-[0.5px]">RESOLVED</Badge>
                  )}
                  {item.status === 'added' && (
                    <Badge variant="active" className="px-1.5 py-0 h-3.5 text-[8.5px] uppercase font-bold tracking-[0.5px]">NEW</Badge>
                  )}
                  {item.status === 'updated' && (
                    <Badge variant="info" className="px-1.5 py-0 h-3.5 text-[8.5px] uppercase font-bold tracking-[0.5px]">UPDATED</Badge>
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
      {diagnostics.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--green)] pb-1 w-full text-[var(--green)] font-bold">
            <Search className="w-3.5 h-3.5" />
            <span className="text-[11.5px] uppercase tracking-[0.6px]">Diagnostics</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-1 pl-2 items-start">
            <div className="flex flex-col gap-1.5 min-w-0">
              {diagCol1.map((diag, idx) => (
                <div key={idx} className="flex items-center flex-wrap gap-1.5 min-w-0">
                  <Badge variant="active" className="shadow-sm">{diag}</Badge>
                </div>
              ))}
            </div>
            {diagCol2.length > 0 && (
              <div className="flex flex-col gap-1.5 min-w-0">
                {diagCol2.map((diag, idx) => (
                  <div key={idx + diagCol1.length} className="flex items-center flex-wrap gap-1.5 min-w-0">
                    <Badge variant="active" className="shadow-sm">{diag}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pharmacologic Treatment Remarks */}
      {note.sections.pharm && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--green)] pb-1 w-full text-[var(--green)] font-bold">
            <Pill className="w-3.5 h-3.5" />
            <span className="text-[11.5px] uppercase tracking-[0.6px]">Pharmacologic Treatment Remarks</span>
          </div>
          <p className="whitespace-pre-wrap mt-1 pl-2 text-[12px]">{note.sections.pharm}</p>
        </div>
      )}

      {/* Medications */}
      {((note.sections.medicationsDetailed && note.sections.medicationsDetailed.length > 0) || medDiff.length > 0) && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--green)] pb-1 w-full text-[var(--green)] font-bold">
            <Pill className="w-3.5 h-3.5" />
            <span className="text-[11.5px] uppercase tracking-[0.6px]">Medications</span>
          </div>
          <div className="flex flex-col gap-1.5 mt-1 pl-2">
            {medDiff.map((item, idx) => (
              <MedicationDiffItem key={idx} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
