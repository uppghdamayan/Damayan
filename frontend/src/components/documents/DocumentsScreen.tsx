import React, { useState } from 'react';
import { useDocuments, useDocumentDownloadUrl, useDeleteDocument } from '@/hooks/useDocuments';
import { usePriorLabs, useAttachmentDownloadUrl, useDeleteAttachment } from '@/hooks/useAttachments';
import { usePatient } from '@/hooks/usePatients';
import { Button } from '../ui/button';
import { DeleteConfirmModal } from '../ui/DeleteConfirmModal';
import { Download, Plus, Trash2, FileIcon, X, ExternalLink } from 'lucide-react';
import { DocumentGeneratorModal } from './DocumentGeneratorModal';
import { useAuthStore } from '@/stores/authStore';

interface DocumentsScreenProps {
  patientId: string;
}

interface FileItem {
  id: string;
  name: string;
  ext: string;
  type: 'document' | 'attachment';
  date: string;
  user: any;
  raw: any;
}

export function DocumentsScreen({ patientId }: DocumentsScreenProps) {
  const { data: patient } = usePatient(patientId);
  const { data: documents, isLoading: docsLoading } = useDocuments(patientId);
  const { data: groupedLabs, isLoading: labsLoading } = usePriorLabs(patientId);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Flatten grouped labs to get an array of attachments
  const attachments = groupedLabs ? groupedLabs.flatMap((g: any) => g.attachments) : [];
  const isLoading = docsLoading || labsLoading;

  const handleSelectFile = (file: FileItem, url: string) => {
    setSelectedFile(file);
    setPreviewUrl(url);
    setPreviewLoading(false);
  };

  const handleStartLoadingPreview = (file: FileItem) => {
    setSelectedFile(file);
    setPreviewLoading(true);
    setPreviewUrl(null);
  };

  return (
    <div className="flex flex-col gap-6 select-none font-sans">
      {/* Title & Action Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-[20px] font-bold text-text-primary">Documents</h1>
        <Button 
          onClick={() => setIsModalOpen(true)} 
          className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center gap-[5px] cursor-pointer"
        >
          <Plus size={12} /> Generate Document
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Main Content (Tables) */}
        <div className={selectedFile ? "lg:col-span-3 flex flex-col gap-6" : "lg:col-span-4 flex flex-col gap-6"}>
          
          {/* GENERATED DOCUMENTS TABLE */}
          <div className="flex flex-col gap-3">
            <h2 className="text-[13px] font-bold text-text-secondary uppercase tracking-wide px-1">
              Generated Documents
            </h2>
            <div className="bg-surface border border-border rounded-card shadow-sm overflow-hidden">
              {docsLoading ? (
                <TableSkeleton />
              ) : !documents || documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-text-muted select-none">
                  <FileIcon size={40} className="mb-3 opacity-45 text-accent" />
                  <p className="text-[13px] font-bold text-text-secondary">No generated documents</p>
                  <p className="text-[11px] mt-0.5 text-text-muted">Clinical records generated for this patient will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-surface-2">
                        <th className="w-[50px] px-3 py-2 border-b border-border"></th>
                        <th className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary px-3 py-2.5 text-left border-b border-border">
                          Name
                        </th>
                        <th className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary px-3 py-2.5 text-left border-b border-border w-[130px]">
                          Modified
                        </th>
                        <th className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary px-3 py-2.5 text-left border-b border-border w-[170px]">
                          Modified By
                        </th>
                        <th className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary px-3 py-2.5 text-left border-b border-border w-[90px]">
                          File size
                        </th>
                        <th className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary px-3 py-2.5 text-left border-b border-border w-[90px]">
                          Sharing
                        </th>
                        <th className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary px-3 py-2.5 text-center border-b border-border w-[110px]">
                          Activity
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc: any) => {
                        const file: FileItem = {
                          id: doc.id,
                          name: `${getDocTypeName(doc.documentType)}.pdf`,
                          ext: '.pdf',
                          type: 'document',
                          date: doc.generatedAt,
                          user: doc.generatedByUser,
                          raw: doc,
                        };
                        return (
                          <DocumentRow 
                            key={file.id} 
                            file={file} 
                            patientId={patientId}
                            selectedFileId={selectedFile?.id}
                            onSelectFile={handleSelectFile}
                            onStartLoadingPreview={handleStartLoadingPreview}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* UPLOADED DOCUMENTS TABLE */}
          <div className="flex flex-col gap-3">
            <h2 className="text-[13px] font-bold text-text-secondary uppercase tracking-wide px-1">
              Uploaded Documents
            </h2>
            <div className="bg-surface border border-border rounded-card shadow-sm overflow-hidden">
              {labsLoading ? (
                <TableSkeleton />
              ) : attachments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-text-muted select-none">
                  <FileIcon size={40} className="mb-3 opacity-45 text-accent" />
                  <p className="text-[13px] font-bold text-text-secondary">No uploaded documents</p>
                  <p className="text-[11px] mt-0.5 text-text-muted">Lab results or attachments uploaded in progress notes will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-surface-2">
                        <th className="w-[50px] px-3 py-2 border-b border-border"></th>
                        <th className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary px-3 py-2.5 text-left border-b border-border">
                          Name
                        </th>
                        <th className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary px-3 py-2.5 text-left border-b border-border w-[130px]">
                          Modified
                        </th>
                        <th className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary px-3 py-2.5 text-left border-b border-border w-[170px]">
                          Modified By
                        </th>
                        <th className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary px-3 py-2.5 text-left border-b border-border w-[90px]">
                          File size
                        </th>
                        <th className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary px-3 py-2.5 text-left border-b border-border w-[90px]">
                          Sharing
                        </th>
                        <th className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary px-3 py-2.5 text-center border-b border-border w-[110px]">
                          Activity
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {attachments.map((att: any) => {
                        const ext = getFileExtension(att.storageKey);
                        const file: FileItem = {
                          id: att.id,
                          name: `${att.tag || 'Attachment'}${ext}`,
                          ext,
                          type: 'attachment',
                          date: att.uploadedAt,
                          user: att.uploadedByUser,
                          raw: att,
                        };
                        return (
                          <AttachmentRow 
                            key={file.id} 
                            file={file}
                            selectedFileId={selectedFile?.id}
                            onSelectFile={handleSelectFile}
                            onStartLoadingPreview={handleStartLoadingPreview}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* OneDrive Style Detail/Preview Pane */}
        {selectedFile && (
          <div className="lg:col-span-1 bg-surface border border-border rounded-card p-4 flex flex-col gap-4 sticky top-4 shadow-sm animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-[12px] font-bold text-text-primary uppercase tracking-wider">File Details</span>
              <button 
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="p-1 rounded-btn hover:bg-surface-3 transition-colors cursor-pointer text-text-muted hover:text-text-primary"
              >
                <X size={15} />
              </button>
            </div>

            {/* Visual Preview Area */}
            <div className="bg-surface-2 border border-border rounded-card aspect-[4/3] flex items-center justify-center overflow-hidden relative shadow-inner">
              {previewLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px] text-text-muted">Loading preview...</span>
                </div>
              ) : previewUrl ? (
                ['.png', '.jpg', '.jpeg', '.gif'].includes(selectedFile.ext.toLowerCase()) ? (
                  <img 
                    src={previewUrl} 
                    alt={selectedFile.name} 
                    className="max-h-full max-w-full object-contain animate-in fade-in duration-200" 
                  />
                ) : (
                  <iframe 
                    src={previewUrl} 
                    className="w-full h-full border-0 animate-in fade-in duration-200" 
                    title={selectedFile.name}
                  />
                )
              ) : (
                <div className="flex flex-col items-center gap-1.5 p-3 text-center">
                  <FileIconBadge ext={selectedFile.ext} />
                  <span className="text-[11px] text-text-muted truncate max-w-[150px]">{selectedFile.name}</span>
                </div>
              )}
            </div>

            {/* Open / External Link if iframe is sandboxed/blocked */}
            {previewUrl && (
              <a 
                href={previewUrl} 
                target="_blank" 
                rel="noreferrer"
                className="h-[28px] w-full rounded-btn text-[11px] font-semibold border border-border bg-surface hover:bg-surface-2 text-text-secondary flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink size={12} /> Open in New Tab
              </a>
            )}

            {/* Meta Details list */}
            <div className="flex flex-col gap-2.5 text-[12px] pt-1">
              <div>
                <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wide">Name</span>
                <span className="text-text-primary font-semibold break-all">{selectedFile.name}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wide">Type</span>
                <span className="text-text-primary">{selectedFile.ext.toUpperCase().substring(1)} Document</span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wide">Size</span>
                <span className="text-text-primary font-mono">{getMockSize(selectedFile.id, selectedFile.type === 'attachment')}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wide">Modified</span>
                <span className="text-text-primary">{formatDate(selectedFile.date)}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wide">Modified By</span>
                <span className="text-text-primary font-medium">{formatUser(selectedFile.user)}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wide">Sharing</span>
                <span className="text-text-primary inline-block text-[10px] font-bold uppercase tracking-[0.5px] px-1.5 py-[1px] rounded bg-surface-2 border border-border mt-0.5">
                  Private
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <DocumentGeneratorModal 
          patientId={patientId} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </div>
  );
}

interface DocumentRowProps {
  file: FileItem;
  patientId: string;
  selectedFileId?: string;
  onSelectFile: (file: FileItem, url: string) => void;
  onStartLoadingPreview: (file: FileItem) => void;
}

function DocumentRow({ file, patientId, selectedFileId, onSelectFile, onStartLoadingPreview }: DocumentRowProps) {
  const { refetch, isFetching } = useDocumentDownloadUrl(patientId, file.id);
  const deleteMutation = useDeleteDocument(patientId);
  const { user } = useAuthStore();
  const canDelete = user?.role === 'DOCTOR' || user?.role === 'ADMIN';
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const isSelected = selectedFileId === file.id;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await refetch();
      if (res.data) {
        window.open(res.data, '_blank');
      }
    } catch (e) {
      alert('Failed to get download link');
    }
  };

  const handleSelect = async () => {
    onStartLoadingPreview(file);
    try {
      const res = await refetch();
      if (res.data) {
        onSelectFile(file, res.data);
      }
    } catch (e) {
      alert('Failed to load file preview');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(file.id);
      setIsDeleteModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Failed to delete document');
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <tr 
      onClick={handleSelect}
      className={`border-b border-border/40 transition-colors group cursor-pointer ${
        isSelected ? 'bg-accent-light/45 hover:bg-accent-light/60 border-l-[3px] border-l-accent' : 'hover:bg-surface-3'
      }`}
    >
      <td className="px-3 py-2.5 text-center align-middle">
        <FileIconBadge ext={file.ext} />
      </td>
      <td className="px-3 py-2.5 align-middle">
        <span className="text-[13px] text-text-primary font-semibold hover:text-accent hover:underline">
          {file.name}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[12px] text-text-secondary align-middle whitespace-nowrap">
        {formatDate(file.date)}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-text-secondary align-middle truncate max-w-[170px]">
        {formatUser(file.user)}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-text-secondary align-middle whitespace-nowrap">
        {getMockSize(file.id, false)}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-text-secondary align-middle">
        <span className="text-[10px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border bg-surface-2 text-text-secondary border-border select-none">
          Private
        </span>
      </td>
      <td className="px-3 py-2.5 text-center align-middle">
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDownload}
            disabled={isFetching}
            title="Download PDF"
            className="text-text-muted hover:text-accent hover:bg-surface-2 border border-transparent hover:border-border transition-all cursor-pointer h-7 w-7"
          >
            {isFetching ? (
              <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={13} />
            )}
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                setIsDeleteModalOpen(true);
              }}
              className="text-text-muted hover:text-red hover:bg-red-bg border border-transparent hover:border-red-border transition-all cursor-pointer h-7 w-7"
              title="Delete Document"
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>

        <DeleteConfirmModal
          open={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDelete}
          title="Delete Document"
          message={`Are you sure you want to delete this ${file.name}? This action cannot be undone.`}
          isDeleting={deleteMutation.isPending}
        />
      </td>
    </tr>
  );
}

interface AttachmentRowProps {
  file: FileItem;
  selectedFileId?: string;
  onSelectFile: (file: FileItem, url: string) => void;
  onStartLoadingPreview: (file: FileItem) => void;
}

function AttachmentRow({ file, selectedFileId, onSelectFile, onStartLoadingPreview }: AttachmentRowProps) {
  const { refetch, isFetching } = useAttachmentDownloadUrl(file.id);
  const deleteMutation = useDeleteAttachment();
  const { user } = useAuthStore();
  const canDelete = user?.role === 'DOCTOR' || user?.role === 'ADMIN';
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const isSelected = selectedFileId === file.id;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await refetch();
      if (res.data) {
        window.open(res.data, '_blank');
      }
    } catch (e) {
      alert('Failed to get download link');
    }
  };

  const handleSelect = async () => {
    onStartLoadingPreview(file);
    try {
      const res = await refetch();
      if (res.data) {
        onSelectFile(file, res.data);
      }
    } catch (e) {
      alert('Failed to load file preview');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: file.id, noteType: file.raw.noteType, noteId: file.raw.noteId });
      setIsDeleteModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Failed to delete attachment');
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <tr 
      onClick={handleSelect}
      className={`border-b border-border/40 transition-colors group cursor-pointer ${
        isSelected ? 'bg-accent-light/45 hover:bg-accent-light/60 border-l-[3px] border-l-accent' : 'hover:bg-surface-3'
      }`}
    >
      <td className="px-3 py-2.5 text-center align-middle">
        <FileIconBadge ext={file.ext} />
      </td>
      <td className="px-3 py-2.5 align-middle">
        <span className="text-[13px] text-text-primary font-semibold hover:text-accent hover:underline flex flex-col">
          <span>{file.name}</span>
          {file.raw.textResult && (
            <span className="text-[10px] text-text-muted italic font-normal mt-0.5 truncate max-w-[300px]">
              "{file.raw.textResult}"
            </span>
          )}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[12px] text-text-secondary align-middle whitespace-nowrap">
        {formatDate(file.date)}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-text-secondary align-middle truncate max-w-[170px]">
        {formatUser(file.user)}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-text-secondary align-middle whitespace-nowrap">
        {getMockSize(file.id, true)}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-text-secondary align-middle">
        <span className="text-[10px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border bg-surface-2 text-text-secondary border-border select-none">
          Private
        </span>
      </td>
      <td className="px-3 py-2.5 text-center align-middle">
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDownload}
            disabled={isFetching}
            title="Download/View File"
            className="text-text-muted hover:text-accent hover:bg-surface-2 border border-transparent hover:border-border transition-all cursor-pointer h-7 w-7"
          >
            {isFetching ? (
              <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={13} />
            )}
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                setIsDeleteModalOpen(true);
              }}
              className="text-text-muted hover:text-red hover:bg-red-bg border border-transparent hover:border-red-border transition-all cursor-pointer h-7 w-7"
              title="Delete Attachment"
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>

        <DeleteConfirmModal
          open={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDelete}
          title="Delete Attachment"
          message="Are you sure you want to delete this attachment? This action cannot be undone."
          isDeleting={deleteMutation.isPending}
        />
      </td>
    </tr>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border/60">
          <div className="w-[32px] h-[36px] bg-surface-3 rounded-[4px] shrink-0 mx-auto" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-3 w-1/3 bg-surface-3 rounded" />
            <div className="h-2.5 w-1/4 bg-surface-3 rounded" />
          </div>
          <div className="h-3 w-[90px] bg-surface-3 rounded" />
          <div className="h-3 w-[110px] bg-surface-3 rounded" />
          <div className="h-3 w-[60px] bg-surface-3 rounded" />
          <div className="h-3 w-[60px] bg-surface-3 rounded" />
          <div className="h-3 w-[80px] bg-surface-3 rounded" />
        </div>
      ))}
    </div>
  );
}

