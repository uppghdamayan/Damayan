import React, { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { FileText, UploadCloud, X, Eye, CheckCircle2, Image, Plus } from 'lucide-react';
import { PriorLabsTable } from '../notes/PriorLabsTable';
import { ComboboxInput } from '@/components/ui/ComboboxInput';

const TAG_SUGGESTIONS = [
  'CBC',
  'Urinalysis',
  'Fecalysis',
  'Chest X-Ray',
  'Lipid Profile',
  'FBS (Fasting Blood Sugar)',
  'HbA1c',
  'ECG (12-Lead)',
  'Creatinine',
  'SGPT (ALT)',
  'SGOT (AST)',
  'TSH (Thyroid Stimulating Hormone)',
  'Electrolytes (Na, K, Cl)',
  'Ultrasound (Whole Abdomen)',
  'Urgent Lab Result'
];

interface AttachmentsSectionProps {
  patientId: string;
  noteType: 'INITIAL_NOTE' | 'PROGRESS_NOTE';
  noteId?: string;
  localAttachments?: any[];
  onAddLocalAttachment?: (attachment: { tag: string, textResult: string, file: File | null }) => void;
  onRemoveLocalAttachment?: (index: number) => void;
  onPendingChange?: (pending: { hasFile: boolean; tag: string; textResult: string; fileName?: string }) => void;
}

export function AttachmentsSection({ 
  patientId, 
  noteType, 
  noteId, 
  localAttachments = [], 
  onAddLocalAttachment, 
  onRemoveLocalAttachment,
  onPendingChange
}: AttachmentsSectionProps) {
  const [tag, setTag] = useState('');
  const [textResult, setTextResult] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (onPendingChange) {
      onPendingChange({
        hasFile: !!pendingFile,
        tag,
        textResult,
        fileName: pendingFile?.name
      });
    }
  }, [pendingFile, tag, textResult, onPendingChange]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleFileChange = (file: File) => {
    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemovePendingFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPendingFile(null);
    setPreviewUrl(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!tag.trim()) {
      alert('Please provide a tag (e.g., CBC, X-Ray) for this result.');
      return;
    }
    if (!pendingFile) {
      alert('Please select a file.');
      return;
    }
    
    if (onAddLocalAttachment) {
      onAddLocalAttachment({
        tag: tag.trim(),
        textResult: textResult.trim(),
        file: pendingFile
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPendingFile(null);
      setPreviewUrl(null);
      setTag('');
      setTextResult('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-[7px]">
        <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface-3 shrink-0">🧪</div>
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">
          Results of Labs or Imaging
        </span>
      </div>
      
      <div className="p-[14px] flex flex-col gap-4">
        {/* Prior Labs Table Section */}
        <div className="flex flex-col">
          <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary mb-1.5 pb-1 border-b border-border">
            Prior Labs & Attachments
          </div>
          <PriorLabsTable 
            patientId={patientId} 
            noteId={noteId}
            localAttachments={localAttachments} 
            onRemoveLocalAttachment={onRemoveLocalAttachment} 
          />
        </div>

        {/* New Results Upload Section */}
        <div className="flex flex-col">
          <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary mb-2 pb-1 border-b border-border flex items-center gap-1">
            New Lab / Imaging Result <span className="text-red font-bold text-[11px]">*</span>
          </div>

          {/* Upload Form Container */}
          <div className="flex flex-col gap-3 p-3.5 border border-border rounded-[8px] bg-surface-2/40">
            {/* Tag Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">
                Tag / Test Name <span className="text-red font-bold">*</span>
              </label>
              <ComboboxInput
                value={tag}
                onChange={(val) => setTag(val)}
                options={TAG_SUGGESTIONS}
                placeholder="Select or type test (e.g. CBC, Chest X-Ray)"
              />
            </div>

            {/* File Dropzone / Selected File Card */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">
                File Attachment <span className="text-red font-bold">*</span>
              </label>
              
              {!pendingFile ? (
                <div 
                  className={`flex flex-col items-center justify-center p-4 border border-dashed rounded-[6px] transition-all cursor-pointer text-center group ${
                    dragActive ? 'border-accent bg-accent/10' : 'border-border-strong/60 bg-surface hover:bg-surface-2 hover:border-accent/60'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }} 
                  />
                  <UploadCloud className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors mb-1.5" strokeWidth={1.75} />
                  <p className="text-[12px] text-text-primary font-medium">
                    Click to browse or drag & drop file here
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Supports PDF, PNG, JPG, DICOM files up to 10MB
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 p-3 bg-surface border border-border rounded-[6px] shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 font-bold text-[10px] ${
                        pendingFile.type === 'application/pdf' 
                          ? 'bg-red/10 text-red' 
                          : pendingFile.type.startsWith('image/') 
                          ? 'bg-accent/10 text-accent' 
                          : 'bg-surface-3 text-text-secondary'
                      }`}>
                        {pendingFile.type === 'application/pdf' ? (
                          'PDF'
                        ) : pendingFile.type.startsWith('image/') ? (
                          <Image className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12px] font-semibold text-text-primary truncate">{pendingFile.name}</span>
                        <span className="text-[10px] font-mono text-text-muted">{(pendingFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      className="p-1 rounded-md hover:bg-surface-3 text-text-muted hover:text-red transition-all cursor-pointer" 
                      onClick={handleRemovePendingFile}
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Image preview thumbnail */}
                  {pendingFile.type.startsWith('image/') && previewUrl && (
                    <div className="relative w-full max-h-32 rounded border border-border overflow-hidden bg-black/5 flex items-center justify-center mt-1">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="max-h-32 object-contain"
                      />
                    </div>
                  )}

                  {/* Positive status badge */}
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/60 text-[11px] font-medium text-accent">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span>File selected. Click "+ Add Result" below to attach to this note.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Text Result / Remarks */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.5px]">
                Text Result / Remarks <span className="text-text-muted font-normal text-[10px] lowercase">(optional)</span>
              </label>
              <textarea 
                placeholder="Enter manual lab results, values, or remarks..." 
                className="w-full px-2.5 py-1.5 bg-white border border-border-strong/60 rounded-[6px] text-[12px] text-text-primary outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] min-h-[60px] resize-y placeholder:text-border-strong/70"
                value={textResult}
                onChange={e => setTextResult(e.target.value)}
              />
            </div>

            {/* Add Action Button */}
            <div className="flex justify-end pt-1">
              <button 
                type="button"
                disabled={!tag.trim() || !pendingFile}
                onClick={handleUpload}
                className="h-7 px-3.5 rounded-[6px] text-[11px] font-semibold bg-accent text-white hover:bg-accent-hover shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Result
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
