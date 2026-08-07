import { useEffect, useState, useRef, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { buildProblemTree } from '@/lib/problem-utils';
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
import { NoteFormSkeleton } from './NoteFormSkeleton';
import { MedicationSnapshotModal } from './MedicationSnapshotModal';
import { AttachmentsSection } from '../attachments/AttachmentsSection';
import { TrashIcon, Trash2, FileText, RotateCcw, Check, Save, PanelRightClose, X, Loader2, Edit } from 'lucide-react';
import { formatBloodPressure, formatTemperature } from '@/lib/vitals-utils';
import { Badge } from '@/components/ui/badge';
import { ComboboxInput } from '@/components/ui/ComboboxInput';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

import { useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  const { data: note, isLoading: noteLoading, isFetching: noteFetching } = useProgressNote(noteId || null);
  const { data: copyForward, isLoading: copyLoading, isFetching: copyFetching, refetch: refetchCopyForward } = useCopyForwardData(patientId);

  const hasLocalDraft = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(`damayan:draft:${patientId}:progress`);
  }, [patientId]);

  const isInitialLoading = noteId
    ? (noteLoading && !note)
    : (copyLoading && !copyForward && !hasLocalDraft);

  const isSyncing = (noteId ? (noteFetching && !!note) : (copyFetching && !!copyForward)) || (copyFetching && !copyLoading && !isInitialLoading);
  const createMutation = useCreateProgressNote(patientId);
  const createAndPublishMutation = useCreateAndPublishProgressNote(patientId);
  const updateMutation = useUpdateProgressNote(patientId);
  const publishMutation = usePublishProgressNote(patientId);
  const deleteMutation = useDeleteProgressNote(patientId);
  const { openExistingProgressNote, setActiveScreen, setDocumentationPanelOpen, registerPublishHandler } = useUiStore();
  const { user } = useAuthStore();
  const isNonDoctor = user?.role === 'NURSE' || user?.role === 'PHARMACIST';

  const [publishError, setPublishError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [localAttachments, setLocalAttachments] = useState<{ tag: string, textResult: string, file: File | null }[]>([]);
  const uploadAttachment = useUploadAttachment();

  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedFormulation, setNewMedFormulation] = useState('');
  const [newMedInstructions, setNewMedInstructions] = useState('');
  const [newMedQuantity, setNewMedQuantity] = useState('');
  const [editMedIndex, setEditMedIndex] = useState<number | null>(null);

  const [newProbTitle, setNewProbTitle] = useState('');
  const [diagnosticsInput, setDiagnosticsInput] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<{ hasFile: boolean; tag: string; textResult: string; fileName?: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const { data: patientMedicationsResponse } = useMedications(patientId);
  const patientMedications = patientMedicationsResponse?.data || [];
  const nameOptions = buildMedicationSuggestions(patientMedications);

  // Refetch patient active problems, medications, vitals every time sidebar opens or patient changes
  useEffect(() => {
    if (patientId) {
      queryClient.invalidateQueries({ queryKey: ['problems', patientId] });
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['latest-vitals', patientId] });
      refetchCopyForward();
    }
  }, [patientId, queryClient, refetchCopyForward]);

  const form = useForm<ProgressNoteDraftValues>({
    resolver: zodResolver(progressNoteDraftSchema),
    defaultValues: {
      subjective: '',
      objective: '',
      labs: '',
      mgmtNonpharm: '',
      mgmtPharm: '',
      diagnostics: [],
      problemListSnapshot: [],
      medicationSnapshot: [],
      visitDatetime: new Date().toISOString(),
    },
  });

  const activeProblemTree = useMemo(() => {
    const activeProbs = copyForward?.activeProblems || [];
    const tree = buildProblemTree(activeProbs);
    const list: { problem: any; depth: number }[] = [];
    const traverse = (nodes: any[], depth: number) => {
      nodes.forEach(node => {
        list.push({ problem: node, depth });
        traverse(node.children || [], depth + 1);
      });
    };
    traverse(tree, 0);
    return list;
  }, [copyForward?.activeProblems]);

  const activeDepthMap = useMemo(() => {
    const map = new Map<string, number>();
    activeProblemTree.forEach(item => {
      map.set(item.problem.title.trim().toLowerCase(), item.depth);
      if (item.problem.id) map.set(item.problem.id, item.depth);
    });
    return map;
  }, [activeProblemTree]);

  const mergeActiveProblems = (existingProblems: any[], activeProblems: any[]) => {
    const tree = buildProblemTree(activeProblems || []);
    const flatActive: { problem: any; depth: number }[] = [];
    const traverse = (nodes: any[], depth: number) => {
      nodes.forEach(node => {
        flatActive.push({ problem: node, depth });
        traverse(node.children || [], depth + 1);
      });
    };
    traverse(tree, 0);

    const existing = [...existingProblems];
    const existingTitles = new Set(existing.map((p: any) => (typeof p === 'string' ? p : p.title)?.trim().toLowerCase()));

    for (const item of flatActive) {
      const p = item.problem;
      if (p.title && !existingTitles.has(p.title.trim().toLowerCase())) {
        existing.push({
          title: p.title,
          parentId: p.parentId || undefined,
          depth: item.depth,
        });
        existingTitles.add(p.title.trim().toLowerCase());
      }
    }
    return existing;
  };

  const mergeActiveMedications = (existingMeds: any[], activeMedications: any[]) => {
    const existing = [...existingMeds];
    const existingNames = new Set(existing.map((m: any) => (typeof m === 'string' ? m : m.name)?.trim().toLowerCase()));

    for (const m of activeMedications) {
      if (m.name && !existingNames.has(m.name.trim().toLowerCase())) {
        existing.push({
          name: m.name,
          dose: m.dose || undefined,
          formulation: m.formulation || undefined,
          quantity: m.quantity || undefined,
          instructions: m.instructions || undefined,
        });
        existingNames.add(m.name.trim().toLowerCase());
      }
    }
    return existing;
  };

  useEffect(() => {
    const activeProblems = copyForward?.activeProblems || [];
    const activeMeds = copyForward?.activeMedications || [];

    if (noteId && note) {
      const isPublished = note.status === 'PUBLISHED';
      const draftProblems = (note.problemListSnapshot as any[]) || [];
      const validProblems = draftProblems.filter((p: any) => p && (typeof p === 'string' ? p.trim() : p.title)).map((p: any) => typeof p === 'string' ? { title: p } : p);

      const draftMeds = (note.medicationSnapshot as any[]) || [];
      const validMeds = draftMeds.filter((m: any) => m && (typeof m === 'string' ? m.trim() : m.name)).map((m: any) => typeof m === 'string' ? { name: m, dose: '' } : m);

      const finalProblems = isPublished
        ? validProblems
        : mergeActiveProblems(validProblems, activeProblems);

      const finalMeds = isPublished
        ? validMeds
        : mergeActiveMedications(validMeds, activeMeds);

      form.reset({
        subjective: note.subjective,
        objective: note.objective,
        labs: (note as any).labs || '',
        mgmtNonpharm: note.mgmtNonpharm || '',
        mgmtPharm: note.mgmtPharm || '',
        diagnostics: note.diagnostics || [],
        problemListSnapshot: finalProblems,
        medicationSnapshot: finalMeds,
        visitDatetime: note.createdAt,
      });
    } else if (!noteId && !copyLoading) {
      const draft = localStorage.getItem(`damayan:draft:${patientId}:progress`);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          const draftProblems = (parsed.problemListSnapshot as any[]) || [];
          const validProblems = draftProblems.filter((p: any) => p && (typeof p === 'string' ? p.trim() : p.title)).map((p: any) => typeof p === 'string' ? { title: p } : p);
          
          const draftMeds = (parsed.medicationSnapshot as any[]) || [];
          const validMeds = draftMeds.filter((m: any) => m && (typeof m === 'string' ? m.trim() : m.name)).map((m: any) => typeof m === 'string' ? { name: m, dose: '' } : {
            name: m.name,
            dose: m.dose || undefined,
            formulation: m.formulation || undefined,
            quantity: m.quantity || undefined,
            instructions: m.instructions || undefined,
          });

          parsed.problemListSnapshot = mergeActiveProblems(validProblems, activeProblems);
          parsed.medicationSnapshot = mergeActiveMedications(validMeds, activeMeds);
          
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
        mgmtPharm: '',
        diagnostics: copyForward?.latestDiagnostics || [],
        problemListSnapshot: activeProblemTree.map(({ problem: p, depth }) => ({
          title: p.title,
          parentId: p.parentId || undefined,
          depth,
        })),
        medicationSnapshot: activeMeds.map((m: any) => ({
          name: m.name,
          dose: m.dose || undefined,
          formulation: m.formulation || undefined,
          quantity: m.quantity || undefined,
          instructions: m.instructions || undefined,
        })),
        visitDatetime: new Date().toISOString(),
      });
    }
  }, [noteId, note, copyForward, copyLoading, patientId, form, activeProblemTree]);

  const previousCopyForward = useRef<any>(null);

  useEffect(() => {
    if (!copyForward || copyLoading || note?.status === 'PUBLISHED') return;
    
    // Sync newly added active problems or medications into form state live
    if (previousCopyForward.current) {
      const oldProblems = JSON.stringify(previousCopyForward.current.activeProblems);
      const newProblems = JSON.stringify(copyForward.activeProblems);
      const oldMeds = JSON.stringify(previousCopyForward.current.activeMedications);
      const newMeds = JSON.stringify(copyForward.activeMedications);

      if (oldProblems !== newProblems || oldMeds !== newMeds) {
        const currentValues = form.getValues();
        const mergedProbs = mergeActiveProblems(currentValues.problemListSnapshot || [], copyForward.activeProblems);
        const mergedMeds = mergeActiveMedications(currentValues.medicationSnapshot || [], copyForward.activeMedications);

        form.reset({
          ...currentValues,
          problemListSnapshot: mergedProbs,
          medicationSnapshot: mergedMeds,
        });
      }
    }
    previousCopyForward.current = copyForward;
  }, [copyForward, copyLoading, note, form]);

  const formValues = form.watch();

  const publishAndSwitchRef = useRef<() => Promise<boolean>>(undefined);

  publishAndSwitchRef.current = async (): Promise<boolean> => {
    const publishCheck = progressNotePublishSchema.safeParse(formValues);
    if (!publishCheck.success || (!isNonDoctor && (!formValues.objective || !formValues.objective.trim()))) {
      setPublishError(isNonDoctor ? "Please fill out Note Details." : "Please fill out Subjective and Objective fields.");
      const el = document.getElementById('notes-workspace-container');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return false;
    }
    
    return new Promise((resolve) => {
      if (noteId) {
        updateMutation.mutate({ id: noteId, data: cleanFormValues(formValues) }, {
          onSuccess: () => {
            publishMutation.mutate(noteId, {
              onSuccess: () => {
                localStorage.removeItem(`damayan:draft:${patientId}:progress`);
                resolve(true);
              },
              onError: (err: any) => {
                setPublishError(err?.message || 'Failed to publish note');
                resolve(false);
              }
            });
          },
          onError: (err: any) => {
            setPublishError(err?.message || 'Failed to update note before publishing');
            resolve(false);
          }
        });
      } else {
        createAndPublishMutation.mutate(cleanFormValues(formValues), {
          onSuccess: () => {
            localStorage.removeItem(`damayan:draft:${patientId}:progress`);
            resolve(true);
          },
          onError: (err: any) => {
            setPublishError(err?.message || 'Failed to create and publish note');
            resolve(false);
          }
        });
      }
    });
  };

  const isPublished = note?.status === 'PUBLISHED';
  const isDraftActive = !!noteId || form.formState.isDirty || localAttachments.length > 0;

  useEffect(() => {
    if (isPublished || !isDraftActive) {
      registerPublishHandler(null);
      return;
    }

    const handler = () => {
      if (publishAndSwitchRef.current) {
        return publishAndSwitchRef.current();
      }
      return Promise.resolve(false);
    };

    registerPublishHandler(handler);
    return () => {
      registerPublishHandler(null);
    };
  }, [isPublished, isDraftActive, registerPublishHandler]);

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
      subjective: values.subjective ?? '',
      objective: values.objective ?? '',
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
      if (!publishCheck.success || (!isNonDoctor && (!formValues.objective || !formValues.objective.trim()))) {
        setPublishError(isNonDoctor ? "Please fill out Note Details." : "Please fill out Subjective and Objective fields.");
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
  const isDisabled = isPublished || isSaving || deleteMutation.isPending;
  const isUpdateActive = !!form.formState.isDirty;

  return (
    <div className="flex flex-col h-full bg-surface-2 panel-container relative">
      {/* Saving is surfaced inline via the per-button spinner and the "Autosaved"
          indicator (design-standard.md §7.3) — no full-panel blocking overlay, so the
          note stays readable and scrollable while a save round-trips. */}
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
            {isSyncing && (
              <span title="Syncing patient data..." className="shrink-0 flex items-center">
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
              </span>
            )}
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
            <Badge variant="published">
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
                      mgmtPharm: '',
                      diagnostics: [],
                      problemListSnapshot: defaultProblems,
                      medicationSnapshot: defaultMeds,
                      visitDatetime: formValues.visitDatetime || new Date().toISOString(),
                    });

                    // Clear controlled inputs
                    setNewProbTitle('');
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
        {isInitialLoading ? (
          <NoteFormSkeleton />
        ) : (
          <>
            {publishError && (
              <div className="p-3 bg-red-bg border border-red-border rounded-lg text-red text-[12px] font-medium">
                {publishError}
              </div>
            )}

        <PatientContextBlock patientId={patientId} copyForward={copyForward} />

        <div id="notes-workspace-container" className="flex flex-col">
          <VitalsSummaryRow patientId={patientId} />

          <div className="flex flex-col gap-4">

            {/* SUBJECTIVE (or Note Details for Non-Doctors) */}
            <div className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-[7px]">
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface-3 shrink-0">💬</div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">
                  {isNonDoctor ? 'Note Details' : 'Subjective'} <span className="text-red ml-0.5">*</span>
                </span>
              </div>
              <div className="p-[14px]">
                <textarea
                  {...form.register('subjective')}
                  className={`w-full min-h-[100px] px-2.5 py-1.5 bg-white border-[1.5px] rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed ${(!formValues.subjective || !formValues.subjective.trim()) && !isPublished ? 'border-red focus:border-red' : 'border-border-strong focus:border-accent'}`}
                  placeholder={isNonDoctor ? "Enter note details..." : "Enter subjective findings..."}
                  disabled={isDisabled}
                />
                {(!formValues.subjective || !formValues.subjective.trim()) && !isPublished && (
                  <p className="text-[10px] text-red mt-1.5 font-medium">{isNonDoctor ? 'Note details are required.' : 'Subjective is required to publish this note.'}</p>
                )}
              </div>
            </div>

            {!isNonDoctor && (
              <>
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
                      <div className="border border-border rounded-[6px] overflow-hidden bg-surface">
                        {field.value?.map((prob: any, idx: number) => {
                          const isLast = idx === (field.value?.length || 0) - 1;
                          const titleStr = typeof prob === 'string' ? prob : prob.title;
                          const isNewItem = typeof prob !== 'string' && prob.isNew;

                          const titleKey = titleStr?.trim().toLowerCase();
                          const depth = typeof prob !== 'string' && prob.depth !== undefined 
                            ? prob.depth 
                            : (titleKey && activeDepthMap.has(titleKey) 
                                ? activeDepthMap.get(titleKey)! 
                                : (typeof prob !== 'string' && prob.parentId ? 1 : 0));

                          return (
                            <div key={idx} className={`flex items-center gap-2.5 px-3 py-2 ${!isLast ? 'border-b border-border' : ''} hover:bg-surface-3/50 transition-colors`}>
                              <div className="w-2 h-2 rounded-full bg-accent-mid shrink-0" />
                              <div 
                                className="flex-1 min-w-0 flex flex-col"
                                style={depth > 0 ? { paddingLeft: `${depth * 20}px` } : undefined}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="text-[12px] font-semibold text-text-primary truncate">
                                    {depth > 0 && <span className="font-mono text-text-muted mr-1 select-none">↳</span>}
                                    {titleStr}
                                  </span>
                                </div>
                              </div>
                              {isNewItem ? (
                                <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] bg-green-bg text-green border border-green-border shrink-0 blink-animation">
                                  New
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] bg-accent-light text-accent-hover border border-accent shrink-0">
                                  Active
                                </span>
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
                                  className="p-1 text-text-muted hover:text-red hover:bg-red-bg rounded-md transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                                  title="Remove Problem"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {field.value?.length === 0 && (
                          <div className="py-3 px-3 text-[12px] text-text-muted italic text-center">
                            No problems added yet.
                          </div>
                        )}
                      </div>
                      {!isPublished && (
                        <div className="flex flex-col gap-2 p-3 border border-border rounded-[8px] bg-surface-2/40">
                          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">Add Problem</span>
                          {/* Problem Title & Add Button */}
                          <div className="flex items-center gap-2">
                            <input
                              id="newProbTitle"
                              value={newProbTitle}
                              onChange={(e) => setNewProbTitle(e.target.value)}
                              disabled={isDisabled}
                              placeholder="Problem Title (e.g. Hypertension)"
                              className="flex-1 h-[32px] px-2.5 text-[12px] rounded-[6px] border border-border-strong/60 outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] bg-white transition-all disabled:bg-surface-2 disabled:cursor-not-allowed placeholder:text-border-strong/70"
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
                              variant="default"
                              disabled={isDisabled || !newProbTitle.trim()}
                              onClick={() => {
                                if (newProbTitle.trim()) {
                                  const newProbs = [...(field.value || []), { title: newProbTitle.trim(), isNew: true }];
                                  field.onChange(newProbs);
                                  setNewProbTitle('');
                                }
                              }}
                              className="h-[32px] px-4 bg-accent hover:bg-accent-hover text-white rounded-[6px] font-semibold text-[11px] flex items-center gap-1 transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-50"
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
                  className="w-full min-h-[60px] px-2.5 py-1.5 bg-white border border-border-strong/60 rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* PHARMACOLOGIC TREATMENT REMARKS */}
            <div className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-[7px]">
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface-3 shrink-0">💊</div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">Pharmacologic Treatment Remarks</span>
              </div>
              <div className="p-[14px]">
                <textarea
                  {...form.register('mgmtPharm')}
                  className="w-full min-h-[60px] px-2.5 py-1.5 bg-white border border-border-strong/60 rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter pharmacologic treatment remarks..."
                  disabled={isDisabled}
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
                      <div className="flex flex-col gap-3">
                        {/* Fixed Table Layout for Medication Data */}
                        <div className="border border-border rounded-[6px] overflow-hidden w-full overflow-x-auto bg-surface">
                          <table className="w-full border-collapse table-fixed text-left min-w-[290px]">
                            <colgroup>
                              <col className="w-[40%]" />
                              <col className="w-[24%]" />
                              <col className="w-[26%]" />
                              <col className="w-[10%]" />
                            </colgroup>
                            <thead>
                              <tr className="bg-surface-2 border-b border-border">
                                <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary px-2.5 py-2 text-left">Medication</th>
                                <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary px-1.5 py-2 text-left">Form / Qty</th>
                                <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary px-1.5 py-2 text-left">Sig</th>
                                <th className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary px-1 py-2 text-center">Act.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {meds.map((med: any, idx: number) => {
                                const medName = typeof med === 'string' ? med : med.name;
                                const medDose = typeof med !== 'string' ? med.dose : undefined;
                                const medForm = typeof med !== 'string' ? med.formulation : undefined;
                                const medQty = typeof med !== 'string' ? med.quantity : undefined;
                                const medSig = typeof med !== 'string' ? med.instructions : undefined;
                                const isNewMed = typeof med !== 'string' && med.isNew;

                                return (
                                  <tr key={idx} className="hover:bg-surface-3/50 transition-colors border-b border-border last:border-b-0">
                                    <td className="px-2.5 py-2 text-[12px] align-top break-words">
                                      <div className="flex flex-col min-w-0">
                                        <div className="flex items-start gap-1.5 flex-wrap">
                                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1.5" />
                                          <span className="font-bold text-text-primary text-[12px] break-words whitespace-normal leading-snug flex-1 min-w-0">{medName}</span>
                                          {isNewMed && (
                                            <span className="text-[8px] font-bold text-green bg-green-bg border border-green-border px-1 py-0.5 rounded uppercase tracking-wider shrink-0 blink-animation mt-0.5">New</span>
                                          )}
                                        </div>
                                        {medDose && (
                                          <span className="font-mono text-[10px] font-semibold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded w-fit mt-0.5 break-words whitespace-normal">{medDose}</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-1.5 py-2 text-[11px] text-text-secondary align-top break-words">
                                      <span className="font-medium break-words block">{medForm || '—'}</span>
                                      {medQty && (
                                        <span className="text-text-muted font-mono text-[10px] block break-words">Qty: {medQty}</span>
                                      )}
                                    </td>
                                    <td className="px-1.5 py-2 text-[11px] text-text-secondary align-top break-words">
                                      <span className="italic text-text-muted text-[11px] break-words block" title={medSig || ''}>
                                        {medSig || '—'}
                                      </span>
                                    </td>
                                    <td className="px-1 py-2 align-top text-center">
                                      {!isPublished && (
                                        <div className="flex items-center justify-center gap-0.5">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-xs"
                                            onClick={() => setEditMedIndex(idx)}
                                            disabled={isDisabled}
                                            className="text-text-muted hover:text-accent hover:bg-accent/10 transition-colors w-6 h-6 rounded-md disabled:opacity-50 shrink-0 cursor-pointer p-0"
                                            title="Edit Medication"
                                          >
                                            <Edit className="w-3.5 h-3.5" />
                                          </Button>
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
                                            className="text-text-muted hover:text-red hover:bg-red-bg transition-colors w-6 h-6 rounded-md disabled:opacity-50 shrink-0 cursor-pointer p-0"
                                            title="Remove Medication"
                                          >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                              {meds.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="py-3 px-3 text-[12px] text-text-muted italic text-center">
                                    No medications added yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {!isPublished && (
                          <div className="flex flex-col gap-2.5 mt-1 p-3 border border-border rounded-[8px] bg-surface-2/40">
                            <span className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">Add Medication</span>
                            
                            {/* Row 1: Medication Name */}
                            <div className="w-full">
                              <ComboboxInput
                                value={newMedName}
                                onChange={setNewMedName}
                                options={nameOptions}
                                placeholder="Medication Name (e.g. Lisinopril)"
                                disabled={isDisabled}
                                className="h-[32px] px-2.5 text-[12px] rounded-[6px] border border-border-strong/60 outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70"
                              />
                            </div>

                            {/* Row 2: Dose, Formulation, Quantity */}
                            <div className="flex items-center gap-2">
                              <input 
                                type="text" 
                                value={newMedDose}
                                onChange={(e) => setNewMedDose(e.target.value)}
                                placeholder="Dose (e.g. 10 mg)" 
                                disabled={isDisabled}
                                className="flex-1 h-[32px] px-2.5 text-[12px] rounded-[6px] border border-border-strong/60 outline-none focus:border-accent bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:bg-surface-2 disabled:cursor-not-allowed" 
                              />
                              <input 
                                value={newMedFormulation}
                                onChange={(e) => setNewMedFormulation(e.target.value)}
                                placeholder="Form (e.g. Tablet)" 
                                disabled={isDisabled}
                                className="flex-1 h-[32px] px-2.5 text-[12px] rounded-[6px] border border-border-strong/60 outline-none focus:border-accent bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:bg-surface-2 disabled:cursor-not-allowed" 
                              />
                              <input 
                                type="number"
                                value={newMedQuantity}
                                onChange={(e) => setNewMedQuantity(e.target.value)}
                                placeholder="Qty" 
                                disabled={isDisabled}
                                className="w-[70px] h-[32px] px-2 text-[12px] rounded-[6px] border border-border-strong/60 outline-none focus:border-accent bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:bg-surface-2 disabled:cursor-not-allowed" 
                              />
                            </div>

                            {/* Row 3: Sig / Instructions & Action Button */}
                            <div className="flex items-center gap-2">
                              <input 
                                value={newMedInstructions}
                                onChange={(e) => setNewMedInstructions(e.target.value)}
                                placeholder="Sig / Instructions (e.g. Take 1 tab daily)" 
                                disabled={isDisabled}
                                className="flex-1 h-[32px] px-2.5 text-[12px] rounded-[6px] border border-border-strong/60 outline-none focus:border-accent bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70 disabled:bg-surface-2 disabled:cursor-not-allowed" 
                              />
                              <Button
                                type="button"
                                variant="default"
                                size="xs"
                                disabled={isDisabled || !newMedName.trim() || !newMedDose.trim()}
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
                                className="h-[32px] px-3.5 bg-accent text-white hover:bg-accent-hover rounded-[6px] font-semibold text-[11px] flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
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
              </>
            )}

          </div>
        </div>
        </>
      )}
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

      <MedicationSnapshotModal
        open={editMedIndex !== null}
        onClose={() => setEditMedIndex(null)}
        editing={editMedIndex !== null ? (form.getValues('medicationSnapshot') || [])[editMedIndex] ?? null : null}
        nameOptions={nameOptions}
        onSave={(values) => {
          if (editMedIndex === null) return;
          const current = form.getValues('medicationSnapshot') || [];
          const updated = [...current];
          updated[editMedIndex] = { ...updated[editMedIndex], ...values };
          form.setValue('medicationSnapshot', updated, { shouldDirty: true, shouldTouch: true });
          setEditMedIndex(null);
        }}
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

