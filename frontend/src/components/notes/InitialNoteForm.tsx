import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { CollapsibleSection } from './CollapsibleSection';
import { TagInputField } from './TagInputField';
import { AttachmentUploader } from './AttachmentUploader';
import { NoteStatusBadge } from './NoteStatusBadge';
import { SaveIcon, SendIcon, Heart, History, MessageSquare, Microscope, ClipboardList, Stethoscope, Users, User, Calendar, Brain, Loader2, TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComboboxInput } from '@/components/ui/ComboboxInput';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
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

  const [isEditing, setIsEditing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const hasProgressNotes = progressResponse?.data && progressResponse.data.length > 0;
  const isPublished = note?.status === 'PUBLISHED';
  const canEditAll = !isPublished || !hasProgressNotes;
  const isHistoryEditableOnly = isPublished && hasProgressNotes;

  const historyInputClass = cn(
    "h-[36px] w-full px-3 field-input placeholder:text-[#9BA3B5] transition-all",
    isHistoryEditableOnly && "border-amber/60 bg-[#FEFDF0] focus:border-amber focus:shadow-[0_0_0_2px_rgba(245,158,11,0.2)] font-medium text-text-primary"
  );

  const historyTextareaClass = cn(
    "w-full px-3 py-2.5 field-input resize-y min-h-[90px] leading-[1.65] transition-all",
    isHistoryEditableOnly && "border-amber/60 bg-[#FEFDF0] focus:border-amber focus:shadow-[0_0_0_2px_rgba(245,158,11,0.2)] font-medium text-text-primary"
  );
  const [showClearModal, setShowClearModal] = useState(false);
  const [showUnsaveModal, setShowUnsaveModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  const [deleteProblemIndex, setDeleteProblemIndex] = useState<number | null>(null);
  const [deleteMedIndex, setDeleteMedIndex] = useState<number | null>(null);

  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
    const [newMedFormulation, setNewMedFormulation] = useState('');
  const [newMedInstructions, setNewMedInstructions] = useState('');
  const [newMedQuantity, setNewMedQuantity] = useState('');

  const [medError, setMedError] = useState('');
  const [addingMed, setAddingMed] = useState(false);
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
      diagnostics: [],
      visitDatetime: new Date().toISOString(),
    },
  });

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
          mgmtNonpharm: note.mgmtNonpharm || '',
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
          });

          if (validProblems.length === 0) {
            parsed.assessment = (copyForward?.activeProblems || []).map((p: any) => ({ title: p.title, icdCode: p.icdCode || undefined }));
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
        assessment: (copyForward?.activeProblems || []).map((p: any) => ({ title: p.title, icdCode: p.icdCode || undefined })),
        medicationSnapshot: (copyForward?.activeMedications || []).map((m: any) => ({
          name: m.name,
          dose: m.dose || undefined,
          formulation: m.formulation || undefined,
          quantity: m.quantity || undefined,
          instructions: m.instructions || undefined,
        })),
        mgmtNonpharm: '',
        diagnostics: [],
        visitDatetime: new Date().toISOString(),
      });
    }
  }, [note, copyLoading, form, patientId, copyForward]);

  const formValues = form.watch();

  const handleSave = (data: InitialNoteDraftValues) => {
    if (note) {
      updateMutation.mutate({ id: note.id, data }, {
        onSuccess: () => {
          if (isPublished) {
            setIsEditing(false);
          } else {
            router.push(`/dashboard/${patientId}/notes`);
          }
        }
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
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
            onSuccess: () => {
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
          publishMutation.mutate(newNote.id, {
            onSuccess: () => {
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
        <div className="h-[90px] bg-surface border border-border rounded-card shadow-card" />
        <div className="h-[180px] bg-surface border border-border rounded-card shadow-card" />
        <div className="h-[140px] bg-surface border border-border rounded-card shadow-card" />
        <div className="h-[180px] bg-surface border border-border rounded-card shadow-card" />
        <div className="h-[130px] bg-surface border border-border rounded-card shadow-card" />
        <div className="h-[160px] bg-surface border border-border rounded-card shadow-card" />
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

  return (
    <div className="flex flex-col gap-6 pb-32">
      {note?.status === 'PUBLISHED' && !isEditing ? (
        // ==================== READ-ONLY PUBLISHED VIEW ====================
        <div className="flex flex-col gap-6 w-full">
          {/* HEADER BAR FOR PUBLISHED NOTE */}
          <div className="flex items-center justify-between bg-surface border border-border rounded-card shadow-card px-4 py-2.5 w-full">
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-[var(--text-primary)]">Initial Consultation Note</span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Published by {note.author ? `${note.author.firstName} ${note.author.lastName}` : 'Author'} on {new Date(note.createdAt).toLocaleDateString()}
                {note.lastEditor && ` · Last edited by ${note.lastEditor.firstName} ${note.lastEditor.lastName}`}
              </span>
            </div>
            <button 
              type="button" 
              onClick={() => setIsEditing(true)} 
              className="sec-btn primary"
            >
              Edit Note
            </button>
          </div>
          {/* VITALS CARD */}
          <div className="bg-surface border border-accent-mid/30 rounded-card shadow-card overflow-hidden border-l-[3px] border-l-accent-mid">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-accent-light border-b border-accent-mid">
              <div className="w-[26px] h-[26px] rounded-icon bg-surface flex items-center justify-center text-[12px] text-accent flex-shrink-0">
                🫀
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-hover flex-1">
                Latest Vital Signs
              </span>
            </div>
            <div className="p-4">
              {latestVitals ? (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-5 gap-2.5 max-[1439px]:grid-cols-3">
                    {/* BP Card */}
                    <div className={cn(
                      "border rounded-card p-[9px_11px] transition-all",
                      bpStatus === "critical" ? "bg-red-bg border-red-border" :
                      bpStatus === "warn"     ? "bg-amber-bg border-amber-border" :
                      "bg-surface-2 border-border"
                    )}>
                      <div className={cn(
                        "text-[9px] font-bold uppercase tracking-[0.6px] mb-0.5",
                        bpStatus === "critical" ? "text-red" :
                        bpStatus === "warn"     ? "text-amber" :
                        "text-[var(--text-muted)]"
                      )}>
                        Blood Pressure
                      </div>
                      <div className={cn(
                        "font-mono text-[18px] font-medium leading-[1.1]",
                        bpStatus === "critical" ? "text-red" :
                        bpStatus === "warn"     ? "text-amber" :
                        "text-[var(--text-primary)]"
                      )}>
                        {latestVitals.sbp || '—'}<span className="text-[10px] text-[var(--text-muted)] ml-[1px]">/</span>{latestVitals.dbp || '—'}<span className="text-[10px] text-[var(--text-muted)] ml-[1px] font-sans font-normal"> mmHg</span>
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)] mt-0.5">diastolic / systolic</div>
                    </div>

                    {/* HR Card */}
                    <div className={cn(
                      "border rounded-card p-[9px_11px] transition-all",
                      hrStatus === "critical" ? "bg-red-bg border-red-border" :
                      hrStatus === "warn"     ? "bg-amber-bg border-amber-border" :
                      "bg-surface-2 border-border"
                    )}>
                      <div className={cn(
                        "text-[9px] font-bold uppercase tracking-[0.6px] mb-0.5",
                        hrStatus === "critical" ? "text-red" :
                        hrStatus === "warn"     ? "text-amber" :
                        "text-[var(--text-muted)]"
                      )}>
                        Heart Rate
                      </div>
                      <div className={cn(
                        "font-mono text-[18px] font-medium leading-[1.1]",
                        hrStatus === "critical" ? "text-red" :
                        hrStatus === "warn"     ? "text-amber" :
                        "text-[var(--text-primary)]"
                      )}>
                        {latestVitals.heartRate ?? '—'}<span className="text-[10px] text-[var(--text-muted)] ml-[1px] font-sans font-normal"> bpm</span>
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{hrStatus === 'normal' ? 'Normal' : hrStatus === 'unknown' ? 'Not recorded' : 'Out of range'}</div>
                    </div>

                    {/* Temp Card */}
                    <div className={cn(
                      "border rounded-card p-[9px_11px] transition-all",
                      tempStatus === "critical" ? "bg-red-bg border-red-border" :
                      tempStatus === "warn"     ? "bg-amber-bg border-amber-border" :
                      "bg-surface-2 border-border"
                    )}>
                      <div className={cn(
                        "text-[9px] font-bold uppercase tracking-[0.6px] mb-0.5",
                        tempStatus === "critical" ? "text-red" :
                        tempStatus === "warn"     ? "text-amber" :
                        "text-[var(--text-muted)]"
                      )}>
                        Temperature
                      </div>
                      <div className={cn(
                        "font-mono text-[18px] font-medium leading-[1.1]",
                        tempStatus === "critical" ? "text-red" :
                        tempStatus === "warn"     ? "text-amber" :
                        "text-[var(--text-primary)]"
                      )}>
                        {formatTemperature(Number(latestVitals.temperature))}<span className="text-[10px] text-[var(--text-muted)] ml-[1px] font-sans font-normal"> °C</span>
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{tempStatus === 'normal' ? 'Normal' : tempStatus === 'unknown' ? 'Not recorded' : 'Out of range'}</div>
                    </div>

                    {/* SpO2 Card */}
                    <div className={cn(
                      "border rounded-card p-[9px_11px] transition-all",
                      o2Status === "critical" ? "bg-red-bg border-red-border" :
                      o2Status === "warn"     ? "bg-amber-bg border-amber-border" :
                      "bg-surface-2 border-border"
                    )}>
                      <div className={cn(
                        "text-[9px] font-bold uppercase tracking-[0.6px] mb-0.5",
                        o2Status === "critical" ? "text-red" :
                        o2Status === "warn"     ? "text-amber" :
                        "text-[var(--text-muted)]"
                      )}>
                        Oxygen Saturation
                      </div>
                      <div className={cn(
                        "font-mono text-[18px] font-medium leading-[1.1]",
                        o2Status === "critical" ? "text-red" :
                        o2Status === "warn"     ? "text-amber" :
                        "text-[var(--text-primary)]"
                      )}>
                        {latestVitals.oxygenSaturation ?? '—'}<span className="text-[10px] text-[var(--text-muted)] ml-[1px] font-sans font-normal"> %</span>
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{o2Status === 'normal' ? 'Normal' : o2Status === 'unknown' ? 'Not recorded' : 'Out of range'}</div>
                    </div>

                    {/* RR Card */}
                    <div className={cn(
                      "border rounded-card p-[9px_11px] transition-all",
                      rrStatus === "critical" ? "bg-red-bg border-red-border" :
                      rrStatus === "warn"     ? "bg-amber-bg border-amber-border" :
                      "bg-surface-2 border-border"
                    )}>
                      <div className={cn(
                        "text-[9px] font-bold uppercase tracking-[0.6px] mb-0.5",
                        rrStatus === "critical" ? "text-red" :
                        rrStatus === "warn"     ? "text-amber" :
                        "text-[var(--text-muted)]"
                      )}>
                        Respiratory Rate
                      </div>
                      <div className={cn(
                        "font-mono text-[18px] font-medium leading-[1.1]",
                        rrStatus === "critical" ? "text-red" :
                        rrStatus === "warn"     ? "text-amber" :
                        "text-[var(--text-primary)]"
                      )}>
                        {latestVitals.respiratoryRate ?? '—'}<span className="text-[10px] text-[var(--text-muted)] ml-[1px] font-sans font-normal"> /min</span>
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{rrStatus === 'normal' ? 'Normal' : rrStatus === 'unknown' ? 'Not recorded' : 'Out of range'}</div>
                    </div>
                  </div>
                  
                  {/* Timestamp & Recorder Info */}
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-2 px-1 font-sans">
                    <span>
                      Measured at: <strong className="text-[var(--text-secondary)]">{new Date(latestVitals.measuredAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                    </span>
                    <span>
                      Recorded by: <strong className="text-[var(--text-secondary)]">{latestVitals.measuredByUser ? `${latestVitals.measuredByUser.firstName} ${latestVitals.measuredByUser.lastName}` : (latestVitals.measuredBy ?? '—')}</strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-[var(--text-muted)]">No vitals recorded for this note.</div>
              )}
            </div>
          </div>

          {/* SUBJECTIVE CARD */}
          <div className="bg-surface border border-border border-l-[3px] border-l-blue rounded-card shadow-card overflow-hidden">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
              <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                💬
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-blue flex-1">
                Subjective
              </span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left Column */}
              <div className="flex flex-col gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-btn bg-blue-bg/60 text-blue text-[11px] font-bold uppercase tracking-[0.5px] mb-2">
                    <span>🗣️</span> Chief Complaint
                  </div>
                  <div className="pl-1 text-[13px] text-[var(--text-primary)] font-bold leading-relaxed">
                    {note.chiefComplaint || '—'}
                  </div>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-btn bg-blue-bg/60 text-blue text-[11px] font-bold uppercase tracking-[0.5px] mb-2">
                    <span>📝</span> History of Present Illness
                  </div>
                  <div className="pl-1 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-[1.6]">
                    {note.hpi || '—'}
                  </div>
                </div>

                {note.socialHistory && (
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-btn bg-blue-bg/60 text-blue text-[11px] font-bold uppercase tracking-[0.5px] mb-2">
                      <span>🏃‍♂️</span> Personal and Social History
                    </div>
                    <div className="pl-1 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-[1.6]">
                      {note.socialHistory}
                    </div>
                  </div>
                )}

                {note.psychosocialHistory && (
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-btn bg-blue-bg/60 text-blue text-[11px] font-bold uppercase tracking-[0.5px] mb-2">
                      <span>🧠</span> Psychosocial History
                    </div>
                    <div className="pl-1 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-[1.6]">
                      {note.psychosocialHistory}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-4 border-l border-border/60 pl-6 max-md:border-l-0 max-md:pl-0">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-btn bg-amber-bg text-amber text-[11px] font-bold uppercase tracking-[0.5px] mb-2">
                    <span>🏥</span> Past Medical History
                  </div>
                  <div className="pl-1 flex flex-col gap-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">
                    <div><span className="font-semibold text-[var(--text-primary)]">Comorbidities:</span> {note.pmhComorbidities || 'None'}</div>
                    <div><span className="font-semibold text-[var(--text-primary)]">Surgeries:</span> {note.pmhSurgeries || 'None'}</div>
                    <div><span className="font-semibold text-[var(--text-primary)]">Hospitalizations:</span> {note.pmhHospitalizations || 'None'}</div>
                    <div><span className="font-semibold text-[var(--text-primary)]">Allergies:</span> <span className={note.allergies ? "text-red font-bold" : ""}>{note.allergies || 'No known allergies'}</span></div>
                  </div>
                </div>

                {note.familyHistory && (
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-btn bg-amber-bg text-amber text-[11px] font-bold uppercase tracking-[0.5px] mb-2">
                      <span>👨‍👩‍👧‍👦</span> Family Medical History
                    </div>
                    <div className="pl-1 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-[1.6]">
                      {note.familyHistory}
                    </div>
                  </div>
                )}

                {isFemale && note.obHistory && (
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-btn bg-amber-bg text-amber text-[11px] font-bold uppercase tracking-[0.5px] mb-2">
                      <span>♀️</span> OB/Menstrual History
                    </div>
                    <div className="pl-1 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-[1.6]">
                      {note.obHistory}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* OBJECTIVE & ASSESSMENT GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* OBJECTIVE CARD */}
            <div className="bg-surface border border-border border-l-[3px] border-l-purple rounded-card shadow-card overflow-hidden h-full">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                  🔬
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-purple flex-1">
                  Objective
                </span>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-btn bg-purple-bg text-purple text-[11px] font-bold uppercase tracking-[0.5px] mb-2">
                    <span>🩺</span> Physical Examination
                  </div>
                  <div className="pl-1 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-[1.6]">
                    {note.physicalExam || '—'}
                  </div>
                </div>

                {note.diagnostics && Array.isArray(note.diagnostics) && note.diagnostics.length > 0 && (
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-btn bg-purple-bg text-purple text-[11px] font-bold uppercase tracking-[0.5px] mb-2">
                      <span>🧪</span> Labs and Imaging Results
                    </div>
                    <div className="flex gap-1.5 flex-wrap pl-1 mt-1">
                      {note.diagnostics.map((diag: string, idx: number) => (
                        <span key={idx} className="text-[11px] font-semibold bg-blue-bg text-blue border border-blue-border px-2.5 py-0.5 rounded-[4px] shadow-sm">
                          {diag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ASSESSMENT CARD */}
            <div className="bg-surface border border-border border-l-[3px] border-l-accent rounded-card shadow-card overflow-hidden h-full">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                  📋
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent flex-1">
                  Assessment
                </span>
              </div>
              <div className="p-5 flex flex-col gap-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-btn bg-accent-light text-accent-hover text-[11px] font-bold uppercase tracking-[0.5px] mb-2">
                  <span>📌</span> Active Problems
                </div>
                <div className="flex flex-col gap-2.5 pl-1">
                  {note.assessment && Array.isArray(note.assessment) && note.assessment.length > 0 ? (
                    note.assessment.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2.5 text-[15px] text-[var(--text-primary)] font-bold">
                        <span className="w-2 h-2 rounded-full bg-accent-mid shrink-0" />
                        <span>{item.title}</span>
                        {item.icdCode && (
                          <span className="font-mono text-[10px] text-[var(--text-muted)] bg-surface-2 border border-border px-1.5 py-0.5 rounded font-normal ml-1.5">
                            {item.icdCode}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-[13px] text-[var(--text-muted)]">No active problems registered.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* PLAN / MANAGEMENT CARD */}
          <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden border-l-[3px] border-l-green-border">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
              <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                💊
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-green flex-1">
                Plan / Management
              </span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-btn bg-green-bg text-green text-[11px] font-bold uppercase tracking-[0.5px] mb-2">
                    <span>🥦</span> Non-Pharmacologic Management
                  </div>
                  <div className="pl-1 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-[1.6]">
                    {note.mgmtNonpharm || '—'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-l border-border/60 pl-6 max-md:border-l-0 max-md:pl-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-btn bg-green-bg text-green text-[11px] font-bold uppercase tracking-[0.5px] mb-2">
                  <span>💊</span> Medications Prescribed
                </div>
                <div className="flex flex-col gap-3 pl-1">
                  {note.medicationSnapshot && Array.isArray(note.medicationSnapshot) && note.medicationSnapshot.length > 0 ? (
                    note.medicationSnapshot.map((med: any, idx: number) => (
                      <div key={idx} className="flex flex-col">
                        <div className="flex items-center gap-2.5 text-[14px] text-[var(--text-primary)] font-bold">
                          <span className="w-2 h-2 rounded-full bg-green shrink-0" />
                          <span>
                            {typeof med === 'string' ? med : med.name} {typeof med !== 'string' && med.dose ? med.dose : ''}{typeof med !== 'string' && med.unit ? med.unit : ''}
                            {typeof med !== 'string' && med.formulation && ` · ${med.formulation}`}
                            {typeof med !== 'string' && med.quantity && ` (Qty: ${med.quantity})`}
                          </span>
                        </div>
                        {typeof med !== 'string' && med.instructions && (
                          <span className="text-[11px] text-[var(--text-muted)] pl-4.5 block mt-0.5">{med.instructions}</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-[13px] text-[var(--text-muted)]">No medications prescribed.</span>
                  )}
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
            <fieldset disabled={isSaving || publishMutation.isPending} className="flex flex-col gap-5 w-full disabled:opacity-70 transition-opacity">
            {/* Latest Vitals Snapshot Strip */}
            <div className="bg-surface border border-border border-l-[3px] border-l-accent-mid rounded-card shadow-card overflow-hidden">
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
              <div className="px-4 py-3 grid grid-cols-5 gap-3 bg-surface-2/50">
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
                <VitalMiniCell 
                  label="RR" 
                  value={latestVitals?.respiratoryRate ?? '—'} 
                  unit="/min" 
                  status={rrStatus} 
                />
              </div>
              {!latestVitals && (
                <div className="px-4 pb-3 text-[11px] text-amber font-medium text-center">
                  ⚠ No vitals on record. Record vitals before publishing this note.
                </div>
              )}
            </div>

            {/* 1. Subjective Card */}
            <div className={cn("bg-surface border border-border border-l-[3px] border-l-blue rounded-card shadow-card overflow-hidden transition-all", isHistoryEditableOnly && "opacity-90 bg-surface-2 border-border/80")}>
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
            <div className="bg-surface border border-border border-l-[3px] border-l-amber rounded-card shadow-card overflow-hidden">
              {/* Card Header */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-bg/40 border-b border-border">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.6px] block mb-1">
                        Comorbidities
                      </label>
                      <input
                        {...form.register('pmhComorbidities')}
                        className={historyInputClass}
                        placeholder="e.g. Diabetes Mellitus (2018), Asthma"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.6px] block mb-1">
                        Previous Surgeries
                      </label>
                      <input
                        {...form.register('pmhSurgeries')}
                        className={historyInputClass}
                        placeholder="e.g. Appendectomy (2015)"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.6px] block mb-1">
                        Previous Hospitalizations
                      </label>
                      <input
                        {...form.register('pmhHospitalizations')}
                        className={historyInputClass}
                        placeholder="e.g. Dengue (2022)"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.6px] block mb-1">
                        Allergies
                      </label>
                      <input
                        {...form.register('allergies')}
                        className={historyInputClass}
                        placeholder="e.g. Penicillin (rash), Sulfa"
                      />
                    </div>
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
            <div className={cn("bg-surface border border-border border-l-[3px] border-l-purple rounded-card shadow-card overflow-hidden transition-all", isHistoryEditableOnly && "opacity-90 bg-surface-2 border-border/80")}>
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
                  {canEditAll && (
                    <div className="mt-2">
                      <AttachmentUploader />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Assessment Card */}
            <div className={cn("bg-surface border border-border border-l-[3px] border-l-accent rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden transition-all", isHistoryEditableOnly && "opacity-90 bg-surface-2 border-border/80")}>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-accent-light/40 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-white/60 shrink-0">📊</div>
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
                        ))}
                        {canEditAll && (
                          <div className="grid grid-cols-12 gap-2.5 mt-3 pt-3 border-t border-border bg-surface-2 p-3 rounded-[8px]">
                            <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Problem Title <span className="text-red">*</span></label>
                              <input id="newProbTitle" placeholder="e.g. Hypertension" className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]" />
                            </div>
                            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">ICD-10 Code</label>
                              <input id="newProbIcd" placeholder="e.g. I10" className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]" />
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
                                  const icdEl = document.getElementById('newProbIcd') as HTMLInputElement;
                                  if (!titleEl.value.trim()) {
                                    setProbError('Problem title is required');
                                    return;
                                  }
                                  setProbError('');
                                  setAddingProb(true);
                                  setTimeout(() => {
                                    const newProbs = [...(field.value || []), { title: titleEl.value.trim(), icdCode: icdEl.value.trim() || undefined }];
                                    field.onChange(newProbs);
                                    titleEl.value = '';
                                    icdEl.value = '';
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
            <div className={cn("bg-surface border border-border border-l-[3px] border-l-green-border rounded-card shadow-card transition-all", isHistoryEditableOnly && "opacity-90 bg-surface-2 border-border/80")}>
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
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-surface">
                {/* Left: Non-Pharmacologic */}
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
                          {meds.map((med: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 py-2 px-3 border border-border bg-white rounded-btn text-[12px] text-text-primary shadow-sm group">
                              <div className="w-1.5 h-1.5 rounded-full bg-green shrink-0"></div>
                              <div className="flex-1 min-w-0 truncate">
                                <span className="font-semibold">{typeof med === 'string' ? med : med.name}</span>
                                {typeof med !== 'string' && med.dose && (
                                  <span className="font-mono text-green font-semibold ml-1.5">{med.dose}{med.unit}</span>
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
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => setDeleteMedIndex(idx)}
                                  className="text-text-muted hover:text-red transition-colors w-6 h-6 rounded-md"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}
                          {canEditAll && (
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
                                      setAddingMed(false);
                                    }, 400);
                                  }}
                                  className="h-[28px] px-3.5 bg-surface border border-border text-text-secondary hover:bg-surface-3 hover:text-text-primary rounded font-medium text-[11px] flex items-center gap-1 transition-all"
                                >
                                  {addingMed ? 'Adding...' : '+ Add Medication'}
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
            assessment: (copyForward?.activeProblems || []).map((p: any) => ({ title: p.title, icdCode: p.icdCode || undefined })),
            medicationSnapshot: (copyForward?.activeMedications || []).map((m: any) => ({
              name: m.name,
              dose: m.dose || undefined,
              formulation: m.formulation || undefined,
              quantity: m.quantity || undefined,
              instructions: m.instructions || undefined,
            })),
            mgmtNonpharm: '',
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
    </div>
  );
}
