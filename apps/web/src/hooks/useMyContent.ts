import { useState, useEffect } from 'react';
import type { MyContentItem, ContentStats } from '../data/mockMyContentData';
import { contentService, type LifecycleState } from '../services/contentService';
import { useAuth } from '../context/AuthContext';

function mapLifecycleToStatus(state: LifecycleState): MyContentItem['status'] {
  switch (state) {
    case 'DRAFT':
      return 'draft';
    case 'IN_REVIEW':
      return 'in_review';
    case 'PUBLISHED':
      return 'published';
    case 'ARCHIVED':
      return 'archived';
  }
}

function buildStats(items: MyContentItem[]): ContentStats[] {
  const total = items.length;
  const published = items.filter((i) => i.status === 'published').length;
  const inReview = items.filter((i) => i.status === 'in_review').length;
  const totalViews = items.reduce((sum, i) => sum + (i.views ?? 0), 0);

  return [
    { label: 'Total Content', value: total, icon: 'content', color: '#8b5cf6' },
    { label: 'Published', value: published, icon: 'published', color: '#10b981' },
    { label: 'In Review', value: inReview, icon: 'review', color: '#f59e0b' },
    { label: 'Total Views', value: totalViews.toLocaleString(), icon: 'views', color: '#06b6d4' },
  ];
}

export function useMyContent() {
  const { user } = useAuth();
  const [contentItems, setContentItems] = useState<MyContentItem[]>([]);
  const [stats, setStats] = useState<ContentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        setLoading(true);
        const contents = await contentService.list(user?.id ? { authorId: user.id } : {});

        const mapped: MyContentItem[] = contents.map((c) => ({
          id: c.id,
          title: c.title,
          type: 'document',
          status: mapLifecycleToStatus(c.lifecycleState),
          views: 0,
          lastModified: c.updatedAt,
          createdAt: c.createdAt,
          collaborators: 0,
        }));

        if (!isMounted) return;
        setContentItems(mapped);
        setStats(buildStats(mapped));
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

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
