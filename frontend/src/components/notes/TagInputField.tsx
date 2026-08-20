import { useState, KeyboardEvent } from 'react';
import { XIcon, PencilIcon, CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TagItem {
  title: string;
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

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
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleStartEdit = (index: number) => {
    if (disabled) return;
    const item = value[index];
    setEditingIndex(index);
    setEditValue(isObjectFormat ? item.title : item);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const val = editValue.trim();
    if (!val) {
      setEditingIndex(null);
      return;
    }
    const newVal = [...value];
    newVal[editingIndex] = isObjectFormat ? { title: val } : val;
    onChange(newVal);
    setEditingIndex(null);
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingIndex(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, idx) =>
          editingIndex === idx ? (
            <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-accent rounded-[6px] text-[12px]">
              <input
                type="text"
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={handleSaveEdit}
                className="w-[120px] bg-transparent outline-none text-text-primary"
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSaveEdit}
                className="text-text-muted hover:text-accent transition-colors p-0.5 rounded-full hover:bg-surface-3 cursor-pointer"
                title="Save"
              >
                <CheckIcon className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-2 border border-border rounded-[6px] text-[12px] font-medium text-text-primary hover:border-border-strong transition-colors">
              <span>{isObjectFormat ? item.title : item}</span>
              {!disabled && (
                <>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(idx)}
                    className="text-text-muted hover:text-accent transition-colors p-0.5 rounded-full hover:bg-surface-3 cursor-pointer"
                    title="Edit"
                  >
                    <PencilIcon className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-text-muted hover:text-red transition-colors p-0.5 rounded-full hover:bg-surface-3 cursor-pointer"
                    title="Remove"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          )
        )}
        {value.length === 0 && (
          <span className="text-[12px] text-text-muted italic">No diagnostics added.</span>
        )}
      </div>
      {!disabled && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="text"
            className="flex-1 h-[32px] px-2.5 bg-white border border-border-strong/60 rounded-[6px] text-[12px] text-text-primary outline-none transition-all duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)] placeholder:text-border-strong/70"
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
            className="h-[32px] px-3.5 bg-accent text-white hover:bg-accent-hover rounded-[6px] font-semibold text-[11px] flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer shadow-sm"
          >
            + Add
          </button>
        </div>
      )}
    </div>
  );
}

