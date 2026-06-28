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
  useCopyForwardData,
  useDeleteProgressNote
} from '@/hooks/useProgressNotes';
import { usePatient } from '@/hooks/usePatients';
import { useLatestVitals } from '@/hooks/useVitals';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useMedications } from '@/hooks/useMedications';
import { buildMedicationSuggestions } from '@/lib/medication-utils';
import { VitalsSummaryRow } from './VitalsSummaryRow';
import { TagInputField } from './TagInputField';
import { TrashIcon, Trash2, FileText, Save, Check } from 'lucide-react';
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
  const deleteMutation = useDeleteProgressNote(patientId);
  const { openExistingProgressNote, setActiveScreen, setDocumentationPanelOpen } = useUiStore();

  const [publishError, setPublishError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

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

  const handleDraftToggle = () => {
    if (noteId) {
      deleteMutation.mutate(noteId, {
        onSuccess: () => {
          localStorage.removeItem(`damayan:draft:${patientId}:progress`);
          onClose();
        }
      });
    } else {
      createMutation.mutate(formValues, {
        onSuccess: (newNote) => {
          setLastSaved(new Date());
          onClose();
          setDocumentationPanelOpen(false);
          setActiveScreen('note-timeline');
        }
      });
    }
  };

  useAutoSave(formValues, (data) => {
    localStorage.setItem(`damayan:draft:${patientId}:progress`, JSON.stringify(data));
    setLastSaved(new Date());
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
              setDocumentationPanelOpen(false);
              setActiveScreen('note-timeline');
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
              setDocumentationPanelOpen(false);
              setActiveScreen('note-timeline');
            }
          });
        }
      });
    }
  };

  if ((noteId && noteLoading) || (!noteId && copyLoading)) {
    return <div className="p-6 animate-pulse text-[var(--text-muted)]">Loading workspace...</div>;
  }

  const isSaving = updateMutation.isPending || createMutation.isPending || publishMutation.isPending;
  const isPublished = note?.status === 'PUBLISHED';
  const isDisabled = isPublished || isSaving || deleteMutation.isPending;
  const isUpdateActive = !!form.formState.isDirty;

  return (
    <div className="flex flex-col h-full bg-surface-2 panel-container">
      <style>{`
        .panel-container {
          container-type: inline-size;
        }
        @container (max-width: 410px) {
          .title-text {
            display: none !important;
          }
          .btn-text {
            display: none !important;
          }
          .header-btn {
            padding-left: 0.5rem !important;
            padding-right: 0.5rem !important;
            gap: 0 !important;
          }
        }
        @keyframes slight-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .blink-animation {
          animation: slight-blink 2s ease-in-out infinite;
        }
      `}</style>
      {/* Sticky header */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10 shrink-0 bg-accent-light border-b border-accent-mid">
        <div className="flex flex-col">
          <span className="text-[13px] font-bold flex items-center gap-2 text-accent-hover">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span className="title-text shrink-0">Progress Note</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-green flex items-center gap-1 shrink-0" title={lastSaved ? `Last saved at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Autosaved'}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" fill="var(--green-border)" />
              <path d="M3 5l1.5 1.5L7 3.5" stroke="white" strokeWidth="1.2" />
            </svg>
            {!isUpdateActive && 'Autosaved'}
          </span>
          {isPublished && (
            <Badge variant="active">
              Published
            </Badge>
          )}
          {!isPublished && noteId && (
            <Badge variant="draft">
              Draft
            </Badge>
          )}
          {!isPublished && (
            <div className="flex items-center gap-2 ml-2">
              <Button 
                onClick={handleDraftToggle} 
                disabled={isSaving || deleteMutation.isPending} 
                variant="outline" 
                size="xs"
                className="h-6 px-2.5 text-[11px] font-semibold bg-surface-2 hover:bg-surface-3 border-border text-text-secondary cursor-pointer rounded-[4px] flex items-center justify-center gap-1.5 header-btn"
                title={noteId ? 'Undraft' : 'Draft'}
              >
                {deleteMutation.isPending || (isSaving && !noteId) ? (
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5 shrink-0" />
                ) : noteId ? (
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="btn-text">{noteId ? 'Undraft' : 'Draft'}</span>
              </Button>
              {form.formState.isDirty && (
                <Button 
                  onClick={() => {
                    if (noteId) {
                      updateMutation.mutate({ id: noteId, data: formValues }, {
                        onSuccess: () => {
                          setLastSaved(new Date());
                          form.reset(formValues);
                        }
                      });
                    } else {
                      createMutation.mutate(formValues, {
                        onSuccess: () => {
                          setLastSaved(new Date());
                          form.reset(formValues);
                        }
                      });
                    }
                  }} 
                  disabled={updateMutation.isPending || createMutation.isPending} 
                  variant="outline" 
                  size="xs"
                  className="h-6 px-2.5 text-[11px] font-semibold bg-surface-2 hover:bg-surface-3 border-border text-text-secondary cursor-pointer rounded-[4px] flex items-center justify-center gap-1.5 header-btn"
                  title="Update Draft"
                >
                  {updateMutation.isPending || createMutation.isPending ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5 shrink-0" />
                  ) : (
                    <Save className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="btn-text">Update Draft</span>
                </Button>
              )}
              <Button 
                onClick={handlePublish} 
                disabled={isSaving || publishMutation.isPending} 
                variant="default" 
                size="xs"
                className="h-6 px-2.5 text-[11px] font-semibold bg-accent hover:bg-accent-hover text-white border-accent-hover cursor-pointer rounded-[4px] flex items-center justify-center gap-1.5 header-btn"
                title="Finalize"
              >
                {isSaving || publishMutation.isPending ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5 shrink-0" />
                ) : (
                  <Check className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="btn-text">Finalize</span>
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
                  className={`w-full min-h-[100px] px-2.5 py-1.5 bg-white border-[1.5px] rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed ${(!formValues.subjective || !formValues.subjective.trim()) && !isPublished ? 'border-red focus:border-red' : 'border-border-strong focus:border-accent'}`}
                  placeholder="Enter subjective findings..."
                  disabled={isDisabled}
                />
                {(!formValues.subjective || !formValues.subjective.trim()) && !isPublished && (
                  <p className="text-[10px] text-red mt-1.5 font-medium">Subjective is required to publish this note.</p>
                )}
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
                  className={`w-full min-h-[100px] px-2.5 py-1.5 bg-white border-[1.5px] rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed ${(!formValues.objective || !formValues.objective.trim()) && !isPublished ? 'border-red focus:border-red' : 'border-border-strong focus:border-accent'}`}
                  placeholder="Enter objective findings..."
                  disabled={isDisabled}
                />
                {(!formValues.objective || !formValues.objective.trim()) && !isPublished && (
                  <p className="text-[10px] text-red mt-1.5 font-medium">Objective is required to publish this note.</p>
                )}
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
                  disabled={isDisabled}
                />
              </div>
            </div>

            {/* PROBLEM LIST */}
            <div className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-[7px]">
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface-3 shrink-0">📊</div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">Assessment / Problem List</span>
              </div>
              <div className="p-[14px]">
                <Controller
                  control={form.control}
                  name="problemListSnapshot"
                  render={({ field }) => (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2">
                        {field.value?.map((prob: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-1 px-2.5 py-1 bg-surface-2 border border-border rounded-[6px] text-[12px] text-text-primary">
                            <span className="font-medium">{typeof prob === 'string' ? prob : prob.title}</span>
                            {typeof prob !== 'string' && prob.icdCode && (
                              <span className="text-[10px] text-text-muted">({prob.icdCode})</span>
                            )}
                            {typeof prob !== 'string' && prob.isNew && (
                              <span className="text-[9px] font-bold text-green bg-green/15 px-1 py-0.5 rounded uppercase tracking-wider blink-animation shrink-0">New</span>
                            )}
                            {!isPublished && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newProbs = [...(field.value || [])];
                                  newProbs.splice(idx, 1);
                                  field.onChange(newProbs);
                                }}
                                disabled={isDisabled}
                                className="text-text-muted hover:text-red transition-colors ml-1 disabled:opacity-50 flex items-center justify-center"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                              </button>
                            )}
                          </div>
                        ))}
                        {field.value?.length === 0 && (
                          <span className="text-[12px] text-text-muted italic">No problems added yet.</span>
                        )}
                      </div>
                      {!isPublished && (
                        <div className="flex items-center gap-2 mt-1">
                          <input 
                            id="newProbTitle" 
                            disabled={isDisabled} 
                            placeholder="Problem Title (e.g. Hypertension)" 
                            className="h-[32px] px-2.5 text-[12px] rounded-[6px] border border-border-strong outline-none focus:border-accent flex-1 bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] disabled:bg-surface-2 disabled:cursor-not-allowed" 
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                document.getElementById('addProbBtn')?.click();
                              }
                            }}
                          />
                          <input 
                            id="newProbIcd" 
                            disabled={isDisabled} 
                            placeholder="ICD-10 (Optional)" 
                            className="h-[32px] px-2.5 text-[12px] rounded-[6px] border border-border-strong outline-none focus:border-accent w-[120px] bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] disabled:bg-surface-2 disabled:cursor-not-allowed" 
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                document.getElementById('addProbBtn')?.click();
                              }
                            }}
                          />
                          <Button
                            id="addProbBtn"
                            type="button"
                            variant="secondary"
                            disabled={isDisabled}
                            onClick={() => {
                              const titleEl = document.getElementById('newProbTitle') as HTMLInputElement;
                              const icdEl = document.getElementById('newProbIcd') as HTMLInputElement;
                              if (titleEl.value.trim()) {
                                const newProbs = [...(field.value || []), { title: titleEl.value.trim(), icdCode: icdEl.value.trim() || undefined, isNew: true }];
                                field.onChange(newProbs);
                                titleEl.value = '';
                                icdEl.value = '';
                              }
                            }}
                            className="h-[32px] px-3 bg-surface border border-border text-text-secondary hover:bg-surface-3 hover:text-text-primary rounded-[6px] font-medium text-[11px] flex items-center gap-1 transition-all"
                          >
                            + Add
                          </Button>
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
                  disabled={isDisabled}
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
                      disabled={isDisabled}
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
                            <div className="flex-1 min-w-0 truncate flex items-center flex-wrap">
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
                              {typeof med !== 'string' && med.isNew && (
                                <span className="text-[9px] font-bold text-green bg-green/15 px-1 py-0.5 rounded uppercase tracking-wider ml-1.5 shrink-0 blink-animation">New</span>
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
                                disabled={isDisabled}
                                className="text-text-muted hover:text-red transition-colors w-6 h-6 rounded-md disabled:opacity-50"
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
                                disabled={isDisabled}
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
                                disabled={isDisabled}
                                className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] disabled:bg-surface-2 disabled:cursor-not-allowed" 
                              />
                            </div>
                            <div className="col-span-12 md:col-span-6 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Formulation</label>
                              <input 
                                value={newMedFormulation}
                                onChange={(e) => setNewMedFormulation(e.target.value)}
                                placeholder="e.g. Tablet, Syrup" 
                                disabled={isDisabled}
                                className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] disabled:bg-surface-2 disabled:cursor-not-allowed" 
                              />
                            </div>
                            <div className="col-span-12 md:col-span-6 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Quantity</label>
                              <input 
                                type="number"
                                value={newMedQuantity}
                                onChange={(e) => setNewMedQuantity(e.target.value)}
                                placeholder="e.g. 30" 
                                disabled={isDisabled}
                                className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] disabled:bg-surface-2 disabled:cursor-not-allowed" 
                              />
                            </div>
                            <div className="col-span-12 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Sig / Instructions</label>
                              <input 
                                value={newMedInstructions}
                                onChange={(e) => setNewMedInstructions(e.target.value)}
                                placeholder="e.g. Take 1 tab daily" 
                                disabled={isDisabled}
                                className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] disabled:bg-surface-2 disabled:cursor-not-allowed" 
                              />
                            </div>
                            <div className="col-span-12 flex justify-end mt-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="xs"
                                disabled={isDisabled}
                                onClick={() => {
                                  if (newMedName.trim() && newMedDose.trim()) {
                                    field.onChange([...meds, { 
                                      name: newMedName.trim(), 
                                      dose: newMedDose.trim(), 
                                      formulation: newMedFormulation.trim() || undefined,
                                      quantity: newMedQuantity ? parseInt(newMedQuantity, 10) : undefined,
                                      instructions: newMedInstructions.trim(),
                                      isNew: true
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

