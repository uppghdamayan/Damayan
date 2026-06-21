import { useState, KeyboardEvent } from 'react';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TagItem {
  title: string;
  icdCode?: string;
}

interface TagInputFieldProps {
  value: any[];
  onChange: (val: any[]) => void;
  placeholder?: string;
  isObjectFormat?: boolean; // If true, outputs { title: string }, otherwise outputs string
}

export function TagInputField({ value = [], onChange, placeholder = 'Type and press Enter...', isObjectFormat = false }: TagInputFieldProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = inputValue.trim();
      if (val) {
        if (isObjectFormat) {
          onChange([...value, { title: val }]);
        } else {
          onChange([...value, val]);
        }
        setInputValue('');
      }
    }
  };

  const handleRemove = (index: number) => {
    const newVal = [...value];
    newVal.splice(index, 1);
    onChange(newVal);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {value.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-surface-2 border border-border rounded-btn text-[12px] text-[var(--text-primary)]">
            <span>{isObjectFormat ? item.title : item}</span>
            {isObjectFormat && item.icdCode && (
              <span className="text-[10px] text-[var(--text-muted)] ml-1">({item.icdCode})</span>
            )}
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="text-[var(--text-muted)] hover:text-red transition-colors ml-1"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <input
        type="text"
        className="w-full h-[34px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-[var(--text-primary)] outline-none transition-all duration-150 focus:border-accent focus:shadow-accent-focus placeholder:text-[var(--text-muted)]"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