const getDocTypeName = (type: string) => {
  switch(type) {
    case 'MEDICAL_CERTIFICATE': return 'Medical Certificate';
    case 'LAB_REQUEST': return 'Lab Request';
    case 'PRESCRIPTION': return 'Prescription';
    case 'REFERRAL_LETTER': return 'Referral Letter';
    case 'CHARGE_SLIP': return 'Charge Slip';
    default: return type;
  }
};

const getFileExtension = (key?: string) => {
  if (!key) return '.pdf';
  const lastDot = key.lastIndexOf('.');
  if (lastDot === -1) return '.pdf';
  return key.substring(lastDot).toLowerCase();
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) {
    options.year = 'numeric';
  }
  return d.toLocaleDateString('en-US', options);
};

const formatUser = (user: any) => {
  if (!user) return 'System';
  const last = user.lastName || '';
  const first = user.firstName || '';
  if (last && first) return `${last}, ${first}`;
  return first || last || 'Unknown';
};

const getMockSize = (id: string, isAttachment: boolean) => {
  const base = (id.charCodeAt(0) || 0) + (id.charCodeAt(1) || 0) + (id.charCodeAt(2) || 0);
  if (!isAttachment) {
    return `${115 + (base % 140)} KB`;
  } else {
    const mb = (0.7 + (base % 41) / 10).toFixed(2);
    return `${mb} MB`;
  }
};

