import type { User, Role, Group, SystemMetric, ActivityLog, SystemSettings } from '../types/admin';

// ─── Mock Users ───────────────────────────────────────────────────────────────

export const mockUsers: User[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    avatar: '',
    role: 'super_admin',
    status: 'active',
    groups: ['Engineering', 'Leadership'],
    lastActive: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    avatar: '',
    role: 'admin',
    status: 'active',
    groups: ['Engineering'],
    lastActive: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    name: 'Carol Williams',
    email: 'carol@example.com',
    avatar: '',
    role: 'moderator',
    status: 'active',
    groups: ['Support', 'Content'],
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    name: 'David Brown',
    email: 'david@example.com',
    avatar: '',
    role: 'editor',
    status: 'inactive',
    groups: ['Content'],
    lastActive: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    name: 'Eve Davis',
    email: 'eve@example.com',
    avatar: '',
    role: 'viewer',
    status: 'suspended',
    groups: ['Marketing'],
    lastActive: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    name: 'Frank Miller',
    email: 'frank@example.com',
    avatar: '',
    role: 'editor',
    status: 'pending',
    groups: ['Engineering', 'QA'],
    lastActive: new Date(Date.now() - 1 * 60 * 1000).toISOString(), // 1 min ago
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '7',
    name: 'Grace Wilson',
    email: 'grace@example.com',
    avatar: '',
    role: 'admin',
    status: 'active',
    groups: ['Leadership', 'HR'],
    lastActive: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '8',
    name: 'Henry Taylor',
    email: 'henry@example.com',
    avatar: '',
    role: 'moderator',
    status: 'active',
    groups: ['Support'],
    lastActive: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Mock Roles ───────────────────────────────────────────────────────────────

export const mockRoles: Role[] = [
  {
    id: '1',
    name: 'Super Admin',
    description: 'Full system access with all permissions',
    permissions: [
      { id: '1', resource: 'users', action: 'manage' },
      { id: '2', resource: 'roles', action: 'manage' },
      { id: '3', resource: 'content', action: 'manage' },
      { id: '4', resource: 'settings', action: 'manage' },
      { id: '5', resource: 'analytics', action: 'read' },
    ],
    userCount: 2,
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    name: 'Admin',
    description: 'Manage users and content, limited system settings',
    permissions: [
      { id: '6', resource: 'users', action: 'manage' },
      { id: '7', resource: 'content', action: 'manage' },
      { id: '8', resource: 'analytics', action: 'read' },
    ],
    userCount: 5,
    createdAt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    name: 'Moderator',
    description: 'Review and approve content, handle reports',
    permissions: [
      { id: '9', resource: 'content', action: 'read' },
      { id: '10', resource: 'content', action: 'update' },
      { id: '11', resource: 'reports', action: 'manage' },
    ],
    userCount: 8,
    createdAt: new Date(Date.now() - 250 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    name: 'Editor',
    description: 'Create and edit content',
    permissions: [
      { id: '12', resource: 'content', action: 'create' },
      { id: '13', resource: 'content', action: 'read' },
      { id: '14', resource: 'content', action: 'update' },
    ],
    userCount: 15,
    createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    name: 'Viewer',
    description: 'Read-only access to content',
    permissions: [
      { id: '15', resource: 'content', action: 'read' },
    ],
    userCount: 50,
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Mock Groups ──────────────────────────────────────────────────────────────

export const mockGroups: Group[] = [
  {
    id: '1',
    name: 'Engineering',
    description: 'Software development and infrastructure team',
    members: ['1', '2', '6'],
    roles: ['admin', 'editor'],
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    name: 'Content',
    description: 'Content creation and management team',
    members: ['3', '4'],
    roles: ['moderator', 'editor'],
    createdAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    name: 'Support',
    description: 'Customer support and community management',
    members: ['3', '8'],
    roles: ['moderator'],
    createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    name: 'Leadership',
    description: 'Executive and management team',
    members: ['1', '7'],
    roles: ['super_admin', 'admin'],
    createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    name: 'Marketing',
    description: 'Marketing and communications team',
    members: ['5'],
    roles: ['viewer'],
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    name: 'QA',
    description: 'Quality assurance and testing team',
    members: ['6'],
    roles: ['editor'],
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '7',
    name: 'HR',
    description: 'Human resources team',
    members: ['7'],
    roles: ['admin'],
    createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Mock Metrics ─────────────────────────────────────────────────────────────

export const mockMetrics: SystemMetric[] = [
  { label: 'CPU Usage', value: 42, unit: '%', trend: 'up', changePercent: 5.2 },
  { label: 'Memory Usage', value: 68, unit: '%', trend: 'stable', changePercent: 0.3 },
  { label: 'Active Sessions', value: 234, trend: 'up', changePercent: 12.5 },
  { label: 'API Response Time', value: 145, unit: 'ms', trend: 'down', changePercent: -8.3 },
  { label: 'Error Rate', value: 0.12, unit: '%', trend: 'down', changePercent: -15.2 },
  { label: 'Requests/min', value: 1847, trend: 'up', changePercent: 22.1 },
];

// ─── Mock Activity Logs ───────────────────────────────────────────────────────

export const mockActivityLogs: ActivityLog[] = [
  {
    id: '1',
    userId: '1',
    userName: 'Alice Johnson',
    action: 'user.create',
    resource: 'User: frank@example.com',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    ipAddress: '192.168.1.100',
    status: 'success',
  },
  {
    id: '2',
    userId: '2',
    userName: 'Bob Smith',
    action: 'content.update',
    resource: 'Article: Q4 Report',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    ipAddress: '192.168.1.101',
    status: 'success',
  },
  {
    id: '3',
    userId: '3',
    userName: 'Carol Williams',
    action: 'user.suspend',
    resource: 'User: eve@example.com',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    ipAddress: '192.168.1.102',
    status: 'success',
  },
  {
    id: '4',
    userId: '5',
    userName: 'Eve Davis',
    action: 'login',
    resource: 'Auth',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    ipAddress: '192.168.1.105',
    status: 'failure',
  },
  {
    id: '5',
    userId: '7',
    userName: 'Grace Wilson',
    action: 'settings.update',
    resource: 'Settings: security',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    ipAddress: '192.168.1.107',
    status: 'success',
  },
  {
    id: '6',
    userId: '1',
    userName: 'Alice Johnson',
    action: 'role.create',
    resource: 'Role: Contractor',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    ipAddress: '192.168.1.100',
    status: 'success',
  },
  {
    id: '7',
    userId: '8',
    userName: 'Henry Taylor',
    action: 'content.delete',
    resource: 'Article: Draft v2',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    ipAddress: '192.168.1.108',
    status: 'success',
  },
  {
    id: '8',
    userId: '4',
    userName: 'David Brown',
    action: 'login',
    resource: 'Auth',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    ipAddress: '192.168.1.104',
    status: 'failure',
  },
];

// ─── Mock Settings ────────────────────────────────────────────────────────────

export const mockSettings: SystemSettings = {
  general: {
    appName: 'Centralized Comms Lib',
    supportEmail: 'support@example.com',
    maintenanceMode: false,
    allowRegistration: true,
    maxUsersPerGroup: 50,
  },
  security: {
    mfaRequired: false,
    sessionTimeoutMinutes: 60,
    passwordMinLength: 8,
    passwordRequireSpecialChars: true,
    maxLoginAttempts: 5,
  },
  notifications: {
    emailNotifications: true,
    slackWebhookUrl: 'https://hooks.slack.com/services/XXX/YYY/ZZZ',
    alertOnFailedLogin: true,
    digestFrequency: 'daily',
  },
  storage: {
    maxFileSizeMb: 25,
    allowedFileTypes: ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx', 'xlsx'],
    storageProvider: 's3',
  },
};
