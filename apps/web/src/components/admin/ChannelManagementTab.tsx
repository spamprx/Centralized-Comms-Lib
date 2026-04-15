import { useEffect, useMemo, useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import { templateCrudService, type ChannelRecord } from '../../services/templateCrudService';

const FIELD_TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'heading1', label: 'Heading 1' },
  { id: 'heading2', label: 'Heading 2' },
  { id: 'paragraph', label: 'Paragraph' },
  { id: 'bold', label: 'Bold' },
  { id: 'italic', label: 'Italic' },
  { id: 'underline', label: 'Underline' },
  { id: 'bullet_list', label: 'Bullet list' },
  { id: 'ordered_list', label: 'Ordered list' },
  { id: 'link', label: 'Link' },
  { id: 'citation', label: 'Citation' },
  { id: 'image', label: 'Image' },
  { id: 'richText', label: 'Rich text block' },
  { id: 'media', label: 'Media block' },
  { id: 'field', label: 'Field block' },
];

type FormState = {
  name: string;
  key: string;
  description: string;
  priority: number;
  maxCharacters: string;
  supportsMedia: boolean;
  fieldTypes: string[];
};

const EMPTY_FORM: FormState = {
  name: '',
  key: '',
  description: '',
  priority: 0,
  maxCharacters: '',
  supportsMedia: true,
  fieldTypes: [],
};

function toForm(channel: ChannelRecord): FormState {
  const restrictions = channel.compatibility?.restrictions ?? {};
  const maxChars =
    typeof restrictions.maxCharacters === 'number' ? String(restrictions.maxCharacters) : '';
  return {
    name: channel.name,
    key: channel.key,
    description: channel.description ?? '',
    priority: channel.priority ?? 0,
    maxCharacters: maxChars,
    supportsMedia: restrictions.supportsMedia !== false,
    fieldTypes: Array.isArray(channel.compatibility?.fieldTypes)
      ? channel.compatibility.fieldTypes.map((x) => String(x))
      : [],
  };
}

