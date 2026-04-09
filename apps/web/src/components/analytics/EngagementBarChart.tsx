import { BarChart3 } from 'lucide-react';
import type { EngagementData } from '../../data/mockAnalyticsData';

interface EngagementBarChartProps {
  data: EngagementData[];
  loading?: boolean;
}

const COLORS = {
  views: '#8b5cf6',
  likes: '#f59e0b',
  shares: '#06b6d4',
  comments: '#10b981',
};

export function EngagementBarChart({ data, loading }: EngagementBarChartProps) {
  if (loading) {
    return (
      <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} />
          <span className="text-sm font-semibold text-[#e2e4f0]">Engagement Metrics</span>
        </div>
        <div className="h-[200px] bg-white/[0.04] rounded-lg animate-pulse" />
      </div>
    );
  }

  const maxValue = Math.max(...data.flatMap(d => [d.views, d.likes, d.shares, d.comments]));

  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <BarChart3 size={16} className="text-cyan-500" />
        <span className="text-sm font-semibold text-[#e2e4f0]">Engagement Metrics</span>
        <div className="flex gap-3 ml-auto">
          {Object.entries(COLORS).map(([key, color]) => (
            <span key={key} className="flex items-center gap-1 text-[11px] text-[#8b8fa8]">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span>{key}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max py-2.5">
          {data.map((day, dayIdx) => (
            <div key={dayIdx} className="flex flex-col items-center gap-2">
              <div className="flex gap-0.5 items-end h-[120px]">
                <div
                  className="w-2.5 rounded-t-sm cursor-pointer transition-opacity duration-150 hover:opacity-80"
                  style={{ height: `${(day.views / maxValue) * 100}%`, background: COLORS.views }}
                  title={`Views: ${day.views}`}
                />
                <div
                  className="w-2.5 rounded-t-sm cursor-pointer transition-opacity duration-150 hover:opacity-80"
                  style={{ height: `${(day.likes / maxValue) * 100}%`, background: COLORS.likes }}
                  title={`Likes: ${day.likes}`}
                />
                <div
                  className="w-2.5 rounded-t-sm cursor-pointer transition-opacity duration-150 hover:opacity-80"
                  style={{ height: `${(day.shares / maxValue) * 100}%`, background: COLORS.shares }}
                  title={`Shares: ${day.shares}`}
                />
                <div
                  className="w-2.5 rounded-t-sm cursor-pointer transition-opacity duration-150 hover:opacity-80"
                  style={{ height: `${(day.comments / maxValue) * 100}%`, background: COLORS.comments }}
                  title={`Comments: ${day.comments}`}
                />
              </div>
              <span className="text-[10px] text-[#555870]">{day.label}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Totals */}
      <div className="flex gap-5 mt-4 pt-4 border-t border-white/5">
        {Object.entries(COLORS).map(([key, color]) => (
          <div key={key} className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase" style={{ color }}>{key}</span>
            <span className="text-sm font-semibold text-[#e2e4f0]">
              {data.reduce((sum, d) => sum + d[key as keyof EngagementData] as number, 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
