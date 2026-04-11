import { Link } from "react-router-dom";
import { ArrowUpRight, FileText, Video, Mic, File } from "lucide-react";
import type { ContentItem } from "../../data/mockLibraryData";

const typeIcons = {
  article: FileText,
  video: Video,
  podcast: Mic,
  document: File,
};

const typeColors = {
  article: "#8b5cf6",
  video: "#06b6d4",
  podcast: "#f59e0b",
  document: "#10b981",
};

const statusColors = {
  draft: "#6b7280",
  review: "#fbbf24",
  published: "#10b981",
};

interface ContentCardProps {
  item: ContentItem;
}

export function ContentCard({ item }: ContentCardProps) {
  const TypeIcon = typeIcons[item.type];
  const c = typeColors[item.type];

  return (
    <Link
      to={`/library/${item.id}`}
      className="group/card relative block overflow-hidden rounded-app-xl border border-app-border/90 bg-app-surface/50 shadow-app-soft outline-none backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-app-accent/35 hover:shadow-app-glow focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
    >
      <div
        className="app-shimmer-hover pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
        aria-hidden
      />
      <div className="relative h-[148px] overflow-hidden">
        <div
          className="absolute inset-0 transition-transform duration-500 group-hover/card:scale-105"
          style={{
            background: `radial-gradient(ellipse 80% 80% at 30% 20%, ${c}35, transparent 55%), linear-gradient(145deg, ${c}22 0%, rgba(0,0,0,0.15) 100%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-app-bg/90 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-app-md bg-app-bg/40 ring-1 ring-white/10 backdrop-blur-sm transition-transform duration-300 group-hover/card:scale-110"
            style={{ color: c }}
          >
            <TypeIcon size={26} strokeWidth={1.75} />
          </div>
          <span className="rounded-full bg-app-bg/50 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-app-muted ring-1 ring-white/10 backdrop-blur-sm">
            {item.type}
          </span>
        </div>
      </div>

      <div className="relative p-4 pt-3">
        <span
          className="inline-block text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: statusColors[item.status] }}
        >
          {item.status}
        </span>
        <h3 className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-app-text">
          {item.title}
        </h3>
        <p className="mt-1 text-xs text-app-faint">by {item.author}</p>

        <div className="mb-3 mt-2.5 flex flex-wrap gap-1.5">
          {item.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-app-bg/50 px-2 py-0.5 text-[10px] text-app-muted ring-1 ring-app-border/60"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-app-border/70 pt-3">
          <span className="text-[11px] text-app-faint">
            {item.type === "video" || item.type === "article"
              ? `${item.views.toLocaleString()} views`
              : "New"}
          </span>
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
    </Link>
  );
}

export function ContentGrid({ items }: { items: ContentItem[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(288px,1fr))] gap-6">
      {items.map((item) => (
        <ContentCard key={item.id} item={item} />
      ))}
    </div>
  );
}
