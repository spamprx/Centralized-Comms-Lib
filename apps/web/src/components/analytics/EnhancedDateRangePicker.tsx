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
            p-2 text-sm rounded-md transition-colors
            ${isDisabled ? 'text-[#555870] cursor-not-allowed' : 'text-[#e2e4f0] hover:bg-white/10 cursor-pointer'}
            ${isSelected === 'start' ? 'bg-violet-500 text-white' : ''}
            ${isSelected === 'end' ? 'bg-violet-500 text-white' : ''}
            ${isSelected === 'range' ? 'bg-violet-500/30 text-[#e2e4f0]' : ''}
          `}
        >
          {day}
        </button>,
      );
    }

    return (
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date(year, month - 1))}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <ChevronLeft size={16} className="text-[#8b8fa8]" />
          </button>
          <span className="text-sm font-semibold text-[#e2e4f0]">{getMonthYear(currentMonth)}</span>
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date(year, month + 1))}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <ChevronRight size={16} className="text-[#8b8fa8]" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-[#555870] p-2">
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
            : 'flex min-w-[200px] cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-[#e2e4f0] transition-colors hover:bg-white/10'
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          <Calendar size={14} className="shrink-0 text-[#555870]" />
          <span className="truncate">{currentDisplay}</span>
        </div>
        {chevronDown ? (
          <ChevronDown
            size={14}
            className={`shrink-0 text-[#555870] transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          />
        ) : (
          <ChevronRight
            size={14}
            className={`shrink-0 text-[#555870] transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 min-w-[400px] max-w-[500px] rounded-lg border border-white/10 bg-[#1a1d2e]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <h3 className="text-sm font-semibold text-[#e2e4f0]">Select Date Range</h3>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onClose?.();
              }}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X size={16} className="text-[#555870]" />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex border-b border-white/10">
            <button
              type="button"
              onClick={() => setMode('preset')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'preset'
                  ? 'text-[#e2e4f0] border-b-2 border-violet-500'
                  : 'text-[#555870] hover:text-[#8b8fa8]'
              }`}
            >
              Preset Ranges
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'custom'
                  ? 'text-[#e2e4f0] border-b-2 border-violet-500'
                  : 'text-[#555870] hover:text-[#8b8fa8]'
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {mode === 'preset' ? (
              <div className="space-y-2">
                {PRESET_RANGES.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handlePresetChange(preset.value)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                      value === preset.value
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                        : 'text-[#e2e4f0] hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Calendar */}
                {renderCalendar()}

                {/* Selected Range Display */}
                {selectedStartDate && (
                  <div className="bg-white/5 border border-white/10 rounded-md p-3">
                    <div className="text-xs text-[#555870] mb-2">Selected Range:</div>
                    <div className="text-sm text-[#e2e4f0]">
                      {selectedStartDate && formatDate(selectedStartDate)}
                      {selectedEndDate && ` - ${formatDate(selectedEndDate)}`}
                    </div>
                  </div>
                )}

                {/* Apply Button */}
                <button
                  type="button"
                  onClick={handleCustomRangeApply}
                  disabled={!selectedStartDate || !selectedEndDate}
                  className="w-full px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-md hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Apply Custom Range
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
