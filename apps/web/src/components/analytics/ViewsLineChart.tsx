import { TrendingUp } from 'lucide-react';
import type { TimeSeriesPoint } from '../../data/mockAnalyticsData';

interface ViewsLineChartProps {
  data: TimeSeriesPoint[];
  loading?: boolean;
}

export function ViewsLineChart({ data, loading }: ViewsLineChartProps) {
  if (loading) {
    return (
      <div className="p-4 bg-app-surface border border-app-border rounded-app-lg">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} />
          <span className="text-sm font-semibold text-app-text">Views Over Time</span>
        </div>
        <div className="h-[200px] bg-app-surface rounded-lg animate-pulse" />
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  const width = 100;
  const height = 60;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.value - minValue) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const labelIndices = [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor(3 * data.length / 4), data.length - 1];

  return (
    <div className="p-4 bg-app-surface border border-app-border rounded-app-lg">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} className="text-app-accent" />
        <span className="text-sm font-semibold text-app-text">Views Over Time</span>
        <span className="text-xs text-app-faint ml-auto">{data.length} days</span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[150px] block" preserveAspectRatio="none">
          <defs>
            <linearGradient id="viewsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map(y => (
            <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
          ))}
          <polygon points={areaPoints} fill="url(#viewsGradient)" />
          <polyline points={points} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((d, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((d.value - minValue) / range) * height;
            return <circle key={i} cx={x} cy={y} r="1" fill="#8b5cf6" />;
          })}
        </svg>
        <div className="flex justify-between mt-2 px-1">
          {labelIndices.map((idx, i) => (
            <span key={i} className="text-[10px] text-app-faint">{data[idx].date.slice(5)}</span>
          ))}
        </div>
      </div>
      {/* Stats */}
      <div className="flex gap-6 mt-4 pt-4 border-t border-app-border/80">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-app-faint uppercase tracking-wide">Total</span>
          <span className="text-sm font-semibold text-app-text">{data.reduce((sum, d) => sum + d.value, 0).toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-app-faint uppercase tracking-wide">Avg/Day</span>
          <span className="text-sm font-semibold text-app-text">{Math.round(data.reduce((sum, d) => sum + d.value, 0) / data.length).toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-app-faint uppercase tracking-wide">Peak</span>
          <span className="text-sm font-semibold text-app-text">{maxValue.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
