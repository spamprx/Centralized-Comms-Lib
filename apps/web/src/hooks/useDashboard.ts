import { useState, useEffect } from 'react';
import {
  mockStatCards,
  mockQuickActions,
  mockRecentActivity,
  mockPendingItems,
  mockNotifications,
} from '../data/mockDashboardData';
import type {
  StatCard,
  QuickAction,
  Activity,
  PendingItem,
  Notification,
} from '../data/mockDashboardData';

const USE_MOCK_DATA = true;

export function useDashboard() {
  const [statCards, setStatCards] = useState<StatCard[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setStatCards(mockStatCards);
        setQuickActions(mockQuickActions);
        setRecentActivity(mockRecentActivity);
        setPendingItems(mockPendingItems);
        setNotifications(mockNotifications);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  return {
    statCards,
    quickActions,
    recentActivity,
    pendingItems,
    notifications,
    loading,
  };
}
