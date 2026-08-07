import { useEffect, useState, useRef, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { buildProblemTree } from '@/lib/problem-utils';
import { 
  initialNoteDraftSchema, 
  initialNotePublishSchema, 
  InitialNoteDraftValues 
} from '@/lib/validation/initial-note-schema';
import { 
  useInitialNote, 
  useCreateInitialNote, 
  useUpdateInitialNote, 
  usePublishInitialNote,
  useDeleteInitialNote
} from '@/hooks/useInitialNote';
import { useCopyForwardData, useProgressNotes } from '@/hooks/useProgressNotes';
import { useLatestVitals } from '@/hooks/useVitals';
import { usePatient } from '@/hooks/usePatients';
import { useMedications } from '@/hooks/useMedications';
import { buildMedicationSuggestions } from '@/lib/medication-utils';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useUploadAttachment } from '@/hooks/useAttachments';
import { CollapsibleSection } from './CollapsibleSection';
import { TagInputField } from './TagInputField';
import { AttachmentsSection } from '../attachments/AttachmentsSection';
import { NoteStatusBadge } from './NoteStatusBadge';
import { SaveIcon, SendIcon, Heart, History, MessageSquare, Microscope, ClipboardList, Stethoscope, Users, User, UserCheck, Calendar, Brain, Loader2, TrashIcon, Edit, Pill, Sparkles, FlaskConical, HeartPulse, Activity, CheckCircle2, AlertTriangle, Download, Plus, Search, Paperclip, ShieldAlert, FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ComboboxInput } from '@/components/ui/ComboboxInput';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useUiStore } from '@/stores/uiStore';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { MedicationSnapshotModal, type MedicationSnapshotValues } from './MedicationSnapshotModal';
import { 
  classifyBloodPressure, classifyHeartRate, classifyOxygenSaturation, 
  classifyTemperature, classifyRespiratoryRate,
  formatBloodPressure, formatTemperature
} from '@/lib/vitals-utils';

interface NoteActionBarProps {
  isSaving: boolean;
  isPublishing?: boolean;
  onSaveDraft?: () => void;
  onPublish?: () => void;
  onClear?: () => void;
  onUnsave?: () => void;
  showSaveAndClear?: boolean;
  showPublish?: boolean;
  onCancel?: () => void;
  onSaveChanges?: () => void;
  saveLabel?: string;
}

function NoteActionBar({ 
  isSaving, 
  isPublishing, 
  onSaveDraft, 
  onPublish, 
  onClear,
  onUnsave,
  showSaveAndClear = true,
  showPublish = true,
  onCancel,
  onSaveChanges,
  saveLabel
}: NoteActionBarProps) {
  return (
    <div className="flex items-center justify-between bg-surface border border-border rounded-card shadow-card px-4 py-2.5 w-full">
      <span className="text-[11px] text-[var(--text-muted)]">
        {showSaveAndClear && !onSaveChanges ? (isSaving ? 'Saving…' : 'Draft auto-saves locally') : ''}
      </span>
      <div className="flex items-center gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="sec-btn">Cancel</button>
        )}
        {showSaveAndClear && onClear && (
          <button type="button" onClick={onClear} className="sec-btn destructive">Clear Form</button>
        )}
        {showSaveAndClear && onUnsave && (
          <button type="button" onClick={onUnsave} className="sec-btn">Unsave Draft</button>
        )}
        {showSaveAndClear && onSaveDraft && (
          <button type="button" onClick={onSaveDraft} disabled={isSaving} className="sec-btn">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>
        )}
        {onSaveChanges && (
          <button type="button" onClick={onSaveChanges} disabled={isSaving} className="sec-btn primary">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : (saveLabel || 'Save Changes')}
          </button>
        )}
        {showPublish && onPublish && (
          <button type="button" onClick={onPublish} disabled={isPublishing || isSaving} className="sec-btn primary">
            {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendIcon className="w-3.5 h-3.5" />}
            {isPublishing ? 'Publishing...' : 'Publish Note'}
          </button>
        )}
      </div>
    </div>
  );
}

function VitalMiniCell({ 
  label, 
  value, 
  unit, 
  status 
}: { 
  label: string; 
  value: string | number; 
  unit: string; 
  status: 'normal' | 'warn' | 'critical' | 'unknown';
}) {
  const valueColorClass =
    status === 'critical' ? 'text-red font-semibold' :
    status === 'warn' ? 'text-amber font-semibold' :
    'text-text-primary font-bold';

  const dotColor =
    status === 'critical' ? 'bg-red' :
    status === 'warn' ? 'bg-amber' :
    null;

  return (
    <div className="border border-border rounded-card px-2.5 py-2 flex flex-col bg-surface-2">
      <span className="text-[9.5px] font-bold uppercase tracking-[0.6px] mb-1 text-text-muted">
        {label}
      </span>
      <div className="flex items-center justify-between gap-1">
        <span className={cn("font-mono text-[15px] leading-none", valueColorClass)}>
          {value}
          {value !== '—' && <span className="text-[10px] text-text-muted ml-[2.5px] font-normal">{unit}</span>}
        </span>
        {dotColor && (
          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse", dotColor)} />
        )}
      </div>
    </div>
  );
}

export type MedSource = 'past' | 'prescribed';

/**
 * Legacy entries are plain strings; every pre-feature object entry has no
 * `source` at all. Both, and any unrecognized value, resolve to 'prescribed'
 * so an entry never silently disappears from the Prescribed Medications list.
 * Only an explicit 'past' counts as a past medication.
 */
function getMedSource(med: any): MedSource {
  return med && typeof med === 'object' && med.source === 'past' ? 'past' : 'prescribed';
}

interface MedicationAddFormProps {
  nameOptions: string[];
  onAdd: (values: MedicationSnapshotValues) => void;
  addLabel?: string;
}

/**
 * Inline "add a medication" sub-form. Used both by the Prescribed Medications
 * list (Plan/Management) and the Past Medication list (History) — each call
 * site owns its own state so typing in one never leaks into the other.
 */
function MedicationAddForm({ nameOptions, onAdd, addLabel = '+ Add Medication' }: MedicationAddFormProps) {
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedFormulation, setNewMedFormulation] = useState('');
  const [newMedInstructions, setNewMedInstructions] = useState('');
  const [newMedQuantity, setNewMedQuantity] = useState('');
  const [medError, setMedError] = useState('');
  const [addingMed, setAddingMed] = useState(false);

  return (
    <div className="grid grid-cols-12 gap-2.5 mt-2 pt-2 border-t border-border bg-surface-2 p-3 rounded-[8px]">
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
      <div className="col-span-12 @md:col-span-12 flex flex-col gap-1">
        <label className="text-[10px] font-bold text-text-secondary uppercase">Dose</label>
        <input
          type="text"
          value={newMedDose}
          onChange={(e) => setNewMedDose(e.target.value)}
          placeholder="e.g. 10mg"
          className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]"
        />
      </div>
      <div className="col-span-12 @md:col-span-6 flex flex-col gap-1">
        <label className="text-[10px] font-bold text-text-secondary uppercase">Formulation</label>
        <input
          value={newMedFormulation}
          onChange={(e) => setNewMedFormulation(e.target.value)}
          placeholder="e.g. Tablet, Syrup"
          className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]"
        />
      </div>
      <div className="col-span-12 @md:col-span-6 flex flex-col gap-1">
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
      <div className="col-span-12 flex justify-between items-center mt-1">
        {medError ? (
          <span className="text-red font-medium text-[10px]">{medError}</span>
        ) : <span />}
        <Button
          type="button"
          variant="secondary"
          size="xs"
          disabled={addingMed}
          onClick={() => {
            if (!newMedName.trim() || !newMedDose.trim()) {
              setMedError('Medication name and dose are required');
              return;
            }
            setMedError('');
            setAddingMed(true);
            setTimeout(() => {
              onAdd({
                name: newMedName.trim(),
                dose: newMedDose.trim(),
                formulation: newMedFormulation.trim() || undefined,
                quantity: newMedQuantity ? parseInt(newMedQuantity, 10) : undefined,
                instructions: newMedInstructions.trim(),
              });
              setNewMedName('');
              setNewMedDose('');
              setNewMedFormulation('');
              setNewMedQuantity('');
              setNewMedInstructions('');
              setAddingMed(false);
            }, 400);
          }}
          className="h-[28px] px-3.5 bg-surface border border-border text-text-secondary hover:bg-surface-3 hover:text-text-primary rounded font-medium text-[11px] flex items-center gap-1 transition-all"
        >
          {addingMed ? 'Adding...' : addLabel}
        </Button>
      </div>
    </div>
  );
}

