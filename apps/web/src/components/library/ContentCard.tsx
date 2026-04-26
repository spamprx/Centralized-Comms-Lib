import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FileText, Video, Mic, File, Eye, MessageSquare } from 'lucide-react';
import type { ContentItem } from '../../data/mockLibraryData';
import { contentService } from '../../services/contentService';

const typeIcons = {
  article: FileText,
  video: Video,
  podcast: Mic,
  document: File,
};

const typeColors = {
  article: '#8b5cf6',
  video: '#06b6d4',
  podcast: '#f59e0b',
  document: '#10b981',
};

const statusColors = {
  draft: '#6b7280',
  review: '#fbbf24',
  published: '#10b981',
};

interface ContentCardProps {
  item: ContentItem;
}

const TOP_EMOJIS = ['👍', '❤️', '👏', '💡'];

function useCardEngagement(id: string, initialLikes: number, initialViews: number, initialComments: number) {
  const [likes, setLikes] = useState(initialLikes);
  const [views, setViews] = useState(initialViews);
  const [comments, setComments] = useState(initialComments);
  const [topEmojis, setTopEmojis] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const [eng, rxn] = await Promise.allSettled([
          contentService.getEngagement(id),
          contentService.getReactions(id),
        ]);
        if (cancelled) return;
        if (eng.status === 'fulfilled') {
          setLikes(eng.value.likes);
          setViews(eng.value.views);
          setComments(eng.value.comments);
        }
        if (rxn.status === 'fulfilled') {
          const GLYPH: Record<string, string> = {
            LIKE: '👍', LOVE: '❤️', CLAP: '👏', INSIGHTFUL: '💡', LAUGH: '😂', CELEBRATE: '🎉',
          };
          const active = rxn.value.counts
            .filter((r) => r.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map((r) => GLYPH[r.emoji] ?? '👍');
          setTopEmojis(active);
        }
      } catch { /* silent */ }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [id]);

  return { likes, views, comments, topEmojis };
}

export function ContentCard({ item }: ContentCardProps) {
  const TypeIcon = typeIcons[item.type];
  const c = typeColors[item.type];
  const { likes, views, comments, topEmojis } = useCardEngagement(
    item.id,
    item.likes ?? 0,
    item.views,
    item.commentsCount ?? 0,
  );

  return (
    <Link
      to={`/library/${item.id}`}
      className="group/card relative block overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/40 shadow-app-lift outline-none backdrop-blur-xl transition-[transform,box-shadow,border-color] duration-(--duration-app-slow) ease-(--ease-app-out) supports-backdrop-filter:bg-app-bg/28 hover:-translate-y-1.5 hover:border-app-accent/30 hover:shadow-app-glow focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg motion-reduce:transition-shadow motion-reduce:hover:transform-none"
    >
      <div
        className="app-shimmer-hover pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
        aria-hidden
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-1 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />
      <div className="relative h-[156px] overflow-hidden">
        <div
          className="absolute inset-0 transition-[transform,filter] duration-700 ease-(--ease-app-out) group-hover/card:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover/card:scale-100"
          style={{
            background: `radial-gradient(ellipse 90% 70% at 20% 10%, ${c}45, transparent 52%), radial-gradient(ellipse 60% 50% at 90% 80%, ${c}22, transparent 50%), linear-gradient(155deg, ${c}35 0%, rgba(8,10,15,0.92) 55%, rgba(8,10,15,0.98) 100%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-app-bg via-app-bg/40 to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_40%,rgba(255,255,255,0.06)_50%,transparent_60%)] opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-app-md border border-white/15 bg-app-bg/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/10 backdrop-blur-md transition-[transform,box-shadow] duration-(--duration-app-slow) ease-(--ease-app-out) group-hover/card:scale-110 group-hover/card:shadow-[0_0_24px_-4px_var(--tw-shadow-color)]"
            style={{ color: c, '--tw-shadow-color': c } as CSSProperties}
          >
            <TypeIcon size={26} strokeWidth={1.75} />
          </div>
          <span className="rounded-full border border-white/12 bg-app-bg/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-app-text/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
            {item.type}
          </span>
        </div>
      </div>

      <div className="relative border-t border-white/[0.06] p-4 pt-3.5">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-white/10"
          style={{
            color: statusColors[item.status],
            background: `${statusColors[item.status]}18`,
          }}
        >
          {item.status}
        </span>
        <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-app-text">
          {item.title}
        </h3>
        <p className="mt-1.5 text-xs text-app-muted">by {item.author}</p>

        {item.tags.length > 0 && (
          <div className="mb-3 mt-2.5 flex flex-wrap gap-1.5">
            {item.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm transition-colors duration-(--duration-app) group-hover/card:border-white/12 group-hover/card:text-app-text"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Live engagement bar */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
          <div className="flex items-center gap-3">
            {/* Emoji reaction stack */}
            <div className="flex items-center gap-1">
              {(topEmojis.length > 0 ? topEmojis : TOP_EMOJIS.slice(0, 2)).map((g, i) => (
                <span
                  key={i}
                  className="text-[14px] leading-none opacity-80 transition-transform duration-200 group-hover/card:opacity-100 group-hover/card:scale-110"
                  style={{ transitionDelay: `${i * 30}ms` }}
                >
                  {g}
                </span>
              ))}
              {likes > 0 && (
                <span className="ml-1 text-[11px] font-semibold tabular-nums text-app-muted">
                  {likes.toLocaleString()}
                </span>
              )}
            </div>
            {/* Comments */}
            {comments > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-app-faint">
                <MessageSquare size={12} strokeWidth={2} />
                {comments}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {views > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-app-faint">
                <Eye size={12} strokeWidth={2} />
                {views.toLocaleString()}
              </span>
            )}
            <div className="relative min-h-[1.25rem] shrink-0 text-right">
              <span className="text-[11px] text-app-faint transition-opacity duration-300 group-hover/card:opacity-0">
                {new Date(item.createdAt).toLocaleDateString()}
              </span>
              <span className="absolute right-0 top-0 flex items-center gap-0.5 text-[11px] font-semibold text-app-accent opacity-0 transition-opacity duration-300 group-hover/card:opacity-100">
                Open
                <ArrowUpRight size={14} aria-hidden />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ContentGrid({ items }: { items: ContentItem[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(288px,1fr))] gap-6">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="animate-fade-in motion-reduce:animate-none"
          style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
        >
          <ContentCard item={item} />
        </div>
      ))}
    </div>
  );
}
