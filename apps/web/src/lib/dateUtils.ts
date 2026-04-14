// ─── Date Utility Functions ──────────────────────────────────────────────────────

export interface DateRange {
  from: Date;
  to: Date;
  label?: string;
}

export const PRESET_RANGES: Array<{ label: string; value: string; days?: number }> = [
  { label: 'Last 7 days', value: '7d', days: 7 },
  { label: 'Last 14 days', value: '14d', days: 14 },
  { label: 'Last 30 days', value: '30d', days: 30 },
  { label: 'Last 90 days', value: '90d', days: 90 },
  { label: 'This month', value: 'month' },
  { label: 'Last month', value: 'last-month' },
];

export function parsePresetRange(value: string): DateRange | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (value) {
    case '7d':
    case '14d':
    case '30d':
    case '90d': {
      const preset = PRESET_RANGES.find(r => r.value === value);
      if (!preset?.days) return null;
      return {
        from: new Date(today.getTime() - preset.days! * 24 * 60 * 60 * 1000),
        to: today,
        label: preset.label,
      };
    }
    
    case 'month': {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        from: firstDayOfMonth,
        to: today,
        label: 'This month',
      };
    }
    
    case 'last-month': {
      const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: firstDayOfLastMonth,
        to: lastDayOfLastMonth,
        label: 'Last month',
      };
    }
    
    default:
      return null;
  }
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDateRange(range: DateRange): string {
  const from = formatDate(range.from);
  const to = formatDate(range.to);
  return `${from} - ${to}`;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function getMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getWeekDays(): string[] {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
}

export function getMonths(): string[] {
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
}

export function isValidDateRange(from: Date, to: Date): boolean {
  return from <= to;
}

export function clampDate(date: Date, min?: Date, max?: Date): Date {
  if (min && date < min) return new Date(min);
  if (max && date > max) return new Date(max);
  return new Date(date);
}
