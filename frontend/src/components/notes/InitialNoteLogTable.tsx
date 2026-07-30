'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  X,
  ListFilter,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InitialNoteLog } from '@/types/initial-note';
import {
  FormattedLogText,
  formatEditorName,
  formatLogDate,
  formatLogTime,
} from '@/lib/initial-note-log-utils';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { InitialNoteLogTableSkeleton } from './InitialNoteLogTableSkeleton';

const COLUMN_LAYOUT = '1.2fr 1.5fr 3fr 1fr';
const ITEMS_PER_PAGE = 10;

const ACTIONS = ['All', 'Created', 'Updated', 'Published', 'Revised', 'Deleted'];

interface InitialNoteLogTableProps {
  logs: InitialNoteLog[];
  isLoading?: boolean;
  /** Opens the version-history modal at the version a log entry produced. */
  onViewVersion?: (versionId: string) => void;
}

export function InitialNoteLogTable({
  logs,
  isLoading,
  onViewVersion,
}: InitialNoteLogTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Any filter change sends the user back to page 1. Done in the handlers
  // rather than an effect so there is no extra render pass.
  const applySearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };
  const applyAction = (value: string) => {
    setSelectedAction(value);
    setCurrentPage(1);
  };
  const applyDateRange = (value: DateRange | undefined) => {
    setDateRange(value);
    setCurrentPage(1);
  };

  // Filter logs client-side (instant and responsive)
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesAction = selectedAction === 'All' || log.action === selectedAction;

      const editorName = formatEditorName(log.editor).toLowerCase();
      const description = log.description.toLowerCase();
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch = !query || editorName.includes(query) || description.includes(query);

      let matchesDate = true;
      if (dateRange?.from) {
        const logDate = new Date(log.createdAt);
        logDate.setHours(0, 0, 0, 0);

        const start = new Date(dateRange.from);
        start.setHours(0, 0, 0, 0);

        if (logDate < start) matchesDate = false;

        if (dateRange.to) {
          const end = new Date(dateRange.to);
          end.setHours(0, 0, 0, 0);
          if (logDate > end) matchesDate = false;
        }
      }

      return matchesAction && matchesSearch && matchesDate;
    });
  }, [logs, searchQuery, selectedAction, dateRange]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(startIndex, endIndex);
  }, [filteredLogs, startIndex, endIndex]);

  const hasActiveFilters = searchQuery !== '' || selectedAction !== 'All' || !!dateRange?.from;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedAction('All');
    setDateRange(undefined);
    setCurrentPage(1);
  };

  if (isLoading) {
    return <InitialNoteLogTableSkeleton />;
  }

  // If there are no logs at all, show the standard empty message
  if (logs.length === 0) {
    return (
      <div className="py-8 px-[14px] text-center text-[13px] text-text-muted italic bg-surface rounded-b-lg">
        No initial note logs found.
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full bg-surface rounded-b-lg relative">
      {/* SaaS Search & Filter Toolbar */}
      <div className="flex flex-col @sm:flex-row gap-3 items-stretch @sm:items-center justify-between p-3 bg-surface border-b border-border/60">
        {/* Left Side: Search and Filter Group */}
        <div className="flex flex-col @sm:flex-row items-stretch @sm:items-center gap-2 w-full @sm:w-auto">
          {/* Search Input Container */}
          <div className="relative w-full @sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => applySearch(e.target.value)}
              placeholder="Search editor or description..."
              className="w-full h-[34px] pl-9 pr-8 bg-surface border border-border rounded-btn text-[13px] text-text-primary placeholder-text-muted/75 outline-none transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => applySearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded-full hover:bg-surface-3 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Dropdown */}
          <div className="relative w-full @sm:w-auto" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className={cn(
                "flex items-center justify-between gap-2 h-[34px] w-full @sm:w-auto px-3 bg-surface border border-border rounded-btn text-[13px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary cursor-pointer transition-all duration-150 outline-none focus:border-accent focus:shadow-accent-focus select-none",
                selectedAction !== 'All' && "border-accent text-accent bg-accent-light/10 hover:bg-accent-light/20 hover:text-accent"
              )}
            >
              <div className="flex items-center gap-2">
                <ListFilter className="w-3.5 h-3.5" />
                <span>{selectedAction === 'All' ? 'All Actions' : selectedAction}</span>
              </div>
              <ChevronDown className={cn(
                "w-3.5 h-3.5 text-text-muted transition-transform duration-200",
                isDropdownOpen && "rotate-180"
              )} />
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 mt-1 w-44 bg-surface border border-border rounded-btn shadow-modal z-[50] py-1 animate-in fade-in slide-in-from-top-1 duration-100 origin-top-left">
                {ACTIONS.map((action) => {
                  const isSelected = selectedAction === action;
                  return (
                    <button
                      key={action}
                      type="button"
                      onClick={() => {
                        applyAction(action);
                        setIsDropdownOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-1.5 text-[12px] text-text-primary hover:bg-surface-2 text-left cursor-pointer transition-colors duration-70 select-none",
                        isSelected && "bg-surface-3 font-semibold text-accent"
                      )}
                    >
                      <div className="flex items-center">
                        <span className={cn(
                          "w-2 h-2 rounded-full mr-2.5",
                          action === 'All' ? "bg-text-muted/40" :
                          action === 'Created' ? "bg-green-border" :
                          action === 'Updated' ? "bg-text-secondary" :
                          action === 'Published' ? "bg-purple-border" :
                          action === 'Revised' ? "bg-blue-border" :
                          "bg-red-border"
                        )} />
                        {action}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date Range Picker */}
          <DatePickerWithRange
            date={dateRange}
            setDate={applyDateRange}
          />
        </div>

        {/* Right Side: Reset Filters */}
        <div className="flex items-center justify-end">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 h-[34px] px-2.5 text-[12.5px] font-medium text-accent hover:text-accent-hover transition-colors cursor-pointer group"
              title="Reset search and filters"
            >
              <RotateCcw className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-[-60deg]" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Data */}
      {filteredLogs.length === 0 ? (
        /* Rich Empty State for No Filter Results */
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-surface text-center animate-row-entry rounded-b-lg">
          <div className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center text-text-muted border border-border/80 mb-3 shadow-sm">
            <Search className="w-4 h-4 text-text-muted/80" />
          </div>
          <h4 className="text-[13px] font-bold text-text-primary mb-1">
            No matching logs found
          </h4>
          <p className="text-[12px] text-text-muted max-w-xs leading-relaxed">
            Your search query or action filter did not return any matches. Try adjusting them.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-4 h-[30px] px-3.5 bg-accent hover:bg-accent-hover text-white text-[12px] font-medium rounded-btn shadow-btn-primary hover:shadow-btn-primary-hover transition-all duration-150 cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <>
          {/* Table Headers */}
          <div
            className="relative grid items-center gap-4 px-[14px] py-2.5 bg-surface-2 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary"
            style={{ gridTemplateColumns: COLUMN_LAYOUT }}
          >
            <div className="text-left">Date & Time</div>
            <div className="text-left">Editor</div>
            <div className="text-left">Description</div>
            <div className="text-center">Action</div>
          </div>

          {/* Table Body */}
          <div className="flex flex-col">
            {paginatedLogs.map((log) => (
              <div
                key={log.id}
                style={{ gridTemplateColumns: COLUMN_LAYOUT }}
                className="relative grid items-center gap-4 px-[14px] py-3 after:absolute after:bottom-0 after:left-[14px] after:right-[14px] after:border-b after:border-border/80 after:content-[''] last:after:hidden bg-surface hover:bg-surface-2/45 transition-all duration-150 animate-row-entry"
              >
                <div className="text-[12px] font-mono text-text-muted whitespace-nowrap">
                  {formatLogDate(log.createdAt)}
                  <br />
                  <span className="text-[10px] text-text-tertiary">
                    {formatLogTime(log.createdAt)}
                  </span>
                </div>

                <div className="text-[13px] font-medium text-text-secondary truncate">
                  {formatEditorName(log.editor)}
                </div>

                <div className="text-[12px] text-text-primary pr-2 leading-relaxed" title={log.description}>
                  <FormattedLogText text={log.description} />
                  {/* Jump straight to the snapshot this entry produced */}
                  {log.versionId && onViewVersion && (
                    <button
                      type="button"
                      onClick={() => onViewVersion(log.versionId!)}
                      className="ml-1.5 inline-flex items-center align-middle font-mono text-[10px] font-semibold text-accent border border-accent/30 bg-accent-light/20 hover:bg-accent-light/40 rounded-[4px] px-1.5 py-[1px] transition-colors cursor-pointer"
                      title="View this version"
                    >
                      View version
                    </button>
                  )}
                </div>

                <div className="flex justify-center">
                  <span className={cn(
                    "px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-[0.5px] border",
                    log.action === 'Created' ? "bg-green-bg text-green border-green-border" :
                    log.action === 'Updated' ? "bg-surface-3 text-text-secondary border-border" :
                    log.action === 'Published' ? "bg-purple-bg text-purple border-purple-border" :
                    log.action === 'Revised' ? "bg-blue-bg text-blue border-blue-border" :
                    log.action === 'Deleted' ? "bg-red-bg text-red border-red-border" :
                    "bg-surface-3 text-text-secondary border-border"
                  )}>
                    {log.action}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Table Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-surface border-t border-border/60 text-[12px] text-text-secondary select-none rounded-b-lg">
              <div className="text-[12px] text-text-muted">
                Showing <span className="font-semibold text-text-secondary">{startIndex + 1}</span> to{' '}
                <span className="font-semibold text-text-secondary">
                  {Math.min(endIndex, filteredLogs.length)}
                </span>{' '}
                of <span className="font-semibold text-text-secondary">{filteredLogs.length}</span> logs
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className="flex items-center justify-center w-8 h-8 rounded-btn border border-border bg-surface text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:text-text-secondary transition-all cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-[12px] px-2 text-text-muted">
                  Page <span className="font-semibold text-text-secondary">{currentPage}</span> of{' '}
                  <span className="font-semibold text-text-secondary">{totalPages}</span>
                </span>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  className="flex items-center justify-center w-8 h-8 rounded-btn border border-border bg-surface text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:text-text-secondary transition-all cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
