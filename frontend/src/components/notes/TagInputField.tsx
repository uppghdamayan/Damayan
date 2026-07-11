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
  disabled?: boolean;
  onInputChange?: (val: string) => void;
}

export function TagInputField({ 
  value = [], 
  onChange, 
  placeholder = 'Type and press Enter...', 
  isObjectFormat = false,
  disabled = false,
  onInputChange
}: TagInputFieldProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    if (disabled) return;
    const val = inputValue.trim();
    if (val) {
      if (isObjectFormat) {
        onChange([...value, { title: val }]);
      } else {
        onChange([...value, val]);
      }
      setInputValue('');
      if (onInputChange) onInputChange('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (index: number) => {
    if (disabled) return;
    const newVal = [...value];
    newVal.splice(index, 1);
    onChange(newVal);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {value.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-surface-2 border border-border rounded-[6px] text-[12px] text-text-primary">
            <span>{isObjectFormat ? item.title : item}</span>
            {isObjectFormat && item.icdCode && (
              <span className="text-[10px] text-text-muted ml-1">({item.icdCode})</span>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-text-muted hover:text-red transition-colors ml-1"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="flex-1 h-[34px] px-2.5 bg-white border-[1.5px] border-border-strong rounded-[6px] text-[13px] text-text-primary outline-none transition-all duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-text-muted/70"
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => {
              const val = e.target.value;
              setInputValue(val);
              if (onInputChange) onInputChange(val);
            }}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!inputValue.trim()}
            className="h-[34px] cursor-pointer px-3 bg-surface border border-border text-text-secondary hover:bg-surface-3 hover:text-text-primary rounded font-medium text-[11px] flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            + Add
          </button>
        </div>
      )}
    </div>
  );
}

