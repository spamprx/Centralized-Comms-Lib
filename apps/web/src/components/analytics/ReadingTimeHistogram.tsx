import { Clock } from 'lucide-react';
import type { ReadingTimeBucket } from '../../data/mockAnalyticsData';

interface ReadingTimeHistogramProps {
  data: ReadingTimeBucket[];
  loading?: boolean;
}

export function ReadingTimeHistogram({ data, loading }: ReadingTimeHistogramProps) {
  if (loading) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <Clock size={16} />
          <span className="chart-title">Reading Time Distribution</span>
        </div>
        <div className="chart-loading" />
        <style>{`
          .chart-container { padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
          .chart-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
          .chart-title { font-size: 14px; font-weight: 600; color: #e2e4f0; }
          .chart-loading { height: 140px; background: rgba(255,255,255,0.04); border-radius: 8px; animation: pulse 1.5s infinite; }
          @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        `}</style>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <Clock size={16} className="chart-icon" />
        <span className="chart-title">Reading Time Distribution</span>
        <span className="chart-subtitle">{total.toLocaleString()} reads</span>
      </div>
      <div className="histogram">
        {data.map((bucket, i) => {
          const percentage = (bucket.count / maxValue) * 100;
          const share = ((bucket.count / total) * 100).toFixed(1);
          return (
            <div key={i} className="histogram__bar-group">
              <div className="histogram__bar-container">
                <div
                  className="histogram__bar"
                  style={{ height: `${percentage}%` }}
                />
              </div>
              <span className="histogram__label">{bucket.range}</span>
              <span className="histogram__value">{bucket.count.toLocaleString()}</span>
              <span className="histogram__share">{share}%</span>
            </div>
          );
        })}
      </div>
      <style>{`
        .chart-container { padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
        .chart-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .chart-icon { color: #f59e0b; }
        .chart-title { font-size: 14px; font-weight: 600; color: #e2e4f0; }
        .chart-subtitle { font-size: 12px; color: #555870; margin-left: auto; }
        .histogram { display: flex; justify-content: space-between; gap: 8px; align-items: flex-end; height: 120px; padding: 10px 0; }
        .histogram__bar-group { display: flex; flex-direction: column; align-items: center; flex: 1; gap: 6px; }
        .histogram__bar-container { width: 100%; height: 80px; display: flex; align-items: flex-end; justify-content: center; background: rgba(255,255,255,0.02); border-radius: 4px; }
        .histogram__bar { width: 80%; background: linear-gradient(180deg, #f59e0b 0%, #f59e0b44 100%); border-radius: 4px 4px 0 0; transition: all 0.2s; }
        .histogram__bar:hover { background: linear-gradient(180deg, #fbbf24 0%, #fbbf2444 100%); }
        .histogram__label { font-size: 9px; color: #555870; text-align: center; white-space: nowrap; }
        .histogram__value { font-size: 11px; font-weight: 600; color: #e2e4f0; }
        .histogram__share { font-size: 9px; color: #555870; }
      `}</style>
    </div>
  );
}
