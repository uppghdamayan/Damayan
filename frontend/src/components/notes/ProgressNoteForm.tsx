import { useEffect, useState, useRef } from 'react';
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
  useCreateAndPublishProgressNote,
  useUpdateProgressNote, 
  usePublishProgressNote,
  useCopyForwardData,
  useDeleteProgressNote
} from '@/hooks/useProgressNotes';
import { usePatient } from '@/hooks/usePatients';
import { useLatestVitals } from '@/hooks/useVitals';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useUploadAttachment } from '@/hooks/useAttachments';
import { useMedications } from '@/hooks/useMedications';
import { buildMedicationSuggestions } from '@/lib/medication-utils';
import { VitalsSummaryRow } from './VitalsSummaryRow';
import { TagInputField } from './TagInputField';
import { AttachmentsSection } from '../attachments/AttachmentsSection';
import { TrashIcon, Trash2, FileText, RotateCcw, Check, Save, PanelRightClose, X } from 'lucide-react';
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
  const createAndPublishMutation = useCreateAndPublishProgressNote(patientId);
  const updateMutation = useUpdateProgressNote(patientId);
  const publishMutation = usePublishProgressNote(patientId);
  const deleteMutation = useDeleteProgressNote(patientId);
  const { openExistingProgressNote, setActiveScreen, setDocumentationPanelOpen } = useUiStore();

  const [publishError, setPublishError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [localAttachments, setLocalAttachments] = useState<{ tag: string, textResult: string, file: File | null }[]>([]);
  const uploadAttachment = useUploadAttachment();

  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedFormulation, setNewMedFormulation] = useState('');
  const [newMedInstructions, setNewMedInstructions] = useState('');
  const [newMedQuantity, setNewMedQuantity] = useState('');

  const [newProbTitle, setNewProbTitle] = useState('');
  const [newProbIcd, setNewProbIcd] = useState('');
  const [diagnosticsInput, setDiagnosticsInput] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<{ hasFile: boolean; tag: string; textResult: string; fileName?: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

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
        problemListSnapshot: (note.problemListSnapshot !== undefined && note.problemListSnapshot !== null)
          ? validProblems
          : (copyForward?.activeProblems || []).map((p: any) => ({ title: p.title, icdCode: p.icdCode || undefined })),
        medicationSnapshot: (note.medicationSnapshot !== undefined && note.medicationSnapshot !== null)
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

          if (parsed.problemListSnapshot === undefined || parsed.problemListSnapshot === null) {
            parsed.problemListSnapshot = (copyForward?.activeProblems || []).map((p: any) => ({ title: p.title, icdCode: p.icdCode || undefined }));
          } else {
            parsed.problemListSnapshot = validProblems;
          }

          if (parsed.medicationSnapshot === undefined || parsed.medicationSnapshot === null) {
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
          
          if (parsed.diagnostics === undefined || parsed.diagnostics === null) {
            parsed.diagnostics = copyForward?.latestDiagnostics || [];
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
        diagnostics: copyForward?.latestDiagnostics || [],
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
  }, [noteId, note, copyForward, copyLoading, patientId, form]);

  const previousCopyForward = useRef<any>(null);

  useEffect(() => {
    if (!copyForward || copyLoading) return;
    
    // If copyForward changed after initial load, instantly sync the form's snapshots
    if (previousCopyForward.current) {
      const oldProblems = JSON.stringify(previousCopyForward.current.activeProblems);
      const newProblems = JSON.stringify(copyForward.activeProblems);
      const oldMeds = JSON.stringify(previousCopyForward.current.activeMedications);
      const newMeds = JSON.stringify(copyForward.activeMedications);

      if (oldProblems !== newProblems || oldMeds !== newMeds) {
        const currentValues = form.getValues();
        form.reset({
          ...currentValues,
          problemListSnapshot: copyForward.activeProblems.map((p: any) => ({ 
            title: p.title, 
            icdCode: p.icdCode || undefined 
          })),
          medicationSnapshot: copyForward.activeMedications.map((m: any) => ({
            name: m.name,
            dose: m.dose || undefined,
            formulation: m.formulation || undefined,
            quantity: m.quantity || undefined,
            instructions: m.instructions || undefined,
          })),
        });
      }
    }
    previousCopyForward.current = copyForward;
  }, [copyForward, copyLoading, form]);

  const formValues = form.watch();
  const getUnaddedSections = () => {
    const list: string[] = [];
    if (newProbTitle.trim()) {
      list.push('Problem List');
    }
    if (newMedName.trim()) {
      list.push('Medications');
    }
    if (diagnosticsInput.trim()) {
      list.push('Diagnostics');
    }
    if (pendingAttachment && (pendingAttachment.hasFile || pendingAttachment.tag.trim() || pendingAttachment.textResult.trim())) {
      list.push('Labs & Imaging');
    }
    return list;
  };

  const cleanFormValues = (values: any) => {
    return {
      ...values,
      problemListSnapshot: values.problemListSnapshot?.map((p: any) => {
        if (typeof p === 'object' && p !== null) {
          const { isNew, ...rest } = p;
          return rest;
        }
        return p;
      }),
      medicationSnapshot: values.medicationSnapshot?.map((m: any) => {
        if (typeof m === 'object' && m !== null) {
          const { isNew, ...rest } = m;
          return rest;
        }
        return m;
      }),
    };
  };

  const handleGoBack = () => {
    const unadded = getUnaddedSections();
    setPendingAction(null);
    
    if (unadded.length > 0) {
      const sectionElements: { [key: string]: string } = {
        'Problem List': 'problem-list-section',
        'Medications': 'medications-section',
        'Diagnostics': 'diagnostics-section',
        'Labs & Imaging': 'labs-imaging-section'
      };

      const firstUnadded = unadded[0];
      const elId = sectionElements[firstUnadded];
      if (elId) {
        const el = document.getElementById(elId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Wait for smooth scroll to finish, then focus the input field
          setTimeout(() => {
            if (firstUnadded === 'Problem List') {
              const input = document.getElementById('newProbTitle');
              input?.focus();
            } else if (firstUnadded === 'Medications') {
              const input = el.querySelector('input');
              input?.focus();
            } else if (firstUnadded === 'Diagnostics') {
              const input = el.querySelector('input');
              input?.focus();
            } else if (firstUnadded === 'Labs & Imaging') {
              const input = el.querySelector('input');
              input?.focus();
            }
          }, 350);
        }
      }
    }
  };

  const executeDraftToggle = () => {
    if (noteId) {
      deleteMutation.mutate(noteId, {
        onSuccess: () => {
          localStorage.removeItem(`damayan:draft:${patientId}:progress`);
          onClose();
        }
      });
    } else {
      createMutation.mutate(cleanFormValues(formValues), {
        onSuccess: async (newNote) => {
          setLastSaved(new Date());
          const newNoteId = (newNote as any)?.data?.id || (newNote as any)?.id;
          
          if (newNoteId && localAttachments.length > 0) {
            for (const att of localAttachments) {
              try {
                await uploadAttachment.mutateAsync({
                  patientId,
                  noteType: 'PROGRESS_NOTE',
                  noteId: newNoteId,
                  tag: att.tag,
                  textResult: att.textResult || undefined,
                  file: att.file || undefined
                });
              } catch (e) {
                console.error('Failed to upload attachment', e);
              }
            }
            setLocalAttachments([]);
          }

          onClose();
          setDocumentationPanelOpen(false);
          setActiveScreen('note-timeline');
        }
      });
    }
  };

  const handleDraftToggle = () => {
    if (!noteId) {
      const unadded = getUnaddedSections();
      if (unadded.length > 0) {
        setPendingAction(() => executeDraftToggle);
        return;
      }
    }
    executeDraftToggle();
  };

  const executeUpdateDraft = () => {
    if (!noteId) return;
    const safeNoteId = noteId;
    updateMutation.mutate({ id: safeNoteId, data: cleanFormValues(formValues) }, {
      onSuccess: async () => {
        if (localAttachments.length > 0) {
          for (const att of localAttachments) {
            try {
              await uploadAttachment.mutateAsync({
                patientId,
                noteType: 'PROGRESS_NOTE',
                noteId: safeNoteId,
                tag: att.tag,
                textResult: att.textResult || undefined,
                file: att.file || undefined
              });
            } catch (e) {
              console.error('Failed to upload attachment', e);
            }
          }
          setLocalAttachments([]);
        }
        setLastSaved(new Date());
        form.reset(formValues);
      }
    });
  };

  const handleUpdateDraft = () => {
    const unadded = getUnaddedSections();
    if (unadded.length > 0) {
      setPendingAction(() => executeUpdateDraft);
    } else {
      executeUpdateDraft();
    }
  };

  const executePublish = () => {
    if (noteId) {
      updateMutation.mutate({ id: noteId, data: cleanFormValues(formValues) }, {
        onSuccess: () => {
          publishMutation.mutate(noteId, {
            onSuccess: async () => {
              if (localAttachments.length > 0) {
                for (const att of localAttachments) {
                  try {
                    await uploadAttachment.mutateAsync({
                      patientId,
                      noteType: 'PROGRESS_NOTE',
                      noteId: noteId,
                      tag: att.tag,
                      textResult: att.textResult || undefined,
                      file: att.file || undefined
                    });
                  } catch (e) {
                    console.error('Failed to upload attachment', e);
                  }
                }
                setLocalAttachments([]);
              }
              localStorage.removeItem(`damayan:draft:${patientId}:progress`);
              onClose();
              setDocumentationPanelOpen(false);
              setActiveScreen('note-timeline');
            },
            onError: (err: any) => {
              setPublishError(err?.message || 'Failed to publish note');
            }
          });
        },
        onError: (err: any) => {
          setPublishError(err?.message || 'Failed to update note before publishing');
        }
      });
    } else {
      createAndPublishMutation.mutate(cleanFormValues(formValues), {
        onSuccess: async (newNote) => {
          const newNoteId = (newNote as any)?.data?.id || (newNote as any)?.id;
          if (newNoteId && localAttachments.length > 0) {
            for (const att of localAttachments) {
              try {
                await uploadAttachment.mutateAsync({
                  patientId,
                  noteType: 'PROGRESS_NOTE',
                  noteId: newNoteId,
                  tag: att.tag,
                  textResult: att.textResult || undefined,
                  file: att.file || undefined
                });
              } catch (e) {
                console.error('Failed to upload attachment', e);
              }
            }
            setLocalAttachments([]);
          }
          localStorage.removeItem(`damayan:draft:${patientId}:progress`);
          onClose();
          setDocumentationPanelOpen(false);
          setActiveScreen('note-timeline');
        },
        onError: (err: any) => {
          setPublishError(err?.message || 'Failed to create and publish note');
        }
      });
    }
  };

  const handlePublish = async () => {
    const unadded = getUnaddedSections();
    
    const proceedWithPublish = () => {
      setPublishError(null);
      const publishCheck = progressNotePublishSchema.safeParse(formValues);
      if (!publishCheck.success) {
        setPublishError("Please fill out Subjective and Objective fields.");
        return;
      }
      executePublish();
    };

    if (unadded.length > 0) {
      setPendingAction(() => proceedWithPublish);
      return;
    }

    proceedWithPublish();
  };

  useAutoSave(formValues, (data) => {
    localStorage.setItem(`damayan:draft:${patientId}:progress`, JSON.stringify(data));
    setLastSaved(new Date());
  }, `damayan:draft:${patientId}:progress`, 5000);

  if ((noteId && noteLoading) || (!noteId && copyLoading)) {
    return (
      <div className="flex flex-col h-full bg-surface-2 p-6 animate-pulse gap-6">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center pb-4 border-b border-border">
          <div className="h-6 w-48 bg-surface-3 rounded-[4px]" />
          <div className="flex gap-2">
            <div className="h-6 w-24 bg-surface-3 rounded-[4px]" />
            <div className="h-6 w-24 bg-surface-3 rounded-[4px]" />
          </div>
        </div>

        {/* Text Areas Skeleton */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="h-4 w-32 bg-surface-3 rounded-[4px]" />
          <div className="h-32 w-full bg-surface-3 rounded-[6px]" />
        </div>
        
        <div className="flex flex-col gap-2 mt-4">
          <div className="h-4 w-32 bg-surface-3 rounded-[4px]" />
          <div className="h-32 w-full bg-surface-3 rounded-[6px]" />
        </div>

        {/* Dynamic Sections Skeleton */}
        <div className="flex flex-col gap-3 mt-6">
          <div className="h-5 w-40 bg-surface-3 rounded-[4px]" />
          <div className="h-10 w-full bg-surface-3 rounded-[6px]" />
          <div className="h-10 w-full bg-surface-3 rounded-[6px]" />
        </div>
      </div>
    );
  }

  const isSaving = updateMutation.isPending || createMutation.isPending || publishMutation.isPending || createAndPublishMutation.isPending;
  const isPublishing = publishMutation.isPending || createAndPublishMutation.isPending;
  const isPublished = note?.status === 'PUBLISHED';
  const isDisabled = isPublished || isSaving || deleteMutation.isPending;
  const isUpdateActive = !!form.formState.isDirty;

  const loadingMessage = isPublishing ? "Finalizing note..." : "Saving draft...";

  return (
    <div className="flex flex-col h-full bg-surface-2 panel-container relative">
      {isSaving && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] font-semibold text-text-secondary">{loadingMessage}</span>
        </div>
      )}
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
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10 shrink-0 bg-accent-light/40 border-b border-accent-mid/40">
        <div className="flex flex-col">
          <span className="text-[13px] font-bold flex items-center gap-2 text-accent-hover">            <button
              onClick={() => {
                const unadded = getUnaddedSections();
                if (unadded.length > 0) {
                  setPendingAction(() => () => {
                    setDocumentationPanelOpen(false);
                    onClose();
                  });
                } else {
                  setDocumentationPanelOpen(false);
                  onClose();
                }
              }}
              className="p-1 -ml-1.5 hover:bg-accent/10 rounded-md transition-colors cursor-pointer text-text-secondary hover:text-accent-hover shrink-0"
              title="Close panel"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
            <span className="title-text shrink-0">Progress Note</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!noteId && (
            <span className="font-mono text-[10px] text-green flex items-center gap-1 shrink-0" title={lastSaved ? `Last saved at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Autosaved'}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4" fill="var(--green-border)" />
                <path d="M3 5l1.5 1.5L7 3.5" stroke="white" strokeWidth="1.2" />
              </svg>
              {!isUpdateActive && 'Autosaved'}
            </span>
          )}
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
              {(form.formState.isDirty || localAttachments.length > 0) && !noteId && (
                <Button 
                  onClick={() => {
                    const defaultProblems = (copyForward?.activeProblems || []).map((p: any) => ({
                      title: p.title,
                      icdCode: p.icdCode || undefined
                    }));
                    const defaultMeds = (copyForward?.activeMedications || []).map((m: any) => ({
                      name: m.name,
                      dose: m.dose || undefined,
                      formulation: m.formulation || undefined,
                      quantity: m.quantity || undefined,
                      instructions: m.instructions || undefined,
                    }));
                    
                    form.reset({
                      subjective: '',
                      objective: '',
                      labs: '',
                      mgmtNonpharm: '',
                      diagnostics: [],
                      problemListSnapshot: defaultProblems,
                      medicationSnapshot: defaultMeds,
                      visitDatetime: formValues.visitDatetime || new Date().toISOString(),
                    });

                    // Clear controlled inputs
                    setNewProbTitle('');
                    setNewProbIcd('');
                    setDiagnosticsInput('');

                    // Clear new medication states
                    setNewMedName('');
                    setNewMedDose('');
                    setNewMedFormulation('');
                    setNewMedQuantity('');
                    setNewMedInstructions('');

                    // Clear temporary attachments
                    setLocalAttachments([]);
                  }} 
                  disabled={isDisabled}
                  variant="outline" 
                  size="xs"
                  className="h-6 px-2.5 text-[11px] font-semibold bg-surface-2 hover:bg-surface-3 border-border text-text-secondary cursor-pointer rounded-[4px] flex items-center justify-center gap-1.5 header-btn"
                  title="Revert"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span className="btn-text">Revert</span>
                </Button>
              )}
              {(form.formState.isDirty || localAttachments.length > 0) && noteId && (
                <Button 
                  onClick={handleUpdateDraft} 
                  disabled={updateMutation.isPending} 
                  variant="outline" 
                  size="xs"
                  className="h-6 px-2.5 text-[11px] font-semibold bg-surface-2 hover:bg-surface-3 border-border text-text-secondary cursor-pointer rounded-[4px] flex items-center justify-center gap-1.5 header-btn"
                  title="Update Draft"
                >
                  {updateMutation.isPending ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5 shrink-0" />
                  ) : (
                    <Save className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="btn-text">Update Draft</span>
                </Button>
              )}
              <Button 
                onClick={handlePublish} 
                disabled={isSaving || publishMutation.isPending || createAndPublishMutation.isPending} 
                variant="default" 
                size="xs"
                className="h-6 px-2.5 text-[11px] font-semibold bg-accent hover:bg-accent-hover text-white border-accent-hover cursor-pointer rounded-[4px] flex items-center justify-center gap-1.5 header-btn"
                title="Finalize"
              >
                {isSaving || publishMutation.isPending || createAndPublishMutation.isPending ? (
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
            <div id="labs-imaging-section">
              <AttachmentsSection 
                patientId={patientId}
                noteType="PROGRESS_NOTE"
                noteId={noteId}
                localAttachments={localAttachments}
                onAddLocalAttachment={(att) => {
                  setLocalAttachments(prev => [...prev, att]);
                  const currentTags = form.getValues('diagnostics') || [];
                  if (att.tag && !currentTags.includes(att.tag)) {
                    form.setValue('diagnostics', [...currentTags, att.tag], { shouldDirty: true });
                  }
                }}
                onRemoveLocalAttachment={(idx) => setLocalAttachments(prev => prev.filter((_, i) => i !== idx))}
                onPendingChange={setPendingAttachment}
              />
            </div>

            {/* PROBLEM LIST */}
            <div id="problem-list-section" className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
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
                            value={newProbTitle}
                            onChange={(e) => setNewProbTitle(e.target.value)}
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
                            value={newProbIcd}
                            onChange={(e) => setNewProbIcd(e.target.value)}
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
                              if (newProbTitle.trim()) {
                                const newProbs = [...(field.value || []), { title: newProbTitle.trim(), icdCode: newProbIcd.trim() || undefined, isNew: true }];
                                field.onChange(newProbs);
                                setNewProbTitle('');
                                setNewProbIcd('');
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
            <div id="diagnostics-section" className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden" style={{ overflow: 'visible' }}>
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
                      onInputChange={setDiagnosticsInput}
                    />
                  )}
                />
              </div>
            </div>

            {/* MEDICATIONS */}
            <div id="medications-section" className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
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
                            <div className="col-span-12 @md:col-span-12 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Dose</label>
                              <input 
                                type="text" 
                                value={newMedDose}
                                onChange={(e) => setNewMedDose(e.target.value)}
                                placeholder="e.g. 10" 
                                className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]" 
                              />
                            </div>
                            <div className="col-span-12 @md:col-span-6 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Formulation</label>
                              <input 
                                value={newMedFormulation}
                                onChange={(e) => setNewMedFormulation(e.target.value)}
                                placeholder="e.g. Tablet, Syrup" 
                                disabled={isDisabled}
                                className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] disabled:bg-surface-2 disabled:cursor-not-allowed" 
                              />
                            </div>
                            <div className="col-span-12 @md:col-span-6 flex flex-col gap-1">
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
      <UnaddedChangesConfirmModal
        open={pendingAction !== null}
        onClose={handleGoBack}
        onConfirm={() => {
          if (pendingAction) {
            pendingAction();
          }
          setPendingAction(null);
        }}
        unaddedItems={getUnaddedSections()}
      />
    </div>
  );
}

function UnaddedChangesConfirmModal({
  open,
  onClose,
  onConfirm,
  unaddedItems
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  unaddedItems: string[];
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // Overlay
    <div className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center animate-in fade-in duration-150">
      {/* Modal box */}
      <div className="bg-surface border border-border rounded-[10px] w-[500px] max-[1439px]:w-[460px] max-[1279px]:w-[420px] max-[767px]:w-[92vw] max-[767px]:max-w-[380px] max-h-[80vh] overflow-y-auto shadow-modal flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border">
          <h2 className="text-[15px] font-bold flex-1 text-text-primary flex items-center gap-1.5">
            <span className="text-[16px]">⚠️</span> Unsaved Changes
          </h2>
          <button 
            onClick={onClose} 
            aria-label="Close modal"
            className="w-6 h-6 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="px-[18px] py-[18px] text-[13px] text-text-secondary leading-relaxed flex flex-col gap-3">
          <p className="text-text-primary">
            You have entered/selected information in the following section(s) but haven't clicked "+ Add" or "Add Result" to attach them to the note:
          </p>
          <ul className="flex flex-col gap-2 bg-surface-2 border border-border p-3 rounded-card">
            {unaddedItems.map((name, idx) => (
              <li key={idx} className="flex items-center gap-2 text-[13px] font-semibold text-accent">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-mid" />
                {name}
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-text-muted mt-1">
            They will be discarded if you proceed. Click "Go Back" to scroll to the section and add them, or "Discard & Proceed" to save/close without them.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-[18px] py-3 border-t border-border bg-surface-2/30">
          <button
            onClick={onClose}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-red-bg text-red border border-red-border hover:bg-red/15 hover:border-red/80 transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer shadow-sm"
          >
            Discard & Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

