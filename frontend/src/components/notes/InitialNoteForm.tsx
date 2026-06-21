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
import { SaveIcon, SendIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { 
  classifyBloodPressure, classifyHeartRate, classifyOxygenSaturation, 
  classifyTemperature, classifyRespiratoryRate,
  formatBloodPressure, formatTemperature
} from '@/lib/vitals-utils';

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

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-surface border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">
            {note?.status === 'PUBLISHED' ? 'Initial Consultation Note' : 'Create Initial Consultation Note'}
          </h1>
          <p className="text-[12px] text-[var(--text-muted)]">
            {patient ? `${patient.lastName}, ${patient.firstName} · ` : ''}
            {note?.status === 'PUBLISHED'
              ? 'Read-only (published)'
              : 'Required before progress notes can be added'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {note?.status !== 'PUBLISHED' && (
            <>
              {isSaving && <span className="text-[11px] text-[var(--text-muted)] animate-pulse mr-2">Saving...</span>}
              <button
                type="button"
                onClick={() => handleSave(formValues)}
                disabled={isSaving}
                className="sec-btn"
              >
                <SaveIcon className="w-3.5 h-3.5" /> Save Draft
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishMutation.isPending}
                className="sec-btn primary"
              >
                <SendIcon className="w-3.5 h-3.5" /> Publish Note
              </button>
            </>
          )}
          {note?.status === 'PUBLISHED' && (
            <span className="ch-badge badge-published">Published</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 w-full">
        {publishError && (
          <div className="mb-4 p-3 bg-red-bg border border-red-border rounded-card text-red text-[12px] font-medium max-w-7xl mx-auto">
            {publishError}
          </div>
        )}

        {note?.status === 'PUBLISHED' ? (
          // ==================== READ-ONLY PUBLISHED VIEW ====================
          <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
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
          <form className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto w-full items-start" onSubmit={(e) => e.preventDefault()}>
            {/* LEFT COLUMN: Subjective Entry */}
            <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                  💬
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

                {/* PMH (Collapsible) */}
                <CollapsibleSection title="Past Medical History (PMH)">
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

                {/* Family History (Collapsible) */}
                <CollapsibleSection title="Family Medical History">
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      {...form.register('familyHistory')}
                      className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none resize-y min-h-[80px] leading-[1.6] transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
                      placeholder="e.g. Father: Hypertension, CVA. Mother: DM."
                    />
                  </div>
                </CollapsibleSection>

                {/* Social History (Collapsible) */}
                <CollapsibleSection title="Personal and Social History">
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      {...form.register('socialHistory')}
                      className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none resize-y min-h-[80px] leading-[1.6] transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
                      placeholder="e.g. Non-smoker, occasional alcohol. Sedentary lifestyle."
                    />
                  </div>
                </CollapsibleSection>

                {/* OB/Menstrual History (Collapsible) - Conditionally shown if patient is Female */}
                {isFemale && (
                  <CollapsibleSection title="OB/Menstrual History">
                    <div className="flex flex-col gap-1.5">
                      <textarea
                        {...form.register('obHistory')}
                        className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none resize-y min-h-[80px] leading-[1.6] transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
                        placeholder="e.g. G0P0. Regular menses. LMP: May 12, 2026."
                      />
                    </div>
                  </CollapsibleSection>
                )}

                {/* Psychosocial History (Collapsible) */}
                <CollapsibleSection title="Psychosocial History">
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

            {/* RIGHT COLUMN: Vitals, Objective, Assessment, Plan */}
            <div className="flex flex-col gap-6">
              {/* Latest Vital Signs Card */}
              <div className="bg-surface border border-accent-mid/30 rounded-card shadow-card overflow-hidden border-l-[3px] border-l-accent-mid">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-accent-light border-b border-accent-mid">
                  <div className="w-[26px] h-[26px] rounded-icon bg-surface flex items-center justify-center text-[12px] text-accent flex-shrink-0">
                    🫀
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-hover flex-1">
                    Latest Vital Signs (Pre-filled)
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/${patientId}/vitals`)}
                    className="sec-btn primary !h-6 !text-[10px] !px-2.5"
                  >
                    Update Vitals ↗
                  </button>
                </div>
                <div className="p-4 flex flex-col gap-3">
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
                    <div className="p-3 text-center text-[12px] bg-surface-2 border border-border rounded-btn text-[var(--text-secondary)]">
                      No vitals recorded. Please update vitals first.
                    </div>
                  )}
                  <div className="font-mono text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                      <path d="M8 15A7 7 0 108 1a7 7 0 000 14zm0-3.5v-4M8 5.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Vitals are automatically synced from the patient's record. To record new vitals, please use the Vital Signs tab.
                  </div>
                </div>
              </div>

              {/* Objective Entry Card */}
              <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                  <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                    🔬
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
                  <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                    📊
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

              {/* Management Plan Card */}
              <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                  <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                    🩺
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

              {/* Form Actions */}
              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => form.reset()}
                  className="sec-btn destructive"
                >
                  Clear Form
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(formValues)}
                  disabled={isSaving}
                  className="sec-btn"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishMutation.isPending}
                  className="sec-btn primary"
                >
                  Publish Initial Consultation Note
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
