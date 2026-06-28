import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComboboxInputProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  hasError?: boolean;
  autoFocus?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  lowercaseOnly?: boolean;
  className?: string; // Additional classes for custom styling
  disabled?: boolean;
}

export function ComboboxInput({
  value,
  onChange,
  options,
  placeholder,
  hasError,
  autoFocus,
  readOnly = false,
  maxLength,
  lowercaseOnly = false,
  className,
  disabled = false,
}: ComboboxInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = readOnly ? options : options.filter((option) =>
    option.toLowerCase().includes(value.trim().toLowerCase())
  );

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredOptions.length > 0 ? (prev - 1 + filteredOptions.length) % filteredOptions.length : -1
      );
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        e.preventDefault();
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (readOnly && filteredOptions.length > 0) {
         e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const inputCn = cn(
    className || 'h-[34px] px-2.5 bg-surface border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150',
    'w-full pr-8', // Always ensure enough padding for the dropdown icon
    hasError
      ? 'border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
      : (className ? '' : 'border-border focus:border-accent focus:shadow-accent-focus'),
    readOnly && 'cursor-pointer',
    disabled && 'opacity-50 cursor-not-allowed bg-surface-2'
  );

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={lowercaseOnly ? value.toLowerCase() : value}
        disabled={disabled}
        onChange={(e) => {
          if (!readOnly && !disabled) {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }
        }}
        onClick={() => {
          if (readOnly) {
            setIsOpen((prev) => !prev);
            setHighlightedIndex(0);
          }
        }}
        onFocus={() => {
          if (!readOnly) {
             setIsOpen(true);
             setHighlightedIndex(0);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        readOnly={readOnly}
        className={inputCn}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            inputRef.current?.focus();
          }
        }}
        tabIndex={-1}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
      >
        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>
      {isOpen && filteredOptions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto bg-surface border border-border rounded-btn shadow-modal z-[600] py-1"
        >
          {filteredOptions.map((option, index) => (
            <li
              key={option}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "px-3 py-1.5 text-[13px] text-text-primary cursor-pointer transition-colors duration-100 truncate",
                index === highlightedIndex ? "bg-surface-2 font-medium" : ""
              )}
            >
              {lowercaseOnly ? option.toLowerCase() : option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
