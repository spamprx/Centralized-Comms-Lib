import { Search } from 'lucide-react';

interface SearchAndFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  selectedTag: string;
  onTagChange: (value: string) => void;
  tags: { id: string; name: string }[];
}

export function SearchAndFilterBar({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedTag,
  onTagChange,
  tags,
}: SearchAndFilterBarProps) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{
        flex: 1,
        minWidth: 250,
        position: 'relative',
      }}>
        <Search size={16} style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#555870',
        }} />
        <input
          type="text"
          placeholder="Search by title or author..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px 10px 40px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: '#e2e4f0',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>
      <select
        value={selectedType}
        onChange={(e) => onTypeChange(e.target.value)}
        style={{
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          color: '#e2e4f0',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <option value="all">All Types</option>
        <option value="article">Articles</option>
        <option value="video">Videos</option>
        <option value="podcast">Podcasts</option>
        <option value="document">Documents</option>
      </select>
      <select
        value={selectedTag}
        onChange={(e) => onTagChange(e.target.value)}
        style={{
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          color: '#e2e4f0',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <option value="all">All Tags</option>
        {tags.map(tag => (
          <option key={tag.id} value={tag.name}>{tag.name}</option>
        ))}
      </select>
    </div>
  );
}
