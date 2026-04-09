import { Clock } from 'lucide-react';
import type { ReadingTimeBucket } from '../../data/mockAnalyticsData';

interface ReadingTimeHistogramProps {
  data: ReadingTimeBucket[];
  loading?: boolean;
}

export function ReadingTimeHistogram({ data, loading }: ReadingTimeHistogramProps) {
  if (loading) {
    return (
      <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} />
          <span className="text-sm font-semibold text-[#e2e4f0]">Reading Time Distribution</span>
        </div>
        <div className="h-[140px] bg-white/[0.04] rounded-lg animate-pulse" />
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} className="text-amber-500" />
        <span className="text-sm font-semibold text-[#e2e4f0]">Reading Time Distribution</span>
        <span className="text-xs text-[#555870] ml-auto">{total.toLocaleString()} reads</span>
      </div>
      <div className="flex justify-between gap-2 items-end h-[120px] py-2.5">
        {data.map((bucket, i) => {
          const percentage = (bucket.count / maxValue) * 100;
          const share = ((bucket.count / total) * 100).toFixed(1);
          return (
            <div key={i} className="flex flex-col items-center flex-1 gap-1.5">
              <div className="w-full h-20 flex items-end justify-center bg-white/[0.02] rounded">
                <div
                  className="w-4/5 rounded-t bg-gradient-to-b from-amber-500 to-amber-500/25 transition-all duration-200 hover:from-amber-400 hover:to-amber-400/25"
                  style={{ height: `${percentage}%` }}
                />
              </div>
              <span className="text-[9px] text-[#555870] text-center whitespace-nowrap">{bucket.range}</span>
              <span className="text-[11px] font-semibold text-[#e2e4f0]">{bucket.count.toLocaleString()}</span>
              <span className="text-[9px] text-[#555870]">{share}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
