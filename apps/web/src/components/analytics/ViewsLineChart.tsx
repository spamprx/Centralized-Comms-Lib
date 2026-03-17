import { TrendingUp } from 'lucide-react';
import type { TimeSeriesPoint } from '../../data/mockAnalyticsData';

interface ViewsLineChartProps {
  data: TimeSeriesPoint[];
  loading?: boolean;
}

export function ViewsLineChart({ data, loading }: ViewsLineChartProps) {
  if (loading) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <TrendingUp size={16} />
          <span className="chart-title">Views Over Time</span>
        </div>
        <div className="chart-loading" />
        <style>{`
          .chart-container { padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
          .chart-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
          .chart-title { font-size: 14px; font-weight: 600; color: #e2e4f0; }
          .chart-loading { height: 200px; background: rgba(255,255,255,0.04); border-radius: 8px; animation: pulse 1.5s infinite; }
          @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        `}</style>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  // Create SVG path
  const width = 100;
  const height = 60;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.value - minValue) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Create area fill
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  // Sample dates for x-axis labels
  const labelIndices = [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor(3 * data.length / 4), data.length - 1];

  return (
    <div className="chart-container">
      <div className="chart-header">
        <TrendingUp size={16} className="chart-icon" />
        <span className="chart-title">Views Over Time</span>
        <span className="chart-subtitle">{data.length} days</span>
      </div>
      <div className="chart-content">
        <svg viewBox={`0 0 ${width} ${height}`} className="line-chart" preserveAspectRatio="none">
          <defs>
            <linearGradient id="viewsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
          ))}
          {/* Area fill */}
          <polygon points={areaPoints} fill="url(#viewsGradient)" />
          {/* Line */}
          <polyline points={points} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Data points */}
          {data.map((d, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((d.value - minValue) / range) * height;
            return <circle key={i} cx={x} cy={y} r="1" fill="#8b5cf6" />;
          })}
        </svg>
        {/* X-axis labels */}
        <div className="chart-x-axis">
          {labelIndices.map((idx, i) => (
            <span key={i} className="chart-x-label">{data[idx].date.slice(5)}</span>
          ))}
        </div>
      </div>
      {/* Stats */}
      <div className="chart-stats">
        <div className="chart-stat">
          <span className="chart-stat__label">Total</span>
          <span className="chart-stat__value">{data.reduce((sum, d) => sum + d.value, 0).toLocaleString()}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat__label">Avg/Day</span>
          <span className="chart-stat__value">{Math.round(data.reduce((sum, d) => sum + d.value, 0) / data.length).toLocaleString()}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat__label">Peak</span>
          <span className="chart-stat__value">{maxValue.toLocaleString()}</span>
        </div>
      </div>
      <style>{`
        .chart-container { padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
        .chart-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .chart-icon { color: #8b5cf6; }
        .chart-title { font-size: 14px; font-weight: 600; color: #e2e4f0; }
        .chart-subtitle { font-size: 12px; color: #555870; margin-left: auto; }
        .chart-content { position: relative; }
        .line-chart { width: 100%; height: 150px; display: block; }
        .chart-x-axis { display: flex; justify-content: space-between; margin-top: 8px; padding: 0 4px; }
        .chart-x-label { font-size: 10px; color: #555870; }
        .chart-stats { display: flex; gap: 24px; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.05); }
        .chart-stat { display: flex; flex-direction: column; gap: 4px; }
        .chart-stat__label { font-size: 10px; color: #555870; text-transform: uppercase; letter-spacing: 0.05em; }
        .chart-stat__value { font-size: 14px; font-weight: 600; color: #e2e4f0; }
      `}</style>
    </div>
  );
}
