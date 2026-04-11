import { Sparkles, TrendingUp, AlertCircle, Info } from 'lucide-react';
import type { AIInsight } from '../../data/mockAnalyticsData';

interface AIAnalysisSummaryCardProps {
  data: AIInsight[];
  loading?: boolean;
}

export function AIAnalysisSummaryCard({ data, loading }: AIAnalysisSummaryCardProps) {
  if (loading) {
    return (
      <div className="p-4 bg-app-surface border border-app-border rounded-app-lg">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} />
          <span className="text-sm font-semibold text-app-text">AI Insights</span>
        </div>
        <div className="h-[100px] bg-app-surface rounded-lg animate-pulse" />
      </div>
    );
  }

  const getIcon = (sentiment: string) => {
    if (sentiment === 'positive') return <TrendingUp size={14} className="text-emerald-400 shrink-0 mt-0.5" />;
    if (sentiment === 'negative') return <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />;
    return <Info size={14} className="text-app-faint shrink-0 mt-0.5" />;
  };

  const getImpactColor = (impact: string) => {
    if (impact === 'high') return 'bg-red-100 text-red-400';
    if (impact === 'medium') return 'bg-amber-400/15 text-amber-400';
    return 'bg-app-surface0/15 text-app-faint';
  };

  return (
    <div className="p-4 bg-app-surface border border-app-border rounded-app-lg">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-app-accent" />
        <span className="text-sm font-semibold text-app-text">AI Insights</span>
        <span className="text-[10px] px-2 py-0.5 bg-app-accent-muted rounded-app-lg text-app-accent ml-auto">{data.length} insights</span>
      </div>
      <div className="flex flex-col gap-3">
        {data.map((insight, i) => (
          <div key={i} className="flex gap-2.5 items-start p-2.5 bg-app-bg/60 rounded-lg transition-colors duration-150 hover:bg-app-surface">
            <div className="flex gap-2.5 flex-1">
              {getIcon(insight.sentiment)}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-app-text">{insight.title}</span>
                <p className="text-[11px] text-app-muted leading-snug m-0">{insight.description}</p>
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
