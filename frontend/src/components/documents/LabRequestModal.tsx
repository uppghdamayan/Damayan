import React, { useState } from 'react';
import { useDocumentDraft, useGenerateDocument } from '@/hooks/useDocuments';
import { Button } from '../ui/button';
import { DocumentDraftPreview } from './DocumentDraftPreview';

interface LabRequestModalProps {
  patientId: string;
  visitId?: string;
  onClose: () => void;
}

export function LabRequestModal({ patientId, visitId, onClose }: LabRequestModalProps) {
  const { data: draft, isLoading, error } = useDocumentDraft(patientId, 'LAB_REQUEST', visitId);
  const generateDoc = useGenerateDocument(patientId);

  const [physicianId, setPhysicianId] = useState('');

  if (isLoading) {
    return <div className="p-4 text-center text-sm">Loading draft...</div>;
  }

  if (error || !draft) {
    return <div className="p-4 text-center text-sm text-red">Failed to load draft</div>;
  }

  const isDoctorAmbiguous = draft.physician === null;
  const isFormValid = !isDoctorAmbiguous || physicianId !== '';

  const handleGenerate = () => {
    if (!isFormValid) return;
    generateDoc.mutate({
      type: 'LAB_REQUEST',
      visitId,
      physicianId: isDoctorAmbiguous ? physicianId : undefined,
    }, {
      onSuccess: onClose,
      onError: (err: any) => alert(err.message || 'Failed to generate document'),
    });
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-150">
      <div className="px-[18px] py-5 flex flex-col gap-4 overflow-y-auto">
        <DocumentDraftPreview draft={draft} title="LAB REQUEST (Draft)" showMedications={false} />

        <div className="flex flex-col gap-3">
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
              <strong>{draft.physician?.role === 'DOCTOR' ? 'Physician' : 'Prepared By'}:</strong> {draft.physician?.role === 'DOCTOR' ? 'Dr. ' : ''}{draft.physician?.firstName} {draft.physician?.lastName}
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
