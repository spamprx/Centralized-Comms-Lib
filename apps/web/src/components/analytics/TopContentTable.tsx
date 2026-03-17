import { Trophy, ExternalLink } from 'lucide-react';
import type { TopContentItem } from '../../data/mockAnalyticsData';

interface TopContentTableProps {
  data: TopContentItem[];
  loading?: boolean;
}

export function TopContentTable({ data, loading }: TopContentTableProps) {
  if (loading) {
    return (
      <div className="table-container">
        <div className="table-header">
          <Trophy size={16} />
          <span className="table-title">Top Performing Content</span>
        </div>
        <div className="table-loading" />
        <style>{`
          .table-container { padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
          .table-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
          .table-title { font-size: 14px; font-weight: 600; color: #e2e4f0; }
          .table-loading { height: 200px; background: rgba(255,255,255,0.04); border-radius: 8px; animation: pulse 1.5s infinite; }
          @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        `}</style>
      </div>
    );
  }

  return (
    <div className="table-container">
      <div className="table-header">
        <Trophy size={16} className="table-icon" />
        <span className="table-title">Top Performing Content</span>
        <span className="table-subtitle">{data.length} items</span>
      </div>
      <div className="table-wrapper">
        <table className="content-table">
          <thead>
            <tr>
              <th className="content-table__th">Rank</th>
              <th className="content-table__th">Title</th>
              <th className="content-table__th">Author</th>
              <th className="content-table__th">Views</th>
              <th className="content-table__th">Engagement</th>
              <th className="content-table__th">Avg Read Time</th>
              <th className="content-table__th" />
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={item.id} className="content-table__row">
                <td className="content-table__td">
                  <span className={`content-table__rank ${i < 3 ? `content-table__rank--${i + 1}` : ''}`}>
                    {i + 1}
                  </span>
                </td>
                <td className="content-table__td">
                  <span className="content-table__title">{item.title}</span>
                  <span className="content-table__date">{new Date(item.publishedAt).toLocaleDateString()}</span>
                </td>
                <td className="content-table__td">
                  <span className="content-table__author">{item.author}</span>
                </td>
                <td className="content-table__td">
                  <span className="content-table__value">{item.views.toLocaleString()}</span>
                </td>
                <td className="content-table__td">
                  <div className="engagement-bar">
                    <div
                      className="engagement-bar__fill"
                      style={{ width: `${item.engagement}%` }}
                    />
                    <span className="engagement-bar__value">{item.engagement}%</span>
                  </div>
                </td>
                <td className="content-table__td">
                  <span className="content-table__time">{item.avgReadTime}</span>
                </td>
                <td className="content-table__td content-table__td--action">
                  <button className="content-table__action" title="View details">
                    <ExternalLink size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`
        .table-container { padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
        .table-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .table-icon { color: #fbbf24; }
        .table-title { font-size: 14px; font-weight: 600; color: #e2e4f0; }
        .table-subtitle { font-size: 12px; color: #555870; margin-left: auto; }
        .table-wrapper { overflow-x: auto; }
        .content-table { width: 100%; border-collapse: collapse; min-width: 700px; }
        .content-table__th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #555870; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .content-table__row { transition: background 0.15s; }
        .content-table__row:hover { background: rgba(255,255,255,0.025); }
        .content-table__td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; }
        .content-table__td--action { width: 40px; text-align: center; }
        .content-table__rank { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; font-size: 12px; font-weight: 600; color: #555870; background: rgba(255,255,255,0.05); }
        .content-table__rank--1 { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #1a1d2e; }
        .content-table__rank--2 { background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%); color: #1a1d2e; }
        .content-table__rank--3 { background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: #1a1d2e; }
        .content-table__title { display: block; font-weight: 500; color: #e2e4f0; margin-bottom: 2px; }
        .content-table__date { display: block; font-size: 11px; color: #555870; }
        .content-table__author { color: #8b8fa8; }
        .content-table__value { font-weight: 600; color: #e2e4f0; }
        .content-table__time { color: #555870; font-family: monospace; }
        .content-table__action { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: rgba(255,255,255,0.05); border: none; border-radius: 6px; color: #555870; cursor: pointer; transition: all 0.15s; }
        .content-table__action:hover { background: rgba(255,255,255,0.1); color: #e2e4f0; }
        .engagement-bar { display: flex; align-items: center; gap: 8px; }
        .engagement-bar__fill { height: 6px; background: linear-gradient(90deg, #8b5cf6 0%, #06b6d4 100%); border-radius: 3px; min-width: 4px; }
        .engagement-bar__value { font-size: 11px; font-weight: 600; color: #e2e4f0; min-width: 35px; }
      `}</style>
    </div>
  );
}
