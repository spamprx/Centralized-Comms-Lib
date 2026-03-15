import { PieChart } from 'lucide-react';
import type { ContentTypeBreakdown } from '../../data/mockAnalyticsData';

interface ContentTypeBreakdownPieProps {
  data: ContentTypeBreakdown[];
  loading?: boolean;
}

export function ContentTypeBreakdownPie({ data, loading }: ContentTypeBreakdownPieProps) {
  if (loading) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <PieChart size={16} />
          <span className="chart-title">Content Type Breakdown</span>
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

  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulativePercent = 0;

  // Create SVG pie slices
  const slices = data.map((item) => {
    const percent = item.value / total;
    const startAngle = cumulativePercent * 360;
    const endAngle = (cumulativePercent + percent) * 360;
    cumulativePercent += percent;

    // Convert to radians
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    // Calculate points
    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);

    // Determine if this should be a large arc
    const largeArc = percent > 0.5 ? 1 : 0;

    // Create path
    const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return { ...item, path, percent };
  });

  return (
    <div className="chart-container">
      <div className="chart-header">
        <PieChart size={16} className="chart-icon" />
        <span className="chart-title">Content Type Breakdown</span>
      </div>
      <div className="chart-content">
        <div className="pie-chart-wrapper">
          <svg viewBox="0 0 100 100" className="pie-chart">
            {slices.map((slice) => (
              <path
                key={slice.type}
                d={slice.path}
                fill={slice.color}
                className="pie-chart__slice"
              />
            ))}
            <circle cx="50" cy="50" r="25" fill="#1a1d2e" />
          </svg>
          <div className="pie-chart__center">
            <span className="pie-chart__total">{total}</span>
            <span className="pie-chart__label">Total</span>
          </div>
        </div>
        <div className="pie-chart__legend">
          {slices.map((slice) => (
            <div key={slice.type} className="pie-chart__legend-item">
              <span className="pie-chart__legend-dot" style={{ background: slice.color }} />
              <span className="pie-chart__legend-label">{slice.type}</span>
              <span className="pie-chart__legend-value">{slice.percent.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .chart-container { padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
        .chart-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .chart-icon { color: #10b981; }
        .chart-title { font-size: 14px; font-weight: 600; color: #e2e4f0; }
        .chart-content { display: flex; gap: 16px; align-items: center; }
        .pie-chart-wrapper { position: relative; width: 120px; height: 120px; flex-shrink: 0; }
        .pie-chart { width: 100%; height: 100%; }
        .pie-chart__slice { transition: opacity 0.15s; cursor: pointer; }
        .pie-chart__slice:hover { opacity: 0.8; }
        .pie-chart__center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
        .pie-chart__total { display: block; font-size: 18px; font-weight: 700; color: #e2e4f0; }
        .pie-chart__label { display: block; font-size: 9px; color: #555870; text-transform: uppercase; letter-spacing: 0.05em; }
        .pie-chart__legend { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .pie-chart__legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
        .pie-chart__legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
        .pie-chart__legend-label { flex: 1; color: #8b8fa8; }
        .pie-chart__legend-value { font-weight: 600; color: #e2e4f0; }
      `}</style>
    </div>
  );
}
