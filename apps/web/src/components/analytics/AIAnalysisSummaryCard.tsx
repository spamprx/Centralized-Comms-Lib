import { Sparkles, TrendingUp, AlertCircle, Info } from 'lucide-react';
import type { AIInsight } from '../../data/mockAnalyticsData';

interface AIAnalysisSummaryCardProps {
  data: AIInsight[];
  loading?: boolean;
}

export function AIAnalysisSummaryCard({ data, loading }: AIAnalysisSummaryCardProps) {
  if (loading) {
    return (
      <div className="ai-card">
        <div className="ai-card__header">
          <Sparkles size={16} />
          <span className="ai-card__title">AI Insights</span>
        </div>
        <div className="ai-card__loading" />
        <style>{`
          .ai-card { padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
          .ai-card__header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
          .ai-card__title { font-size: 14px; font-weight: 600; color: #e2e4f0; }
          .ai-card__loading { height: 100px; background: rgba(255,255,255,0.04); border-radius: 8px; animation: pulse 1.5s infinite; }
          @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        `}</style>
      </div>
    );
  }

  const getIcon = (sentiment: string) => {
    if (sentiment === 'positive') return <TrendingUp size={14} className="ai-insight__icon ai-insight__icon--positive" />;
    if (sentiment === 'negative') return <AlertCircle size={14} className="ai-insight__icon ai-insight__icon--negative" />;
    return <Info size={14} className="ai-insight__icon ai-insight__icon--neutral" />;
  };

  const getImpactColor = (impact: string) => {
    if (impact === 'high') return 'rgba(239,68,68,0.15)';
    if (impact === 'medium') return 'rgba(251,191,36,0.15)';
    return 'rgba(107,114,128,0.15)';
  };

  const getImpactTextColor = (impact: string) => {
    if (impact === 'high') return '#f87171';
    if (impact === 'medium') return '#fbbf24';
    return '#6b7280';
  };

  return (
    <div className="ai-card">
      <div className="ai-card__header">
        <Sparkles size={16} className="ai-card__icon" />
        <span className="ai-card__title">AI Insights</span>
        <span className="ai-card__badge">{data.length} insights</span>
      </div>
      <div className="ai-card__content">
        {data.map((insight, i) => (
          <div key={i} className="ai-insight">
            <div className="ai-insight__left">
              {getIcon(insight.sentiment)}
              <div className="ai-insight__content">
                <span className="ai-insight__title">{insight.title}</span>
                <p className="ai-insight__description">{insight.description}</p>
              </div>
            </div>
            <span
              className="ai-insight__impact"
              style={{
                background: getImpactColor(insight.impact),
                color: getImpactTextColor(insight.impact),
              }}
            >
              {insight.impact}
            </span>
          </div>
        ))}
      </div>
      <style>{`
        .ai-card { padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
        .ai-card__header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .ai-card__icon { color: #a78bfa; }
        .ai-card__title { font-size: 14px; font-weight: 600; color: #e2e4f0; }
        .ai-card__badge { font-size: 10px; padding: 2px 8px; background: rgba(167,139,250,0.15); border-radius: 10px; color: #a78bfa; margin-left: auto; }
        .ai-card__content { display: flex; flex-direction: column; gap: 12px; }
        .ai-insight { display: flex; gap: 10px; align-items: flex-start; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 8px; transition: background 0.15s; }
        .ai-insight:hover { background: rgba(255,255,255,0.04); }
        .ai-insight__left { display: flex; gap: 10px; flex: 1; }
        .ai-insight__icon { flex-shrink: 0; margin-top: 2px; }
        .ai-insight__icon--positive { color: #34d399; }
        .ai-insight__icon--negative { color: #f87171; }
        .ai-insight__icon--neutral { color: #6b7280; }
        .ai-insight__content { display: flex; flex-direction: column; gap: 4px; }
        .ai-insight__title { font-size: 12px; font-weight: 600; color: #e2e4f0; }
        .ai-insight__description { font-size: 11px; color: #8b8fa8; line-height: 1.4; margin: 0; }
        .ai-insight__impact { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 3px 8px; border-radius: 4px; flex-shrink: 0; }
      `}</style>
    </div>
  );
}
