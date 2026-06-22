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
  usePublishInitialNote 
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
import { SaveIcon, SendIcon, Heart, History, MessageSquare, Microscope, ClipboardList, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { 
  classifyBloodPressure, classifyHeartRate, classifyOxygenSaturation, 
  classifyTemperature, classifyRespiratoryRate,
  formatBloodPressure, formatTemperature
} from '@/lib/vitals-utils';

interface NoteActionBarProps {
  isSaving: boolean;
  isPublishing: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onClear: () => void;
}

function NoteActionBar({ 
  isSaving, 
  isPublishing, 
  onSaveDraft, 
  onPublish, 
  onClear 
}: NoteActionBarProps) {
  return (
    <div className="flex items-center justify-between bg-surface border border-border rounded-card shadow-card px-4 py-2.5 w-full">
      <span className="text-[11px] text-[var(--text-muted)]">
        {isSaving ? 'Saving…' : 'Draft auto-saves every 30s'}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClear} className="sec-btn destructive">Clear Form</button>
        <button type="button" onClick={onSaveDraft} disabled={isSaving} className="sec-btn">
          <SaveIcon className="w-3.5 h-3.5" /> Save Draft
        </button>
        <button type="button" onClick={onPublish} disabled={isPublishing} className="sec-btn primary">
          <SendIcon className="w-3.5 h-3.5" /> Publish Note
        </button>
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
    status === 'critical' ? 'text-[var(--red)] font-semibold' :
    status === 'warn' ? 'text-[var(--amber)] font-semibold' :
    'text-[var(--text-primary)] font-bold';

  const dotColor =
    status === 'critical' ? 'bg-[var(--red)]' :
    status === 'warn' ? 'bg-[var(--amber)]' :
    null;

  return (
    <div className="border border-border rounded-card px-2.5 py-2 flex flex-col bg-surface-2">
      <span className="text-[9.5px] font-bold uppercase tracking-[0.6px] mb-1 text-[var(--text-muted)]">
        {label}
      </span>
      <div className="flex items-center justify-between gap-1">
        <span className={cn("font-mono text-[15px] leading-none", valueColorClass)}>
          {value}
          {value !== '—' && <span className="text-[10px] text-[var(--text-muted)] ml-[2.5px] font-normal">{unit}</span>}
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

  const [publishError, setPublishError] = useState<string | null>(null);

  const isFemale = patient?.sex?.toLowerCase() === 'female';

  const form = useForm<InitialNoteDraftValues>({
    resolver: zodResolver(initialNoteDraftSchema),
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
      updateMutation.mutate({ id: note.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  useAutoSave(formValues, handleSave, `damayan:draft:${patientId}:initial`, 30000);

  const handlePublish = async () => {
    setPublishError(null);
    const publishCheck = initialNotePublishSchema.safeParse(formValues);
    if (!publishCheck.success) {
      setPublishError("Please fill out all required fields: Chief Complaint, HPI, Physical Exam, and at least one Assessment.");
      return;
    }

    if (note) {
      // Save latest state first
      updateMutation.mutate({ id: note.id, data: formValues }, {
        onSuccess: () => {
          publishMutation.mutate(note.id, {
            onSuccess: () => {
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
              localStorage.removeItem(`damayan:draft:${patientId}:initial`);
              router.push(`/dashboard/${patientId}/notes`);
            }
          });
        }
      });
    }
  };

  if (isLoading) {
    return <div className="p-6 animate-pulse text-[var(--text-muted)]">Loading note...</div>;
  }

  const isSaving = updateMutation.isPending || createMutation.isPending;

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
    <div className="flex flex-col gap-6">
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
            isPublishing={publishMutation.isPending}
            onSaveDraft={() => handleSave(formValues)}
            onPublish={handlePublish}
            onClear={() => form.reset()}
          />

          <form className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 w-full items-start" onSubmit={(e) => e.preventDefault()}>
            {/* LEFT COLUMN: Subjective, History, Objective, Assessment */}
            <div className="flex flex-col gap-6">
              {/* Subjective Card */}
              <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                  <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] flex-1">
                    Subjective Entry
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  {/* Chief Complaint */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">
                      Chief Complaint <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
                    </label>
                    <input
                      {...form.register('chiefComplaint')}
                      className="w-full h-[34px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none transition-all duration-150 focus:border-accent focus:shadow-accent-focus placeholder:text-[var(--text-muted)]"
                      placeholder="e.g. Persistent headaches and dizziness for 2 weeks"
                    />
                  </div>

                  {/* HPI */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">
                      History of Present Illness (HPI) <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
                    </label>
                    <textarea
                      {...form.register('hpi')}
                      className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none resize-y min-h-[100px] leading-[1.6] transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
                      placeholder="Describe HPI in detail..."
                    />
                  </div>
                </div>
              </div>

              {/* History Card (Combined) */}
              <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                  <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center flex-shrink-0">
                    <History className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] flex-1">
                    History
                  </span>
                </div>
                <div className="divide-y divide-border">
                  <CollapsibleSection title="Past Medical History (PMH)" variant="row" defaultOpen>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Comorbidities</label>
                        <input
                          {...form.register('pmhComorbidities')}
                          className="w-full h-[34px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none transition-all duration-150 focus:border-accent focus:shadow-accent-focus placeholder:text-[var(--text-muted)]"
                          placeholder="e.g. Diabetes Mellitus (2018), Asthma"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Previous Surgeries</label>
                        <input
                          {...form.register('pmhSurgeries')}
                          className="w-full h-[34px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none transition-all duration-150 focus:border-accent focus:shadow-accent-focus placeholder:text-[var(--text-muted)]"
                          placeholder="e.g. Appendectomy (2015)"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Previous Hospitalizations</label>
                        <input
                          {...form.register('pmhHospitalizations')}
                          className="w-full h-[34px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none transition-all duration-150 focus:border-accent focus:shadow-accent-focus placeholder:text-[var(--text-muted)]"
                          placeholder="e.g. Dengue (2022)"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Allergies</label>
                        <input
                          {...form.register('allergies')}
                          className="w-full h-[34px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none transition-all duration-150 focus:border-accent focus:shadow-accent-focus placeholder:text-[var(--text-muted)]"
                          placeholder="e.g. Penicillin (rash), Sulfa"
                        />
                      </div>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Family Medical History" variant="row">
                    <div className="flex flex-col gap-1.5">
                      <textarea
                        {...form.register('familyHistory')}
                        className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none resize-y min-h-[80px] leading-[1.6] transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
                        placeholder="e.g. Father: Hypertension, CVA. Mother: DM."
                      />
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Personal & Social History" variant="row">
                    <div className="flex flex-col gap-1.5">
                      <textarea
                        {...form.register('socialHistory')}
                        className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none resize-y min-h-[80px] leading-[1.6] transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
                        placeholder="e.g. Non-smoker, occasional alcohol. Sedentary lifestyle."
                      />
                    </div>
                  </CollapsibleSection>

                  {isFemale && (
                    <CollapsibleSection title="OB / Menstrual History" variant="row">
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          {...form.register('obHistory')}
                          className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none resize-y min-h-[80px] leading-[1.6] transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
                          placeholder="e.g. G0P0. Regular menses. LMP: May 12, 2026."
                        />
                      </div>
                    </CollapsibleSection>
                  )}

                  <CollapsibleSection title="Psychosocial History" variant="row">
                    <div className="flex flex-col gap-1.5">
                      <textarea
                        {...form.register('psychosocialHistory')}
                        className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none resize-y min-h-[80px] leading-[1.6] transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
                        placeholder="e.g. Works as accountant, high stress lately. Good family support system."
                      />
                    </div>
                  </CollapsibleSection>
                </div>
              </div>

              {/* Objective Card */}
              <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                  <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center flex-shrink-0">
                    <Microscope className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] flex-1">
                    Objective Entry
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  {/* Physical Examination */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">
                      Physical Examination <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
                    </label>
                    <textarea
                      {...form.register('physicalExam')}
                      className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none resize-y min-h-[90px] leading-[1.6] transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
                      placeholder="Describe physical exam findings... e.g. General: Conscious, coherent, not in acute distress..."
                    />
                  </div>

                  {/* Labs & Imaging Results */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">
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

              {/* Assessment (Active Problems) Card */}
              <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                  <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] flex-1">
                    Assessment (Active Problems)
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] text-[var(--text-muted)]">Add the active problems for this patient.</p>
                    <Controller
                      control={form.control}
                      name="assessment"
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
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Vitals, Management Plan */}
            <div className="flex flex-col gap-4">
              {/* Latest Vitals Snapshot Card */}
              <div className="bg-surface border border-accent-mid/30 rounded-card shadow-card overflow-hidden border-l-[3px] border-l-accent-mid">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-accent-light border-b border-accent-mid">
                  <div className="w-[26px] h-[26px] rounded-icon bg-surface flex items-center justify-center flex-shrink-0">
                    <Heart className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-hover flex-1">Latest Vitals</span>
                  <button 
                    type="button" 
                    onClick={() => router.push(`/dashboard/${patientId}/vitals`)} 
                    className="sec-btn primary !h-6 !text-[10px] !px-2.5"
                  >
                    Update ↗
                  </button>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2">
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
                    value={latestVitals?.temperature ? formatTemperature(latestVitals.temperature) : '—'} 
                    unit="°C" 
                    status={tempStatus} 
                  />
                  <VitalMiniCell 
                    label="SpO2" 
                    value={latestVitals?.oxygenSaturation ?? '—'} 
                    unit="%" 
                    status={o2Status} 
                  />
                  <div className="col-span-2 font-mono text-[10px] text-[var(--text-muted)] pt-1 border-t border-border mt-1 text-center">
                    {measuredAt ? `${measuredAt} · by ${measuredBy}` : 'No vitals recorded'}
                  </div>
                </div>
                {!latestVitals && (
                  <div className="px-3 pb-3 text-[11px] text-[var(--text-secondary)] bg-surface-2 mx-3 mb-3 rounded-btn p-1.5 text-center">
                    No vitals recorded. Please update vitals first.
                  </div>
                )}
              </div>

              {/* Management Plan Card */}
              <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                  <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] flex-1">
                    Management Plan
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  {/* Non-Pharmacologic Management */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">
                      Non-Pharmacologic Management
                    </label>
                    <textarea
                      {...form.register('mgmtNonpharm')}
                      className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none resize-y min-h-[60px] leading-[1.6] transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
                      placeholder="e.g. Low-sodium DASH diet. Daily BP monitoring."
                    />
                  </div>

                  {/* Prescribed Medications */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">
                      Prescribed Medications
                    </label>
                    <p className="text-[10px] text-[var(--text-muted)]">Add medications prescribed during this initial consultation.</p>
                    <MedicationListEditor patientId={patientId} />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
