import { useState } from 'react';
import { Save, Globe, Lock, Bell, HardDrive } from 'lucide-react';
import { useAdminSettings } from '../../hooks/useAdmin';
import type { SystemSettings } from '../../types/admin';

type Section = keyof SystemSettings;

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'general',       label: 'General',      icon: Globe      },
  { id: 'security',      label: 'Security',      icon: Lock       },
  { id: 'notifications', label: 'Notifications', icon: Bell       },
  { id: 'storage',       label: 'Storage',       icon: HardDrive  },
];

export default function SystemSettingsTab() {
  const { settings, loading, saving, updateSection } = useAdminSettings();
  const [activeSection, setActiveSection] = useState<Section>('general');
  const [localChanges, setLocalChanges] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await updateSection(activeSection, localChanges as any);
    setLocalChanges({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const patch = (key: string, value: unknown) => setLocalChanges(prev => ({ ...prev, [key]: value }));
  const current = settings ? { ...settings[activeSection], ...localChanges } : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#e2e4f0] mb-1">System Settings</h2>
          <p className="text-[13px] text-[#555870] m-0">Configure application-wide preferences</p>
        </div>
        <button
          className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-lg text-[13px] cursor-pointer transition-all duration-200 ${
            saved
              ? 'bg-emerald-400/15 border-emerald-400/30 text-emerald-400'
              : 'bg-violet-400/15 border-violet-400/30 text-violet-400'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={handleSave}
          disabled={saving || Object.keys(localChanges).length === 0}
        >
          <Save size={13} />{saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
        </button>
      </div>

      <div className="flex gap-4 items-start">
        <nav className="flex flex-col gap-0.5 min-w-[160px] p-1 bg-white/[0.03] rounded-lg border border-white/[0.06]">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`flex items-center gap-2 px-3 py-2.5 border-none rounded-md text-[13px] cursor-pointer ${
                activeSection === id
                  ? 'bg-violet-400/10 text-violet-400'
                  : 'bg-transparent text-[#8b8fa8] hover:bg-white/5 hover:text-[#c4c7d9]'
              }`}
              onClick={() => { setActiveSection(id); setLocalChanges({}); }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
        <div className="flex-1 p-5 bg-white/[0.02] border border-white/[0.06] rounded-[10px]">
          {loading || !current ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[52px] bg-white/[0.04] rounded-lg animate-pulse" />)}
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

function Field({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <div className={`flex gap-1.5 ${inline ? 'flex-row items-center justify-between' : 'flex-col'}`}>
      <label className="text-[13px] font-medium text-[#c4c7d9]">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      className={`relative w-10 h-[22px] rounded-[11px] border-none cursor-pointer shrink-0 transition-colors duration-200 ${
        checked ? 'bg-violet-400' : 'bg-white/10'
      }`}
      onClick={() => onChange(!checked)}
    >
      <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
        checked ? 'translate-x-[18px]' : ''
      }`} />
    </button>
  );
}

const inputClass = "px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] outline-none transition-colors duration-150 focus:border-violet-400/50";
const inputSmClass = `${inputClass} w-[120px]`;

function GeneralSection({ data, patch }: { data: SystemSettings['general']; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Application Name"><input className={inputClass} value={data.appName} onChange={e => patch('appName', e.target.value)} /></Field>
      <Field label="Support Email"><input className={inputClass} type="email" value={data.supportEmail} onChange={e => patch('supportEmail', e.target.value)} /></Field>
      <Field label="Max Users per Group"><input className={inputSmClass} type="number" value={data.maxUsersPerGroup} onChange={e => patch('maxUsersPerGroup', +e.target.value)} /></Field>
      <Field label="Maintenance Mode" inline><Toggle checked={data.maintenanceMode} onChange={v => patch('maintenanceMode', v)} /></Field>
      <Field label="Allow Public Registration" inline><Toggle checked={data.allowRegistration} onChange={v => patch('allowRegistration', v)} /></Field>
    </div>
  );
}

function SecuritySection({ data, patch }: { data: SystemSettings['security']; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Require MFA" inline><Toggle checked={data.mfaRequired} onChange={v => patch('mfaRequired', v)} /></Field>
      <Field label="Session Timeout (minutes)"><input className={inputSmClass} type="number" value={data.sessionTimeoutMinutes} onChange={e => patch('sessionTimeoutMinutes', +e.target.value)} /></Field>
      <Field label="Minimum Password Length"><input className={inputSmClass} type="number" value={data.passwordMinLength} onChange={e => patch('passwordMinLength', +e.target.value)} /></Field>
      <Field label="Require Special Characters" inline><Toggle checked={data.passwordRequireSpecialChars} onChange={v => patch('passwordRequireSpecialChars', v)} /></Field>
      <Field label="Max Login Attempts"><input className={inputSmClass} type="number" value={data.maxLoginAttempts} onChange={e => patch('maxLoginAttempts', +e.target.value)} /></Field>
    </div>
  );
}

function NotificationsSection({ data, patch }: { data: SystemSettings['notifications']; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Email Notifications" inline><Toggle checked={data.emailNotifications} onChange={v => patch('emailNotifications', v)} /></Field>
      <Field label="Slack Webhook URL"><input className={inputClass} value={data.slackWebhookUrl} onChange={e => patch('slackWebhookUrl', e.target.value)} placeholder="https://hooks.slack.com/…" /></Field>
      <Field label="Alert on Failed Login" inline><Toggle checked={data.alertOnFailedLogin} onChange={v => patch('alertOnFailedLogin', v)} /></Field>
      <Field label="Digest Frequency">
        <select className={inputClass} value={data.digestFrequency} onChange={e => patch('digestFrequency', e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="never">Never</option>
        </select>
      </Field>
    </div>
  );
}

function StorageSection({ data, patch }: { data: SystemSettings['storage']; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Storage Provider">
        <select className={inputClass} value={data.storageProvider} onChange={e => patch('storageProvider', e.target.value)}>
          <option value="local">Local</option>
          <option value="s3">Amazon S3</option>
          <option value="gcs">Google Cloud Storage</option>
        </select>
      </Field>
      <Field label="Max File Size (MB)"><input className={inputSmClass} type="number" value={data.maxFileSizeMb} onChange={e => patch('maxFileSizeMb', +e.target.value)} /></Field>
      <Field label="Allowed File Types"><input className={inputClass} value={data.allowedFileTypes.join(', ')} onChange={e => patch('allowedFileTypes', e.target.value.split(',').map(s => s.trim()))} placeholder="pdf, jpg, png…" /></Field>
    </div>
  );
}