/** Defaults + in-memory overrides for GET/PATCH /admin/settings (no DB table yet). */

export type AdminSettingsState = {
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
    digestFrequency: "daily" | "weekly" | "never";
  };
  storage: {
    maxFileSizeMb: number;
    allowedFileTypes: string[];
    storageProvider: "local" | "s3" | "gcs";
  };
  attribution: {
    enabled: boolean;
    template: string;
    disabledContentIds: string[];
  };
};

const defaults = (): AdminSettingsState => ({
  general: {
    appName: "Centralized Comms",
    supportEmail: "support@comms.local",
    maintenanceMode: false,
    allowRegistration: true,
    maxUsersPerGroup: 50,
  },
  security: {
    mfaRequired: false,
    sessionTimeoutMinutes: 480,
    passwordMinLength: 10,
    passwordRequireSpecialChars: true,
    maxLoginAttempts: 5,
  },
  notifications: {
    emailNotifications: true,
    slackWebhookUrl: "",
    alertOnFailedLogin: true,
    digestFrequency: "weekly",
  },
  storage: {
    maxFileSizeMb: 25,
    allowedFileTypes: ["pdf", "png", "jpg", "jpeg", "webp"],
    storageProvider: "local",
  },
  attribution: {
    enabled: true,
    template:
      "Shared from {appName}: \"{title}\" by {authorName}. Read the full article: {url}",
    disabledContentIds: [],
  },
});

let cache: AdminSettingsState | null = null;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function getSettingsSnapshot(): AdminSettingsState {
  return clone(cache ?? defaults());
}

export function mergeSettingsSection(
  section: keyof AdminSettingsState,
  patch: Partial<AdminSettingsState[keyof AdminSettingsState]>,
): AdminSettingsState {
  const base = getSettingsSnapshot();
  if (!(section in base)) {
    throw new Error(`Unknown settings section: ${String(section)}`);
  }
  const cur = base[section] as Record<string, unknown>;
  const next = { ...cur, ...(patch as Record<string, unknown>) };
  const merged = { ...base, [section]: next } as AdminSettingsState;
  cache = merged;
  return clone(merged);
}
