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
import { useLatestVitals } from '@/hooks/useVitals';
import { usePatient } from '@/hooks/usePatients';
import { useMedications } from '@/hooks/useMedications';
import { useAutoSave } from '@/hooks/useAutoSave';
import { CollapsibleSection } from './CollapsibleSection';
import { TagInputField } from './TagInputField';
import { MedicationListEditor } from './MedicationListEditor';
import { AttachmentUploader } from './AttachmentUploader';
import { NoteStatusBadge } from './NoteStatusBadge';
import { SaveIcon, SendIcon, Heart, History, MessageSquare, Microscope, ClipboardList, Stethoscope, Users, User, Calendar, Brain, Loader2 } from 'lucide-react';
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
}

function NoteActionBar({ 
  isSaving, 
  isPublishing, 
  onSaveDraft, 
  onPublish, 
  onClear,
  onUnsave,
  showSaveAndClear = true,
  showPublish = true
}: NoteActionBarProps) {
  return (
    <div className="flex items-center justify-between bg-surface border border-border rounded-card shadow-card px-4 py-2.5 w-full">
      <span className="text-[11px] text-[var(--text-muted)]">
        {showSaveAndClear ? (isSaving ? 'Saving…' : 'Draft auto-saves locally') : ''}
      </span>
      <div className="flex items-center gap-2">
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
            <span>{med.name} {med.dose}{med.unit}</span>
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
  const { data: latestVitals } = useLatestVitals(patientId);
  const { data: patient } = usePatient(patientId);
  const createMutation = useCreateInitialNote(patientId);
  const updateMutation = useUpdateInitialNote(patientId);
  const publishMutation = usePublishInitialNote(patientId);
  const deleteMutation = useDeleteInitialNote(patientId);

  const [publishError, setPublishError] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showUnsaveModal, setShowUnsaveModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

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
      mgmtNonpharm: '',
      diagnostics: [],
      visitDatetime: new Date().toISOString(),
    },
  });

  useEffect(() => {
    if (note) {
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
        assessment: note.assessment || [],
        mgmtNonpharm: note.mgmtNonpharm || '',
        diagnostics: note.diagnostics || [],
        visitDatetime: note.createdAt,
      });
    } else {
      // Check local storage
      const draft = localStorage.getItem(`damayan:draft:${patientId}:initial`);
      if (draft) {
        try {
          form.reset(JSON.parse(draft));
        } catch (e) {}
      }
    }
  }, [note, form, patientId]);

  const formValues = form.watch();

  const handleSave = (data: InitialNoteDraftValues) => {
    if (note) {
      updateMutation.mutate({ id: note.id, data }, {
        onSuccess: () => {
          router.push(`/dashboard/${patientId}/notes`);
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
            }
          });
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
            }
          });
        }
      });
    }
  };

  if (isLoading) {
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
      {note?.status === 'PUBLISHED' ? (
        // ==================== READ-ONLY PUBLISHED VIEW ====================
        <div className="flex flex-col gap-6 w-full">
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
                <div className="border border-border rounded-card overflow-hidden">
                  <table className="w-full border-collapse text-[12px]">
                    <thead className="bg-surface-2 border-b border-border">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold text-[10px] text-[var(--text-secondary)] uppercase">Date / Time</th>
                        <th className="px-3 py-1.5 text-left font-semibold text-[10px] text-[var(--text-secondary)] uppercase">BP</th>
                        <th className="px-3 py-1.5 text-left font-semibold text-[10px] text-[var(--text-secondary)] uppercase">HR</th>
                        <th className="px-3 py-1.5 text-left font-semibold text-[10px] text-[var(--text-secondary)] uppercase">Temp</th>
                        <th className="px-3 py-1.5 text-left font-semibold text-[10px] text-[var(--text-secondary)] uppercase">SpO₂</th>
                        <th className="px-3 py-1.5 text-left font-semibold text-[10px] text-[var(--text-secondary)] uppercase">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-surface-2">
                        <td className="px-3 py-1.5 text-[var(--text-secondary)] font-mono">
                          {new Date(latestVitals.measuredAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className={cn("px-3 py-1.5 font-mono", getStatusColor(bpStatus))}>
                          {formatBloodPressure(latestVitals.sbp, latestVitals.dbp)}
                        </td>
                        <td className={cn("px-3 py-1.5 font-mono", getStatusColor(hrStatus))}>
                          {latestVitals.heartRate ?? '—'}
                        </td>
                        <td className={cn("px-3 py-1.5 font-mono", getStatusColor(tempStatus))}>
                          {formatTemperature(Number(latestVitals.temperature))}
                        </td>
                        <td className={cn("px-3 py-1.5 font-mono", getStatusColor(o2Status))}>
                          {latestVitals.oxygenSaturation ? `${latestVitals.oxygenSaturation}%` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-[var(--text-muted)]">
                          {latestVitals.measuredByUser
                            ? `${latestVitals.measuredByUser.lastName}`
                            : (latestVitals.measuredBy ?? '—')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-[12px] text-[var(--text-muted)]">No vitals recorded for this note.</div>
              )}
            </div>
          </div>

          {/* SUBJECTIVE CARD */}
          <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
              <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                💬
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] flex-1">
                Subjective
              </span>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    <span>🗣️</span> Chief Complaint
                  </div>
                  <div className="p-3 bg-surface-2 border border-border rounded-btn text-[12px] text-[var(--text-primary)] font-medium leading-[1.6]">
                    {note.chiefComplaint || '—'}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    <span>📝</span> History of Present Illness
                  </div>
                  <div className="p-3 bg-surface-2 border border-border rounded-btn text-[12px] text-[var(--text-primary)] whitespace-pre-wrap leading-[1.6]">
                    {note.hpi || '—'}
                  </div>
                </div>

                {note.socialHistory && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                      <span>🏃‍♂️</span> Personal and Social History
                    </div>
                    <div className="p-3 bg-surface-2 border border-border rounded-btn text-[12px] text-[var(--text-primary)] whitespace-pre-wrap leading-[1.6]">
                      {note.socialHistory}
                    </div>
                  </div>
                )}

                {note.psychosocialHistory && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                      <span>🧠</span> Psychosocial History
                    </div>
                    <div className="p-3 bg-surface-2 border border-border rounded-btn text-[12px] text-[var(--text-primary)] whitespace-pre-wrap leading-[1.6]">
                      {note.psychosocialHistory}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    <span>🏥</span> Past Medical History
                  </div>
                  <div className="p-3 bg-surface-2 border border-border rounded-btn text-[12px] text-[var(--text-primary)] flex flex-col gap-2 leading-[1.6]">
                    <div><b>Comorbidities:</b> {note.pmhComorbidities || '—'}</div>
                    <div><b>Surgeries:</b> {note.pmhSurgeries || '—'}</div>
                    <div><b>Hospitalizations:</b> {note.pmhHospitalizations || '—'}</div>
                    <div><b>Allergies:</b> <span className={note.allergies ? "text-red font-semibold" : ""}>{note.allergies || '—'}</span></div>
                  </div>
                </div>

                {note.familyHistory && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                      <span>👨‍👩‍👧‍👦</span> Family Medical History
                    </div>
                    <div className="p-3 bg-surface-2 border border-border rounded-btn text-[12px] text-[var(--text-primary)] whitespace-pre-wrap leading-[1.6]">
                      {note.familyHistory}
                    </div>
                  </div>
                )}

                {isFemale && note.obHistory && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                      <span>♀️</span> OB/Menstrual History
                    </div>
                    <div className="p-3 bg-surface-2 border border-border rounded-btn text-[12px] text-[var(--text-primary)] whitespace-pre-wrap leading-[1.6]">
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
            <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden h-full">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                  🔬
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] flex-1">
                  Objective
                </span>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    <span>🩺</span> Physical Examination
                  </div>
                  <div className="p-3 bg-surface-2 border border-border rounded-btn text-[12px] text-[var(--text-primary)] whitespace-pre-wrap leading-[1.6]">
                    {note.physicalExam || '—'}
                  </div>
                </div>

                {note.diagnostics && Array.isArray(note.diagnostics) && note.diagnostics.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                      <span>🧪</span> Labs and Imaging Results
                    </div>
                    <div className="flex gap-1.5 flex-wrap p-3 bg-surface-2 border border-border rounded-btn min-h-[40px] items-center">
                      {note.diagnostics.map((diag: string, idx: number) => (
                        <span key={idx} className="text-[11px] px-2 py-0.5 bg-surface border border-border rounded-btn text-[var(--text-secondary)] font-medium">
                          {diag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ASSESSMENT CARD */}
            <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden h-full">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                  📋
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] flex-1">
                  Assessment
                </span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                  <span>📌</span> Active Problems
                </div>
                <div className="flex flex-col gap-1.5 border border-border rounded-btn bg-surface-2 p-3">
                  {note.assessment && Array.isArray(note.assessment) && note.assessment.length > 0 ? (
                    note.assessment.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-[12px] text-[var(--text-primary)] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-mid" />
                        <span>{item.title}</span>
                        {item.icdCode && (
                          <span className="font-mono text-[10px] text-[var(--text-muted)] ml-1">({item.icdCode})</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-[12px] text-[var(--text-muted)]">No active problems registered.</span>
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
              <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] flex-1">
                Plan / Management
              </span>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    <span>🥦</span> Non-Pharmacologic Management
                  </div>
                  <div className="p-3 bg-surface-2 border border-border rounded-btn text-[12px] text-[var(--text-primary)] whitespace-pre-wrap leading-[1.6]">
                    {note.mgmtNonpharm || '—'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                  <span>💊</span> Medications Prescribed
                </div>
                <div className="flex flex-col gap-1.5 border border-border rounded-btn bg-surface-2 p-3">
                  <MedicationListReadOnly patientId={patientId} />
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

          <NoteActionBar 
            isSaving={isSaving}
            onSaveDraft={() => handleSave(formValues)}
            onClear={() => setShowClearModal(true)}
            onUnsave={note && note.status === 'DRAFT' ? () => setShowUnsaveModal(true) : undefined}
            showPublish={false}
          />

          <form className="flex flex-col gap-5 w-full" onSubmit={(e) => e.preventDefault()}>
            <fieldset disabled={isSaving} className="flex flex-col gap-5 w-full disabled:opacity-70 transition-opacity">
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
                  className="h-[26px] px-3 rounded-btn text-[10px] font-semibold bg-accent text-white border border-accent-hover hover:bg-accent-hover transition-all cursor-pointer"
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
            <div className="bg-surface border border-border border-l-[3px] border-l-blue rounded-card shadow-card overflow-hidden">
              {/* Card Header */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-blue-bg/40 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-blue" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-blue flex-1">
                  Subjective
                </span>
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
                    className={cn(
                      "h-[36px] w-full px-3 bg-white border-[1.5px] rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:bg-white placeholder:text-[#9BA3B5]",
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
                    className={cn(
                      "w-full px-3 py-2.5 bg-white border-[1.5px] rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[110px] leading-[1.65] transition-all duration-150 focus:bg-white placeholder:text-[#9BA3B5]",
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
                        className="h-[36px] w-full px-3 field-input placeholder:text-[#9BA3B5]"
                        placeholder="e.g. Diabetes Mellitus (2018), Asthma"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.6px] block mb-1">
                        Previous Surgeries
                      </label>
                      <input
                        {...form.register('pmhSurgeries')}
                        className="h-[36px] w-full px-3 field-input placeholder:text-[#9BA3B5]"
                        placeholder="e.g. Appendectomy (2015)"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.6px] block mb-1">
                        Previous Hospitalizations
                      </label>
                      <input
                        {...form.register('pmhHospitalizations')}
                        className="h-[36px] w-full px-3 field-input placeholder:text-[#9BA3B5]"
                        placeholder="e.g. Dengue (2022)"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.6px] block mb-1">
                        Allergies
                      </label>
                      <input
                        {...form.register('allergies')}
                        className="h-[36px] w-full px-3 field-input placeholder:text-[#9BA3B5]"
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
                      className="w-full px-3 py-2.5 field-input resize-y min-h-[90px] leading-[1.65]"
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
                      className="w-full px-3 py-2.5 field-input resize-y min-h-[90px] leading-[1.65]"
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
                        className="w-full px-3 py-2.5 field-input resize-y min-h-[90px] leading-[1.65]"
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
                      className="w-full px-3 py-2.5 field-input resize-y min-h-[90px] leading-[1.65]"
                      placeholder="e.g. Works as accountant, high stress lately. Good family support system."
                    />
                  </div>
                </CollapsibleSection>
              </div>
            </div>

            {/* 3. Objective Card */}
            <div className="bg-surface border border-border border-l-[3px] border-l-purple rounded-card shadow-card overflow-hidden">
              {/* Card Header */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-purple-bg/40 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
                  <Microscope className="w-3.5 h-3.5 text-purple" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-purple flex-1">
                  Objective
                </span>
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
                    className={cn(
                      "w-full px-3 py-2.5 bg-white border-[1.5px] rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[110px] leading-[1.65] transition-all duration-150 focus:bg-white placeholder:text-[#9BA3B5]",
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
                      />
                    )}
                  />
                  <div className="mt-2">
                    <AttachmentUploader />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Assessment Card */}
            <div className="bg-surface border border-border border-l-[3px] border-l-accent rounded-card shadow-card overflow-hidden">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-accent-light/40 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-3.5 h-3.5 text-accent-hover" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-hover flex-1">
                  Assessment (Active Problems) {(!formValues.assessment || formValues.assessment.length === 0) && <span className="text-red font-bold ml-[2px] align-top">*</span>}
                </span>
                <span className="text-[10px] text-accent-hover/70 font-medium">Required to publish</span>
              </div>
              <div className="p-4 flex flex-col gap-3 bg-surface">
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Add the active problems or diagnoses for this visit. Press <kbd className="px-1 py-0.5 bg-surface-2 border border-border rounded text-[10px] font-mono">Enter</kbd> after each entry.
                </p>
                <Controller
                  control={form.control}
                  name="assessment"
                  render={({ field }) => (
                    <div className="flex flex-col gap-1.5" id="field-assessment">
                      <TagInputField
                        value={field.value || []}
                        onChange={field.onChange}
                        placeholder="Type problem name and press Enter"
                        isObjectFormat={true}
                      />
                      {form.formState.errors.assessment && (
                        <p className="text-[10px] text-red font-medium">
                          {form.formState.errors.assessment.message || "At least one assessment is required"}
                        </p>
                      )}
                    </div>
                  )}
                />
              </div>
            </div>

            {/* 5. Management Plan Card */}
            <div className="bg-surface border border-border border-l-[3px] border-l-green-border rounded-card shadow-card overflow-hidden">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-green-bg/40 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-icon bg-white/60 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-3.5 h-3.5 text-green" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-green flex-1">
                  Plan / Management
                </span>
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
                    className="w-full px-3 py-2.5 bg-white border-[1.5px] border-[#9BA3B5] rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[100px] leading-[1.65] transition-all duration-150 focus:bg-white focus:border-accent focus:shadow-accent-focus placeholder:text-[#9BA3B5]"
                    placeholder="e.g. Low-sodium DASH diet. Daily home BP monitoring. Regular aerobic exercise 30 min/day."
                  />
                </div>
                {/* Right: Prescribed Medications */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#374151] uppercase tracking-[0.6px] block">
                    Prescribed Medications
                  </label>
                  <p className="text-[11px] text-text-muted -mt-0.5">
                    Medications added here are saved to the patient's cumulative medication list.
                  </p>
                  <MedicationListEditor patientId={patientId} />
                </div>
              </div>
            </div>
            </fieldset>
          </form>

          <div className="mt-2">
            <NoteActionBar 
              isSaving={isSaving}
              isPublishing={publishMutation.isPending}
              onPublish={handlePublish}
              showSaveAndClear={false}
            />
          </div>
        </>
      )}

      <DeleteConfirmModal
        open={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={() => {
          form.reset();
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
    </div>
  );
}
