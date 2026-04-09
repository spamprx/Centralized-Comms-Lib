import { Sparkles, TrendingUp, AlertCircle, Info } from 'lucide-react';
import type { AIInsight } from '../../data/mockAnalyticsData';

interface AIAnalysisSummaryCardProps {
  data: AIInsight[];
  loading?: boolean;
}

export function AIAnalysisSummaryCard({ data, loading }: AIAnalysisSummaryCardProps) {
  if (loading) {
    return (
      <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} />
          <span className="text-sm font-semibold text-[#e2e4f0]">AI Insights</span>
        </div>
        <div className="h-[100px] bg-white/[0.04] rounded-lg animate-pulse" />
      </div>
    );
  }

  const getIcon = (sentiment: string) => {
    if (sentiment === 'positive') return <TrendingUp size={14} className="text-emerald-400 shrink-0 mt-0.5" />;
    if (sentiment === 'negative') return <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />;
    return <Info size={14} className="text-gray-500 shrink-0 mt-0.5" />;
  };

  const getImpactColor = (impact: string) => {
    if (impact === 'high') return 'bg-red-500/15 text-red-400';
    if (impact === 'medium') return 'bg-amber-400/15 text-amber-400';
    return 'bg-gray-500/15 text-gray-500';
  };

  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-violet-400" />
        <span className="text-sm font-semibold text-[#e2e4f0]">AI Insights</span>
        <span className="text-[10px] px-2 py-0.5 bg-violet-400/15 rounded-[10px] text-violet-400 ml-auto">{data.length} insights</span>
      </div>
      <div className="flex flex-col gap-3">
        {data.map((insight, i) => (
          <div key={i} className="flex gap-2.5 items-start p-2.5 bg-white/[0.02] rounded-lg transition-colors duration-150 hover:bg-white/[0.04]">
            <div className="flex gap-2.5 flex-1">
              {getIcon(insight.sentiment)}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#e2e4f0]">{insight.title}</span>
                <p className="text-[11px] text-[#8b8fa8] leading-snug m-0">{insight.description}</p>
              </div>
            </div>
            <span className={`text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded shrink-0 ${getImpactColor(insight.impact)}`}>
              {insight.impact}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
