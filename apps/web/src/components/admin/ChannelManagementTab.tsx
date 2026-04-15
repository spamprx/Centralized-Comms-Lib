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
  maxRows: string;
  maxColumnsPerRow: string;
  maxRichTextRegions: string;
  maxMediaRegions: string;
  maxFieldRegions: string;
  maxTotalRegions: string;
  allowedRegionSequences: string;
  disallowInlineImagesInRichText: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  key: '',
  description: '',
  priority: 0,
  maxCharacters: '',
  supportsMedia: true,
  fieldTypes: [],
  maxRows: '',
  maxColumnsPerRow: '',
  maxRichTextRegions: '',
  maxMediaRegions: '',
  maxFieldRegions: '',
  maxTotalRegions: '',
  allowedRegionSequences: '',
  disallowInlineImagesInRichText: false,
};

function optNum(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
}

function toForm(channel: ChannelRecord): FormState {
  const restrictions = channel.compatibility?.restrictions ?? {};
  const maxChars =
    typeof restrictions.maxCharacters === 'number' ? String(restrictions.maxCharacters) : '';
  const seqs = Array.isArray(restrictions.allowedRegionSequences)
    ? JSON.stringify(restrictions.allowedRegionSequences)
    : '';
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
    maxRows: optNum(restrictions.maxRows),
    maxColumnsPerRow: optNum(restrictions.maxColumnsPerRow),
    maxRichTextRegions: optNum(restrictions.maxRichTextRegions),
    maxMediaRegions: optNum(restrictions.maxMediaRegions),
    maxFieldRegions: optNum(restrictions.maxFieldRegions),
    maxTotalRegions: optNum(restrictions.maxTotalRegions),
    allowedRegionSequences: seqs,
    disallowInlineImagesInRichText: restrictions.disallowInlineImagesInRichText === true,
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

    const parseOptInt = (v: string): number | undefined => {
      const trimmed = v.trim();
      if (!trimmed) return undefined;
      const n = Number(trimmed);
      return Number.isFinite(n) && n >= 0 && Number.isInteger(n) ? n : undefined;
    };

    let parsedSeqs: string[][] | undefined;
    if (form.allowedRegionSequences.trim()) {
      try {
        const raw = JSON.parse(form.allowedRegionSequences);
        if (
          Array.isArray(raw) &&
          raw.every(
            (item: unknown) =>
              Array.isArray(item) && item.every((s: unknown) => typeof s === 'string'),
          )
        ) {
          parsedSeqs = raw as string[][];
        } else {
          setError(
            'Allowed region sequences must be a JSON array of string arrays, e.g. [["richText"],["media","richText"]]',
          );
          return;
        }
      } catch {
        setError('Allowed region sequences is not valid JSON.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const structuralRestrictions: Record<string, unknown> = {};
      const mRows = parseOptInt(form.maxRows);
      const mCols = parseOptInt(form.maxColumnsPerRow);
      const mRich = parseOptInt(form.maxRichTextRegions);
      const mMedia = parseOptInt(form.maxMediaRegions);
      const mField = parseOptInt(form.maxFieldRegions);
      const mTotal = parseOptInt(form.maxTotalRegions);
      if (mRows !== undefined) structuralRestrictions.maxRows = mRows;
      if (mCols !== undefined) structuralRestrictions.maxColumnsPerRow = mCols;
      if (mRich !== undefined) structuralRestrictions.maxRichTextRegions = mRich;
      if (mMedia !== undefined) structuralRestrictions.maxMediaRegions = mMedia;
      if (mField !== undefined) structuralRestrictions.maxFieldRegions = mField;
      if (mTotal !== undefined) structuralRestrictions.maxTotalRegions = mTotal;
      if (parsedSeqs) structuralRestrictions.allowedRegionSequences = parsedSeqs;

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
            ...structuralRestrictions,
            disallowInlineImagesInRichText: form.disallowInlineImagesInRichText,
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

  const fieldInput =
    'rounded-app-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none backdrop-blur-sm transition-[border-color,box-shadow] duration-200 placeholder:text-app-faint focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/12';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="mb-1 text-lg font-semibold tracking-tight text-app-text">Channels</h2>
          <p className="m-0 text-[13px] text-app-muted">
            Admin-only channel compatibility and restrictions
          </p>
        </div>
      </div>

      {error ? (
        <div className="relative overflow-hidden rounded-app-xl border border-red-400/25 bg-gradient-to-r from-red-500/12 to-red-500/5 px-4 py-3 text-[13px] font-medium text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/35 to-transparent" />
          <span className="relative">{error}</span>
        </div>
      ) : null}

      <div className="grid gap-3">
        {loading ? (
          <div className="app-skeleton-shimmer rounded-app-xl border border-white/[0.08] px-4 py-12 text-center text-sm font-medium text-app-muted">
            Loading channels…
          </div>
        ) : channels.length < 1 ? (
          <div className="rounded-app-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-12 text-center text-sm text-app-muted backdrop-blur-sm">
            No channels found.
          </div>
        ) : (
          channels.map((ch) => (
            <div
              key={ch.id}
              className="admin-glass admin-card-hover relative overflow-hidden rounded-app-xl p-4 sm:p-5 ring-1 ring-white/[0.04]"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="m-0 text-sm font-semibold text-app-text">{ch.name}</h3>
                    <span className="rounded-app-md border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-medium text-app-muted">
                      {ch.key}
                    </span>
                    <span className="rounded-app-md border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-app-muted">
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
                  {(ch.compatibility?.restrictions?.maxRows != null ||
                    ch.compatibility?.restrictions?.maxTotalRegions != null) && (
                    <p className="mt-1 text-[11px] text-app-faint">
                      Structure: rows {String(ch.compatibility.restrictions.maxRows ?? '∞')} ·
                      cols/row {String(ch.compatibility.restrictions.maxColumnsPerRow ?? '∞')} ·
                      text {String(ch.compatibility.restrictions.maxRichTextRegions ?? '∞')} · media{' '}
                      {String(ch.compatibility.restrictions.maxMediaRegions ?? '∞')} · total{' '}
                      {String(ch.compatibility.restrictions.maxTotalRegions ?? '∞')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(ch)}
                    className="rounded-app-md border border-white/[0.1] bg-white/[0.04] p-2 text-app-muted shadow-sm transition-[border-color,background-color] hover:border-app-accent/25 hover:bg-app-accent-muted/30 hover:text-app-accent"
                  >
                    <Pencil size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm ? (
        <div className="admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="admin-modal-enter admin-modal-panel max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-app-xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.08] pb-4">
              <h3 className="m-0 text-base font-semibold tracking-tight text-app-text">
                {editing ? 'Edit channel' : 'Create channel'}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-app-md p-2 text-app-faint transition-colors hover:bg-white/[0.08] hover:text-app-text"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Name"
                className={fieldInput}
              />
              <input
                value={form.key}
                onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
                placeholder="Key (optional)"
                className={fieldInput}
              />
              <input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description (optional)"
                className={`${fieldInput} md:col-span-2`}
              />
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) }))}
                placeholder="Priority"
                className={fieldInput}
              />
              <input
                type="number"
                value={form.maxCharacters}
                onChange={(e) => setForm((p) => ({ ...p, maxCharacters: e.target.value }))}
                placeholder="Max characters (optional)"
                className={fieldInput}
              />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-[12px] font-medium text-app-muted">Structural restrictions</p>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-[11px] text-app-faint">
                  Max rows
                  <input
                    type="number"
                    min={0}
                    value={form.maxRows}
                    onChange={(e) => setForm((p) => ({ ...p, maxRows: e.target.value }))}
                    placeholder="∞"
                    className={`mt-1 block w-full ${fieldInput}`}
                  />
                </label>
                <label className="text-[11px] text-app-faint">
                  Max columns / row
                  <input
                    type="number"
                    min={0}
                    value={form.maxColumnsPerRow}
                    onChange={(e) => setForm((p) => ({ ...p, maxColumnsPerRow: e.target.value }))}
                    placeholder="∞"
                    className={`mt-1 block w-full ${fieldInput}`}
                  />
                </label>
                <label className="text-[11px] text-app-faint">
                  Max text blocks
                  <input
                    type="number"
                    min={0}
                    value={form.maxRichTextRegions}
                    onChange={(e) => setForm((p) => ({ ...p, maxRichTextRegions: e.target.value }))}
                    placeholder="∞"
                    className={`mt-1 block w-full ${fieldInput}`}
                  />
                </label>
                <label className="text-[11px] text-app-faint">
                  Max media blocks
                  <input
                    type="number"
                    min={0}
                    value={form.maxMediaRegions}
                    onChange={(e) => setForm((p) => ({ ...p, maxMediaRegions: e.target.value }))}
                    placeholder="∞"
                    className={`mt-1 block w-full ${fieldInput}`}
                  />
                </label>
                <label className="text-[11px] text-app-faint">
                  Max field blocks
                  <input
                    type="number"
                    min={0}
                    value={form.maxFieldRegions}
                    onChange={(e) => setForm((p) => ({ ...p, maxFieldRegions: e.target.value }))}
                    placeholder="∞"
                    className={`mt-1 block w-full ${fieldInput}`}
                  />
                </label>
                <label className="text-[11px] text-app-faint">
                  Max total blocks
                  <input
                    type="number"
                    min={0}
                    value={form.maxTotalRegions}
                    onChange={(e) => setForm((p) => ({ ...p, maxTotalRegions: e.target.value }))}
                    placeholder="∞"
                    className={`mt-1 block w-full ${fieldInput}`}
                  />
                </label>
              </div>
              <label className="mt-3 block text-[11px] text-app-faint">
                Allowed region sequences (JSON)
                <input
                  value={form.allowedRegionSequences}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, allowedRegionSequences: e.target.value }))
                  }
                  placeholder='e.g. [["richText"],["media"],["media","richText"]]'
                  className={`mt-1 block w-full font-mono ${fieldInput}`}
                />
              </label>
              <p className="mt-1 m-0 text-[10px] leading-snug text-app-faint">
                Leave blank for no sequence restrictions. Each inner array defines one valid
                block-type ordering per cell.
              </p>
              <label className="mt-3 flex items-center gap-2 text-[12px] text-app-muted">
                <input
                  type="checkbox"
                  checked={form.disallowInlineImagesInRichText}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, disallowInlineImagesInRichText: e.target.checked }))
                  }
                  className="rounded border-app-border"
                />
                Disallow embedded media in text blocks (inline images and Add media token
                placeholders; use layout Media blocks instead)
              </label>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-[12px] font-medium text-app-muted">
                Compatibility matrix ({selectedCount} selected)
              </p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {FIELD_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 rounded-app-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-app-muted transition-[border-color,background-color] hover:border-white/[0.14] hover:bg-white/[0.05] has-[:checked]:border-app-accent/35 has-[:checked]:bg-app-accent-muted/25"
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
            <div className="mt-6 flex justify-end gap-3 border-t border-white/[0.08] pt-5">
              <button
                type="button"
                onClick={closeForm}
                className="admin-glass-button rounded-app-lg px-4 py-2.5 text-[13px] font-semibold text-app-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveChannel}
                disabled={saving}
                className="admin-btn-lift inline-flex items-center gap-2 rounded-app-lg border border-app-accent/35 bg-gradient-to-br from-app-accent-muted to-app-accent-muted/50 px-4 py-2.5 text-[13px] font-semibold text-app-accent shadow-[0_0_24px_-8px_rgba(147,124,248,0.4)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={14} strokeWidth={2} /> {saving ? 'Saving…' : 'Save channel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
