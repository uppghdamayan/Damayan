import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: 'default' | 'row';
}

export function CollapsibleSection({ 
  title, 
  children, 
  defaultOpen = false, 
  variant = 'default' 
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isRow = variant === 'row';

  return (
    <div className={cn(
      isRow ? "" : "border border-border rounded-card overflow-hidden bg-surface mb-4"
    )}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-3.5 py-2.5 transition-colors",
          isRow ? "hover:bg-surface-2" : "bg-surface-2 hover:bg-surface-3 border-b border-border"
        )}
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
        <div className="p-3.5 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}
