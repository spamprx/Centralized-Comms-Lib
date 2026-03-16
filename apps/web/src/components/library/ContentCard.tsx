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
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      overflow: 'hidden',
      transition: 'all 0.2s',
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
    }}
    >
      {/* Thumbnail */}
      <div style={{
        height: 140,
        background: `linear-gradient(135deg, ${typeColors[item.type]}22, ${typeColors[item.type]}11)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <TypeIcon size={48} style={{ color: typeColors[item.type], opacity: 0.8 }} />
      </div>

      {/* Content */}
      <div style={{ padding: 16 }}>
        {/* Status badge */}
        <span style={{
          fontSize: 10,
          padding: '3px 8px',
          borderRadius: 12,
          background: `${statusColors[item.status]}22`,
          color: statusColors[item.status],
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>{item.status}</span>

        {/* Title */}
        <h3 style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#e2e4f0',
          margin: '8px 0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>{item.title}</h3>

        {/* Author */}
        <p style={{ fontSize: 12, color: '#555870', margin: '0 0 12px' }}>by {item.author}</p>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {item.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 10,
              padding: '2px 6px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 4,
              color: '#8b8fa8',
            }}>{tag}</span>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 11, color: '#555870' }}>
            {item.type === 'video' || item.type === 'article' ? `${item.views.toLocaleString()} views` : 'New'}
          </span>
          <span style={{ fontSize: 11, color: '#555870' }}>
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ContentGrid({ items }: { items: ContentItem[] }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 20,
    }}>
      {items.map(item => <ContentCard key={item.id} item={item} />)}
    </div>
  );
}
