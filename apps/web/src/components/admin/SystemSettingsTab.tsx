import { useState } from 'react';
import { Save, Globe, Lock, Bell, HardDrive, RotateCcw } from 'lucide-react';
import { useAdminSettings } from '../../hooks/useAdmin';
import type { SystemSettings } from '../../types/admin';

type Section = keyof SystemSettings;

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'general',       label: 'General',       icon: Globe      },
  { id: 'security',      label: 'Security',      icon: Lock       },
  { id: 'notifications', label: 'Notifications', icon: Bell       },
  { id: 'storage',       label: 'Storage',        icon: HardDrive  },
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

  const patch = (key: string, value: unknown) => setLocalChanges(prev => ({ ...prev, [key]: value }));
  const current = settings ? { ...settings[activeSection], ...localChanges } : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-app-text mb-1">System Settings</h2>
          <p className="text-[13px] text-app-faint m-0">Configure application-wide preferences</p>
        </div>
        <button
          className={`flex items-center gap-1.5 px-3.5 py-2 admin-glass-button rounded-xl text-[13px] font-medium transition-all duration-200 ${
            saved
              ? 'text-emerald-400 !border-emerald-400/30 !bg-emerald-400/10'
              : 'text-app-accent'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          <Save size={13} />{saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
        </button>
      </div>

      {/* Unsaved changes bar */}
      {isDirty && (
        <div className="admin-unsaved-bar">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          <span className="text-[13px] text-amber-300/90 flex-1">You have unsaved changes</span>
          <button
            className="flex items-center gap-1 px-2.5 py-1 bg-transparent border border-amber-400/20 rounded-lg text-amber-400 text-[12px] cursor-pointer hover:bg-amber-400/10"
            onClick={handleDiscard}
          >
            <RotateCcw size={11} /> Discard
          </button>
          <button
            className="flex items-center gap-1 px-2.5 py-1 bg-app-accent-muted border border-app-accent/30 rounded-lg text-app-accent text-[12px] cursor-pointer hover:bg-app-accent/20"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={11} /> Save
          </button>
        </div>
      )}

      <div className="flex gap-5 items-start">
        {/* Vertical icon tab rail */}
        <nav className="flex flex-col gap-1 shrink-0">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                className={`relative flex items-center justify-center w-11 h-11 border-none rounded-xl cursor-pointer transition-all duration-200 group/tab ${
                  isActive
                    ? 'bg-app-accent-muted text-app-accent'
                    : 'bg-transparent text-app-faint hover:bg-app-surface-hover hover:text-app-muted'
                }`}
                onClick={() => { setActiveSection(id); setLocalChanges({}); }}
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
        <div className="flex-1 p-5 admin-glass rounded-xl" style={{ background: 'rgba(15, 20, 32, 0.5)' }}>
          {/* Section label */}
          <div className="text-[11px] font-semibold uppercase tracking-wider text-app-faint mb-4">
            {SECTIONS.find(s => s.id === activeSection)?.label}
          </div>

          {loading || !current ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[56px] rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />)}
            </div>
          ) : (
            <>
              {activeSection === 'general'       && <GeneralSection       data={current as SystemSettings['general']}       patch={patch} />}
              {activeSection === 'security'      && <SecuritySection      data={current as SystemSettings['security']}      patch={patch} />}
              {activeSection === 'notifications' && <NotificationsSection data={current as SystemSettings['notifications']} patch={patch} />}
              {activeSection === 'storage'       && <StorageSection       data={current as SystemSettings['storage']}       patch={patch} />}
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

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
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
  'w-full px-3 py-3 bg-app-surface border border-app-border rounded-xl text-app-text text-[13px] outline-none transition-all duration-200 focus:border-app-accent/40 focus:shadow-[0_0_0_3px_rgba(147,124,248,0.06)] placeholder-transparent';
const inputSmClass = `${inputClass} w-[140px]`;

// ─── Section Components ───────────────────────────────────────────────

function GeneralSection({ data, patch }: { data: SystemSettings['general']; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <FloatField label="Application Name">
        <input className={inputClass} value={data.appName} onChange={e => patch('appName', e.target.value)} placeholder=" " />
      </FloatField>
      <FloatField label="Support Email">
        <input className={inputClass} type="email" value={data.supportEmail} onChange={e => patch('supportEmail', e.target.value)} placeholder=" " />
      </FloatField>
      <FloatField label="Max Users per Group">
        <input className={inputSmClass} type="number" value={data.maxUsersPerGroup} onChange={e => patch('maxUsersPerGroup', +e.target.value)} placeholder=" " />
      </FloatField>

      <div className="border-t border-white/[0.04] pt-3 mt-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-app-faint mb-2">Toggles</div>
        <ToggleField label="Maintenance Mode" checked={data.maintenanceMode} onChange={v => patch('maintenanceMode', v)} />
        <ToggleField label="Allow Public Registration" checked={data.allowRegistration} onChange={v => patch('allowRegistration', v)} />
      </div>
    </div>
  );
}

function SecuritySection({ data, patch }: { data: SystemSettings['security']; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <ToggleField label="Require MFA" checked={data.mfaRequired} onChange={v => patch('mfaRequired', v)} />
      <FloatField label="Session Timeout (minutes)">
        <input className={inputSmClass} type="number" value={data.sessionTimeoutMinutes} onChange={e => patch('sessionTimeoutMinutes', +e.target.value)} placeholder=" " />
      </FloatField>
      <FloatField label="Minimum Password Length">
        <input className={inputSmClass} type="number" value={data.passwordMinLength} onChange={e => patch('passwordMinLength', +e.target.value)} placeholder=" " />
      </FloatField>
      <ToggleField label="Require Special Characters" checked={data.passwordRequireSpecialChars} onChange={v => patch('passwordRequireSpecialChars', v)} />
      <FloatField label="Max Login Attempts">
        <input className={inputSmClass} type="number" value={data.maxLoginAttempts} onChange={e => patch('maxLoginAttempts', +e.target.value)} placeholder=" " />
      </FloatField>
    </div>
  );
}

function NotificationsSection({ data, patch }: { data: SystemSettings['notifications']; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <ToggleField label="Email Notifications" checked={data.emailNotifications} onChange={v => patch('emailNotifications', v)} />
      <FloatField label="Slack Webhook URL">
        <input className={inputClass} value={data.slackWebhookUrl} onChange={e => patch('slackWebhookUrl', e.target.value)} placeholder=" " />
      </FloatField>
      <ToggleField label="Alert on Failed Login" checked={data.alertOnFailedLogin} onChange={v => patch('alertOnFailedLogin', v)} />
      <FloatField label="Digest Frequency">
        <select className={inputClass} value={data.digestFrequency} onChange={e => patch('digestFrequency', e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="never">Never</option>
        </select>
      </FloatField>
    </div>
  );
}

function StorageSection({ data, patch }: { data: SystemSettings['storage']; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <FloatField label="Storage Provider">
        <select className={inputClass} value={data.storageProvider} onChange={e => patch('storageProvider', e.target.value)}>
          <option value="local">Local</option>
          <option value="s3">Amazon S3</option>
          <option value="gcs">Google Cloud Storage</option>
        </select>
      </FloatField>
      <FloatField label="Max File Size (MB)">
        <input className={inputSmClass} type="number" value={data.maxFileSizeMb} onChange={e => patch('maxFileSizeMb', +e.target.value)} placeholder=" " />
      </FloatField>
      <FloatField label="Allowed File Types">
        <input className={inputClass} value={data.allowedFileTypes.join(', ')} onChange={e => patch('allowedFileTypes', e.target.value.split(',').map(s => s.trim()))} placeholder=" " />
      </FloatField>
    </div>
  );
}