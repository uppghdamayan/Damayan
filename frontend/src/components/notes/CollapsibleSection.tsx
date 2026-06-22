import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: 'default' | 'row';
  icon?: React.ReactNode;
  theme?: 'amber' | 'purple' | 'primary';
}

const themeClasses = {
  amber: {
    text: "text-amber",
    bgContainerOpen: "bg-amber-bg/5",
    bgTriggerOpen: "bg-amber-bg/10 hover:bg-amber-bg/15",
    bgTriggerHover: "hover:bg-amber-bg/5",
    border: "border-l-amber",
    iconOpen: "text-amber"
  },
  purple: {
    text: "text-purple",
    bgContainerOpen: "bg-purple-bg/5",
    bgTriggerOpen: "bg-purple-bg/10 hover:bg-purple-bg/15",
    bgTriggerHover: "hover:bg-purple-bg/5",
    border: "border-l-purple",
    iconOpen: "text-purple"
  },
  primary: {
    text: "text-primary",
    bgContainerOpen: "bg-accent-light/10",
    bgTriggerOpen: "bg-accent-light/15 hover:bg-accent-light/20",
    bgTriggerHover: "hover:bg-accent-light/5",
    border: "border-l-primary",
    iconOpen: "text-primary"
  }
};

export function CollapsibleSection({ 
  title, 
  children, 
  defaultOpen = false, 
  variant = 'default',
  icon,
  theme = 'amber'
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isRow = variant === 'row';
  const activeTheme = themeClasses[theme];

  return (
    <div className={cn(
      isRow 
        ? "transition-all duration-250 ease-in-out" 
        : "border border-border rounded-card overflow-hidden bg-surface mb-4",
      isRow && isOpen 
        ? activeTheme.bgContainerOpen 
        : ""
    )}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-3.5 py-2.5 transition-all duration-200 rounded-[4px] cursor-pointer outline-none",
          isRow 
            ? cn(
                activeTheme.bgTriggerHover,
                isOpen && activeTheme.bgTriggerOpen
              )
            : "bg-surface-2 hover:bg-surface-3 border-b border-border"
        )}
      >
        <div className="flex items-center gap-2.5 flex-1">
          {icon && (
            <div className={cn(
              "transition-colors duration-200 flex-shrink-0",
              isOpen && isRow ? activeTheme.iconOpen : "text-text-muted"
            )}>
              {icon}
            </div>
          )}
          <span className={cn(
            "text-[11.5px] font-bold uppercase tracking-[0.6px] transition-colors duration-200 text-left",
            isOpen && isRow ? activeTheme.text : "text-text-secondary"
          )}>
            {title}
          </span>
        </div>
        <ChevronDownIcon className={cn(
          "w-4 h-4 text-text-muted transition-transform duration-250 ease-out flex-shrink-0",
          isOpen && "transform rotate-180",
          isOpen && isRow && activeTheme.text
        )} />
      </button>
      <div className={cn(
        "collapsible-content-wrapper",
        isOpen && "is-open"
      )}>
        <div className="collapsible-content-inner">
          <div className="p-3.5 pt-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