export default function ChannelManagementTab() {
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChannelRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  async function loadChannels() {
    setLoading(true);
    setError(null);
    try {
      setChannels(await templateCrudService.listChannels());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChannels();
  }, []);

  const selectedCount = useMemo(() => form.fieldTypes.length, [form.fieldTypes.length]);

  function openEdit(ch: ChannelRecord) {
    setEditing(ch);
    setForm(toForm(ch));
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function toggleFieldType(id: string) {
    setForm((prev) => ({
      ...prev,
      fieldTypes: prev.fieldTypes.includes(id)
        ? prev.fieldTypes.filter((x) => x !== id)
        : [...prev.fieldTypes, id],
    }));
  }

  async function saveChannel() {
    if (!form.name.trim()) {
      setError('Channel name is required.');
      return;
    }
    if (form.fieldTypes.length < 1) {
      setError('Select at least one compatible field type.');
      return;
    }
    const maxCharacters = form.maxCharacters.trim();
    const parsedMaxCharsRaw = maxCharacters ? Number(maxCharacters) : null;
    if (
      maxCharacters &&
      (parsedMaxCharsRaw === null || !Number.isFinite(parsedMaxCharsRaw) || parsedMaxCharsRaw <= 0)
    ) {
      setError('Max characters must be a positive number.');
      return;
    }
    const parsedMaxChars = parsedMaxCharsRaw;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        key: form.key.trim() || undefined,
        description: form.description.trim() || null,
        priority: Number(form.priority) || 0,
        compatibility: {
          fieldTypes: form.fieldTypes,
          restrictions: {
            ...(parsedMaxChars !== null ? { maxCharacters: parsedMaxChars } : {}),
            supportsMedia: form.supportsMedia,
            supportsUnderline: form.fieldTypes.includes('underline'),
          },
        },
      };
      if (editing) {
        await templateCrudService.updateChannel(editing.id, payload);
      } else {
        throw new Error('Channel creation is disabled.');
      }
      await loadChannels();
      closeForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save channel');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-app-text">Channels</h2>
          <p className="m-0 text-[13px] text-app-faint">
            Admin-only channel compatibility and restrictions
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3">
        {loading ? (
          <div className="rounded-xl border border-app-border bg-app-bg-subtle px-4 py-8 text-center text-app-faint">
            Loading channels…
          </div>
        ) : channels.length < 1 ? (
          <div className="rounded-xl border border-dashed border-app-border px-4 py-8 text-center text-app-faint">
            No channels found.
          </div>
        ) : (
          channels.map((ch) => (
            <div key={ch.id} className="rounded-xl border border-app-border bg-app-bg-subtle p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="m-0 text-sm font-semibold text-app-text">{ch.name}</h3>
                    <span className="rounded border border-app-border px-1.5 py-0.5 font-mono text-[10px] text-app-faint">
                      {ch.key}
                    </span>
                    <span className="rounded border border-app-border px-1.5 py-0.5 text-[10px] text-app-faint">
                      Priority {ch.priority}
                    </span>
                  </div>
                  {ch.description ? (
                    <p className="mt-1 text-[12px] text-app-muted">{ch.description}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-app-faint">
                    Compatible field types:{' '}
                    {Array.isArray(ch.compatibility?.fieldTypes)
                      ? ch.compatibility.fieldTypes.join(', ')
                      : '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-app-faint">
                    Max chars: {String(ch.compatibility?.restrictions?.maxCharacters ?? 'none')} ·
                    Media: {ch.compatibility?.restrictions?.supportsMedia === false ? 'No' : 'Yes'}{' '}
                    · Underline:{' '}
                    {Array.isArray(ch.compatibility?.fieldTypes) &&
                    ch.compatibility.fieldTypes.includes('underline')
                      ? 'Yes'
                      : 'No'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(ch)}
                    className="rounded-lg border border-app-border p-2 text-app-muted hover:bg-app-surface-hover"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-app-border bg-app-bg-subtle p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="m-0 text-sm font-semibold text-app-text">
                {editing ? 'Edit channel' : 'Create channel'}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-1 text-app-faint hover:bg-app-surface-hover"
              >
                <X size={15} />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Name"
                className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm outline-none"
              />
              <input
                value={form.key}
                onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
                placeholder="Key (optional)"
                className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm outline-none"
              />
              <input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description (optional)"
                className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm outline-none md:col-span-2"
              />
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) }))}
                placeholder="Priority"
                className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm outline-none"
              />
              <input
                type="number"
                value={form.maxCharacters}
                onChange={(e) => setForm((p) => ({ ...p, maxCharacters: e.target.value }))}
                placeholder="Max characters (optional)"
                className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-[12px] font-medium text-app-muted">
                Compatibility matrix ({selectedCount} selected)
              </p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {FIELD_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 rounded-lg border border-app-border bg-app-bg px-2.5 py-2 text-[12px] text-app-muted"
                  >
                    <input
                      type="checkbox"
                      checked={form.fieldTypes.includes(opt.id)}
                      onChange={() => toggleFieldType(opt.id)}
                      className="rounded border-app-border"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-[12px] text-app-muted">
                <input
                  type="checkbox"
                  checked={form.supportsMedia}
                  onChange={(e) => setForm((p) => ({ ...p, supportsMedia: e.target.checked }))}
                  className="rounded border-app-border"
                />
                Supports media
              </label>
              <p className="m-0 max-w-md text-[11px] leading-snug text-app-faint">
                Underline is controlled only by the{' '}
                <span className="text-app-muted">Underline</span> checkbox above (avoids conflicting
                toggles).
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-app-border px-3.5 py-2 text-[13px] text-app-muted hover:bg-app-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveChannel}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg border border-app-accent/35 bg-app-accent-muted px-3.5 py-2 text-[13px] text-app-accent disabled:opacity-50"
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save channel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