const FileIconBadge = ({ ext }: { ext: string }) => {
  const isPdf = ext.toLowerCase() === '.pdf';
  const isImage = ['.jpg', '.jpeg', '.png', '.gif'].includes(ext.toLowerCase());
  
  if (isPdf) {
    return (
      <div className="w-[32px] h-[36px] bg-white border border-border rounded-[4px] relative flex flex-col justify-end shadow-sm select-none shrink-0 mx-auto">
        <div className="absolute top-[4px] right-[4px] w-0 h-0 border-[6px] border-transparent border-t-text-muted border-r-text-muted rounded-tr-[2px]" />
        <div className="bg-[#E02424] text-white text-[7px] font-bold text-center py-[2px] rounded-b-[3px] uppercase tracking-[0.5px] leading-none">
          PDF
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="w-[32px] h-[36px] bg-[#E1EFFE] border border-[#A4CAFE] rounded-[4px] relative flex items-center justify-center shadow-sm select-none shrink-0 mx-auto">
        <span className="text-[14px]">🖼️</span>
      </div>
    );
  }

  return (
    <div className="w-[32px] h-[36px] bg-white border border-border rounded-[4px] relative flex items-center justify-center shadow-sm select-none shrink-0 mx-auto">
      <div className="absolute top-[4px] right-[4px] w-0 h-0 border-[6px] border-transparent border-t-text-muted border-r-text-muted rounded-tr-[2px]" />
      <span className="text-[12px] text-text-muted">📄</span>
    </div>
  );
};
