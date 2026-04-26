import { useState, useEffect } from 'react';
import type { StatCard, Activity, PendingItem, Notification } from '../data/mockDashboardData';
import { analyticsService } from '../services/analyticsService';
import { profileService, type ProfileActivityItem } from '../services/profileService';
import { reviewService, type ReviewAssignment } from '../services/reviewService';
import { contentService, type Content } from '../services/contentService';
import type { KPI, TopContentItem } from '../types/analytics';

function kpiIcon(label: string): StatCard['icon'] {
  const l = label.toLowerCase();
  if (l.includes('interaction') || l.includes('engagement')) return 'engagement';
  if (l.includes('user')) return 'users';
  if (l.includes('view')) return 'content';
  if (l.includes('published') || l.includes('content')) return 'content';
  return 'content';
}

function kpiToStatCard(kpi: KPI): StatCard {
  return {
    label: kpi.label,
    value: kpi.value,
    icon: kpiIcon(kpi.label),
  };
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.round(Math.abs(diffMs) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function mapActivityVerb(type: ProfileActivityItem['type']): string {
  switch (type) {
    case 'PUBLISHED':
      return 'published';
    case 'COMMENTED':
      return 'commented on';
    case 'CREATED':
      return 'created';
    default:
      return 'updated';
  }
}

function mapActivityRows(items: ProfileActivityItem[], actorLabel: string): Activity[] {
  return items.map((item) => ({
    id: item.id,
    user: actorLabel,
    action: mapActivityVerb(item.type),
    target: item.contentTitle,
    time: formatRelativeTime(item.timestamp),
  }));
}

function pendingTypeLabel(contentType: Content['contentType']): PendingItem['type'] {
  switch (contentType) {
    case 'ARTICLE':
      return 'Article';
    case 'VIDEO':
      return 'Video';
    case 'PODCAST':
      return 'Podcast';
    case 'DOCUMENT':
    default:
      return 'Document';
  }
}

function priorityFromAssignedAt(assignedAt: string): PendingItem['priority'] {
  const hours = (Date.now() - new Date(assignedAt).getTime()) / 3600000;
  if (hours >= 72) return 'high';
  if (hours >= 24) return 'medium';
  return 'low';
}

type RequestCacheEntry =
  | { kind: 'skip' }
  | {
      kind: 'ok';
      title: string;
      typeLabel: PendingItem['type'];
      submittedBy: string;
      submittedAt: string;
    };

async function buildPendingItems(assignments: ReviewAssignment[]): Promise<PendingItem[]> {
  const active = assignments.filter((a) => a.status === 'PENDING' || a.status === 'IN_PROGRESS');
  const cache = new Map<string, RequestCacheEntry>();

  const resolve = async (reviewRequestId: string): Promise<RequestCacheEntry> => {
    const cached = cache.get(reviewRequestId);
    if (cached) return cached;
    try {
      const req = await reviewService.getRequestById(reviewRequestId);
      if (req.status !== 'OPEN') {
        const skip: RequestCacheEntry = { kind: 'skip' };
        cache.set(reviewRequestId, skip);
        return skip;
      }
      const { content } = await contentService.getById(req.contentId);
      const entry: RequestCacheEntry = {
        kind: 'ok',
        title: content.title,
        typeLabel: pendingTypeLabel(content.contentType),
        submittedBy: content.author?.displayName ?? 'Unknown',
        submittedAt: req.createdAt,
      };
      cache.set(reviewRequestId, entry);
      return entry;
    } catch {
      const skip: RequestCacheEntry = { kind: 'skip' };
      cache.set(reviewRequestId, skip);
      return skip;
    }
  };

  const out: PendingItem[] = [];
  for (const a of active) {
    const meta = await resolve(a.reviewRequestId);
    if (meta.kind !== 'ok') continue;
    out.push({
      id: a.id,
      title: meta.title,
      type: meta.typeLabel,
      submittedBy: meta.submittedBy,
      submittedAt: meta.submittedAt,
      priority: priorityFromAssignedAt(a.assignedAt),
    });
  }
  return out.slice(0, 12);
}

function buildNotifications(pendingCount: number): Notification[] {
  if (pendingCount > 0) {
    return [
      {
        id: 'pending-reviews',
        title: 'Reviews waiting',
        message: `You have ${pendingCount} review assignment${pendingCount === 1 ? '' : 's'} to complete.`,
        type: 'warning',
        time: 'Now',
        read: false,
      },
    ];
  }
  return [
    {
      id: 'all-clear',
      title: "You're caught up",
      message: 'No pending review assignments.',
      type: 'success',
      time: 'Today',
      read: true,
    },
  ];
}

export function useDashboard() {
  const [statCards, setStatCards] = useState<StatCard[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [topContent, setTopContent] = useState<TopContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const [kpisRes, meRes, activityRes, assignmentsRes, topContentRes] = await Promise.allSettled([
          analyticsService.getKPIs('30d'),
          profileService.me(),
          profileService.listActivity(),
          reviewService.listMyAssignments(),
          analyticsService.getTopContent(5, '7d'),
        ]);

        if (cancelled) return;

        if (kpisRes.status === 'fulfilled') {
          setStatCards(kpisRes.value.map(kpiToStatCard));
        } else {
          setStatCards([]);
        }

        const actorLabel = meRes.status === 'fulfilled' ? meRes.value.displayName || 'You' : 'You';

        if (activityRes.status === 'fulfilled') {
          setRecentActivity(mapActivityRows(activityRes.value, actorLabel));
        } else {
          setRecentActivity([]);
        }

        let pending: PendingItem[] = [];
        if (assignmentsRes.status === 'fulfilled') {
          pending = await buildPendingItems(assignmentsRes.value);
        }
        if (!cancelled) {
          setPendingItems(pending);
          setNotifications(buildNotifications(pending.length));
        }

        if (!cancelled && topContentRes.status === 'fulfilled') {
          setTopContent(topContentRes.value);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    statCards,
    recentActivity,
    pendingItems,
    notifications,
    topContent,
    loading,
  };
}