interface InitialNoteFormProps {
  patientId: string;
}

function MedicationListReadOnly({ patientId }: { patientId: string }) {
  const { data: response, isLoading } = useMedications(patientId);

  if (isLoading) {
    return <div className="text-[12px] text-[var(--text-muted)] animate-pulse">Loading medications...</div>;
  }

  if (!response?.data || response.data.length === 0) {
    return <div className="text-[12px] text-[var(--text-muted)]">No medications prescribed.</div>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {response.data.map((med) => (
        <div key={med.id} className="flex flex-col text-[12px]">
          <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-green" />
            <span>{med.name} {med.dose}</span>
          </div>
          {med.instructions && (
            <span className="text-[10px] text-[var(--text-muted)] pl-3.5">{med.instructions}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function InitialNoteForm({ patientId }: InitialNoteFormProps) {
  const router = useRouter();
  const { data: note, isLoading } = useInitialNote(patientId);
  const { data: progressResponse, isLoading: progressLoading } = useProgressNotes(patientId);
  const { data: latestVitals } = useLatestVitals(patientId);
  const { data: patient } = usePatient(patientId);
  const { data: patientMedicationsResponse } = useMedications(patientId);
  const createMutation = useCreateInitialNote(patientId);
  const updateMutation = useUpdateInitialNote(patientId);
  const publishMutation = usePublishInitialNote(patientId);
  const deleteMutation = useDeleteInitialNote(patientId);
  const { data: copyForward, isLoading: copyLoading } = useCopyForwardData(patientId);
  const { registerPublishHandler } = useUiStore();

  const [isEditing, setIsEditing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [localAttachments, setLocalAttachments] = useState<{ tag: string, textResult: string, file: File | null }[]>([]);
  const uploadAttachment = useUploadAttachment();

  const hasProgressNotes = progressResponse?.data && progressResponse.data.length > 0;
  const isPublished = note?.status === 'PUBLISHED';
  const canEditAll = !isPublished;
  const isHistoryEditableOnly = false;

  const historyTextareaClass = cn(
    "w-full px-3 py-2.5 field-input resize-y min-h-[90px] leading-[1.65] transition-all",
    isHistoryEditableOnly && "border-amber/60 bg-[#FEFDF0] focus:border-amber focus:shadow-[0_0_0_2px_rgba(245,158,11,0.2)] font-medium text-text-primary"
  );

  // Shorter than historyTextareaClass (min-h-[90px]) — four of those in a 2x2
  // grid would roughly double the PMH section's height. ~68px ≈ 2 lines.
  const pmhTextareaClass = cn(
    "w-full px-3 py-2.5 field-input resize-y min-h-[68px] leading-[1.65] transition-all",
    isHistoryEditableOnly && "border-amber/60 bg-[#FEFDF0] focus:border-amber focus:shadow-[0_0_0_2px_rgba(245,158,11,0.2)] font-medium text-text-primary"
  );
  const [showClearModal, setShowClearModal] = useState(false);
  const [showUnsaveModal, setShowUnsaveModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  const [deleteProblemIndex, setDeleteProblemIndex] = useState<number | null>(null);
  const [deleteMedIndex, setDeleteMedIndex] = useState<number | null>(null);
  const [editMedIndex, setEditMedIndex] = useState<number | null>(null);

  const [probError, setProbError] = useState('');
  const [addingProb, setAddingProb] = useState(false);

  const patientMedications = patientMedicationsResponse?.data || [];
  const nameOptions = buildMedicationSuggestions(patientMedications);

  const isFemale = patient?.sex?.toLowerCase() === 'female';

  const form = useForm<InitialNoteDraftValues>({
    resolver: zodResolver(initialNotePublishSchema) as any,
    mode: 'onChange',
    defaultValues: {
      chiefComplaint: '',
      hpi: '',
      pmhComorbidities: '',
      pmhSurgeries: '',
      pmhHospitalizations: '',
      allergies: '',
      familyHistory: '',
      socialHistory: '',
      obHistory: '',
      psychosocialHistory: '',
      physicalExam: '',
      assessment: [],
      medicationSnapshot: [],
      mgmtNonpharm: '',
      mgmtPharm: '',
      diagnostics: [],
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

  useEffect(() => {
    if (note) {
        const draftProblems = note.assessment as any[] || [];
        const validProblems = draftProblems.filter((p: any) => p && p.title);
        
        const draftMeds = note.medicationSnapshot as any[] || [];
        const validMeds = draftMeds.filter((m: any) => m && (typeof m === 'string' ? m.trim() : m.name));

        form.reset({
          chiefComplaint: note.chiefComplaint || '',
          hpi: note.hpi || '',
          pmhComorbidities: note.pmhComorbidities || '',
          pmhSurgeries: note.pmhSurgeries || '',
          pmhHospitalizations: note.pmhHospitalizations || '',
          allergies: note.allergies || '',
          familyHistory: note.familyHistory || '',
          socialHistory: note.socialHistory || '',
          obHistory: note.obHistory || '',
          psychosocialHistory: note.psychosocialHistory || '',
          physicalExam: note.physicalExam || '',
          assessment: validProblems.length > 0
            ? validProblems
            : (copyForward?.activeProblems || []).map((p: any) => ({ title: p.title })),
          medicationSnapshot: validMeds.length > 0
            ? validMeds
            : (copyForward?.activeMedications || []).map((m: any) => ({
                name: m.name,
                dose: m.dose || undefined,
                formulation: m.formulation || undefined,
                quantity: m.quantity || undefined,
                instructions: m.instructions || undefined,
              })),
          mgmtNonpharm: note.mgmtNonpharm || '',
          mgmtPharm: note.mgmtPharm || '',
        diagnostics: note.diagnostics || [],
        visitDatetime: note.createdAt,
      });
    } else if (!copyLoading) {
      // Check local storage
      const draft = localStorage.getItem(`damayan:draft:${patientId}:initial`);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          const draftProblems = parsed.assessment as any[] || [];
          const validProblems = draftProblems.filter((p: any) => p && p.title);
          const draftMeds = parsed.medicationSnapshot as any[] || [];
          const validMeds = draftMeds.filter((m: any) => m && (typeof m === 'string' ? m.trim() : m.name)).map((m: any) => typeof m === 'string' ? { name: m, dose: '' } : {
            name: m.name,
            dose: m.dose || undefined,
            formulation: m.formulation || undefined,
            quantity: m.quantity || undefined,
            instructions: m.instructions || undefined,
            source: m.source,
          });

          if (validProblems.length === 0) {
            parsed.assessment = (copyForward?.activeProblems || []).map((p: any) => ({ title: p.title }));
          } else {
            parsed.assessment = validProblems;
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
        chiefComplaint: '',
        hpi: '',
        pmhComorbidities: '',
        pmhSurgeries: '',
        pmhHospitalizations: '',
        allergies: '',
        familyHistory: '',
        socialHistory: '',
        obHistory: '',
        psychosocialHistory: '',
        physicalExam: '',
        assessment: (copyForward?.activeProblems || []).map((p: any) => ({ title: p.title })),
        medicationSnapshot: (copyForward?.activeMedications || []).map((m: any) => ({
          name: m.name,
          dose: m.dose || undefined,
          formulation: m.formulation || undefined,
          quantity: m.quantity || undefined,
          instructions: m.instructions || undefined,
        })),
        mgmtNonpharm: '',
        mgmtPharm: '',
        diagnostics: [],
        visitDatetime: new Date().toISOString(),
      });
    }
  }, [note, copyLoading, form, patientId, copyForward]);

  const formValues = form.watch();

  const appendMedication = (values: MedicationSnapshotValues, source: MedSource) => {
    const current = form.getValues('medicationSnapshot') || [];
    form.setValue('medicationSnapshot', [...current, { ...values, source }], { shouldDirty: true, shouldTouch: true });
  };

  // Flat-array indices preserved through the filter — the History section's
  // edit/delete buttons splice the same medicationSnapshot array as the Plan
  // section, so they must operate on true indices, not filtered-list ones.
  const pastMedEntries = (formValues.medicationSnapshot || [])
    .map((med: any, index: number) => ({ med, index }))
    .filter(({ med }: { med: any }) => getMedSource(med) === 'past');

  const publishAndSwitchRef = useRef<() => Promise<boolean>>(undefined);

  publishAndSwitchRef.current = async (): Promise<boolean> => {
    setPublishError(null);
    const isValid = await form.trigger();
    if (!isValid) {
      setPublishError("Please fill out all required fields: Chief Complaint, HPI, Physical Exam, and at least one Assessment.");
      
      const errors = form.formState.errors;
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        setTimeout(() => {
          const element = 
            document.getElementsByName(firstErrorField)[0] || 
            document.getElementById(`field-${firstErrorField}`) ||
            document.getElementById(firstErrorField);
          
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            (element as HTMLElement).focus?.();
          }
        }, 50);
      }
      return false;
    }

    return new Promise((resolve) => {
      if (note) {
        updateMutation.mutate({ id: note.id, data: formValues }, {
          onSuccess: () => {
            publishMutation.mutate(note.id, {
              onSuccess: () => {
                localStorage.removeItem(`damayan:draft:${patientId}:initial`);
                resolve(true);
              },
              onError: (err: any) => {
                setPublishError(err?.response?.data?.message || err.message || 'Failed to publish note');
                resolve(false);
              }
            });
          },
          onError: (err: any) => {
            setPublishError(err?.response?.data?.message || err.message || 'Failed to save draft before publishing');
            resolve(false);
          }
        });
      } else {
        createMutation.mutate(formValues, {
          onSuccess: (newNote) => {
            const noteIdToPublish = (newNote as any)?.data?.id || newNote?.id;
            if (!noteIdToPublish) {
              setPublishError('Failed to retrieve new note ID for publishing');
              resolve(false);
              return;
            }
            publishMutation.mutate(noteIdToPublish, {
              onSuccess: () => {
                localStorage.removeItem(`damayan:draft:${patientId}:initial`);
                resolve(true);
              },
              onError: (err: any) => {
                setPublishError(err?.response?.data?.message || err.message || 'Failed to publish note');
                resolve(false);
              }
            });
          },
          onError: (err: any) => {
            setPublishError(err?.response?.data?.message || err.message || 'Failed to create draft before publishing');
            resolve(false);
          }
        });
      }
    });
  };

  const isDraftActive = !!note?.id || form.formState.isDirty || localAttachments.length > 0;

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

  const handleSave = (data: InitialNoteDraftValues) => {
    if (note) {
      updateMutation.mutate({ id: note.id, data }, {
        onSuccess: async () => {
          if (localAttachments.length > 0) {
            for (const att of localAttachments) {
              try {
                await uploadAttachment.mutateAsync({
                  patientId,
                  noteType: 'INITIAL_NOTE',
                  noteId: note.id,
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
          if (isPublished) {
            setIsEditing(false);
          } else {
            router.push(`/dashboard/${patientId}/notes`);
          }
        }
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: async (newNote) => {
          const noteIdToUpload = (newNote as any)?.data?.id || newNote?.id;
          if (noteIdToUpload && localAttachments.length > 0) {
            for (const att of localAttachments) {
              try {
                await uploadAttachment.mutateAsync({
                  patientId,
                  noteType: 'INITIAL_NOTE',
                  noteId: noteIdToUpload,
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
          router.push(`/dashboard/${patientId}/notes`);
        }
      });
    }
  };

  useAutoSave(formValues, (data) => {
    localStorage.setItem(`damayan:draft:${patientId}:initial`, JSON.stringify(data));
  }, `damayan:draft:${patientId}:initial`, 5000);

  const handlePublish = async () => {
    setPublishError(null);
    const isValid = await form.trigger();
    if (!isValid) {
      setPublishError("Please fill out all required fields: Chief Complaint, HPI, Physical Exam, and at least one Assessment.");
      
      const errors = form.formState.errors;
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        setTimeout(() => {
          const element = 
            document.getElementsByName(firstErrorField)[0] || 
            document.getElementById(`field-${firstErrorField}`) ||
            document.getElementById(firstErrorField);
          
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            (element as HTMLElement).focus?.();
          }
        }, 50);
      }
      return;
    }
    setShowPublishModal(true);
  };

  const executePublish = () => {
    if (note) {
      // Save latest state first
      updateMutation.mutate({ id: note.id, data: formValues }, {
        onSuccess: () => {
          publishMutation.mutate(note.id, {
            onSuccess: async () => {
              if (localAttachments.length > 0) {
                for (const att of localAttachments) {
                  try {
                    await uploadAttachment.mutateAsync({
                      patientId,
                      noteType: 'INITIAL_NOTE',
                      noteId: note.id,
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
              setShowPublishModal(false);
              localStorage.removeItem(`damayan:draft:${patientId}:initial`);
              router.push(`/dashboard/${patientId}/notes`);
            },
            onError: (err: any) => {
              setShowPublishModal(false);
              setPublishError(err?.response?.data?.message || err.message || 'Failed to publish note');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          });
        },
        onError: (err: any) => {
          setShowPublishModal(false);
          setPublishError(err?.response?.data?.message || err.message || 'Failed to save draft before publishing');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    } else {
      createMutation.mutate(formValues, {
        onSuccess: (newNote) => {
          const noteIdToPublish = (newNote as any)?.data?.id || newNote?.id;
          if (!noteIdToPublish) {
            setPublishError('Failed to retrieve new note ID for publishing');
            return;
          }
          publishMutation.mutate(noteIdToPublish, {
            onSuccess: async () => {
              if (localAttachments.length > 0) {
                for (const att of localAttachments) {
                  try {
                    await uploadAttachment.mutateAsync({
                      patientId,
                      noteType: 'INITIAL_NOTE',
                      noteId: noteIdToPublish,
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
              setShowPublishModal(false);
              localStorage.removeItem(`damayan:draft:${patientId}:initial`);
              router.push(`/dashboard/${patientId}/notes`);
            },
            onError: (err: any) => {
              setShowPublishModal(false);
              setPublishError(err?.response?.data?.message || err.message || 'Failed to publish note');
            }
          });
        },
        onError: (err: any) => {
          setShowPublishModal(false);
          setPublishError(err?.response?.data?.message || err.message || 'Failed to create draft before publishing');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
  };

  if (isLoading || progressLoading) {
    return (
      <div className="flex flex-col gap-6 w-full animate-pulse pb-10">
        {/* Use the shared skeleton token, not bg-surface — bg-surface matches the card
            background so the shimmer was effectively invisible (design-standard.md §6.8). */}
        <div className="h-[90px] bg-skeleton rounded-card" />
        <div className="h-[180px] bg-skeleton rounded-card" />
        <div className="h-[140px] bg-skeleton rounded-card" />
        <div className="h-[180px] bg-skeleton rounded-card" />
        <div className="h-[130px] bg-skeleton rounded-card" />
        <div className="h-[160px] bg-skeleton rounded-card" />
      </div>
    );
  }

  const isSaving = updateMutation.isPending || createMutation.isPending || publishMutation.isPending;

  const hrStatus = latestVitals ? classifyHeartRate(latestVitals.heartRate) : 'unknown';
  const rrStatus = latestVitals ? classifyRespiratoryRate(latestVitals.respiratoryRate) : 'unknown';
  const tempStatus = latestVitals ? classifyTemperature(Number(latestVitals.temperature)) : 'unknown';
  const o2Status = latestVitals ? classifyOxygenSaturation(latestVitals.oxygenSaturation) : 'unknown';
  const bpStatus = latestVitals ? classifyBloodPressure(latestVitals.sbp, latestVitals.dbp) : 'unknown';

  const getStatusColor = (status: 'normal' | 'warn' | 'critical' | 'unknown') => {
    switch (status) {
      case 'critical': return 'text-red font-semibold';
      case 'warn': return 'text-amber font-medium';
      case 'normal': return 'text-green';
      default: return 'text-[var(--text-secondary)]';
    }
  };

  const measuredAt = latestVitals 
    ? new Date(latestVitals.measuredAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const measuredBy = latestVitals
    ? latestVitals.measuredByUser
      ? `${latestVitals.measuredByUser.lastName}`
      : (latestVitals.measuredBy ?? '—')
    : '';

  const renderVitalCell = (
    label: string,
    valueStr: string,
    unit: string,
    status: 'normal' | 'warn' | 'critical' | 'unknown',
    subText?: string
  ) => (
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[9px] font-bold uppercase tracking-[0.5px] text-text-muted">{label}</span>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={`font-mono text-[18px] ${
          status === 'critical' ? 'text-red font-semibold' :
          status === 'warn' ? 'text-amber font-medium' :
          'text-text-primary font-bold'
        } leading-none`}>
          {valueStr}
        </span>
        {valueStr !== '—' && valueStr !== '—/—' && <span className="text-[11px] text-text-muted">{unit}</span>}
      </div>
      <div className="text-[10px] text-text-muted font-sans mt-0.5">
        {subText || '—'}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 pb-32">
      {note?.status === 'PUBLISHED' && !isEditing ? (
        // ==================== READ-ONLY PUBLISHED VIEW ====================
        <div className="flex flex-col gap-6 w-full">
          {/* HEADER BAR FOR PUBLISHED NOTE */}
          <div className="flex items-center justify-between bg-surface border border-border rounded-card shadow-card px-4 py-3 w-full">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-btn bg-accent-light flex items-center justify-center text-accent shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-text-primary">Initial Consultation Note</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Published
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
                  <span>
                    Published by <strong className="font-semibold text-text-secondary">{note.author ? `${note.author.role === 'DOCTOR' ? 'Dr. ' : ''}${note.author.firstName} ${note.author.lastName}` : 'Author'}</strong>
                  </span>
                  <span>•</span>
                  <span>{new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {note.lastEditor && (
                <div className="hidden @md:flex items-center gap-1.5 text-[10px] font-medium text-text-muted bg-surface-2 border border-border px-2.5 py-1 rounded-btn">
                  <Edit className="w-3 h-3 text-text-secondary" />
                  <span>
                    Edited by {note.lastEditor.role === 'DOCTOR' ? 'Dr. ' : ''}{note.lastEditor.lastName} · {new Date(note.lastEditedAt || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="h-[32px] px-3.5 rounded-btn text-[11px] font-semibold bg-accent text-white hover:bg-accent-hover transition-colors inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Note</span>
              </button>
            </div>
          </div>

          {/* VITALS CARD */}
          <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-[24px] h-[24px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                  <Heart size={13} className="text-accent" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-primary">
                  Vital Signs
                </span>
              </div>
              {latestVitals && (
                <div className="flex items-center gap-2 text-[10px] text-text-muted font-sans">
                  <span>Recorded {new Date(latestVitals.measuredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {new Date(latestVitals.measuredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {latestVitals.measuredByUser && (
                    <>
                      <span>•</span>
                      <span>By {latestVitals.measuredByUser.firstName} {latestVitals.measuredByUser.lastName}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="p-3.5">
              {latestVitals ? (
                <div className="grid grid-cols-5 gap-2.5 @max-[1439px]:grid-cols-3 @max-[1023px]:grid-cols-3 @max-[767px]:grid-cols-2">
                  {renderVitalCell(
                    'Blood Pressure',
                    latestVitals.sbp || latestVitals.dbp ? `${latestVitals.sbp ?? '—'}/${latestVitals.dbp ?? '—'}` : '—',
                    'mmHg',
                    bpStatus,
                    'systolic / diastolic'
                  )}
                  {renderVitalCell(
                    'Heart Rate',
                    latestVitals.heartRate?.toString() ?? '—',
                    'bpm',
                    hrStatus,
                    hrStatus === 'normal' ? 'Normal' : hrStatus === 'unknown' ? 'Not recorded' : 'Out of range'
                  )}
                  {renderVitalCell(
                    'Resp Rate',
                    latestVitals.respiratoryRate?.toString() ?? '—',
                    '/min',
                    rrStatus,
                    rrStatus === 'normal' ? 'Normal' : rrStatus === 'unknown' ? 'Not recorded' : 'Out of range'
                  )}
                  {renderVitalCell(
                    'Temperature',
                    formatTemperature(Number(latestVitals.temperature)),
                    '°C',
                    tempStatus,
                    tempStatus === 'normal' ? 'Normal' : tempStatus === 'unknown' ? 'Not recorded' : 'Out of range'
                  )}
                  {renderVitalCell(
                    'SpO2',
                    latestVitals.oxygenSaturation?.toString() ?? '—',
                    '%',
                    o2Status,
                    o2Status === 'normal' ? 'Normal' : o2Status === 'unknown' ? 'Not recorded' : 'Out of range'
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-text-muted p-1">No vitals recorded for this note.</div>
              )}
            </div>
          </div>

          {/* SUBJECTIVE CARD */}
          <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-blue-bg/30 border-b border-border">
              <div className="w-[24px] h-[24px] rounded-icon bg-blue-bg flex items-center justify-center flex-shrink-0">
                <MessageSquare size={13} className="text-blue" strokeWidth={2.5} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-blue flex-1">
                Subjective
              </span>
              <span className="text-[10px] text-text-muted font-medium">Patient's reported complaints and history</span>
            </div>

            <div className="p-4 grid grid-cols-1 @min-[1024px]:grid-cols-2 gap-6 items-start">
              {/* Left Column */}
              <div className="flex flex-col gap-4">
                {/* Chief Complaint */}
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-blue mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue" />
                    <span>Chief Complaint</span>
                  </div>
                  <div className="text-[13px] text-text-primary font-semibold leading-relaxed bg-blue-bg/20 border border-blue-border/30 rounded-btn px-3.5 py-2.5">
                    {note.chiefComplaint || '—'}
                  </div>
                </div>

                {/* History of Present Illness */}
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-blue mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue" />
                    <span>History of Present Illness</span>
                  </div>
                  <div className="text-[13px] text-text-secondary whitespace-pre-wrap leading-[1.7] bg-surface-2/40 border border-border/70 rounded-btn p-3.5">
                    {note.hpi || '—'}
                  </div>
                </div>

                {/* Personal and Social History */}
                {note.socialHistory && (
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-blue mb-1.5 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-blue" />
                      <span>Personal and Social History</span>
                    </div>
                    <div className="text-[12.5px] text-text-secondary whitespace-pre-wrap leading-relaxed bg-surface-2/40 border border-border/70 rounded-btn p-3">
                      {note.socialHistory}
                    </div>
                  </div>
                )}

                {/* Psychosocial History */}
                {note.psychosocialHistory && (
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-blue mb-1.5 flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-blue" />
                      <span>Psychosocial History</span>
                    </div>
                    <div className="text-[12.5px] text-text-secondary whitespace-pre-wrap leading-relaxed bg-surface-2/40 border border-border/70 rounded-btn p-3">
                      {note.psychosocialHistory}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-4 border-l border-border pl-6 max-@md:border-l-0 max-@md:pl-0">
                {/* Past Medical History */}
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-amber mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-amber" />
                    <span>Past Medical History</span>
                  </div>
                  <div className="flex flex-col text-[12.5px] bg-surface-2/60 border border-border rounded-lg overflow-hidden divide-y divide-border/60">
                    <div className="p-3 flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-text-muted">Comorbidities</span>
                      <span className="text-text-primary font-medium leading-relaxed">{note.pmhComorbidities || 'None'}</span>
                    </div>
                    <div className="p-3 flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-text-muted">Surgeries</span>
                      <span className="text-text-primary font-medium leading-relaxed">{note.pmhSurgeries || 'None'}</span>
                    </div>
                    <div className="p-3 flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-text-muted">Hospitalizations</span>
                      <span className="text-text-primary font-medium leading-relaxed">{note.pmhHospitalizations || 'None'}</span>
                    </div>
                    <div className="p-3 flex flex-col gap-1 bg-surface">
                      <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-text-muted">Allergies</span>
                      {note.allergies ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-bg border border-red-border text-red font-semibold text-[12px] w-fit">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{note.allergies}</span>
                        </div>
                      ) : (
                        <span className="text-text-secondary font-medium">No known allergies</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Family Medical History */}
                {note.familyHistory && (
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-amber mb-1.5 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber" />
                      <span>Family Medical History</span>
                    </div>
                    <div className="text-[12.5px] text-text-secondary whitespace-pre-wrap leading-relaxed bg-surface-2/40 border border-border/70 rounded-btn p-3">
                      {note.familyHistory}
                    </div>
                  </div>
                )}

                {/* OB/Menstrual History */}
                {isFemale && note.obHistory && (
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-amber mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber" />
                      <span>OB / Menstrual History</span>
                    </div>
                    <div className="text-[12.5px] text-text-secondary whitespace-pre-wrap leading-relaxed bg-surface-2/40 border border-border/70 rounded-btn p-3">
                      {note.obHistory}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* OBJECTIVE & ASSESSMENT GRID */}
          <div className="grid grid-cols-1 @min-[1024px]:grid-cols-2 gap-6 items-stretch">
            {/* OBJECTIVE CARD */}
            <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden flex flex-col">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-purple-bg/30 border-b border-border">
                <div className="w-[24px] h-[24px] rounded-icon bg-purple-bg flex items-center justify-center flex-shrink-0">
                  <Microscope size={13} className="text-purple" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-purple flex-1">
                  Objective
                </span>
                <span className="text-[10px] text-text-muted font-medium">Physical exam & findings</span>
              </div>
              <div className="p-4 flex flex-col gap-4 flex-1">
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-purple mb-1.5 flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-purple" />
                    <span>Physical Examination</span>
                  </div>
                  <div className="text-[13px] text-text-secondary whitespace-pre-wrap leading-[1.7] bg-surface-2/40 border border-border/70 rounded-btn p-3.5 font-sans">
                    {note.physicalExam || '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* ASSESSMENT CARD */}
            <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden flex flex-col">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-accent-light/30 border-b border-border">
                <div className="w-[24px] h-[24px] rounded-icon bg-accent-light flex items-center justify-center flex-shrink-0">
                  <ClipboardList size={13} className="text-accent" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-accent flex-1">
                  Assessment
                </span>
                <span className="text-[10px] text-text-muted font-medium">Active diagnoses</span>
              </div>
              <div className="p-4 flex flex-col gap-3 flex-1">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-accent mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-accent" />
                    <span>Active Problems</span>
                  </div>
                  {note.assessment && Array.isArray(note.assessment) && note.assessment.length > 0 && (
                    <span className="text-[10px] font-bold bg-accent-light text-accent px-1.5 py-0.5 rounded-full">
                      {note.assessment.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-surface divide-y divide-border/60">
                  {note.assessment && Array.isArray(note.assessment) && note.assessment.length > 0 ? (
                    note.assessment.map((item: any, idx: number) => {
                      const titleStr = typeof item === 'string' ? item : item.title;
                      const titleKey = titleStr?.trim().toLowerCase();
                      const depth = typeof item !== 'string' && item.depth !== undefined
                        ? item.depth
                        : (titleKey && activeDepthMap.has(titleKey)
                            ? activeDepthMap.get(titleKey)!
                            : (typeof item !== 'string' && item.parentId ? 1 : 0));

                      return (
                        <div key={idx} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-surface-2/60 transition-colors">
                          <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                          <div 
                            className="flex-1 min-w-0"
                            style={depth > 0 ? { paddingLeft: `${depth * 18}px` } : undefined}
                          >
                            <span className="text-[13px] text-text-primary font-semibold">
                              {depth > 0 && <span className="font-mono text-text-muted mr-1.5 select-none">↳</span>}
                              {titleStr}
                            </span>
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-accent bg-accent-light/50 border border-accent/20 px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-[12px] text-text-muted text-center">No active problems registered.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* PLAN / MANAGEMENT CARD */}
          <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-green-bg/30 border-b border-border">
              <div className="w-[24px] h-[24px] rounded-icon bg-green-bg flex items-center justify-center flex-shrink-0">
                <Stethoscope size={13} className="text-green" strokeWidth={2.5} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-green flex-1">
                Plan / Management
              </span>
              <span className="text-[10px] text-text-muted font-medium">Treatment & orders</span>
            </div>
            <div className="p-4 grid grid-cols-1 @min-[1024px]:grid-cols-2 gap-6 items-start">
              {/* Left Column */}
              <div className="flex flex-col gap-4">
                {/* Non-Pharmacologic */}
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-green mb-1.5 flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-green" />
                    <span>Non-Pharmacologic Management</span>
                  </div>
                  <div className="text-[13px] text-text-secondary whitespace-pre-wrap leading-[1.7] bg-surface-2/40 border border-border/70 rounded-btn p-3.5 font-sans">
                    {note.mgmtNonpharm || '—'}
                  </div>
                </div>

                {/* Diagnostics */}
                {note.diagnostics && Array.isArray(note.diagnostics) && note.diagnostics.length > 0 && (
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-green mb-1.5 flex items-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5 text-green" />
                      <span>Diagnostics</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {note.diagnostics.map((diag: string, idx: number) => (
                        <span key={idx} className="text-[11px] font-semibold bg-surface-2 text-text-primary border border-border px-2.5 py-1 rounded-[6px] shadow-2xs">
                          {diag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pharmacologic Treatment Remarks */}
                {note.mgmtPharm && (
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-green mb-1.5 flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-green" />
                      <span>Pharmacologic Treatment Remarks</span>
                    </div>
                    <div className="text-[13px] text-text-secondary whitespace-pre-wrap leading-[1.7] bg-surface-2/40 border border-border/70 rounded-btn p-3.5 font-sans">
                      {note.mgmtPharm}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-3 border-l border-border pl-6 max-@md:border-l-0 max-@md:pl-0">
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-green mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-green" />
                      <span>Medications Prescribed</span>
                    </div>
                    {note.medicationSnapshot && Array.isArray(note.medicationSnapshot) && note.medicationSnapshot.length > 0 && (
                      <span className="text-[10px] font-bold bg-green-bg text-green px-1.5 py-0.5 rounded-full">
                        {note.medicationSnapshot.length}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-surface divide-y divide-border/60">
                    {note.medicationSnapshot && Array.isArray(note.medicationSnapshot) && note.medicationSnapshot.length > 0 ? (
                      note.medicationSnapshot.map((med: any, idx: number) => {
                        const isPast = getMedSource(med) === 'past';
                        const medName = typeof med === 'string' ? med : med.name;
                        const medDetails = typeof med !== 'string'
                          ? [med.dose, med.formulation, med.quantity ? `Qty: ${med.quantity}` : ''].filter(Boolean).join(' · ')
                          : '';
                        const instructions = typeof med !== 'string' ? med.instructions : '';

                        return (
                          <div key={idx} className="flex flex-col gap-1 p-3 hover:bg-surface-2/50 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={cn("w-2 h-2 rounded-full shrink-0", isPast ? "bg-amber" : "bg-green")} />
                                <span className="text-[13px] font-bold text-text-primary truncate">{medName}</span>
                                {isPast && (
                                  <span className="text-[8px] font-bold text-amber bg-amber-bg border border-amber-border px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                                    Past
                                  </span>
                                )}
                              </div>
                              {medDetails && (
                                <span className="text-[11px] font-medium font-mono text-text-secondary shrink-0 bg-surface-2 px-2 py-0.5 rounded border border-border">
                                  {medDetails}
                                </span>
                              )}
                            </div>
                            {instructions && (
                              <div className="text-[11.5px] text-text-secondary pl-4 leading-relaxed font-sans">
                                {instructions}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-[12px] text-text-muted text-center">No medications prescribed.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ==================== INTERACTIVE FORM DRAFT ====================
        <>
          {publishError && (
            <div className="p-3 bg-red-bg border border-red-border rounded-card text-red text-[12px] font-medium w-full">
              {publishError}
            </div>
          )}

          {isPublished && (
            <div className={cn(
              "p-3 rounded-card text-[12px] font-medium border flex items-center justify-between",
              isHistoryEditableOnly 
                ? "bg-amber-bg border-amber-border text-amber"
                : "bg-green-bg border-green-border text-green"
            )}>
              <span>
                {isHistoryEditableOnly 
                  ? "⚠ Note is published and has subsequent progress notes. You can only edit the history sections (Medical, Family, Personal, OB, Psychosocial)."
                  : "ℹ Note is published but has no progress notes. You can edit any part of the note."}
              </span>
            </div>
          )}

          <NoteActionBar 
            isSaving={isSaving}
            onSaveDraft={!isPublished ? () => handleSave(formValues) : undefined}
            onSaveChanges={isPublished ? () => handleSave(formValues) : undefined}
            onCancel={isPublished ? () => setIsEditing(false) : undefined}
            onClear={!isPublished ? () => setShowClearModal(true) : undefined}
            onUnsave={note && note.status === 'DRAFT' ? () => setShowUnsaveModal(true) : undefined}
            showPublish={false}
            showSaveAndClear={!isPublished}
          />

          <form className="flex flex-col gap-5 w-full" onSubmit={(e) => e.preventDefault()}>
            {/* No whole-form disable/opacity dim on save — saving is surfaced inline on the
                action buttons (design-standard.md §7.3). The clinician can keep reading and
                editing while a save round-trips, per the "auto-save always on" principle. */}
            <fieldset className="flex flex-col gap-5 w-full">
            {/* Latest Vitals Snapshot Strip */}
            <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-accent-light/40 border-b border-accent-mid">
                <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-3.5 h-3.5 text-accent" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-hover flex-1">
                  Latest Vital Signs
                </span>
                <span className="font-mono text-[10px] text-text-muted mr-2">
                  {measuredAt ? `Recorded ${measuredAt} · by ${measuredBy}` : 'No vitals recorded'}
                </span>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/${patientId}/vitals`)}
                  disabled={!canEditAll}
                  className="h-[26px] px-3 rounded-btn text-[10px] font-semibold bg-accent text-white border border-accent-hover hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update ↗
                </button>
              </div>
              {/* Vitals grid — horizontal, compact */}
              <div className="px-4 py-3 grid grid-cols-5 gap-3 bg-surface-2/50 @max-[1439px]:grid-cols-3 @max-[1023px]:grid-cols-3 @max-[767px]:grid-cols-2">
                <VitalMiniCell 
                  label="BP" 
                  value={latestVitals ? formatBloodPressure(latestVitals.sbp, latestVitals.dbp) : '—'} 
                  unit="mmHg" 
                  status={bpStatus} 
                />
                <VitalMiniCell 
                  label="HR" 
                  value={latestVitals?.heartRate ?? '—'} 
                  unit="bpm" 
                  status={hrStatus} 
                />
                <VitalMiniCell 
                  label="RR" 
                  value={latestVitals?.respiratoryRate ?? '—'} 
                  unit="/min" 
                  status={rrStatus} 
                />
                <VitalMiniCell 
                  label="Temp" 
                  value={latestVitals?.temperature ? formatTemperature(Number(latestVitals.temperature)) : '—'} 
                  unit="°C" 
                  status={tempStatus} 
                />
                <VitalMiniCell 
                  label="SpO2" 
                  value={latestVitals?.oxygenSaturation ?? '—'} 
                  unit="%" 
                  status={o2Status} 
                />
              </div>
              {!latestVitals && (
                <div className="px-4 pb-3 text-[11px] text-amber font-medium text-center">
                  ⚠ No vitals on record. Record vitals before publishing this note.
                </div>
              )}
            </div>

            {/* 1. Subjective Card */}
            <div className={cn("bg-surface border border-border rounded-card shadow-card overflow-hidden transition-all", isHistoryEditableOnly && "opacity-90 bg-surface-2 border-border/80")}>
              {/* Card Header */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-blue-bg/40 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-blue" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-blue flex-1">
                  Subjective
                </span>
                {isHistoryEditableOnly && (
                  <span className="text-[9px] font-semibold bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB] px-2 py-0.5 rounded-full flex items-center gap-1 mr-2 shrink-0">
                    🔒 Read-Only
                  </span>
                )}
                <span className="text-[10px] text-blue/70 font-medium">Patient's reported complaints and history</span>
              </div>
              {/* Card Body */}
              <div className="p-4 flex flex-col gap-4 bg-surface">
                {/* Chief Complaint field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
                    Chief Complaint {!formValues.chiefComplaint && <span className="text-red font-bold ml-[2px] align-top">*</span>}
                  </label>
                  <input
                    {...form.register('chiefComplaint')}
                    disabled={!canEditAll}
                    className={cn(
                      "h-[36px] w-full px-3 bg-white border-[1.5px] rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:bg-white placeholder:text-[#9BA3B5] disabled:bg-surface-2 disabled:text-text-muted disabled:border-border",
                      form.formState.errors.chiefComplaint
                        ? "border-red focus:border-red focus:shadow-[0_0_0_2px_rgba(239,68,68,0.2)]"
                        : "border-[#9BA3B5] focus:border-accent focus:shadow-accent-focus"
                    )}
                    placeholder="e.g. Persistent headaches and dizziness for 2 weeks"
                    maxLength={50}
                  />
                  {form.formState.errors.chiefComplaint ? (
                    <p className="text-[10px] text-red font-medium">{form.formState.errors.chiefComplaint.message}</p>
                  ) : (
                    <p className="text-[10px] text-text-muted">Max 50 characters. Required to publish.</p>
                  )}
                </div>

                {/* HPI field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
                    History of Present Illness (HPI) {!formValues.hpi && <span className="text-red font-bold ml-[2px] align-top">*</span>}
                  </label>
                  <textarea
                    {...form.register('hpi')}
                    disabled={!canEditAll}
                    className={cn(
                      "w-full px-3 py-2.5 bg-white border-[1.5px] rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[110px] leading-[1.65] transition-all duration-150 focus:bg-white placeholder:text-[#9BA3B5] disabled:bg-surface-2 disabled:text-text-muted disabled:border-border",
                      form.formState.errors.hpi
                        ? "border-red focus:border-red focus:shadow-[0_0_0_2px_rgba(239,68,68,0.2)]"
                        : "border-[#9BA3B5] focus:border-accent focus:shadow-accent-focus"
                    )}
                    placeholder="Describe onset, character, duration, associated symptoms, relieving/aggravating factors…"
                  />
                  {form.formState.errors.hpi && (
                    <p className="text-[10px] text-red font-medium">{form.formState.errors.hpi.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. History Card */}
            {/* No overflow-hidden here: the Past Medication combobox below needs to
                escape this card's bottom edge (see Plan/Management card for precedent). */}
            <div className="bg-surface border border-border rounded-card shadow-card">
              {/* Card Header */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-bg/40 border-b border-border rounded-t-[7px]">
                <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
                  <History className="w-3.5 h-3.5 text-amber" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-amber flex-1">
                  History
                </span>
                {isHistoryEditableOnly && (
                  <span className="text-[9px] font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FCD34D] px-2 py-0.5 rounded-full flex items-center gap-1 mr-2 shrink-0 animate-pulse">
                    ✏️ Editable
                  </span>
                )}
                <span className="text-[10px] text-amber/70 font-medium">Medical, family, personal, and social background</span>
              </div>
              {/* Card Body */}
              <div className="divide-y divide-border bg-surface">
                <CollapsibleSection 
                  title="Past Medical History (PMH)" 
                  variant="row" 
                  defaultOpen
                  theme="amber"
                  icon={<ClipboardList className="w-3.5 h-3.5" />}
                >
                  <div className="grid grid-cols-1 @min-[1024px]:grid-cols-2 gap-3 items-start">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.6px] block mb-1">
                        Comorbidities
                      </label>
                      <textarea
                        {...form.register('pmhComorbidities')}
                        rows={2}
                        className={pmhTextareaClass}
                        placeholder="e.g. Diabetes Mellitus (2018), Asthma"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.6px] block mb-1">
                        Previous Surgeries
                      </label>
                      <textarea
                        {...form.register('pmhSurgeries')}
                        rows={2}
                        className={pmhTextareaClass}
                        placeholder="e.g. Appendectomy (2015)"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.6px] block mb-1">
                        Previous Hospitalizations
                      </label>
                      <textarea
                        {...form.register('pmhHospitalizations')}
                        rows={2}
                        className={pmhTextareaClass}
                        placeholder="e.g. Dengue (2022)"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.6px] block mb-1">
                        Allergies
                      </label>
                      <textarea
                        {...form.register('allergies')}
                        rows={2}
                        className={pmhTextareaClass}
                        placeholder="e.g. Penicillin (rash), Sulfa"
                      />
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Past Medication"
                  variant="row"
                  theme="amber"
                  icon={<Pill className="w-3.5 h-3.5" />}
                >
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] text-text-muted -mt-0.5 mb-1">
                      Medications recorded here also appear under Prescribed Medications and are saved to the patient's cumulative medication list when this note is published.
                    </p>
                    {pastMedEntries.length === 0 ? (
                      <div className="text-[11px] text-text-muted">No past medications recorded.</div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {pastMedEntries.map(({ med, index }: { med: any; index: number }) => (
                          <div key={index} className="flex items-start gap-2 py-2 px-3 border border-border bg-white rounded-btn text-[12px] text-text-primary shadow-sm group">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber shrink-0 mt-1.5"></div>
                            <div className="flex-1 min-w-0 break-words whitespace-normal">
                              <span className="font-semibold break-words">{typeof med === 'string' ? med : med.name}</span>
                              {typeof med !== 'string' && med.dose && (
                                <span className="font-mono text-amber font-semibold ml-1.5">{med.dose}</span>
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
                            {canEditAll && (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => setEditMedIndex(index)}
                                  className="text-text-muted hover:text-accent transition-colors w-6 h-6 rounded-md"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => setDeleteMedIndex(index)}
                                  className="text-text-muted hover:text-red transition-colors w-6 h-6 rounded-md"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {canEditAll && (
                      <MedicationAddForm
                        nameOptions={nameOptions}
                        onAdd={(values) => appendMedication(values, 'past')}
                        addLabel="+ Add Past Medication"
                      />
                    )}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Family Medical History"
                  variant="row"
                  theme="amber"
                  icon={<Users className="w-3.5 h-3.5" />}
                >
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      {...form.register('familyHistory')}
                      className={historyTextareaClass}
                      placeholder="e.g. Father: Hypertension, CVA. Mother: DM."
                    />
                  </div>
                </CollapsibleSection>
 
                <CollapsibleSection 
                  title="Personal & Social History" 
                  variant="row"
                  theme="amber"
                  icon={<User className="w-3.5 h-3.5" />}
                >
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      {...form.register('socialHistory')}
                      className={historyTextareaClass}
                      placeholder="e.g. Non-smoker, occasional alcohol. Sedentary lifestyle."
                    />
                  </div>
                </CollapsibleSection>
 
                {isFemale && (
                  <CollapsibleSection 
                    title="OB / Menstrual History" 
                    variant="row"
                    theme="amber"
                    icon={<Calendar className="w-3.5 h-3.5" />}
                  >
                    <div className="flex flex-col gap-1.5">
                      <textarea
                        {...form.register('obHistory')}
                        className={historyTextareaClass}
                        placeholder="e.g. G0P0. Regular menses. LMP: May 12, 2026."
                      />
                    </div>
                  </CollapsibleSection>
                )}
 
                <CollapsibleSection 
                  title="Psychosocial History" 
                  variant="row"
                  theme="amber"
                  icon={<Brain className="w-3.5 h-3.5" />}
                >
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      {...form.register('psychosocialHistory')}
                      className={historyTextareaClass}
                      placeholder="e.g. Works as accountant, high stress lately. Good family support system."
                    />
                  </div>
                </CollapsibleSection>
              </div>
            </div>

            {/* 3. Objective Card */}
            <div className={cn("bg-surface border border-border rounded-card shadow-card overflow-hidden transition-all", isHistoryEditableOnly && "opacity-90 bg-surface-2 border-border/80")}>
              {/* Card Header */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-purple-bg/40 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
                  <Microscope className="w-3.5 h-3.5 text-purple" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-purple flex-1">
                  Objective
                </span>
                {isHistoryEditableOnly && (
                  <span className="text-[9px] font-semibold bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB] px-2 py-0.5 rounded-full flex items-center gap-1 mr-2 shrink-0">
                    🔒 Read-Only
                  </span>
                )}
                <span className="text-[10px] text-purple/70 font-medium">Physical exam and diagnostic results</span>
              </div>
              <div className="p-4 flex flex-col gap-4 bg-surface">
                {/* Physical Examination textarea */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
                    Physical Examination {!formValues.physicalExam && <span className="text-red font-bold ml-[2px] align-top">*</span>}
                  </label>
                  <textarea
                    {...form.register('physicalExam')}
                    disabled={!canEditAll}
                    className={cn(
                      "w-full px-3 py-2.5 bg-white border-[1.5px] rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[110px] leading-[1.65] transition-all duration-150 focus:bg-white placeholder:text-[#9BA3B5] disabled:bg-surface-2 disabled:text-text-muted disabled:border-border",
                      form.formState.errors.physicalExam
                        ? "border-red focus:border-red focus:shadow-[0_0_0_2px_rgba(239,68,68,0.2)]"
                        : "border-[#9BA3B5] focus:border-accent focus:shadow-accent-focus"
                    )}
                    placeholder="General: Conscious, coherent, not in acute distress…&#10;HEENT: Anicteric sclerae, pink conjunctivae…&#10;Lungs: Clear to auscultation bilaterally…"
                  />
                  {form.formState.errors.physicalExam && (
                    <p className="text-[10px] text-red font-medium">{form.formState.errors.physicalExam.message}</p>
                  )}
                </div>

                {/* Labs and Imaging */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
                    Labs and Imaging Results
                  </label>
                  {canEditAll && (
                    <AttachmentsSection 
                      patientId={patientId} 
                      noteType="INITIAL_NOTE" 
                      noteId={note?.id} 
                      localAttachments={localAttachments}
                      onAddLocalAttachment={(att) => setLocalAttachments(prev => [...prev, att])}
                      onRemoveLocalAttachment={(idx) => setLocalAttachments(prev => prev.filter((_, i) => i !== idx))}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 4. Assessment Card */}
            <div className={cn("bg-surface border border-border rounded-card shadow-card overflow-hidden transition-all", isHistoryEditableOnly && "opacity-90 bg-surface-2 border-border/80")}>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-accent-light/40 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-white/60 shrink-0">
                  <ClipboardList size={14} className="text-accent" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-hover flex-1">
                  Assessment (Active Problems) {(!formValues.assessment || formValues.assessment.length === 0) && <span className="text-red font-bold ml-[2px] align-top">*</span>}
                </span>
                {isHistoryEditableOnly && (
                  <span className="text-[9px] font-semibold bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB] px-2 py-0.5 rounded-full flex items-center gap-1 mr-2 shrink-0">
                    🔒 Read-Only
                  </span>
                )}
                <span className="text-[10px] text-accent-hover/70 font-medium">Required to publish</span>
              </div>
              <div className="p-4 flex flex-col gap-3 bg-surface">
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Add the active problems or diagnoses for this visit. These will be automatically synced with the patient's global Problem List.
                </p>
                <Controller
                  control={form.control}
                  name="assessment"
                  render={({ field }) => (
                    <div className="flex flex-col gap-1.5" id="field-assessment">
                      <div className="flex flex-col gap-1">
                        {field.value?.map((prob: any, idx: number) => {
                          const titleStr = typeof prob === 'string' ? prob : prob.title;
                          const titleKey = titleStr?.trim().toLowerCase();
                          const depth = typeof prob !== 'string' && prob.depth !== undefined
                            ? prob.depth
                            : (titleKey && activeDepthMap.has(titleKey)
                                ? activeDepthMap.get(titleKey)!
                                : (typeof prob !== 'string' && prob.parentId ? 1 : 0));

                          return (
                            <div key={idx} className="flex items-center gap-2 py-1.5 border-b border-border last:border-b-0 text-[12px] text-text-primary">
                              <div className="w-2 h-2 rounded-full bg-accent-mid shrink-0"></div>
                              <div 
                                className="flex-1 min-w-0 truncate"
                                style={depth > 0 ? { paddingLeft: `${depth * 20}px` } : undefined}
                              >
                                {depth > 0 && <span className="font-mono text-text-muted mr-1 select-none">↳</span>}
                                {titleStr}
                              </div>
                            {canEditAll && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setDeleteProblemIndex(idx)}
                                className="text-text-muted hover:text-red transition-colors w-6 h-6 rounded-md"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                        {canEditAll && (
                          <div className="grid grid-cols-12 gap-2.5 mt-3 pt-3 border-t border-border bg-surface-2 p-3 rounded-[8px]">
                            <div className="col-span-12 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Problem Title <span className="text-red">*</span></label>
                              <input id="newProbTitle" placeholder="e.g. Hypertension" className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]" />
                            </div>
                            <div className="col-span-12 flex justify-between items-center mt-1">
                              {probError ? (
                                <span className="text-red font-medium text-[10px]">{probError}</span>
                              ) : <span />}
                              <Button
                                type="button"
                                variant="secondary"
                                size="xs"
                                disabled={addingProb}
                                onClick={() => {
                                  const titleEl = document.getElementById('newProbTitle') as HTMLInputElement;
                                  if (!titleEl.value.trim()) {
                                    setProbError('Problem title is required');
                                    return;
                                  }
                                  setProbError('');
                                  setAddingProb(true);
                                  setTimeout(() => {
                                    const newProbs = [...(field.value || []), { title: titleEl.value.trim() }];
                                    field.onChange(newProbs);
                                    titleEl.value = '';
                                    setAddingProb(false);
                                  }, 400);
                                }}
                                className="h-[28px] px-3.5 bg-surface border border-border text-text-secondary hover:bg-surface-3 hover:text-text-primary rounded font-medium text-[11px] flex items-center gap-1 transition-all"
                              >
                                {addingProb ? 'Adding...' : '+ Add Problem'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      {form.formState.errors.assessment && (
                        <p className="text-[10px] text-red font-medium">
                          {form.formState.errors.assessment.message}
                        </p>
                      )}
                    </div>
                  )}
                />
              </div>
            </div>

            {/* 5. Management Plan Card */}
            <div className={cn("bg-surface border border-border rounded-card shadow-card transition-all", isHistoryEditableOnly && "opacity-90 bg-surface-2 border-border/80")}>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-green-bg/40 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-3.5 h-3.5 text-green" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-green flex-1">
                  Plan / Management
                </span>
                {isHistoryEditableOnly && (
                  <span className="text-[9px] font-semibold bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB] px-2 py-0.5 rounded-full flex items-center gap-1 mr-2 shrink-0">
                    🔒 Read-Only
                  </span>
                )}
                <span className="text-[10px] text-green/70 font-medium">Non-pharmacologic and pharmacologic treatment</span>
              </div>
              <div className="p-4 grid grid-cols-1 @min-[1024px]:grid-cols-2 gap-6 bg-surface">
                {/* Left: Non-Pharmacologic & Diagnostics */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
                      Non-Pharmacologic Management
                    </label>
                    <textarea
                      {...form.register('mgmtNonpharm')}
                      disabled={!canEditAll}
                      className="w-full px-3 py-2.5 bg-white border-[1.5px] border-[#9BA3B5] rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[100px] leading-[1.65] transition-all duration-150 focus:bg-white focus:border-accent focus:shadow-accent-focus placeholder:text-[#9BA3B5] disabled:bg-surface-2 disabled:text-text-muted disabled:border-border"
                      placeholder="e.g. Low-sodium DASH diet. Daily home BP monitoring. Regular aerobic exercise 30 min/day."
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
                      Diagnostics
                    </label>
                    <Controller
                      control={form.control}
                      name="diagnostics"
                      render={({ field }) => (
                        <TagInputField
                          value={field.value || []}
                          onChange={field.onChange}
                          placeholder="Search and select diagnostic... e.g. Lipid Profile pending, Chest X-ray clear"
                          isObjectFormat={false}
                          disabled={!canEditAll}
                        />
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
                      Pharmacologic Treatment Remarks
                    </label>
                    <textarea
                      {...form.register('mgmtPharm')}
                      disabled={!canEditAll}
                      className="w-full px-3 py-2.5 bg-white border-[1.5px] border-[#9BA3B5] rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[80px] leading-[1.65] transition-all duration-150 focus:bg-white focus:border-accent focus:shadow-accent-focus placeholder:text-[#9BA3B5] disabled:bg-surface-2 disabled:text-text-muted disabled:border-border"
                      placeholder="e.g. Continue anti-hypertensives, initiate statin therapy at bedtime…"
                    />
                  </div>
                </div>
                {/* Right: Prescribed Medications */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
                    Prescribed Medications
                  </label>
                  <p className="text-[11px] text-text-muted -mt-0.5">
                    Medications added here are saved to the patient's cumulative medication list when this note is published.
                  </p>
                  <Controller
                    control={form.control}
                    name="medicationSnapshot"
                    render={({ field }) => {
                      const meds = field.value || [];
                      return (
                        <div className="flex flex-col gap-1.5" id="field-medications">
                          {meds.map((med: any, idx: number) => {
                            const isPast = getMedSource(med) === 'past';
                            return (
                              <div key={idx} className="flex items-start gap-2 py-2 px-3 border border-border bg-white rounded-btn text-[12px] text-text-primary shadow-sm group">
                                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-1.5", isPast ? "bg-amber" : "bg-green")}></div>
                                <div className="flex-1 min-w-0 break-words whitespace-normal">
                                  <span className="font-semibold break-words">{typeof med === 'string' ? med : med.name}</span>
                                  {isPast && (
                                    <span className="text-[8px] font-bold text-amber bg-amber-bg border border-amber-border px-1 py-0.5 rounded uppercase tracking-wider ml-1.5 align-middle whitespace-nowrap">
                                      Past
                                    </span>
                                  )}
                                  {typeof med !== 'string' && med.dose && (
                                    <span className={cn("font-mono font-semibold ml-1.5", isPast ? "text-amber" : "text-green")}>{med.dose}</span>
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
                                {canEditAll && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => setEditMedIndex(idx)}
                                      className="text-text-muted hover:text-accent transition-colors w-6 h-6 rounded-md"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => setDeleteMedIndex(idx)}
                                      className="text-text-muted hover:text-red transition-colors w-6 h-6 rounded-md"
                                    >
                                      <TrashIcon className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {canEditAll && (
                            <MedicationAddForm
                              nameOptions={nameOptions}
                              onAdd={(values) => field.onChange([...meds, { ...values, source: 'prescribed' }])}
                            />
                          )}
                        </div>
                      );
                    }}
                  />
                </div>
              </div>
            </div>
            </fieldset>
          </form>

          <div className="mt-2">
            <NoteActionBar 
              isSaving={isSaving}
              isPublishing={publishMutation.isPending}
              onPublish={!isPublished ? handlePublish : undefined}
              onSaveChanges={isPublished ? () => handleSave(formValues) : undefined}
              onCancel={isPublished ? () => setIsEditing(false) : undefined}
              showSaveAndClear={false}
              showPublish={!isPublished}
            />
          </div>
        </>
      )}

      <DeleteConfirmModal
        open={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={() => {
          form.reset({
            chiefComplaint: '',
            hpi: '',
            pmhComorbidities: '',
            pmhSurgeries: '',
            pmhHospitalizations: '',
            allergies: '',
            familyHistory: '',
            socialHistory: '',
            obHistory: '',
            psychosocialHistory: '',
            physicalExam: '',
            assessment: (copyForward?.activeProblems || []).map((p: any) => ({ title: p.title })),
            medicationSnapshot: (copyForward?.activeMedications || []).map((m: any) => ({
              name: m.name,
              dose: m.dose || undefined,
              formulation: m.formulation || undefined,
              quantity: m.quantity || undefined,
              instructions: m.instructions || undefined,
            })),
            mgmtNonpharm: '',
            mgmtPharm: '',
            diagnostics: [],
            visitDatetime: new Date().toISOString(),
          });
          localStorage.removeItem(`damayan:draft:${patientId}:initial`);
          setShowClearModal(false);
        }}
        title="Clear Form"
        message="Are you sure you want to clear the form? This will remove all your current input."
        confirmLabel="Clear"
      />

      <DeleteConfirmModal
        open={showUnsaveModal}
        onClose={() => setShowUnsaveModal(false)}
        onConfirm={() => {
          if (note && note.status === 'DRAFT') {
            deleteMutation.mutate(note.id, {
              onSuccess: () => {
                setShowUnsaveModal(false);
                router.push(`/dashboard/${patientId}/notes`);
              }
            });
          }
        }}
        isDeleting={deleteMutation.isPending}
        title="Unsave Draft"
        message="Are you sure you want to unsave this draft? This will delete the draft from the system."
        confirmLabel="Unsave"
      />

      <DeleteConfirmModal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={executePublish}
        isDeleting={publishMutation.isPending || updateMutation.isPending || createMutation.isPending}
        title="Publish Note"
        message="Are you sure you want to publish this Initial Consultation Note? Once published, it will be finalized and become part of the patient's permanent record."
        confirmLabel="Publish"
        intent="primary"
        loadingLabel="Publishing..."
      />

      <DeleteConfirmModal
        open={deleteProblemIndex !== null}
        onClose={() => setDeleteProblemIndex(null)}
        onConfirm={() => {
          if (deleteProblemIndex !== null) {
            const current = form.getValues('assessment') || [];
            const updated = [...current];
            updated.splice(deleteProblemIndex, 1);
            form.setValue('assessment', updated, { shouldDirty: true, shouldTouch: true });
            setDeleteProblemIndex(null);
          }
        }}
        title="Remove Problem"
        message="Are you sure you want to remove this problem from the active problem list?"
        confirmLabel="Remove"
      />

      <DeleteConfirmModal
        open={deleteMedIndex !== null}
        onClose={() => setDeleteMedIndex(null)}
        onConfirm={() => {
          if (deleteMedIndex !== null) {
            const current = form.getValues('medicationSnapshot') || [];
            const updated = [...current];
            updated.splice(deleteMedIndex, 1);
            form.setValue('medicationSnapshot', updated, { shouldDirty: true, shouldTouch: true });
            setDeleteMedIndex(null);
          }
        }}
        title="Remove Medication"
        message="Are you sure you want to remove this medication from the prescribed list?"
        confirmLabel="Remove"
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

