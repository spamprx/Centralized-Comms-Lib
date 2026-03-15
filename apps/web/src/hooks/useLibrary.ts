import { useState, useEffect } from 'react';
import { mockContentItems, mockTags } from '../data/mockLibraryData';
import type { ContentItem, Tag } from '../data/mockLibraryData';

const USE_MOCK_DATA = true;

export function useLibrary() {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        setContentItems(mockContentItems);
        setTags(mockTags);
        setLoading(false);
      }, 200);
    }
  }, []);

  const filteredItems = contentItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || item.type === selectedType;
    const matchesTag = selectedTag === 'all' || item.tags.includes(selectedTag);
    return matchesSearch && matchesType && matchesTag;
  });

  return {
    contentItems: filteredItems,
    tags,
    loading,
    searchQuery,
    setSearchQuery,
    selectedType,
    setSelectedType,
    selectedTag,
    setSelectedTag,
  };
}
