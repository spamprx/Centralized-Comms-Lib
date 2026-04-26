export type UserRole = 'super_admin' | 'admin' | 'moderator' | 'editor' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  /** Whether the account can sign in (`User.isActive` in the API). */
  isActive: boolean;
  /** Group membership ids from the API */
  groups: string[];
  lastActive: string;
  /** Client heartbeat timestamp when the user has the app open (`User.presencePingAt`). */
  presencePingAt: string | null;
  createdAt: string;
  /** First role assignment id (for counts / admin sync) */
  primaryRoleId?: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  userCount: number;
  createdAt: string;
  /** From API — built-in roles may not be deleted */
  isSystem?: boolean;
}

export interface Permission {
  id: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}

export interface Group {
  id: string;
  name: string;
  description: string;
  members: string[];
  roles: string[];
  createdAt: string;
}

export interface SystemMetric {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  changePercent?: number;
  details?: Record<string, unknown>;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: string;
  ipAddress: string;
  userAgent?: string;
  oldValue?: unknown | null;
  newValue?: unknown | null;
  severity: 'info' | 'warning' | 'error' | 'success';
  status: 'success' | 'failure';
}

export interface SystemSettings {
  general: {
    appName: string;
    supportEmail: string;
    maintenanceMode: boolean;
    allowRegistration: boolean;
    maxUsersPerGroup: number;
  };
  security: {
    mfaRequired: boolean;
    sessionTimeoutMinutes: number;
    passwordMinLength: number;
    passwordRequireSpecialChars: boolean;
    maxLoginAttempts: number;
  };
  notifications: {
    emailNotifications: boolean;
    slackWebhookUrl: string;
    alertOnFailedLogin: boolean;
    digestFrequency: 'daily' | 'weekly' | 'never';
  };
  storage: {
    maxFileSizeMb: number;
    allowedFileTypes: string[];
    storageProvider: 'local' | 's3' | 'gcs';
  };
}

export interface UserFilters {
  search: string;
  role: UserRole | 'all';
  group: string | 'all';
  /** Filter by `User.isActive` (admin). Omitted or `'all'` shows everyone. */
  accountStatus?: 'all' | 'active' | 'inactive';
  sortBy: 'name' | 'email' | 'role' | 'lastActive' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  pagination?: PaginationParams;
}
