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
  small: 'h-[100px]',
  medium: 'h-[150px]',
  large: 'h-[200px]',
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
    <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
      <div className={`flex flex-col items-center justify-center ${heightClass} gap-3`}>
        <Icon size={24} className="text-[#555870]" />
        <div className="text-center">
          <p className="text-sm font-medium text-[#8b8fa8] mb-1">{title}</p>
          <p className="text-xs text-[#555870]">{description}</p>
        </div>
      </div>
    </div>
  );
}
