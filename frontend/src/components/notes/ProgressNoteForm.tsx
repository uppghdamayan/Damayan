import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  progressNoteDraftSchema, 
  progressNotePublishSchema, 
  ProgressNoteDraftValues 
} from '@/lib/validation/progress-note-schema';
import { 
  useProgressNote, 
  useCreateProgressNote, 
  useUpdateProgressNote, 
  usePublishProgressNote,
  useCopyForwardData
} from '@/hooks/useProgressNotes';
import { useAutoSave } from '@/hooks/useAutoSave';
import { VitalsSummaryRow } from './VitalsSummaryRow';
import { TagInputField } from './TagInputField';
import { NoteStatusBadge } from './NoteStatusBadge';
import { SaveIcon, SendIcon, PlusIcon, TrashIcon } from 'lucide-react';
import type { MedUnitValue } from '@/types/medication';

interface ProgressNoteFormProps {
  patientId: string;
  noteId?: string; // If null/undefined, we are creating a new one
  onClose: () => void;
}

export function ProgressNoteForm({ patientId, noteId, onClose }: ProgressNoteFormProps) {
  const { data: note, isLoading: noteLoading } = useProgressNote(noteId || null);
  const { data: copyForward, isLoading: copyLoading } = useCopyForwardData(patientId);
  const createMutation = useCreateProgressNote(patientId);
  const updateMutation = useUpdateProgressNote(patientId);
  const publishMutation = usePublishProgressNote(patientId);

  const [publishError, setPublishError] = useState<string | null>(null);

  const form = useForm<ProgressNoteDraftValues>({
    resolver: zodResolver(progressNoteDraftSchema),
    defaultValues: {
      subjective: '',
      objective: '',
      mgmtNonpharm: '',
      diagnostics: [],
      problemListSnapshot: [],
      medicationSnapshot: [],
      visitDatetime: new Date().toISOString(),
    },
  });

  useEffect(() => {
    if (noteId && note) {
      form.reset({
        subjective: note.subjective,
        objective: note.objective,
        mgmtNonpharm: note.mgmtNonpharm,
        diagnostics: note.diagnostics,
        problemListSnapshot: note.problemListSnapshot,
        medicationSnapshot: note.medicationSnapshot,
        visitDatetime: note.createdAt,
      });
    } else if (!noteId && !copyLoading) {
      // Check local storage for drafts
      const draft = localStorage.getItem(`damayan:draft:${patientId}:progress`);
      if (draft) {
        try {
          form.reset(JSON.parse(draft));
          return;
        } catch (e) {}
      }
      
      // If no draft, use copy forward
      form.reset({
        subjective: '',
        objective: '',
        mgmtNonpharm: '',
        diagnostics: [],
        problemListSnapshot: (copyForward?.activeProblems || []).map(p => ({
          title: p.title,
          icdCode: p.icdCode || undefined
        })),
        medicationSnapshot: copyForward?.activeMedications || [],
        visitDatetime: new Date().toISOString(),
      });
    }
  }, [note, noteId, copyLoading, form, patientId, copyForward]);

  const formValues = form.watch();

  const handleSave = (data: ProgressNoteDraftValues) => {
    if (noteId) {
      updateMutation.mutate({ id: noteId, data });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          // Typically we'd get the new note ID and switch to update mode
          // But since the NoteTimeline is managing the ID, we might need to rely on the parent component
          // to react to the invalidateQueries and open the newly created draft.
          onClose(); // Temporary: close form to let timeline refresh
        }
      });
    }
  };

  // We only auto-save if we already have an ID (i.e., we are updating a draft)
  useAutoSave(formValues, handleSave, `damayan:draft:${patientId}:progress`, 30000);

  const handlePublish = async () => {
    setPublishError(null);
    const publishCheck = progressNotePublishSchema.safeParse(formValues);
    if (!publishCheck.success) {
      setPublishError("Please fill out Subjective and Objective fields.");
      return;
    }

    if (noteId) {
      updateMutation.mutate({ id: noteId, data: formValues }, {
        onSuccess: () => {
          publishMutation.mutate(noteId, {
            onSuccess: () => {
              localStorage.removeItem(`damayan:draft:${patientId}:progress`);
              onClose();
            }
          });
        }
      });
    } else {
      createMutation.mutate(formValues, {
        onSuccess: (newNote) => {
          publishMutation.mutate(newNote.id, {
            onSuccess: () => {
              localStorage.removeItem(`damayan:draft:${patientId}:progress`);
              onClose();
            }
          });
        }
      });
    }
  };

  if ((noteId && noteLoading) || (!noteId && copyLoading)) {
    return <div className="p-6 animate-pulse text-[var(--text-muted)]">Loading workspace...</div>;
  }

  const isSaving = updateMutation.isPending || createMutation.isPending;

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-border sticky top-0 z-10">
        <div className="flex flex-col">
          <span className="text-[12px] font-bold text-[var(--text-primary)]">Progress Note</span>
          <span className="text-[10px] text-[var(--text-muted)]">{new Date().toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleSave(formValues)} disabled={isSaving} className="sec-btn">
            <SaveIcon className="w-3.5 h-3.5" /> Save
          </button>
          {note?.status !== 'PUBLISHED' && (
            <button onClick={handlePublish} disabled={publishMutation.isPending} className="sec-btn primary">
              <SendIcon className="w-3.5 h-3.5" /> Publish
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {publishError && (
          <div className="p-3 bg-red-bg border border-red-border rounded-card text-red text-[12px] font-medium">
            {publishError}
          </div>
        )}

        <VitalsSummaryRow patientId={patientId} />

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Subjective</label>
          <textarea
            {...form.register('subjective')}
            className="w-full px-2.5 py-2 border border-border rounded-btn text-[13px] outline-none min-h-[80px]"
            disabled={note?.status === 'PUBLISHED'}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Objective</label>
          <textarea
            {...form.register('objective')}
            className="w-full px-2.5 py-2 border border-border rounded-btn text-[13px] outline-none min-h-[80px]"
            disabled={note?.status === 'PUBLISHED'}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Problem List (Snapshot)</label>
          <Controller
            control={form.control}
            name="problemListSnapshot"
            render={({ field }) => (
              <TagInputField
                value={field.value || []}
                onChange={field.onChange}
                placeholder="Type problem name and press Enter"
                isObjectFormat={true}
              />
            )}
          />
        </div>

        {/* Snapshot Medications Editor */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Medications (Snapshot)</label>
          <Controller
            control={form.control}
            name="medicationSnapshot"
            render={({ field }) => {
              const meds = field.value || [];
              return (
                <div className="flex flex-col gap-2 border border-border p-3 rounded-card">
                  {meds.map((med, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-surface-2 border border-border rounded-btn">
                      <span className="text-[12px] font-medium text-[var(--text-primary)]">
                        {med.name} {med.dose}{med.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const newMeds = [...meds];
                          newMeds.splice(idx, 1);
                          field.onChange(newMeds);
                        }}
                        className="text-[var(--text-muted)] hover:text-red transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-2">
                    <input id="newMedName" placeholder="Name" className="h-[28px] px-2 text-[12px] rounded border w-[120px]" />
                    <input id="newMedDose" type="number" placeholder="Dose" className="h-[28px] px-2 text-[12px] rounded border w-[60px]" />
                    <select id="newMedUnit" className="h-[28px] px-1 text-[12px] rounded border w-[70px]">
                      <option value="MG">MG</option>
                      <option value="G">G</option>
                      <option value="MCG">MCG</option>
                      <option value="ML">ML</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const nameEl = document.getElementById('newMedName') as HTMLInputElement;
                        const doseEl = document.getElementById('newMedDose') as HTMLInputElement;
                        const unitEl = document.getElementById('newMedUnit') as HTMLSelectElement;
                        if (nameEl.value && doseEl.value) {
                          field.onChange([...meds, { name: nameEl.value, dose: parseFloat(doseEl.value), unit: unitEl.value }]);
                          nameEl.value = '';
                          doseEl.value = '';
                        }
                      }}
                      className="h-[28px] px-2 bg-surface-2 border text-[11px] rounded flex items-center gap-1"
                    >
                      <PlusIcon className="w-3 h-3" /> Add
                    </button>
                  </div>
                </div>
              );
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Diagnostics</label>
          <Controller
            control={form.control}
            name="diagnostics"
            render={({ field }) => (
              <TagInputField
                value={field.value || []}
                onChange={field.onChange}
                placeholder="Type test name and press Enter"
                isObjectFormat={false}
              />
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Non-Pharm Management</label>
          <textarea
            {...form.register('mgmtNonpharm')}
            className="w-full px-2.5 py-2 border border-border rounded-btn text-[13px] outline-none min-h-[60px]"
            disabled={note?.status === 'PUBLISHED'}
          />
        </div>
      </div>
    </div>
  );
}
