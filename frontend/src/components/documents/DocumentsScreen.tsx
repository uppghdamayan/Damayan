import React, { useState } from 'react';
import { useDocuments, useDocumentDownloadUrl, useDeleteDocument } from '@/hooks/useDocuments';
import { usePriorLabs, useAttachmentDownloadUrl, useDeleteAttachment } from '@/hooks/useAttachments';
import { Button } from '../ui/button';
import { DeleteConfirmModal } from '../ui/DeleteConfirmModal';
import { FileText, Download, Plus, Trash2, FileIcon } from 'lucide-react';
import { DocumentGeneratorModal } from './DocumentGeneratorModal';
import { useAuthStore } from '@/stores/authStore';

interface DocumentsScreenProps {
  patientId: string;
}

export function DocumentsScreen({ patientId }: DocumentsScreenProps) {
  const { data: documents, isLoading: docsLoading } = useDocuments(patientId);
  const { data: groupedLabs, isLoading: labsLoading } = usePriorLabs(patientId);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Flatten grouped labs to get an array of attachments
  const attachments = groupedLabs ? groupedLabs.flatMap((g: any) => g.attachments) : [];

  return (
    <div className="flex flex-col gap-6">
      {/* GENERATED DOCUMENTS SECTION */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center bg-surface border border-border rounded-card p-3 px-4 shadow-sm select-none">
          <span className="text-[13px] font-bold text-text-secondary uppercase tracking-wide">
            Generated Documents
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-text-muted font-medium">
              {documents && documents.length > 0 
                ? `${documents.length} document${documents.length === 1 ? '' : 's'}` 
                : ''}
            </span>
            <Button 
              onClick={() => setIsModalOpen(true)} 
              className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center gap-[5px] cursor-pointer"
            >
              <Plus size={12} /> Generate Document
            </Button>
          </div>
        </div>

        {docsLoading ? (
          <div className="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : !documents || documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 bg-surface border border-border border-dashed rounded-card text-text-muted shadow-sm select-none">
            <FileText size={40} className="mb-3 opacity-40 text-accent" />
            <p className="text-[14px] font-bold text-text-secondary">No documents generated yet</p>
            <p className="text-[12px] mt-1 mb-4 text-text-muted">Generate prescriptions, medical certificates, or lab requests.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3 gap-4">
            {documents.map((doc: any) => (
              <DocumentCard key={doc.id} document={doc} patientId={patientId} />
            ))}
          </div>
        )}
      </div>

      {/* UPLOADED ATTACHMENTS SECTION */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center bg-surface border border-border rounded-card p-3 px-4 shadow-sm select-none">
          <span className="text-[13px] font-bold text-text-secondary uppercase tracking-wide">
            Uploaded Attachments
          </span>
          <span className="text-[12px] text-text-muted font-medium">
            {attachments.length > 0 
              ? `${attachments.length} attachment${attachments.length === 1 ? '' : 's'}` 
              : ''}
          </span>
        </div>

        {labsLoading ? (
          <div className="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 bg-surface border border-border border-dashed rounded-card text-text-muted shadow-sm select-none">
            <FileIcon size={40} className="mb-3 opacity-40 text-accent" />
            <p className="text-[14px] font-bold text-text-secondary">No uploaded attachments</p>
            <p className="text-[12px] mt-1 text-text-muted">Attachments uploaded in progress notes will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3 gap-4">
            {attachments.map((att: any) => (
              <AttachmentCard key={att.id} attachment={att} />
            ))}
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

function CardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden flex flex-col h-[155px]">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
        <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex-shrink-0 animate-pulse" />
        <div className="h-3 w-1/2 bg-surface-3 rounded animate-pulse" />
      </div>
      <div className="p-3.5 flex flex-col gap-3 flex-1 justify-between bg-surface">
        <div className="flex flex-col gap-2.5 mt-1">
          <div className="flex justify-between items-center">
            <div className="h-2 w-20 bg-surface-3 rounded animate-pulse" />
            <div className="h-2 w-24 bg-surface-3 rounded animate-pulse" />
          </div>
          <div className="flex justify-between items-center">
            <div className="h-2 w-20 bg-surface-3 rounded animate-pulse" />
            <div className="h-2 w-24 bg-surface-3 rounded animate-pulse" />
          </div>
        </div>
        <div className="w-full h-[28px] bg-surface-3 rounded-btn animate-pulse mt-auto" />
      </div>
    </div>
  );
}

function DocumentCard({ document, patientId }: { document: any, patientId: string }) {
  const { refetch, isFetching } = useDocumentDownloadUrl(patientId, document.id);
  const deleteMutation = useDeleteDocument(patientId);
  const { user } = useAuthStore();
  const canDelete = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleDownload = async () => {
    try {
      const res = await refetch();
      if (res.data) {
        window.open(res.data, '_blank');
      }
    } catch (e) {
      alert('Failed to get download link');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(document.id);
      setIsDeleteModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Failed to delete document');
      setIsDeleteModalOpen(false);
    }
  };

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

  const getDocIcon = (type: string) => {
    switch(type) {
      case 'MEDICAL_CERTIFICATE': return '📜';
      case 'LAB_REQUEST': return '🧪';
      case 'PRESCRIPTION': return '💊';
      case 'REFERRAL_LETTER': return '✉️';
      case 'CHARGE_SLIP': return '💳';
      default: return '📄';
    }
  };

  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden flex flex-col hover:border-border-strong transition-all duration-150">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
        <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[13px] flex-shrink-0 select-none">
          {getDocIcon(document.documentType)}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-text-secondary flex-1 truncate">
          {getDocTypeName(document.documentType)}
        </span>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-text-muted hover:text-red transition-colors cursor-pointer"
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={deleteMutation.isPending}
            title="Delete Document"
          >
            {deleteMutation.isPending ? (
              <div className="w-3 h-3 border-2 border-red border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        )}
      </div>

      <div className="p-3.5 flex flex-col gap-3 flex-1 justify-between bg-surface">
        <div className="flex flex-col gap-1.5 text-[12px]">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-text-muted">Date Generated</span>
            <span className="font-mono text-text-secondary">{new Date(document.generatedAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-text-muted">Generated By</span>
            <span className="font-semibold text-text-secondary">
              {document.generatedByUser?.firstName} {document.generatedByUser?.lastName}
            </span>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center justify-center gap-[5px] cursor-pointer" 
          onClick={handleDownload}
          disabled={isFetching}
        >
          <Download size={12} className="mr-1" />
          {isFetching ? 'Loading URL...' : 'Download PDF'}
        </Button>
      </div>

      <DeleteConfirmModal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Document"
        message={`Are you sure you want to delete this ${getDocTypeName(document.documentType)}? This action cannot be undone.`}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}

function AttachmentCard({ attachment }: { attachment: any }) {
  const { refetch, isFetching } = useAttachmentDownloadUrl(attachment.id);
  const deleteMutation = useDeleteAttachment();
  const { user } = useAuthStore();
  const canDelete = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleDownload = async () => {
    try {
      const res = await refetch();
      if (res.data) {
        window.open(res.data, '_blank');
      }
    } catch (e) {
      alert('Failed to get download link');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: attachment.id, noteType: attachment.noteType, noteId: attachment.noteId });
      setIsDeleteModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Failed to delete attachment');
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden flex flex-col hover:border-border-strong transition-all duration-150">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
        <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[13px] flex-shrink-0 select-none">
          📎
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-text-secondary flex-1 truncate">
          {attachment.tag}
        </span>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-text-muted hover:text-red transition-colors cursor-pointer"
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={deleteMutation.isPending}
            title="Delete Attachment"
          >
            {deleteMutation.isPending ? (
              <div className="w-3 h-3 border-2 border-red border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        )}
      </div>

      <div className="p-3.5 flex flex-col gap-3 flex-1 justify-between bg-surface">
        <div className="flex flex-col gap-1.5 text-[12px]">
          {attachment.textResult && (
            <div className="flex flex-col mb-1 pb-2 border-b border-border border-dashed">
              <span className="text-[10px] uppercase font-bold text-text-muted mb-0.5">Result/Notes</span>
              <span className="italic text-text-secondary">"{attachment.textResult}"</span>
            </div>
          )}
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-text-muted">Uploaded</span>
            <span className="font-mono text-text-secondary">{new Date(attachment.uploadedAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-text-muted">Uploaded By</span>
            <span className="font-semibold text-text-secondary">
              {attachment.uploadedByUser?.firstName} {attachment.uploadedByUser?.lastName}
            </span>
          </div>
        </div>

        {attachment.storageKey && (
          <Button 
            variant="outline" 
            className="w-full h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center justify-center gap-[5px] cursor-pointer mt-1" 
            onClick={handleDownload}
            disabled={isFetching}
          >
            <Download size={12} className="mr-1" />
            {isFetching ? 'Loading...' : 'View File'}
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
    </div>
  );
}
