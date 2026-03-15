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
      <div className="chart-container">
        <div className="chart-header">
          <BarChart3 size={16} />
          <span className="chart-title">Engagement Metrics</span>
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

  const maxValue = Math.max(...data.flatMap(d => [d.views, d.likes, d.shares, d.comments]));

  return (
    <div className="chart-container">
      <div className="chart-header">
        <BarChart3 size={16} className="chart-icon" />
        <span className="chart-title">Engagement Metrics</span>
        <div className="chart-legend">
          {Object.entries(COLORS).map(([key, color]) => (
            <span key={key} className="chart-legend__item">
              <span className="chart-legend__dot" style={{ background: color }} />
              <span className="chart-legend__label">{key}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="chart-content">
        <div className="bar-chart">
          {data.map((day, dayIdx) => (
            <div key={dayIdx} className="bar-chart__group">
              <div className="bar-chart__bars">
                <div
                  className="bar-chart__bar"
                  style={{
                    height: `${(day.views / maxValue) * 100}%`,
                    background: COLORS.views,
                  }}
                  title={`Views: ${day.views}`}
                />
                <div
                  className="bar-chart__bar"
                  style={{
                    height: `${(day.likes / maxValue) * 100}%`,
                    background: COLORS.likes,
                  }}
                  title={`Likes: ${day.likes}`}
                />
                <div
                  className="bar-chart__bar"
                  style={{
                    height: `${(day.shares / maxValue) * 100}%`,
                    background: COLORS.shares,
                  }}
                  title={`Shares: ${day.shares}`}
                />
                <div
                  className="bar-chart__bar"
                  style={{
                    height: `${(day.comments / maxValue) * 100}%`,
                    background: COLORS.comments,
                  }}
                  title={`Comments: ${day.comments}`}
                />
              </div>
              <span className="bar-chart__label">{day.label}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Totals */}
      <div className="chart-stats">
        <div className="chart-stat">
          <span className="chart-stat__label" style={{ color: COLORS.views }}>Views</span>
          <span className="chart-stat__value">{data.reduce((sum, d) => sum + d.views, 0).toLocaleString()}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat__label" style={{ color: COLORS.likes }}>Likes</span>
          <span className="chart-stat__value">{data.reduce((sum, d) => sum + d.likes, 0).toLocaleString()}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat__label" style={{ color: COLORS.shares }}>Shares</span>
          <span className="chart-stat__value">{data.reduce((sum, d) => sum + d.shares, 0).toLocaleString()}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat__label" style={{ color: COLORS.comments }}>Comments</span>
          <span className="chart-stat__value">{data.reduce((sum, d) => sum + d.comments, 0).toLocaleString()}</span>
        </div>
      </div>
      <style>{`
        .chart-container { padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
        .chart-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .chart-icon { color: #06b6d4; }
        .chart-title { font-size: 14px; font-weight: 600; color: #e2e4f0; }
        .chart-legend { display: flex; gap: 12px; margin-left: auto; }
        .chart-legend__item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #8b8fa8; }
        .chart-legend__dot { width: 8px; height: 8px; border-radius: 50%; }
        .chart-content { overflow-x: auto; }
        .bar-chart { display: flex; gap: 8px; min-width: max-content; padding: 10px 0; }
        .bar-chart__group { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .bar-chart__bars { display: flex; gap: 2px; align-items: flex-end; height: 120px; }
        .bar-chart__bar { width: 10px; border-radius: 2px 2px 0 0; transition: opacity 0.15s; cursor: pointer; }
        .bar-chart__bar:hover { opacity: 0.8; }
        .bar-chart__label { font-size: 10px; color: #555870; }
        .chart-stats { display: flex; gap: 20px; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.05); }
        .chart-stat { display: flex; flex-direction: column; gap: 4px; }
        .chart-stat__label { font-size: 10px; font-weight: 600; text-transform: uppercase; }
        .chart-stat__value { font-size: 14px; font-weight: 600; color: #e2e4f0; }
      `}</style>
    </div>
  );
}
