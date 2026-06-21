import { useState } from 'react';
import { UploadIcon, XIcon } from 'lucide-react';

interface MockAttachment {
  id: string;
  name: string;
  size: number;
}

export function AttachmentUploader() {
  const [files, setFiles] = useState<MockAttachment[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(f => ({
        id: Math.random().toString(36).substring(7),
        name: f.name,
        size: f.size,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemove = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="border-2 border-dashed border-border rounded-card p-6 flex flex-col items-center justify-center bg-surface-2 hover:bg-surface-3 transition-colors">
        <UploadIcon className="w-6 h-6 text-[var(--text-muted)] mb-2" />
        <span className="text-[12px] text-[var(--text-secondary)] font-medium mb-1">
          Drag & drop files here
        </span>
        <span className="text-[11px] text-[var(--text-muted)] mb-3">
          or click to browse
        </span>
        <label className="sec-btn primary cursor-pointer">
          Browse Files
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          {files.map(f => (
            <div key={f.id} className="flex items-center justify-between px-3 py-2 bg-surface border border-border rounded-btn">
              <div className="flex flex-col">
                <span className="text-[12px] text-[var(--text-primary)] font-medium truncate max-w-[200px]">
                  {f.name}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {(f.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(f.id)}
                className="text-[var(--text-muted)] hover:text-red transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
