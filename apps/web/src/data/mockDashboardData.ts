// ─── Dashboard Mock Data ──────────────────────────────────────────────────────

export interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  avatar?: string;
}

export interface PendingItem {
  id: string;
  title: string;
  type: string;
  submittedBy: string;
  submittedAt: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  time: string;
  read: boolean;
}

// ─── Mock Stat Cards ──────────────────────────────────────────────────────────

export const mockStatCards: StatCard[] = [
  { label: 'Total Content', value: '1,247', icon: 'content' },
  { label: 'Pending Reviews', value: '23', icon: 'review' },
  { label: 'Active Users', value: '8,234', icon: 'users' },
  { label: 'Avg. Engagement', value: '68.3%', icon: 'engagement' },
];

// ─── Mock Recent Activity ─────────────────────────────────────────────────────

export const mockRecentActivity: Activity[] = [
  {
    id: '1',
    user: 'Alice Johnson',
    action: 'created',
    target: 'Q1 Marketing Plan',
    time: '2 min ago',
  },
  {
    id: '2',
    user: 'Bob Smith',
    action: 'reviewed',
    target: 'Product Demo Video',
    time: '15 min ago',
  },
  {
    id: '3',
    user: 'Carol Williams',
    action: 'published',
    target: 'Blog: Best Practices',
    time: '1 hour ago',
  },
  {
    id: '4',
    user: 'David Brown',
    action: 'uploaded',
    target: 'Company Logo.png',
    time: '2 hours ago',
  },
  {
    id: '5',
    user: 'Eve Davis',
    action: 'commented on',
    target: 'Training Module 3',
    time: '3 hours ago',
  },
];

// ─── Mock Pending Items ───────────────────────────────────────────────────────

export const mockPendingItems: PendingItem[] = [
  {
    id: '1',
    title: 'New Product Launch Article',
    type: 'Article',
    submittedBy: 'Alice Johnson',
    submittedAt: '2025-03-10',
    priority: 'high',
  },
  {
    id: '2',
    title: 'Customer Testimonial Video',
    type: 'Video',
    submittedBy: 'Bob Smith',
    submittedAt: '2025-03-09',
    priority: 'medium',
  },
  {
    id: '3',
    title: 'Q2 Strategy Deck',
    type: 'Document',
    submittedBy: 'Carol Williams',
    submittedAt: '2025-03-08',
    priority: 'high',
  },
  {
    id: '4',
    title: 'Social Media Graphics',
    type: 'Image',
    submittedBy: 'David Brown',
    submittedAt: '2025-03-07',
    priority: 'low',
  },
  {
    id: '5',
    title: 'Employee Handbook Update',
    type: 'Document',
    submittedBy: 'Eve Davis',
    submittedAt: '2025-03-06',
    priority: 'medium',
  },
];

// ─── Mock Notifications ───────────────────────────────────────────────────────

export const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'Review Required',
    message: '3 new items pending your review',
    type: 'warning',
    time: '5 min ago',
    read: false,
  },
  {
    id: '2',
    title: 'Content Published',
    message: '"Getting Started Guide" is now live',
    type: 'success',
    time: '1 hour ago',
    read: false,
  },
  {
    id: '3',
    title: 'System Update',
    message: 'Scheduled maintenance on March 15',
    type: 'info',
    time: '2 hours ago',
    read: true,
  },
  {
    id: '4',
    title: 'Upload Failed',
    message: 'Video file exceeded size limit',
    type: 'error',
    time: '3 hours ago',
    read: true,
  },
];
