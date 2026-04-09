import { FileText, Video, Mic, File } from 'lucide-react';
import type { ContentItem } from '../../data/mockLibraryData';

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

export function ContentCard({ item }: ContentCardProps) {
  const TypeIcon = typeIcons[item.type];

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-[10px] overflow-hidden transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:border-violet-500/30">
      {/* Thumbnail */}
      <div
        className="h-[140px] flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${typeColors[item.type]}22, ${typeColors[item.type]}11)` }}
      >
        <TypeIcon size={48} style={{ color: typeColors[item.type], opacity: 0.8 }} />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Status badge */}
        <span
          className="text-[10px] px-2 py-0.5 rounded-xl font-semibold uppercase"
          style={{ background: `${statusColors[item.status]}22`, color: statusColors[item.status] }}
        >{item.status}</span>

        {/* Title */}
        <h3 className="text-sm font-semibold text-[#e2e4f0] my-2 overflow-hidden text-ellipsis line-clamp-2">
          {item.title}
        </h3>

        {/* Author */}
        <p className="text-xs text-[#555870] mb-3">by {item.author}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {item.tags.map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-[#8b8fa8]">
              {tag}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="flex justify-between items-center pt-3 border-t border-white/5">
          <span className="text-[11px] text-[#555870]">
            {item.type === 'video' || item.type === 'article' ? `${item.views.toLocaleString()} views` : 'New'}
          </span>
          <span className="text-[11px] text-[#555870]">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ContentGrid({ items }: { items: ContentItem[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
      {items.map(item => <ContentCard key={item.id} item={item} />)}
    </div>
  );
}
