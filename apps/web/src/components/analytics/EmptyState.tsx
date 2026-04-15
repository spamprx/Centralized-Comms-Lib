import { TrendingUp, Trophy, BarChart3, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  type: 'kpi' | 'chart' | 'table' | 'insights';
  title: string;
  description?: string;
  size?: 'small' | 'medium' | 'large';
}

const icons = {
  kpi: TrendingUp,
  chart: BarChart3,
  table: Trophy,
  insights: Sparkles,
};

const sizes = {
  small: 'min-h-[100px]',
  medium: 'min-h-[150px]',
  large: 'min-h-[200px]',
};

export function EmptyState({
  type,
  title,
  description = 'No data available for the selected time period',
  size = 'medium',
}: EmptyStateProps) {
  const Icon = icons[type];
  const heightClass = sizes[size];

  return (
    <div className="relative overflow-hidden rounded-app-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/35 to-transparent"
        aria-hidden
      />
      <div className={`flex flex-col items-center justify-center gap-3 py-2 ${heightClass}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-app-lg border border-app-accent/25 bg-app-accent/10 text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Icon size={22} strokeWidth={1.75} />
        </div>
        <div className="max-w-xs text-center">
          <p className="mb-1 text-sm font-semibold tracking-tight text-app-text">{title}</p>
          <p className="text-xs leading-relaxed text-app-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}
