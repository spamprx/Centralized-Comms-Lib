import { PieChart } from 'lucide-react';
import type { ContentTypeBreakdown } from '../../data/mockAnalyticsData';

interface ContentTypeBreakdownPieProps {
  data: ContentTypeBreakdown[];
  loading?: boolean;
}

export function ContentTypeBreakdownPie({ data, loading }: ContentTypeBreakdownPieProps) {
  if (loading) {
    return (
      <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
        <div className="flex items-center gap-2 mb-4">
          <PieChart size={16} />
          <span className="text-sm font-semibold text-[#e2e4f0]">Content Type Breakdown</span>
        </div>
        <div className="h-[140px] bg-white/[0.04] rounded-lg animate-pulse" />
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulativePercent = 0;

  const slices = data.map((item) => {
    const percent = item.value / total;
    const startAngle = cumulativePercent * 360;
    const endAngle = (cumulativePercent + percent) * 360;
    cumulativePercent += percent;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);

    const largeArc = percent > 0.5 ? 1 : 0;
    const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return { ...item, path, percent };
  });

  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
      <div className="flex items-center gap-2 mb-4">
        <PieChart size={16} className="text-emerald-500" />
        <span className="text-sm font-semibold text-[#e2e4f0]">Content Type Breakdown</span>
      </div>
      <div className="flex gap-4 items-center">
        <div className="relative w-[120px] h-[120px] shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {slices.map((slice) => (
              <path
                key={slice.type}
                d={slice.path}
                fill={slice.color}
                className="transition-opacity duration-150 cursor-pointer hover:opacity-80"
              />
            ))}
            <circle cx="50" cy="50" r="25" fill="#1a1d2e" />
          </svg>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <span className="block text-lg font-bold text-[#e2e4f0]">{total}</span>
            <span className="block text-[9px] text-[#555870] uppercase tracking-wide">Total</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          {slices.map((slice) => (
            <div key={slice.type} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: slice.color }} />
              <span className="flex-1 text-[#8b8fa8]">{slice.type}</span>
              <span className="font-semibold text-[#e2e4f0]">{slice.percent.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
