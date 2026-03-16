import { useState, useEffect } from 'react';
import { mockMyContent, mockContentStats } from '../data/mockMyContentData';
import type { MyContentItem, ContentStats } from '../data/mockMyContentData';

const USE_MOCK_DATA = true;

export function useMyContent() {
  const [contentItems, setContentItems] = useState<MyContentItem[]>([]);
  const [stats, setStats] = useState<ContentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        setContentItems(mockMyContent);
        setStats(mockContentStats);
        setLoading(false);
      }, 200);
    }
  }, []);

  const filteredItems = contentItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return {
    contentItems: filteredItems,
    stats,
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
  };
}
