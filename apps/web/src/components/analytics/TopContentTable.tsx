import { Trophy, ExternalLink } from 'lucide-react';
import type { TopContentItem } from '../../data/mockAnalyticsData';

interface TopContentTableProps {
  data: TopContentItem[];
  loading?: boolean;
}

export function TopContentTable({ data, loading }: TopContentTableProps) {
  if (loading) {
    return (
      <div className="p-4 bg-app-surface border border-app-border rounded-app-lg">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={16} />
          <span className="text-sm font-semibold text-app-text">Top Performing Content</span>
        </div>
        <div className="h-[200px] bg-app-surface rounded-lg animate-pulse" />
      </div>
    );
  }

  const rankStyles = [
    'bg-gradient-to-br from-amber-400 to-amber-500 text-app-bg',
    'bg-gradient-to-br from-zinc-400 to-zinc-600 text-white',
    'bg-gradient-to-br from-amber-700 to-amber-900 text-amber-100',
  ];

  return (
    <div className="p-4 bg-app-surface border border-app-border rounded-app-lg">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={16} className="text-amber-400" />
        <span className="text-sm font-semibold text-app-text">Top Performing Content</span>
        <span className="text-xs text-app-faint ml-auto">{data.length} items</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              {['Rank', 'Title', 'Author', 'Views', 'Engagement', 'Avg Read Time', ''].map((h, i) => (
                <th key={i} className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase text-app-faint bg-app-bg/60 border-b border-app-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={item.id} className="transition-colors duration-150 hover:bg-app-surface/50">
                <td className="px-3 py-3 border-b border-app-border text-[13px]">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-semibold ${
                    i < 3 ? rankStyles[i] : 'bg-app-surface text-app-faint'
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-3 py-3 border-b border-app-border text-[13px]">
                  <span className="block font-medium text-app-text mb-0.5">{item.title}</span>
                  <span className="block text-[11px] text-app-faint">{new Date(item.publishedAt).toLocaleDateString()}</span>
                </td>
                <td className="px-3 py-3 border-b border-app-border text-[13px] text-app-muted">{item.author}</td>
                <td className="px-3 py-3 border-b border-app-border text-[13px] font-semibold text-app-text">{item.views.toLocaleString()}</td>
                <td className="px-3 py-3 border-b border-app-border text-[13px]">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-sm min-w-1"
                      style={{ width: `${item.engagement}%` }}
                    />
                    <span className="text-[11px] font-semibold text-app-text min-w-[35px]">{item.engagement}%</span>
                  </div>
                </td>
                <td className="px-3 py-3 border-b border-app-border text-[13px] text-app-faint font-mono">{item.avgReadTime}</td>
                <td className="px-3 py-3 border-b border-app-border text-[13px] w-10 text-center">
                  <button className="inline-flex items-center justify-center w-7 h-7 bg-app-surface border-none rounded-md text-app-faint cursor-pointer transition-all duration-150 hover:bg-white/10 hover:text-app-text" title="View details">
                    <ExternalLink size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
