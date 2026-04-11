import { Clock } from 'lucide-react';
import type { ReadingTimeBucket } from '../../data/mockAnalyticsData';

interface ReadingTimeHistogramProps {
  data: ReadingTimeBucket[];
  loading?: boolean;
}

export function ReadingTimeHistogram({ data, loading }: ReadingTimeHistogramProps) {
  if (loading) {
    return (
      <div className="p-4 bg-app-surface border border-app-border rounded-app-lg">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} />
          <span className="text-sm font-semibold text-app-text">Reading Time Distribution</span>
        </div>
        <div className="h-[140px] bg-app-surface rounded-lg animate-pulse" />
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="p-4 bg-app-surface border border-app-border rounded-app-lg">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} className="text-blue-500" />
        <span className="text-sm font-semibold text-app-text">Reading Time Distribution</span>
        <span className="text-xs text-app-faint ml-auto">{total.toLocaleString()} reads</span>
      </div>
      <div className="flex justify-between gap-2 items-end h-[160px]">
        {data.map((bucket, i) => {
          const percentage = (bucket.count / maxValue) * 100;
          const share = ((bucket.count / total) * 100).toFixed(1);
          
          // Color gradient based on reading time
          const colors = [
            'from-blue-400 to-blue-500',   // 0-1 min - quick readers
            'from-green-400 to-green-500', // 1-3 min - normal readers  
            'from-emerald-400 to-emerald-500', // 3-5 min - engaged readers
            'from-teal-400 to-teal-500',   // 5-10 min - focused readers
            'from-cyan-400 to-cyan-500',   // 10-15 min - deep readers
            'from-indigo-400 to-indigo-500', // 15+ min - power readers
          ];
          const colorClass = colors[i] || colors[0];
          
          return (
            <div key={i} className="flex flex-col items-center flex-1 h-full group">
              {/* Chart area */}
              <div className="relative w-full h-20 flex items-end justify-center mb-3">
                {/* Background track */}
                <div className="absolute inset-x-0 bottom-0 h-full bg-app-bg/40 rounded-t-lg" />
                {/* Value bar */}
                <div
                  className={`relative w-3/4 rounded-t-lg bg-gradient-to-t ${colorClass} transition-all duration-300 group-hover:scale-105 shadow-sm`}
                  style={{ height: `${percentage}%` }}
                >
                  {/* Top highlight */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-white/30 rounded-t-lg" />
                </div>
              </div>
              
              {/* Text labels - separate from chart */}
              <div className="text-center flex-shrink-0">
                <span className="text-[9px] font-medium text-app-text block leading-tight">{bucket.range}</span>
                <span className="text-[11px] font-bold text-app-text block leading-tight">{bucket.count.toLocaleString()}</span>
                <span className="text-[8px] text-app-faint">{share}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
