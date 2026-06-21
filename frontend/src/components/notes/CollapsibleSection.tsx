import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({ title, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-card overflow-hidden bg-surface mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-surface-2 hover:bg-surface-3 transition-colors border-b border-border"
      >
        <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">
          {title}
        </span>
        {isOpen ? (
          <ChevronUpIcon className="w-4 h-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronDownIcon className="w-4 h-4 text-[var(--text-muted)]" />
        )}
      </button>
      {isOpen && (
        <div className="p-3">
          {children}
        </div>
      )}
    </div>
  );
}
