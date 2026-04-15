import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { DateRange } from '../../lib/dateUtils';
import {
  PRESET_RANGES,
  parsePresetRange,
  formatDate,
  formatDateRange,
  isSameDay,
  getDaysInMonth,
  getMonthYear,
  getWeekDays,
  isValidDateRange,
} from '../../lib/dateUtils';

interface EnhancedDateRangePickerProps {
  value: string;
  onChange: (value: string | DateRange) => void;
  onClose?: () => void;
  /** Merges onto the trigger button `className` */
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  /** When set, shown on the trigger instead of the internal preset/custom label */
  displayLabelOverride?: string;
  chevronDown?: boolean;
}

export function EnhancedDateRangePicker({
  value,
  onChange,
  onClose,
  triggerClassName,
  triggerStyle,
  displayLabelOverride,
  chevronDown,
}: EnhancedDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize from preset value
  useEffect(() => {
    const parsed = parsePresetRange(value);
    if (parsed) {
      setCustomRange(parsed);
      setSelectedStartDate(parsed.from);
      setSelectedEndDate(parsed.to);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetChange = (presetValue: string) => {
    const range = parsePresetRange(presetValue);
    if (range) {
      setCustomRange(range);
      setSelectedStartDate(range.from);
      setSelectedEndDate(range.to);
      onChange(presetValue);
      setIsOpen(false);
    }
  };

  const handleCustomRangeApply = () => {
    if (
      selectedStartDate &&
      selectedEndDate &&
      isValidDateRange(selectedStartDate, selectedEndDate)
    ) {
      const range = { from: selectedStartDate, to: selectedEndDate };
      setCustomRange(range);
      onChange(range);
      setIsOpen(false);
    }
  };

  const handleDateClick = (date: Date) => {
    if (!selectedStartDate) {
      setSelectedStartDate(date);
      setSelectedEndDate(null);
    } else if (!selectedEndDate) {
      if (isSameDay(date, selectedStartDate)) {
        setSelectedStartDate(null);
        setSelectedEndDate(null);
      } else if (date >= selectedStartDate) {
        setSelectedEndDate(date);
      } else {
        setSelectedEndDate(selectedStartDate);
        setSelectedStartDate(date);
      }
    } else {
      setSelectedStartDate(date);
      setSelectedEndDate(null);
    }
  };

  const isDateSelected = (date: Date): 'start' | 'end' | 'range' | false => {
    if (selectedStartDate && isSameDay(date, selectedStartDate)) return 'start';
    if (selectedEndDate && isSameDay(date, selectedEndDate)) return 'end';
    if (
      selectedStartDate &&
      selectedEndDate &&
      date >= selectedStartDate &&
      date <= selectedEndDate
    )
      return 'range';
    return false;
  };

  const isDateDisabled = (date: Date): boolean => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date > today;
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDayOfMonth = new Date(year, month, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay();

    const days = [];
    const weekDays = getWeekDays();

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="p-2" />);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isSelected = isDateSelected(date);
      const isDisabled = isDateDisabled(date);

      days.push(
        <button
          key={day}
          type="button"
          disabled={isDisabled}
          onClick={() => handleDateClick(date)}
          className={`
            cursor-pointer rounded-app-md p-2 text-sm transition-colors duration-150
            ${isDisabled ? 'cursor-not-allowed text-app-faint' : 'text-app-text hover:bg-white/10'}
            ${isSelected === 'start' ? 'bg-app-accent text-app-bg shadow-[0_0_16px_-4px_rgba(147,124,248,0.55)]' : ''}
            ${isSelected === 'end' ? 'bg-app-accent text-app-bg shadow-[0_0_16px_-4px_rgba(147,124,248,0.55)]' : ''}
            ${isSelected === 'range' ? 'bg-app-accent/25 text-app-text' : ''}
          `}
        >
          {day}
        </button>,
      );
    }

    return (
      <div className="rounded-app-lg border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date(year, month - 1))}
            className="rounded-app-md p-1.5 text-app-muted transition-colors hover:bg-white/10 hover:text-app-text"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <span className="text-sm font-semibold tracking-tight text-app-text">
            {getMonthYear(currentMonth)}
          </span>
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date(year, month + 1))}
            className="rounded-app-md p-1.5 text-app-muted transition-colors hover:bg-white/10 hover:text-app-text"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-xs font-semibold uppercase tracking-wide text-app-faint"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">{days}</div>
      </div>
    );
  };

  const derivedDisplay = customRange
    ? formatDateRange(customRange)
    : PRESET_RANGES.find((r) => r.value === value)?.label || value;
  const currentDisplay = displayLabelOverride ?? derivedDisplay;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={triggerStyle}
        className={
          triggerClassName
            ? triggerClassName
            : 'flex min-w-[200px] cursor-pointer items-center justify-between gap-2 rounded-app-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 hover:border-app-accent/30 hover:bg-white/[0.08]'
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          <Calendar size={14} strokeWidth={2} className="shrink-0 text-app-accent/80" />
          <span className="truncate font-medium">{currentDisplay}</span>
        </div>
        {chevronDown ? (
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={`shrink-0 text-app-faint transition-transform duration-200 ease-out ${isOpen ? 'rotate-180 text-app-accent' : ''}`}
          />
        ) : (
          <ChevronRight
            size={14}
            strokeWidth={2}
            className={`shrink-0 text-app-faint transition-transform duration-200 ${isOpen ? 'rotate-90 text-app-accent' : ''}`}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[400px] max-w-[500px] overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/90 shadow-app-lift backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/75">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/45 to-app-accent-2/30"
            aria-hidden
          />
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5">
            <h3 className="text-sm font-semibold tracking-tight text-app-text">
              Select date range
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onClose?.();
              }}
              className="rounded-app-md p-1.5 text-app-faint transition-colors hover:bg-white/10 hover:text-app-text"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex border-b border-white/[0.08]">
            <button
              type="button"
              onClick={() => setMode('preset')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                mode === 'preset'
                  ? 'border-b-2 border-app-accent text-app-text'
                  : 'border-b-2 border-transparent text-app-muted hover:text-app-text'
              }`}
            >
              Preset ranges
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                mode === 'custom'
                  ? 'border-b-2 border-app-accent text-app-text'
                  : 'border-b-2 border-transparent text-app-muted hover:text-app-text'
              }`}
            >
              Custom range
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {mode === 'preset' ? (
              <div className="space-y-1.5">
                {PRESET_RANGES.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handlePresetChange(preset.value)}
                    className={`w-full rounded-app-md border px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                      value === preset.value
                        ? 'border-app-accent/40 bg-app-accent/15 text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                        : 'border-transparent text-app-text hover:border-white/10 hover:bg-white/[0.06]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {renderCalendar()}

                {selectedStartDate && (
                  <div className="rounded-app-lg border border-white/10 bg-white/[0.04] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-app-faint">
                      Selected range
                    </div>
                    <div className="text-sm text-app-text">
                      {selectedStartDate && formatDate(selectedStartDate)}
                      {selectedEndDate && ` — ${formatDate(selectedEndDate)}`}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCustomRangeApply}
                  disabled={!selectedStartDate || !selectedEndDate}
                  className="w-full rounded-app-lg border border-white/10 bg-gradient-to-r from-app-accent to-app-accent-2 px-4 py-2.5 text-sm font-semibold text-app-bg shadow-[0_0_24px_-8px_rgba(147,124,248,0.45)] transition-[filter,opacity] duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Apply custom range
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
