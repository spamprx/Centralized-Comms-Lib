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
    <div className="flex gap-3 flex-wrap items-center">
      <div className="flex-1 min-w-[250px] relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555870]" />
        <input
          type="text"
          placeholder="Search by title or author..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full py-2.5 pr-3 pl-10 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] outline-none"
        />
      </div>
      <select
        value={selectedType}
        onChange={(e) => onTypeChange(e.target.value)}
        className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] cursor-pointer"
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
        className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] cursor-pointer"
      >
        <option value="all">All Tags</option>
        {tags.map(tag => (
          <option key={tag.id} value={tag.name}>{tag.name}</option>
        ))}
      </select>
    </div>
  );
}
