import { useState } from 'react';
import { Save, Globe, Lock, Bell, HardDrive, RotateCcw } from 'lucide-react';
import { useAdminSettings } from '../../hooks/useAdmin';
import type { SystemSettings } from '../../types/admin';

type Section = keyof SystemSettings;

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'storage', label: 'Storage', icon: HardDrive },
];

export default function SystemSettingsTab() {
  const { settings, loading, saving, updateSection } = useAdminSettings();
  const [activeSection, setActiveSection] = useState<Section>('general');
  const [localChanges, setLocalChanges] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState(false);

  const isDirty = Object.keys(localChanges).length > 0;

  const handleSave = async () => {
    await updateSection(activeSection, localChanges as any);
    setLocalChanges({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDiscard = () => {
    setLocalChanges({});
  };

  const patch = (key: string, value: unknown) =>
    setLocalChanges((prev) => ({ ...prev, [key]: value }));
  const current = settings ? { ...settings[activeSection], ...localChanges } : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="mb-1 text-lg font-semibold tracking-tight text-app-text">
            System Settings
          </h2>
          <p className="m-0 text-[13px] text-app-muted">Configure application-wide preferences</p>
        </div>
        <button
          type="button"
          className={`admin-glass-button inline-flex items-center gap-2 rounded-app-lg px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
            saved
              ? '!border-emerald-400/35 !bg-emerald-500/15 text-emerald-300'
              : 'border-app-accent/25 bg-app-accent-muted/35 text-app-accent'
          } disabled:cursor-not-allowed disabled:opacity-40`}
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          <Save size={13} />
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
        </button>
      </div>

      {/* Unsaved changes bar */}
      {isDirty && (
        <div className="admin-unsaved-bar">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          <span className="text-[13px] text-amber-300/90 flex-1">You have unsaved changes</span>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded-app-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[12px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/15"
            onClick={handleDiscard}
          >
            <RotateCcw size={11} /> Discard
          </button>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded-app-md border border-app-accent/35 bg-app-accent-muted px-2.5 py-1.5 text-[12px] font-semibold text-app-accent transition-colors hover:bg-app-accent/20"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={11} /> Save
          </button>
        </div>
      )}

      <div className="flex flex-col items-start gap-5 md:flex-row">
        {/* Vertical icon tab rail */}
        <nav className="admin-glass flex shrink-0 flex-row gap-1 rounded-app-xl p-1.5 ring-1 ring-white/[0.05] md:flex-col">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                className={`group/tab relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-app-md border border-transparent transition-all duration-200 ${
                  isActive
                    ? 'border-app-accent/25 bg-app-accent-muted text-app-accent shadow-[0_0_20px_-8px_rgba(147,124,248,0.45)]'
                    : 'border-transparent bg-transparent text-app-faint hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-app-muted'
                }`}
                onClick={() => {
                  setActiveSection(id);
                  setLocalChanges({});
                }}
                title={label}
              >
                <Icon size={18} />
                {/* Glowing underline for active */}
                {isActive && (
                  <div
                    className="absolute bottom-0.5 left-2 right-2 h-[2px] rounded-full bg-app-accent"
                    style={{ boxShadow: '0 0 6px rgba(147, 124, 248, 0.4)' }}
                  />
                )}
                {/* Tooltip */}
                <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-app-elevated text-app-text text-[11px] font-medium whitespace-nowrap opacity-0 pointer-events-none translate-x-1 group-hover/tab:opacity-100 group-hover/tab:translate-x-0 transition-all duration-150 z-10 shadow-app-soft">
                  {label}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="admin-glass relative min-w-0 flex-1 overflow-hidden rounded-app-xl p-5 ring-1 ring-white/[0.05] sm:p-6 md:flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
          {/* Section label */}
          <div className="relative mb-5 text-[10px] font-bold uppercase tracking-[0.14em] text-app-faint">
            {SECTIONS.find((s) => s.id === activeSection)?.label}
          </div>

          {loading || !current ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="app-skeleton-shimmer h-14 rounded-app-lg border border-white/[0.06]"
                />
              ))}
            </div>
          ) : (
            <>
              {activeSection === 'general' && (
                <GeneralSection data={current as SystemSettings['general']} patch={patch} />
              )}
              {activeSection === 'security' && (
                <SecuritySection data={current as SystemSettings['security']} patch={patch} />
              )}
              {activeSection === 'notifications' && (
                <NotificationsSection
                  data={current as SystemSettings['notifications']}
                  patch={patch}
                />
              )}
              {activeSection === 'storage' && (
                <StorageSection data={current as SystemSettings['storage']} patch={patch} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Floating Label Field ─────────────────────────────────────────────

function FloatField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="admin-float-field">
      {children}
      <label>{label}</label>
    </div>
  );
}

// ─── Inline Toggle Field ──────────────────────────────────────────────

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-b-0">
      <span className="text-[13px] font-medium text-app-muted">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        className="admin-toggle"
        onClick={() => onChange(!checked)}
      >
        <span className="admin-toggle-knob" />
      </button>
    </div>
  );
}

// ─── Shared input classes ─────────────────────────────────────────────

const inputClass =
  'w-full rounded-app-lg border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none backdrop-blur-sm transition-[border-color,box-shadow] duration-200 placeholder-transparent focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/12';
const inputSmClass = `${inputClass} w-[140px]`;

// ─── Section Components ───────────────────────────────────────────────

function GeneralSection({
  data,
  patch,
}: {
  data: SystemSettings['general'];
  patch: (k: string, v: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <FloatField label="Application Name">
        <input
          className={inputClass}
          value={data.appName}
          onChange={(e) => patch('appName', e.target.value)}
          placeholder=" "
        />
      </FloatField>
      <FloatField label="Support Email">
        <input
          className={inputClass}
          type="email"
          value={data.supportEmail}
          onChange={(e) => patch('supportEmail', e.target.value)}
          placeholder=" "
        />
      </FloatField>
      <FloatField label="Max Users per Group">
        <input
          className={inputSmClass}
          type="number"
          value={data.maxUsersPerGroup}
          onChange={(e) => patch('maxUsersPerGroup', +e.target.value)}
          placeholder=" "
        />
      </FloatField>

      <div className="border-t border-white/[0.04] pt-3 mt-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-app-faint mb-2">
          Toggles
        </div>
        <ToggleField
          label="Maintenance Mode"
          checked={data.maintenanceMode}
          onChange={(v) => patch('maintenanceMode', v)}
        />
        <ToggleField
          label="Allow Public Registration"
          checked={data.allowRegistration}
          onChange={(v) => patch('allowRegistration', v)}
        />
      </div>
    </div>
  );
}

function SecuritySection({
  data,
  patch,
}: {
  data: SystemSettings['security'];
  patch: (k: string, v: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <ToggleField
        label="Require MFA"
        checked={data.mfaRequired}
        onChange={(v) => patch('mfaRequired', v)}
      />
      <FloatField label="Session Timeout (minutes)">
        <input
          className={inputSmClass}
          type="number"
          value={data.sessionTimeoutMinutes}
          onChange={(e) => patch('sessionTimeoutMinutes', +e.target.value)}
          placeholder=" "
        />
      </FloatField>
      <FloatField label="Minimum Password Length">
        <input
          className={inputSmClass}
          type="number"
          value={data.passwordMinLength}
          onChange={(e) => patch('passwordMinLength', +e.target.value)}
          placeholder=" "
        />
      </FloatField>
      <ToggleField
        label="Require Special Characters"
        checked={data.passwordRequireSpecialChars}
        onChange={(v) => patch('passwordRequireSpecialChars', v)}
      />
      <FloatField label="Max Login Attempts">
        <input
          className={inputSmClass}
          type="number"
          value={data.maxLoginAttempts}
          onChange={(e) => patch('maxLoginAttempts', +e.target.value)}
          placeholder=" "
        />
      </FloatField>
    </div>
  );
}

function NotificationsSection({
  data,
  patch,
}: {
  data: SystemSettings['notifications'];
  patch: (k: string, v: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <ToggleField
        label="Email Notifications"
        checked={data.emailNotifications}
        onChange={(v) => patch('emailNotifications', v)}
      />
      <FloatField label="Slack Webhook URL">
        <input
          className={inputClass}
          value={data.slackWebhookUrl}
          onChange={(e) => patch('slackWebhookUrl', e.target.value)}
          placeholder=" "
        />
      </FloatField>
      <ToggleField
        label="Alert on Failed Login"
        checked={data.alertOnFailedLogin}
        onChange={(v) => patch('alertOnFailedLogin', v)}
      />
      <FloatField label="Digest Frequency">
        <select
          className={inputClass}
          value={data.digestFrequency}
          onChange={(e) => patch('digestFrequency', e.target.value)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="never">Never</option>
        </select>
      </FloatField>
    </div>
  );
}

function StorageSection({
  data,
  patch,
}: {
  data: SystemSettings['storage'];
  patch: (k: string, v: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <FloatField label="Storage Provider">
        <select
          className={inputClass}
          value={data.storageProvider}
          onChange={(e) => patch('storageProvider', e.target.value)}
        >
          <option value="local">Local</option>
          <option value="s3">Amazon S3</option>
          <option value="gcs">Google Cloud Storage</option>
        </select>
      </FloatField>
      <FloatField label="Max File Size (MB)">
        <input
          className={inputSmClass}
          type="number"
          value={data.maxFileSizeMb}
          onChange={(e) => patch('maxFileSizeMb', +e.target.value)}
          placeholder=" "
        />
      </FloatField>
      <FloatField label="Allowed File Types">
        <input
          className={inputClass}
          value={data.allowedFileTypes.join(', ')}
          onChange={(e) =>
            patch(
              'allowedFileTypes',
              e.target.value.split(',').map((s) => s.trim()),
            )
          }
          placeholder=" "
        />
      </FloatField>
    </div>
  );
}
