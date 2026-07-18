import React, { useState } from 'react';
import { useDocumentDraft, useGenerateDocument } from '@/hooks/useDocuments';
import { Button } from '../ui/button';

interface ReferralLetterModalProps {
  patientId: string;
  visitId?: string;
  onClose: () => void;
}

export function ReferralLetterModal({ patientId, visitId, onClose }: ReferralLetterModalProps) {
  const { data: draft, isLoading, error } = useDocumentDraft(patientId, 'REFERRAL_LETTER', visitId);
  const generateDoc = useGenerateDocument(patientId);

  const [referralRecipient, setReferralRecipient] = useState('');
  const [salientPoints, setSalientPoints] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [physicianId, setPhysicianId] = useState('');

  if (isLoading) {
    return <div className="p-4 text-center text-sm">Loading draft...</div>;
  }

  if (error || !draft) {
    return <div className="p-4 text-center text-sm text-red">Failed to load draft</div>;
  }

  const isDoctorAmbiguous = draft.physician === null;
  const isFormValid = referralRecipient.trim() !== '' && salientPoints.trim() !== '' && referralReason.trim() !== '' && (!isDoctorAmbiguous || physicianId !== '');

  const handleGenerate = () => {
    if (!isFormValid) return;
    generateDoc.mutate({
      type: 'REFERRAL_LETTER',
      visitId,
      referralRecipient,
      salientPoints,
      referralReason,
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
          <h3 className="font-bold text-[14px] mb-2 border-b border-border pb-1">REFERRAL LETTER (Draft)</h3>
          <p><strong>Patient:</strong> {draft.patient.firstName} {draft.patient.lastName}</p>
          <div className="mt-2 font-bold">Assessment:</div>
          <ul className="list-disc list-inside">
            {draft.assessment && draft.assessment.length > 0 ? draft.assessment.map((a, i) => (
              <li key={i}>{a.title} {a.icdCode ? `(${a.icdCode})` : ''}</li>
            )) : <li>No assessment</li>}
          </ul>
        </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">
            Referral Recipient <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
          </label>
          <input
            className="w-full h-[34px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none focus:border-accent"
            value={referralRecipient}
            onChange={e => setReferralRecipient(e.target.value)}
            maxLength={150}
            placeholder="e.g. Dr. Timoteo Gonzales (Infectious Disease)"
          />
        </div>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">
            Salient Points <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
          </label>
          <textarea
            className="w-full p-2 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none focus:border-accent resize-y min-h-[60px]"
            value={salientPoints}
            onChange={e => setSalientPoints(e.target.value)}
            maxLength={500}
            placeholder="Enter salient points..."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">
            Reason for Referral <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
          </label>
          <textarea
            className="w-full p-2 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none focus:border-accent resize-y min-h-[60px]"
            value={referralReason}
            onChange={e => setReferralReason(e.target.value)}
            maxLength={500}
            placeholder="Enter reason for referral..."
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
