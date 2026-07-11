import React, { useRef, useState } from 'react';
import { useAttachmentsByNote, useDeleteAttachment, useUploadAttachment, useAttachmentDownloadUrl } from '@/hooks/useAttachments';
import { LabResultsSectionSkeleton } from './LabResultsSectionSkeleton';
import { UploadProgressBar } from './UploadProgressBar';
import { Button } from '../ui/button';
import { Trash2, FileText, UploadCloud, X, Download, Eye } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
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

function AttachmentViewButton({ attachmentId, filename }: { attachmentId: string, filename: string }) {
  const { refetch, isFetching } = useAttachmentDownloadUrl(attachmentId);

  const handleView = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await refetch();
      if (res.data) {
        window.open(res.data, '_blank');
      }
    } catch (err) {
      alert('Failed to view file');
    }
  };

  return (
    <Button
      variant="outline"
      size="xs"
      onClick={handleView}
      disabled={isFetching}
      className="h-6.5 text-[11px] font-semibold border-accent/20 hover:border-accent/50 hover:bg-accent-light/20 hover:text-accent transition-all duration-150 flex items-center gap-1 mt-1.5 w-fit"
    >
      <Eye size={12} />
      {isFetching ? 'Loading...' : `View File`}
    </Button>
  );
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
  const { data: attachments, isLoading } = useAttachmentsByNote(noteType, noteId);
  // useUploadAttachment is moved to ProgressNoteForm
  const deleteAttachment = useDeleteAttachment();
  const { user } = useAuthStore();
  const role = user?.role;
  
  const [tag, setTag] = useState('');
  const [textResult, setTextResult] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  
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

  if (isLoading && noteId) {
    return <LabResultsSectionSkeleton />;
  }

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
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
      <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2 border-b border-border rounded-t-[7px]">
        <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[12px] bg-surface-3 shrink-0">🧪</div>
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)] flex-1">
          Results of Labs or Imaging
        </span>
      </div>
      
      <div className="p-[14px] flex flex-col gap-5">
        {/* Prior Labs Table Section */}
        <div className="flex flex-col">
          <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-accent-mid mb-1.5 pb-1 border-b border-border">
            Prior Labs
          </div>
          <PriorLabsTable patientId={patientId} localAttachments={localAttachments} onRemoveLocalAttachment={onRemoveLocalAttachment} />
        </div>

        {/* New Results Upload Section */}
        <div className="flex flex-col">
          <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-accent-mid mb-1.5 pb-1 border-b border-border">
            New Results <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
          </div>

          {/* Attachment List */}
          {attachments && attachments.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              <h4 className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Attached to this note:</h4>
              <div className="flex flex-col gap-2">
                {attachments.map((att: any) => (
                  <div key={att.id} className="flex justify-between items-start p-[10px] bg-surface-2 rounded-[6px] border border-border">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">{att.tag}</span>
                      {att.storageKey && (
                        <AttachmentViewButton attachmentId={att.id} filename={att.storageKey.split('/').pop() || ''} />
                      )}
                      {att.textResult && (
                        <p className="mt-1.5 text-[12px] text-[var(--text-secondary)] italic">"{att.textResult}"</p>
                      )}
                      <span className="text-[10px] text-[var(--text-muted)] mt-1.5">
                        By {att.uploadedByUser?.firstName} {att.uploadedByUser?.lastName}
                      </span>
                    </div>
                    
                    {(role === 'DOCTOR' || role === 'ADMIN') && (
                      <button 
                        className="h-[28px] px-2 rounded-btn bg-transparent border-transparent hover:bg-red-bg hover:text-red text-[var(--text-muted)] transition-all duration-150 inline-flex items-center justify-center"
                        onClick={() => {
                          if(confirm('Are you sure you want to delete this attachment?')) {
                            deleteAttachment.mutate({ id: att.id, noteType, noteId: noteId! });
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Upload Form */}
        <div className="flex flex-col gap-3 p-[14px] border border-dashed border-border-strong/60 rounded-[8px] bg-surface relative">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Tag (Required)</label>
            <ComboboxInput
              value={tag}
              onChange={(val) => setTag(val)}
              options={TAG_SUGGESTIONS}
              placeholder="e.g. CBC, Chest X-Ray"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Text Result (Optional)</label>
            <textarea 
              placeholder="Enter manual lab results here..." 
              className="w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none resize-y min-h-[80px] leading-[1.6] transition-all duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-[var(--text-muted)]"
              value={textResult}
              onChange={e => setTextResult(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5 mb-1">
            <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.5px]">File (Required) <span className="text-red font-bold">*</span></label>
            {!pendingFile ? (
              <div 
                className={`flex flex-col items-center justify-center py-[22px] px-4 border border-dashed rounded-btn transition-colors duration-150 ${dragActive ? 'border-accent bg-accent-light/30' : 'border-border-strong/60 bg-surface hover:bg-surface-2'}`}
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
                <UploadCloud className="w-6 h-6 text-[var(--text-muted)] mb-2.5" strokeWidth={1.5} />
                <p className="text-[12px] text-[var(--text-secondary)] cursor-pointer text-center">
                  Drag and drop a file here, or <span className="text-accent underline font-medium">click to select</span>
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-3 border border-border rounded-btn bg-surface-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate max-w-[85%]">
                    <FileText className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-[12px] font-medium text-[var(--text-primary)] truncate">{pendingFile.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">({(pendingFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  <button 
                    type="button"
                    className="h-6 w-6 rounded-full hover:bg-surface-3 hover:text-red text-[var(--text-muted)] transition-all flex items-center justify-center cursor-pointer" 
                    onClick={handleRemovePendingFile}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* File preview thumbnail if image */}
                {pendingFile.type.startsWith('image/') && previewUrl && (
                  <div className="relative w-full max-h-36 rounded-md overflow-hidden border border-border bg-black/5 flex items-center justify-center mt-1">
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="max-h-36 object-contain"
                    />
                  </div>
                )}
                {/* PDF preview indicator */}
                {pendingFile.type === 'application/pdf' && (
                  <div className="flex items-center gap-2 p-2 bg-surface/50 border border-border rounded text-[11px] text-[var(--text-secondary)] mt-1">
                    <span className="w-2 h-2 rounded-full bg-red shrink-0" />
                    <span>PDF Document selected. Click 'Add Result' to attach.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end mt-1">
            <button 
              disabled={!tag.trim() || !pendingFile}
              onClick={handleUpload}
              className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap min-w-[80px] justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Add Result
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
