import React, { useState } from 'react';
import { useDocumentDraft, useGenerateDocument } from '@/hooks/useDocuments';
import { Button } from '../ui/button';

interface MedicalCertificateModalProps {
  patientId: string;
  visitId?: string;
  onClose: () => void;
}

export function MedicalCertificateModal({ patientId, visitId, onClose }: MedicalCertificateModalProps) {
  const { data: draft, isLoading, error } = useDocumentDraft(patientId, 'MEDICAL_CERTIFICATE', visitId);
  const generateDoc = useGenerateDocument(patientId);

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [physicianId, setPhysicianId] = useState('');
  
  // pre-fill chief complaint when draft loads
  React.useEffect(() => {
    if (draft?.chiefComplaintDefault && !chiefComplaint) {
      setChiefComplaint(draft.chiefComplaintDefault);
    }
  }, [draft, chiefComplaint]);

  if (isLoading) {
    return <div className="p-4 text-center text-sm">Loading draft...</div>;
  }

  if (error || !draft) {
    return <div className="p-4 text-center text-sm text-red">Failed to load draft</div>;
  }

  const isDoctorAmbiguous = draft.physician === null;
  const isFormValid = chiefComplaint.trim() !== '' && recommendation.trim() !== '' && (!isDoctorAmbiguous || physicianId !== '');

  const handleGenerate = () => {
    if (!isFormValid) return;
    generateDoc.mutate({
      type: 'MEDICAL_CERTIFICATE',
      visitId,
      chiefComplaint,
      recommendation,
      physicianId: isDoctorAmbiguous ? physicianId : undefined,
    }, {
      onSuccess: onClose,
      onError: (err: any) => alert(err.message || 'Failed to generate document'),
    });
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-150">
      <div className="px-[18px] py-5 flex flex-col gap-4 overflow-y-auto">
        <div className="bg-surface-2 border border-border rounded-card p-4 text-[13px] text-text-primary">
          <h3 className="font-bold text-[14px] mb-2 border-b border-border pb-1">MEDICAL CERTIFICATE (Draft)</h3>
          <p><strong>Patient:</strong> {draft.patient.firstName} {draft.patient.lastName}</p>
          <div className="mt-2 font-bold">Assessment:</div>
          <ul className="list-disc list-inside">
            {draft.assessment && draft.assessment.length > 0 ? draft.assessment.map((a, i) => (
              <li key={i}>{a.title} {a.icdCode ? `(${a.icdCode})` : ''}</li>
            )) : <li>No assessment</li>}
          </ul>
          <div className="mt-2 font-bold">Medications:</div>
          <ul className="list-disc list-inside">
            {draft.medications && draft.medications.length > 0 ? draft.medications.map((m, i) => (
              <li key={i}>{m.name} {m.dose}</li>
            )) : <li>No active medications</li>}
          </ul>
        </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">
            Chief Complaint <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
          </label>
          <textarea
            className="w-full p-2 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none focus:border-accent resize-y min-h-[60px]"
            value={chiefComplaint}
            onChange={e => setChiefComplaint(e.target.value)}
            maxLength={300}
            placeholder="Enter chief complaint..."
          />
        </div>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">
            Recommendation <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
          </label>
          <textarea
            className="w-full p-2 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none focus:border-accent resize-y min-h-[80px]"
            value={recommendation}
            onChange={e => setRecommendation(e.target.value)}
            maxLength={1000}
            placeholder="Enter recommendation..."
          />
        </div>

        {isDoctorAmbiguous ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">
              Physician <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
            </label>
            <select
              value={physicianId}
              onChange={e => setPhysicianId(e.target.value)}
              className="w-full h-[34px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none focus:border-accent"
            >
              <option value="">Select a physician...</option>
              {draft.candidateDoctors.map(d => (
                <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="text-[12px] text-text-secondary bg-surface-2 p-2 rounded-card border border-border">
            <strong>Physician:</strong> Dr. {draft.physician?.firstName} {draft.physician?.lastName}
          </div>
        )}
      </div>
      </div>

      <div className="flex justify-end gap-2 px-[18px] py-3 border-t border-border bg-surface-2 mt-auto">
        <Button 
          variant="outline" 
          onClick={onClose}
          className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 cursor-pointer"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleGenerate} 
          disabled={!isFormValid || generateDoc.isPending}
          className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-[5px]"
        >
          {generateDoc.isPending ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : 'Generate PDF'}
        </Button>
      </div>
    </div>
  );
}
