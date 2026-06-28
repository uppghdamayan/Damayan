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
import { usePatient } from '@/hooks/usePatients';
import { useLatestVitals } from '@/hooks/useVitals';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useMedications } from '@/hooks/useMedications';
import { buildMedicationSuggestions } from '@/lib/medication-utils';
import { VitalsSummaryRow } from './VitalsSummaryRow';
import { TagInputField } from './TagInputField';
import { TrashIcon } from 'lucide-react';
import { formatBloodPressure, formatTemperature } from '@/lib/vitals-utils';
import { Badge } from '@/components/ui/badge';
import { ComboboxInput } from '@/components/ui/ComboboxInput';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/uiStore';

interface ProgressNoteFormProps {
  patientId: string;
  noteId?: string; // If null/undefined, we are creating a new one
  onClose: () => void;
}

function PatientContextBlock({ patientId, copyForward }: { patientId: string; copyForward: any }) {
  const { data: patient } = usePatient(patientId);
  const { data: vitals } = useLatestVitals(patientId);

  const activeProblemsStr = copyForward?.activeProblems?.length > 0 
    ? copyForward.activeProblems.map((p: any) => p.title).join(', ') 
    : 'None';
  const currentMedsStr = copyForward?.activeMedications?.length > 0
    ? copyForward.activeMedications.map((m: any) => m.name).join(', ')
    : 'None';
  const vitalsStr = vitals 
    ? `BP ${formatBloodPressure(vitals.sbp, vitals.dbp)}, HR ${vitals.heartRate ?? '-'}, Temp ${formatTemperature(Number(vitals.temperature))}` 
    : 'None';

  return (
    <details className="border border-border rounded-lg overflow-hidden bg-surface mb-3" open>
      <summary className="flex items-center gap-2 px-2.5 py-[7px] bg-[rgba(10,110,95,0.1)] border-b border-accent-mid text-accent-hover font-bold text-[10px] uppercase tracking-[0.5px] cursor-pointer select-none">
        ▼ PATIENT CONTEXT
      </summary>
      <div className="bg-surface py-2 px-3 flex flex-col gap-2">
        <div className="flex items-center gap-[7px] px-2.5 py-1 border-b border-border last:border-b-0 text-[11px]">
          <span className="text-text-secondary font-semibold shrink-0">Active Problems:</span>
          <span className="font-mono text-[10px] text-text-primary">{activeProblemsStr}</span>
        </div>
        <div className="flex items-center gap-[7px] px-2.5 py-1 border-b border-border last:border-b-0 text-[11px]">
          <span className="text-text-secondary font-semibold shrink-0">Current Medications:</span>
          <span className="font-mono text-[10px] text-text-primary">{currentMedsStr}</span>
        </div>
        <div className="flex items-center gap-[7px] px-2.5 py-1 border-b border-border last:border-b-0 text-[11px]">
          <span className="text-text-secondary font-semibold shrink-0">Latest Vitals:</span>
          <span className="font-mono text-[10px] text-text-primary">{vitalsStr}</span>
        </div>
        <div className="flex items-center gap-[7px] px-2.5 py-1 border-b border-border last:border-b-0 text-[11px]">
          <span className="text-red font-semibold shrink-0">Allergies:</span>
          <span className="font-mono text-[10px] text-red font-bold">N/A</span>
        </div>
      </div>
    </details>
  );
}

