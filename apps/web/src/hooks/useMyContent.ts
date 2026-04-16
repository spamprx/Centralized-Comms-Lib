import { useState, useEffect, useCallback } from 'react';
import type { MyContentItem, ContentStats } from '../data/mockMyContentData';
import { contentService, type Content, type LifecycleState } from '../services/contentService';
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

function mapContentType(ct: Content['contentType']): MyContentItem['type'] {
  switch (ct) {
    case 'ARTICLE':
      return 'article';
    case 'VIDEO':
      return 'video';
    case 'PODCAST':
      return 'podcast';
    case 'DOCUMENT':
    default:
      return 'document';
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

  const fetchContent = useCallback(async () => {
    if (!user?.id) {
      setContentItems([]);
      setStats(buildStats([]));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const contents = await contentService.listWorkspace();

      const mapped: MyContentItem[] = await Promise.all(
        contents.map(async (c) => {
          let status = mapLifecycleToStatus(c.lifecycleState);

          if (status === 'published') {
            try {
              const { reviewService } = await import('../services/reviewService');
              const requests = await reviewService.listForContent(c.id);
              if (requests.some((req) => req.status === 'OPEN')) {
                status = 'in_review';
              }
            } catch {
              /* keep status */
            }
          }

          return {
            id: c.id,
            title: c.title,
            type: mapContentType(c.contentType),
            status,
            views: c.viewsCount ?? 0,
            lastModified: c.updatedAt,
            createdAt: c.createdAt,
            collaborators: c.acceptedCoAuthorCount ?? 0,
            workspaceRole: c.workspaceRole,
            primaryAuthor: c.author ?? null,
          };
        }),
      );

      setContentItems(mapped);
      setStats(buildStats(mapped));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchContent();
  }, [fetchContent]);

  const filteredItems = contentItems.filter((item) => {
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
    refreshContent: fetchContent,
  };
}
