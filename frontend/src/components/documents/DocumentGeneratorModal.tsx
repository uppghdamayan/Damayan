import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { MedicalCertificateModal } from './MedicalCertificateModal';
import { ReferralLetterModal } from './ReferralLetterModal';
import { LabRequestModal } from './LabRequestModal';
import { PrescriptionModal } from './PrescriptionModal';

interface DocumentGeneratorModalProps {
  patientId: string;
  onClose: () => void;
}

export function DocumentGeneratorModal({ patientId, onClose }: DocumentGeneratorModalProps) {
  const [docType, setDocType] = useState<string>('MEDICAL_CERTIFICATE');
  const [step, setStep] = useState<1 | 2>(1);
  const { user } = useAuthStore();
  const role = user?.role;

  // Handle keyboard navigability (Escape key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleNext = () => {
    // Every document type now reviews a live draft (Assessment/Medications
    // pulled fresh from the Problem List and active Medications) before
    // generating, so the preview always matches what prints.
    setStep(2);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-surface border border-border rounded-[10px] w-[500px] @max-[1439px]:w-[460px] max-h-[85vh] overflow-y-auto shadow-modal flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border bg-surface-2 select-none">
          <h2 className="text-[15px] font-bold flex-1 text-text-primary">
            {step === 2 ? 'Draft Document' : 'Generate Document'}
          </h2>
          <Button 
            variant="ghost" 
            size="icon-xs" 
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={16} />
          </Button>
        </div>
        
        {step === 1 ? (
          <>
            {/* Body */}
            <div className="px-[18px] py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">
                  Document Type <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
                </label>
                <select 
                  value={docType}
                  onChange={e => setDocType(e.target.value)}
                  className="w-full h-[34px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:bg-surface focus:border-accent focus:shadow-accent-focus cursor-pointer"
                >
                  <option value="MEDICAL_CERTIFICATE">Medical Certificate</option>
                  <option value="REFERRAL_LETTER">Referral Letter</option>
                  <option value="LAB_REQUEST">Lab Request</option>
                  <option value="PRESCRIPTION">Prescription</option>
                </select>
              </div>

              <div className="text-[12px] text-text-secondary bg-surface-2 p-3 rounded-card border border-border leading-relaxed">
                <p className="mb-1 font-bold text-accent">Note on Clinical Data Integration:</p>
                <p className="text-[11px] text-text-muted">
                  The next step shows a live draft — Assessment pulled from the current Problem List
                  and Medications from the active medication list — for you to review before the PDF is generated.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-[18px] py-3 border-t border-border bg-surface-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleNext}
                className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 cursor-pointer inline-flex items-center gap-[5px]"
              >
                Continue to Draft
              </Button>
            </div>
          </>
        ) : (
          docType === 'MEDICAL_CERTIFICATE' ? (
            <MedicalCertificateModal patientId={patientId} onClose={onClose} />
          ) : docType === 'REFERRAL_LETTER' ? (
            <ReferralLetterModal patientId={patientId} onClose={onClose} />
          ) : docType === 'LAB_REQUEST' ? (
            <LabRequestModal patientId={patientId} onClose={onClose} />
          ) : docType === 'PRESCRIPTION' ? (
            <PrescriptionModal patientId={patientId} onClose={onClose} />
          ) : null
        )}
      </div>
    </div>
  );
}