export function ProgressNoteForm({ patientId, noteId, onClose }: ProgressNoteFormProps) {
  const { data: note, isLoading: noteLoading } = useProgressNote(noteId || null);
  const { data: copyForward, isLoading: copyLoading } = useCopyForwardData(patientId);
  const createMutation = useCreateProgressNote(patientId);
  const updateMutation = useUpdateProgressNote(patientId);
  const publishMutation = usePublishProgressNote(patientId);
  const { openExistingProgressNote } = useUiStore();

  const [publishError, setPublishError] = useState<string | null>(null);

  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
    const [newMedFormulation, setNewMedFormulation] = useState('');
  const [newMedInstructions, setNewMedInstructions] = useState('');
  const [newMedQuantity, setNewMedQuantity] = useState('');

  const { data: patientMedicationsResponse } = useMedications(patientId);
  const patientMedications = patientMedicationsResponse?.data || [];
  const nameOptions = buildMedicationSuggestions(patientMedications);

  const form = useForm<ProgressNoteDraftValues>({
    resolver: zodResolver(progressNoteDraftSchema),
    defaultValues: {
      subjective: '',
      objective: '',
      labs: '',
      mgmtNonpharm: '',
      diagnostics: [],
      problemListSnapshot: [],
      medicationSnapshot: [],
      visitDatetime: new Date().toISOString(),
    },
  });

  useEffect(() => {
    if (noteId && note) {
      const draftProblems = (note.problemListSnapshot as any[]) || [];
      const validProblems = draftProblems.filter((p: any) => p && (typeof p === 'string' ? p.trim() : p.title)).map((p: any) => typeof p === 'string' ? { title: p } : p);

      const draftMeds = (note.medicationSnapshot as any[]) || [];
      const validMeds = draftMeds.filter((m: any) => m && (typeof m === 'string' ? m.trim() : m.name)).map((m: any) => typeof m === 'string' ? { name: m, dose: '' } : m);

      form.reset({
        subjective: note.subjective,
        objective: note.objective,
        labs: (note as any).labs || '',
        mgmtNonpharm: note.mgmtNonpharm || '',
        diagnostics: note.diagnostics || [],
        problemListSnapshot: validProblems.length > 0
          ? validProblems
          : (copyForward?.activeProblems || []).map((p: any) => ({ title: p.title, icdCode: p.icdCode || undefined })),
        medicationSnapshot: validMeds.length > 0
          ? validMeds
          : (copyForward?.activeMedications || []).map((m: any) => ({
              name: m.name,
              dose: m.dose || undefined,
              formulation: m.formulation || undefined,
              quantity: m.quantity || undefined,
              instructions: m.instructions || undefined,
            })),
        visitDatetime: note.createdAt,
      });
    } else if (!noteId && !copyLoading) {
      const draft = localStorage.getItem(`damayan:draft:${patientId}:progress`);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          const draftProblems = parsed.problemListSnapshot as any[] || [];
          const validProblems = draftProblems.filter((p: any) => p && (typeof p === 'string' ? p.trim() : p.title)).map((p: any) => typeof p === 'string' ? { title: p } : p);
          
          const draftMeds = parsed.medicationSnapshot as any[] || [];
          const validMeds = draftMeds.filter((m: any) => m && (typeof m === 'string' ? m.trim() : m.name)).map((m: any) => typeof m === 'string' ? { name: m, dose: '' } : {
            name: m.name,
            dose: m.dose || undefined,
            formulation: m.formulation || undefined,
            quantity: m.quantity || undefined,
            instructions: m.instructions || undefined,
          });

          if (validProblems.length === 0) {
            parsed.problemListSnapshot = (copyForward?.activeProblems || []).map((p: any) => ({ title: p.title, icdCode: p.icdCode || undefined }));
          } else {
            parsed.problemListSnapshot = validProblems;
          }

          if (validMeds.length === 0) {
            parsed.medicationSnapshot = (copyForward?.activeMedications || []).map((m: any) => ({
              name: m.name,
              dose: m.dose || undefined,
              formulation: m.formulation || undefined,
              quantity: m.quantity || undefined,
              instructions: m.instructions || undefined,
            }));
          } else {
            parsed.medicationSnapshot = validMeds;
          }
          
          form.reset(parsed);
          return;
        } catch (e) {}
      }
      form.reset({
        subjective: '',
        objective: '',
        labs: '',
        mgmtNonpharm: '',
        diagnostics: [],
        problemListSnapshot: (copyForward?.activeProblems || []).map((p: any) => ({
          title: p.title,
          icdCode: p.icdCode || undefined
        })),
        medicationSnapshot: (copyForward?.activeMedications || []).map((m: any) => ({
          name: m.name,
          dose: m.dose || undefined,
          formulation: m.formulation || undefined,
          quantity: m.quantity || undefined,
          instructions: m.instructions || undefined,
        })),
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
        onSuccess: (newNote) => {
          openExistingProgressNote(patientId, newNote.id);
        }
      });
    }
  };

  useAutoSave(formValues, (data) => {
    localStorage.setItem(`damayan:draft:${patientId}:progress`, JSON.stringify(data));
  }, `damayan:draft:${patientId}:progress`, 5000);

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
  const isPublished = note?.status === 'PUBLISHED';

  return (
    <div className="flex flex-col h-full bg-surface-2">
      {/* Sticky header */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10 shrink-0 bg-accent-light border-b border-accent-mid">
        <div className="flex flex-col">
          <span className="text-[13px] font-bold flex items-center gap-2 text-accent-hover">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Progress Note
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-green flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" fill="var(--green-border)" />
              <path d="M3 5l1.5 1.5L7 3.5" stroke="white" strokeWidth="1.2" />
            </svg>
            Autosaved
          </span>
          <Badge variant={isPublished ? 'active' : 'draft'}>
            {isPublished ? 'Published' : 'Draft'}
          </Badge>
          {!isPublished && (
            <div className="flex items-center gap-2 ml-2">
              <Button 
                onClick={() => handleSave(formValues)} 
                disabled={isSaving} 
                variant="outline" 
                size="xs"
                className="h-6 px-2.5 text-[11px] font-semibold bg-surface-2 hover:bg-surface-3 border-border text-text-secondary"
              >
                Save
              </Button>
              <Button 
                onClick={handlePublish} 
                disabled={publishMutation.isPending} 
                variant="default" 
                size="xs"
                className="h-6 px-2.5 text-[11px] font-semibold bg-accent hover:bg-accent-hover text-white border-accent-hover"
              >
                Finalize
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {publishError && (
          <div className="p-3 bg-red-bg border border-red-border rounded-lg text-red text-[12px] font-medium">
            {publishError}
          </div>
        )}

        <PatientContextBlock patientId={patientId} copyForward={copyForward} />

        <div id="notes-workspace-container" className="flex flex-col">
          <VitalsSummaryRow patientId={patientId} />

          <div className="flex flex-col gap-4">

            {/* SUBJECTIVE */}
            <div className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-[7px]">
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface-3 shrink-0">💬</div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">
                  Subjective <span className="text-red ml-0.5">*</span>
                </span>
              </div>
              <div className="p-[14px]">
                <textarea
                  {...form.register('subjective')}
                  className="w-full min-h-[100px] px-2.5 py-1.5 bg-white border-[1.5px] border-border-strong rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter subjective findings..."
                  disabled={isPublished}
                />
              </div>
            </div>

            {/* OBJECTIVE */}
            <div className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-[7px]">
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface-3 shrink-0">🔬</div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">
                  Objective <span className="text-red ml-0.5">*</span>
                </span>
              </div>
              <div className="p-[14px]">
                <textarea
                  {...form.register('objective')}
                  className="w-full min-h-[100px] px-2.5 py-1.5 bg-white border-[1.5px] border-border-strong rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter objective findings..."
                  disabled={isPublished}
                />
              </div>
            </div>

            {/* LABS & IMAGING */}
            <div className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-[7px]">
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface-3 shrink-0">🧪</div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">Results of Labs or Imaging</span>
              </div>
              <div className="p-[14px]">
                <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-accent-mid mb-1.5 pb-1 border-b border-border">New Results</div>
                <textarea
                  {...form.register('labs')}
                  className="w-full min-h-[50px] px-2.5 py-1.5 bg-white border-[1.5px] border-border-strong rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter new lab/imaging results..."
                  disabled={isPublished}
                />
              </div>
            </div>

            {/* PROBLEM LIST */}
            <div className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-[7px]">
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface-3 shrink-0">📊</div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">Current Problem List</span>
              </div>
              <div className="p-[14px]">
                <Controller
                  control={form.control}
                  name="problemListSnapshot"
                  render={({ field }) => (
                    <div className="flex flex-col gap-1">
                      {field.value?.map((prob: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 py-1.5 border-b border-border last:border-b-0 text-[12px] text-text-primary">
                          <div className="w-2 h-2 rounded-full bg-accent-mid shrink-0"></div>
                          <div className="flex-1 min-w-0 truncate">
                            {typeof prob === 'string' ? prob : prob.title}
                            {typeof prob !== 'string' && prob.icdCode && (
                              <span className="font-mono text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border ml-2">
                                {prob.icdCode}
                              </span>
                            )}
                          </div>
                          {!isPublished && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => {
                                const newProbs = [...(field.value || [])];
                                newProbs.splice(idx, 1);
                                field.onChange(newProbs);
                              }}
                              className="text-text-muted hover:text-red transition-colors w-6 h-6 rounded-md"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {!isPublished && (
                        <div className="grid grid-cols-12 gap-2.5 mt-3 pt-3 border-t border-border bg-surface-2 p-3 rounded-card">
                          <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-text-secondary uppercase">Problem Title <span className="text-red">*</span></label>
                            <input id="newProbTitle" placeholder="e.g. Hypertension" className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]" />
                          </div>
                          <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-text-secondary uppercase">ICD-10 Code</label>
                            <input id="newProbIcd" placeholder="e.g. I10" className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]" />
                          </div>
                          <div className="col-span-12 flex justify-end mt-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="xs"
                              onClick={() => {
                                const titleEl = document.getElementById('newProbTitle') as HTMLInputElement;
                                const icdEl = document.getElementById('newProbIcd') as HTMLInputElement;
                                if (titleEl.value.trim()) {
                                  const newProbs = [...(field.value || []), { title: titleEl.value.trim(), icdCode: icdEl.value.trim() || undefined }];
                                  field.onChange(newProbs);
                                  titleEl.value = '';
                                  icdEl.value = '';
                                }
                              }}
                              className="h-[28px] px-3.5 bg-surface border border-border text-text-secondary hover:bg-surface-3 hover:text-text-primary rounded font-medium text-[11px] flex items-center gap-1 transition-all"
                            >
                              + Add Problem
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                />
              </div>
            </div>

            {/* NON-PHARMACOLOGIC */}
            <div className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-[7px]">
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface-3 shrink-0">🏃</div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">Non-pharmacologic Management</span>
              </div>
              <div className="p-[14px]">
                <textarea
                  {...form.register('mgmtNonpharm')}
                  className="w-full min-h-[60px] px-2.5 py-1.5 bg-white border-[1.5px] border-border-strong rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter non-pharmacologic management..."
                  disabled={isPublished}
                />
              </div>
            </div>

            {/* DIAGNOSTICS */}
            <div className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden" style={{ overflow: 'visible' }}>
              <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-[7px]">
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface-3 shrink-0">🔍</div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">Diagnostics</span>
              </div>
              <div className="p-[14px]">
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
            </div>

            {/* MEDICATIONS */}
            <div className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-[7px]">
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface-3 shrink-0">💊</div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">Current Medication List</span>
              </div>
              <div className="p-[14px]">
                <Controller
                  control={form.control}
                  name="medicationSnapshot"
                  render={({ field }) => {
                    const meds = field.value || [];
                    return (
                      <div className="flex flex-col gap-1">
                        {meds.map((med: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 py-1.5 border-b border-border last:border-b-0 text-[12px] text-text-primary">
                            <div className="flex-1 min-w-0 truncate">
                              <strong>{typeof med === 'string' ? med : med.name}</strong> 
                              {typeof med !== 'string' && med.dose && (
                                <span className="font-mono text-accent font-semibold ml-1.5">{med.dose}</span>
                              )}
                              {typeof med !== 'string' && med.formulation && (
                                <span className="text-text-secondary ml-1.5">{med.formulation}</span>
                              )}
                              {typeof med !== 'string' && med.quantity && (
                                <span className="text-text-secondary font-medium ml-1.5">Qty: {med.quantity}</span>
                              )}
                              {typeof med !== 'string' && med.instructions && (
                                <span className="text-[10px] text-text-muted ml-2">{med.instructions}</span>
                              )}
                            </div>
                            {!isPublished && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                  const newMeds = [...meds];
                                  newMeds.splice(idx, 1);
                                  field.onChange(newMeds);
                                }}
                                className="text-text-muted hover:text-red transition-colors w-6 h-6 rounded-md"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {!isPublished && (
                          <div className="grid grid-cols-12 gap-2.5 mt-3 pt-3 border-t border-border bg-surface-2 p-3 rounded-card">
                            <div className="col-span-12 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Medication Name</label>
                              <ComboboxInput
                                value={newMedName}
                                onChange={setNewMedName}
                                options={nameOptions}
                                placeholder="e.g. Lisinopril"
                                className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]"
                              />
                            </div>
                            <div className="col-span-12 md:col-span-12 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Dose</label>
                              <input 
                                type="text" 
                                value={newMedDose}
                                onChange={(e) => setNewMedDose(e.target.value)}
                                placeholder="e.g. 10mg" 
                                className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]" 
                              />
                            </div>
                            <div className="col-span-12 md:col-span-6 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Formulation</label>
                              <input 
                                value={newMedFormulation}
                                onChange={(e) => setNewMedFormulation(e.target.value)}
                                placeholder="e.g. Tablet, Syrup" 
                                className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]" 
                              />
                            </div>
                            <div className="col-span-12 md:col-span-6 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Quantity</label>
                              <input 
                                type="number"
                                value={newMedQuantity}
                                onChange={(e) => setNewMedQuantity(e.target.value)}
                                placeholder="e.g. 30" 
                                className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]" 
                              />
                            </div>
                            <div className="col-span-12 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Sig / Instructions</label>
                              <input 
                                value={newMedInstructions}
                                onChange={(e) => setNewMedInstructions(e.target.value)}
                                placeholder="e.g. Take 1 tab daily" 
                                className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]" 
                              />
                            </div>
                            <div className="col-span-12 flex justify-end mt-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="xs"
                                onClick={() => {
                                  if (newMedName.trim() && newMedDose.trim()) {
                                    field.onChange([...meds, { 
                                      name: newMedName.trim(), 
                                      dose: newMedDose.trim(), 
                                      formulation: newMedFormulation.trim() || undefined,
                                      quantity: newMedQuantity ? parseInt(newMedQuantity, 10) : undefined,
                                      instructions: newMedInstructions.trim() 
                                    }]);
                                    setNewMedName('');
                                    setNewMedDose('');
                                    setNewMedFormulation('');
                                    setNewMedQuantity('');
                                    setNewMedInstructions('');
                                  }
                                }}
                                className="h-[28px] px-3.5 bg-surface border border-border text-text-secondary hover:bg-surface-3 hover:text-text-primary rounded font-medium text-[11px] flex items-center gap-1 transition-all"
                              >
                                + Add Medication
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

