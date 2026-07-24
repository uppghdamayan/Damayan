'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddressComboboxProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  maxLength?: number;
  className?: string;
}

export function AddressCombobox({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select or type...',
  required = false,
  error,
  disabled = false,
  loading = false,
  maxLength = 100,
  className,
}: AddressComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  // Filter options based on user input
  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes((value || '').toLowerCase())
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectOption = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        e.preventDefault();
        handleSelectOption(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px] mb-1">
          {label} {required && <span className="text-red font-bold">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            updatePosition();
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Loading options...' : placeholder}
          disabled={disabled}
          maxLength={maxLength}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          className={cn(
            'h-[34px] w-full pl-2.5 pr-8 bg-surface border rounded-btn text-[13px] text-text-primary outline-none transition-all focus:border-accent focus:shadow-accent-focus disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-2',
            error ? 'border-red-border' : 'border-border'
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              if (!isOpen) updatePosition();
              setIsOpen((prev) => !prev);
              if (!isOpen && inputRef.current) inputRef.current.focus();
            }
          }}
          className="absolute right-2 text-text-muted hover:text-text-primary focus:outline-none disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
          ) : (
            <ChevronDown className={cn('w-4 h-4 transition-transform duration-150', isOpen && 'rotate-180')} />
          )}
        </button>
      </div>

      {error && <p className="text-[12px] text-red mt-1">{error}</p>}

      {isOpen && !disabled && mounted &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 2000,
            }}
            className="max-h-48 overflow-y-auto bg-surface border border-border rounded-md shadow-modal py-1 text-[13px] text-text-primary"
          >
            {loading ? (
              <li className="px-3 py-2 text-xs text-text-muted flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                <span>Fetching options from PSGC...</span>
              </li>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = value.toLowerCase() === opt.toLowerCase();
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li
                    key={opt}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur before click registers
                      handleSelectOption(opt);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      'px-3 py-1.5 cursor-pointer flex items-center justify-between transition-colors',
                      isHighlighted ? 'bg-surface-2 text-accent font-medium' : 'hover:bg-surface-2',
                      isSelected && 'font-semibold text-accent'
                    )}
                  >
                    <span className="truncate">{opt}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-2 text-xs text-text-muted italic">
                {value ? `Use "${value}" (custom entry)` : 'Type to enter address...'}
              </li>
            )}
          </ul>,
          document.body
        )}
    </div>
  );
}
