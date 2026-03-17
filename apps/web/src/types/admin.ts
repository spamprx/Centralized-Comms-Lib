export type UserRole = 'super_admin' | 'admin' | 'moderator' | 'editor' | 'viewer';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  groups: string[];
  lastActive: string;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  userCount: number;
  createdAt: string;
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
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  timestamp: string;
  ipAddress: string;
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
  status: UserStatus | 'all';
  group: string | 'all';
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