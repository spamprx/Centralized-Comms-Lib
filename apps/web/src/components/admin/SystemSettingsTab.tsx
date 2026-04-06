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
    <div className="sst-wrapper">
      <div className="sst-header">
        <div>
          <h2 className="sst-title">System Settings</h2>
          <p className="sst-subtitle">Configure application-wide preferences</p>
        </div>
        <button className={`sst-save-btn ${saved ? 'sst-save-btn--saved' : ''}`} onClick={handleSave} disabled={saving || Object.keys(localChanges).length === 0}>
          <Save size={13} />{saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
        </button>
      </div>

      <div className="sst-layout">
        <nav className="sst-nav">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`sst-nav-item ${activeSection === id ? 'sst-nav-item--active' : ''}`} onClick={() => { setActiveSection(id); setLocalChanges({}); }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
        <div className="sst-content">
          {loading || !current ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height:52, background:'rgba(255,255,255,0.04)', borderRadius:8, animation:'pulse 1.5s infinite' }} />)}
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

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        .sst-wrapper { display:flex; flex-direction:column; gap:16px; }
        .sst-header { display:flex; align-items:flex-start; justify-content:space-between; }
        .sst-title { font-size:18px; font-weight:600; color:#e2e4f0; margin:0 0 4px; }
        .sst-subtitle { font-size:13px; color:#555870; margin:0; }
        .sst-save-btn { display:flex; align-items:center; gap:6px; padding:8px 14px; background:rgba(167,139,250,0.15); border:1px solid rgba(167,139,250,0.3); border-radius:8px; color:#a78bfa; font-size:13px; cursor:pointer; transition:all .2s; }
        .sst-save-btn:disabled { opacity:.4; cursor:not-allowed; }
        .sst-save-btn--saved { background:rgba(52,211,153,0.15); border-color:rgba(52,211,153,0.3); color:#34d399; }
        .sst-layout { display:flex; gap:16px; align-items:flex-start; }
        .sst-nav { display:flex; flex-direction:column; gap:2px; min-width:160px; padding:4px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.06); }
        .sst-nav-item { display:flex; align-items:center; gap:8px; padding:9px 12px; background:none; border:none; border-radius:6px; color:#8b8fa8; font-size:13px; cursor:pointer; }
        .sst-nav-item:hover { background:rgba(255,255,255,0.05); color:#c4c7d9; }
        .sst-nav-item--active { background:rgba(167,139,250,0.1); color:#a78bfa; }
        .sst-content { flex:1; padding:20px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:10px; }
        .sst-fields { display:flex; flex-direction:column; gap:16px; }
        .sst-field { display:flex; flex-direction:column; gap:6px; }
        .sst-field--inline { flex-direction:row; align-items:center; justify-content:space-between; }
        .sst-field__label { font-size:13px; font-weight:500; color:#c4c7d9; }
        .sst-input { padding:8px 12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#e2e4f0; font-size:13px; outline:none; transition:border .15s; }
        .sst-input:focus { border-color:rgba(167,139,250,0.5); }
        .sst-input--sm { width:120px; }
        .sst-toggle { position:relative; width:40px; height:22px; border-radius:11px; border:none; cursor:pointer; background:rgba(255,255,255,0.1); transition:background .2s; flex-shrink:0; }
        .sst-toggle--on { background:#a78bfa; }
        .sst-toggle__thumb { position:absolute; top:3px; left:3px; width:16px; height:16px; border-radius:50%; background:white; transition:transform .2s; }
        .sst-toggle--on .sst-toggle__thumb { transform:translateX(18px); }
      `}</style>
    </div>
  );
}

function Field({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <div className={`sst-field ${inline ? 'sst-field--inline' : ''}`}>
      <label className="sst-field__label">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} className={`sst-toggle ${checked ? 'sst-toggle--on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="sst-toggle__thumb" />
    </button>
  );
}

function GeneralSection({ data, patch }: { data: SystemSettings['general']; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="sst-fields">
      <Field label="Application Name"><input className="sst-input" value={data.appName} onChange={e => patch('appName', e.target.value)} /></Field>
      <Field label="Support Email"><input className="sst-input" type="email" value={data.supportEmail} onChange={e => patch('supportEmail', e.target.value)} /></Field>
      <Field label="Max Users per Group"><input className="sst-input sst-input--sm" type="number" value={data.maxUsersPerGroup} onChange={e => patch('maxUsersPerGroup', +e.target.value)} /></Field>
      <Field label="Maintenance Mode" inline><Toggle checked={data.maintenanceMode} onChange={v => patch('maintenanceMode', v)} /></Field>
      <Field label="Allow Public Registration" inline><Toggle checked={data.allowRegistration} onChange={v => patch('allowRegistration', v)} /></Field>
    </div>
  );
}

function SecuritySection({ data, patch }: { data: SystemSettings['security']; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="sst-fields">
      <Field label="Require MFA" inline><Toggle checked={data.mfaRequired} onChange={v => patch('mfaRequired', v)} /></Field>
      <Field label="Session Timeout (minutes)"><input className="sst-input sst-input--sm" type="number" value={data.sessionTimeoutMinutes} onChange={e => patch('sessionTimeoutMinutes', +e.target.value)} /></Field>
      <Field label="Minimum Password Length"><input className="sst-input sst-input--sm" type="number" value={data.passwordMinLength} onChange={e => patch('passwordMinLength', +e.target.value)} /></Field>
      <Field label="Require Special Characters" inline><Toggle checked={data.passwordRequireSpecialChars} onChange={v => patch('passwordRequireSpecialChars', v)} /></Field>
      <Field label="Max Login Attempts"><input className="sst-input sst-input--sm" type="number" value={data.maxLoginAttempts} onChange={e => patch('maxLoginAttempts', +e.target.value)} /></Field>
    </div>
  );
}

function NotificationsSection({ data, patch }: { data: SystemSettings['notifications']; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="sst-fields">
      <Field label="Email Notifications" inline><Toggle checked={data.emailNotifications} onChange={v => patch('emailNotifications', v)} /></Field>
      <Field label="Slack Webhook URL"><input className="sst-input" value={data.slackWebhookUrl} onChange={e => patch('slackWebhookUrl', e.target.value)} placeholder="https://hooks.slack.com/…" /></Field>
      <Field label="Alert on Failed Login" inline><Toggle checked={data.alertOnFailedLogin} onChange={v => patch('alertOnFailedLogin', v)} /></Field>
      <Field label="Digest Frequency">
        <select className="sst-input" value={data.digestFrequency} onChange={e => patch('digestFrequency', e.target.value)}>
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
    <div className="sst-fields">
      <Field label="Storage Provider">
        <select className="sst-input" value={data.storageProvider} onChange={e => patch('storageProvider', e.target.value)}>
          <option value="local">Local</option>
          <option value="s3">Amazon S3</option>
          <option value="gcs">Google Cloud Storage</option>
        </select>
      </Field>
      <Field label="Max File Size (MB)"><input className="sst-input sst-input--sm" type="number" value={data.maxFileSizeMb} onChange={e => patch('maxFileSizeMb', +e.target.value)} /></Field>
      <Field label="Allowed File Types"><input className="sst-input" value={data.allowedFileTypes.join(', ')} onChange={e => patch('allowedFileTypes', e.target.value.split(',').map(s => s.trim()))} placeholder="pdf, jpg, png…" /></Field>
    </div>
  );
}