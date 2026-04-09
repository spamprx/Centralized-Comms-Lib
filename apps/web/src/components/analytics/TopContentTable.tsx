import { Trophy, ExternalLink } from 'lucide-react';
import type { TopContentItem } from '../../data/mockAnalyticsData';

interface TopContentTableProps {
  data: TopContentItem[];
  loading?: boolean;
}

export function TopContentTable({ data, loading }: TopContentTableProps) {
  if (loading) {
    return (
      <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={16} />
          <span className="text-sm font-semibold text-[#e2e4f0]">Top Performing Content</span>
        </div>
        <div className="h-[200px] bg-white/[0.04] rounded-lg animate-pulse" />
      </div>
    );
  }

  const rankStyles = [
    'bg-gradient-to-br from-amber-400 to-amber-500 text-[#1a1d2e]',
    'bg-gradient-to-br from-gray-400 to-gray-500 text-[#1a1d2e]',
    'bg-gradient-to-br from-amber-600 to-amber-700 text-[#1a1d2e]',
  ];

  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={16} className="text-amber-400" />
        <span className="text-sm font-semibold text-[#e2e4f0]">Top Performing Content</span>
        <span className="text-xs text-[#555870] ml-auto">{data.length} items</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              {['Rank', 'Title', 'Author', 'Views', 'Engagement', 'Avg Read Time', ''].map((h, i) => (
                <th key={i} className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase text-[#555870] bg-white/[0.02] border-b border-white/[0.06]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={item.id} className="transition-colors duration-150 hover:bg-white/[0.025]">
                <td className="px-3 py-3 border-b border-white/[0.04] text-[13px]">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-semibold ${
                    i < 3 ? rankStyles[i] : 'bg-white/5 text-[#555870]'
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-3 py-3 border-b border-white/[0.04] text-[13px]">
                  <span className="block font-medium text-[#e2e4f0] mb-0.5">{item.title}</span>
                  <span className="block text-[11px] text-[#555870]">{new Date(item.publishedAt).toLocaleDateString()}</span>
                </td>
                <td className="px-3 py-3 border-b border-white/[0.04] text-[13px] text-[#8b8fa8]">{item.author}</td>
                <td className="px-3 py-3 border-b border-white/[0.04] text-[13px] font-semibold text-[#e2e4f0]">{item.views.toLocaleString()}</td>
                <td className="px-3 py-3 border-b border-white/[0.04] text-[13px]">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-sm min-w-1"
                      style={{ width: `${item.engagement}%` }}
                    />
                    <span className="text-[11px] font-semibold text-[#e2e4f0] min-w-[35px]">{item.engagement}%</span>
                  </div>
                </td>
                <td className="px-3 py-3 border-b border-white/[0.04] text-[13px] text-[#555870] font-mono">{item.avgReadTime}</td>
                <td className="px-3 py-3 border-b border-white/[0.04] text-[13px] w-10 text-center">
                  <button className="inline-flex items-center justify-center w-7 h-7 bg-white/5 border-none rounded-md text-[#555870] cursor-pointer transition-all duration-150 hover:bg-white/10 hover:text-[#e2e4f0]" title="View details">
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
