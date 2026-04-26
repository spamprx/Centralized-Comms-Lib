import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Eye, ThumbsUp, ArrowUpRight } from 'lucide-react';
import { Surface } from '../ui';
import type { TopContentItem } from '../../types/analytics';

const EMOJIS = ['🥇', '🥈', '🥉'];

interface TopEngagingContentProps {
  items: TopContentItem[];
}

export function TopEngagingContent({ items }: TopEngagingContentProps) {
  const data = items.slice(0, 5);

  return (
    <Surface
      variant="glass"
      className="overflow-hidden shadow-app-lift transition-shadow duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] hover:shadow-app-soft"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-app-accent/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-app-accent-2/8 blur-3xl"
      />
      <div className="relative z-[1]">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={15} className="text-app-accent" strokeWidth={2} />
          <h3 className="text-sm font-semibold tracking-tight text-app-text">
            Top engaging content
          </h3>
          <span className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-app-faint">
            7 days
          </span>
        </div>

        {data.length === 0 ? (
          <div className="rounded-app-lg border border-dashed border-white/10 py-8 text-center text-[13px] text-app-faint">
            No engagement data yet
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.map((item, index) => {
              const rankEmoji = EMOJIS[index] ?? null;
              const engWidth = Math.min(100, item.engagement);
              const accentColor = index === 0 ? '#937cf8' : index === 1 ? '#2dd4bf' : index === 2 ? '#fbbf24' : '#8892a8';

              return (
                <Link
                  key={item.id}
                  to={`/library/${item.id}`}
                  className="group/top relative overflow-hidden rounded-app-lg border border-white/[0.06] bg-app-bg/30 p-3.5 transition-[border-color,background-color,transform] duration-200 hover:-translate-y-px hover:border-white/12 hover:bg-white/[0.04]"
                >
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-px opacity-0 transition-opacity duration-300 group-hover/top:opacity-100"
                    style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }}
                  />
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      {rankEmoji ? (
                        <span className="shrink-0 text-[15px] leading-none">{rankEmoji}</span>
                      ) : (
                        <span
                          className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-semibold text-app-faint"
                        >
                          #{index + 1}
                        </span>
                      )}
                      <p
                        className="line-clamp-1 text-[13px] font-semibold leading-snug tracking-tight text-app-text group-hover/top:text-app-accent transition-colors duration-200"
                        title={item.title}
                      >
                        {item.title}
                      </p>
                    </div>
                    <ArrowUpRight
                      size={13}
                      className="mt-0.5 shrink-0 text-app-faint opacity-0 transition-opacity duration-200 group-hover/top:opacity-100"
                    />
                  </div>

                  {/* Engagement bar */}
                  <div className="mb-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out"
                      style={{
                        width: `${engWidth}%`,
                        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}80)`,
                        boxShadow: `0 0 12px -2px ${accentColor}`,
                      } as CSSProperties}
                    />
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-[11px] text-app-faint">
                    <span className="flex items-center gap-1">
                      <Eye size={11} strokeWidth={2} />
                      {item.views.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp size={11} strokeWidth={2} />
                      {item.engagement}%
                    </span>
                    <span className="ml-auto text-[10px] text-app-faint/60">
                      {item.avgReadTime}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Surface>
  );
}
