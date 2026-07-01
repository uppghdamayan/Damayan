import React, { useState, useEffect } from 'react';
import { useGenerateDocument } from '@/hooks/useDocuments';
import { Button } from '../ui/button';
import { X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface DocumentGeneratorModalProps {
  patientId: string;
  onClose: () => void;
}

export function DocumentGeneratorModal({ patientId, onClose }: DocumentGeneratorModalProps) {
  const [docType, setDocType] = useState<string>('MEDICAL_CERTIFICATE');
  const generateDoc = useGenerateDocument(patientId);
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

  const handleGenerate = () => {
    generateDoc.mutate({ type: docType }, {
      onSuccess: () => {
        onClose();
      },
      onError: (err: any) => {
        alert(err.message || 'Failed to generate document');
      }
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-surface border border-border rounded-[10px] w-[500px] max-[1439px]:w-[460px] max-h-[85vh] overflow-y-auto shadow-modal flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border bg-surface-2 select-none">
          <h2 className="text-[15px] font-bold flex-1 text-text-primary">Generate Document</h2>
          <Button 
            variant="ghost" 
            size="icon-xs" 
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={16} />
          </Button>
        </div>
        
        {/* Body */}
        <div className="px-[18px] py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">
              Document Type <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
            </label>
            <select 
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="w-full h-[34px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150
                focus:bg-surface focus:border-accent focus:shadow-accent-focus cursor-pointer"
            >
              <option value="MEDICAL_CERTIFICATE">Medical Certificate</option>
              <option value="LAB_REQUEST">Lab Request</option>
              <option value="PRESCRIPTION">Prescription</option>
              <option value="CHARGE_SLIP">Charge Slip</option>
            </select>
          </div>

          <div className="text-[12px] text-text-secondary bg-surface-2 p-3 rounded-card border border-border leading-relaxed">
            <p className="mb-1 font-bold text-accent">Note on Clinical Data Integration:</p>
            <p className="text-[11px] text-text-muted">
              The generated document automatically queries and embeds the latest patient record data. 
              For example, active medications populate the Prescription, and the latest published assessment 
              populates the Medical Certificate.
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
            onClick={handleGenerate} 
            disabled={generateDoc.isPending}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 cursor-pointer inline-flex items-center gap-[5px]"
          >
            {generateDoc.isPending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              'Generate PDF'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
