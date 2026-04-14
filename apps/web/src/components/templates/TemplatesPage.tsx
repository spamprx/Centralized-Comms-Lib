import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  templateCrudService,
  type ChannelRecord,
  type CreateTemplateInput,
  type TemplateRecord,
  type TemplateStatus,
  type UpdateTemplateInput,
} from '../../services/templateCrudService';
import { PageHeader } from '../ui/PageHeader';
import { PageShell } from '../ui/PageShell';
import { Surface } from '../ui/Surface';
import TemplateLayoutEditor from './TemplateLayoutEditor';
import TemplateChannelPreviews from './TemplateChannelPreviews';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

function statusPill(status: TemplateStatus): string {
  if (status === 'ACTIVE') return 'bg-green-500/15 text-green-300 border-green-400/30';
  if (status === 'ARCHIVED') return 'bg-zinc-500/15 text-zinc-300 border-zinc-400/30';
  return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
}

function templateType(t: TemplateRecord): string {
  if (t.activeLayout) return 'Active layout';
  if (t.draftLayout) return 'Draft layout';
  return 'Metadata only';
}

function nextCopyName(baseName: string, existing: TemplateRecord[]): string {
  const exact = `${baseName} (Copy)`;
  if (!existing.some((t) => t.name === exact)) return exact;
  let i = 2;
  while (existing.some((t) => t.name === `${baseName} (Copy ${i})`)) i += 1;
  return `${baseName} (Copy ${i})`;
}

function defaultBindingConfigText(): string {
  return '{\n  "layout": "responsive"\n}';
}

function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return defaultBindingConfigText();
  }
}

function extractBindingsFromTemplate(detail: TemplateRecord | null): Array<{
  id: string;
  channelId: string;
  createdAt: string;
  layoutConfig?: unknown;
}> {
  if (!detail) return [];
  const anyDetail = detail as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    anyDetail.bindings,
    anyDetail.channelBindings,
    anyDetail.channel_bindings,
    anyDetail.templateBindings,
  ];
  const arr = candidates.find((x) => Array.isArray(x)) as Array<any> | undefined;
  if (!arr) return [];
  return arr
    .map((b) => {
      if (!b || typeof b !== 'object') return null;
      const id = String((b as any).id ?? '').trim();
      const channelId = String((b as any).channelId ?? (b as any).channel_id ?? '').trim();
      const createdAt = String((b as any).createdAt ?? (b as any).created_at ?? '').trim();
      const layoutConfig = (b as any).layoutConfig ?? (b as any).layout_config ?? undefined;
      if (!id || !channelId) return null;
      return { id, channelId, createdAt, layoutConfig };
    })
    .filter(Boolean) as Array<{ id: string; channelId: string; createdAt: string; layoutConfig?: unknown }>;
}

function normalizeI18n(input: unknown): Record<string, Record<string, string>> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, Record<string, string>> = {};
  for (const [locale, bundle] of Object.entries(input as Record<string, unknown>)) {
    if (!bundle || typeof bundle !== 'object') continue;
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(bundle as Record<string, unknown>)) {
      if (typeof v === 'string') row[k] = v;
    }
    out[locale] = row;
  }
  return out;
}

function extractTemplateKeys(template: TemplateRecord | null): string[] {
  if (!template) return [];
  const source = JSON.stringify({
    name: template.name,
    description: template.description,
    draftLayout: template.draftLayout,
    activeLayout: template.activeLayout,
  });
  const found = new Set<string>();
  const re = /\{\{([^{}]+)\}\}/g;
  for (const match of source.matchAll(re)) {
    const key = match[1]?.trim();
    if (key) found.add(`{{${key}}}`);
  }
  return Array.from(found);
}

function validLocaleCode(locale: string): boolean {
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(locale);
}

function applyI18nFallback(
  input: string,
  locale: string,
  i18n: Record<string, Record<string, string>>,
  baseLocale: string,
): string {
  const current = i18n[locale] ?? {};
  const base = i18n[baseLocale] ?? {};
  return input.replace(/\{\{([^{}]+)\}\}/g, (full) => {
    const translated = current[full];
    if (translated && translated.trim()) return translated;
    const fallback = base[full];
    if (fallback && fallback.trim()) return fallback;
    return full;
  });
}

export default function TemplatesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<TemplateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<TemplateRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'DRAFT' as TemplateStatus,
  });
  const [formErrors, setFormErrors] = useState<{ name?: string; description?: string }>({});
  const [formServerError, setFormServerError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<TemplateRecord | null>(null);
  const [cloneTarget, setCloneTarget] = useState<TemplateRecord | null>(null);
  const [cloneBanner, setCloneBanner] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [editingBindingId, setEditingBindingId] = useState<string | null>(null);
  const [channelIdInput, setChannelIdInput] = useState('');
  const [channelConfigInput, setChannelConfigInput] = useState('{\n  "layout": "responsive"\n}');
  const [channelError, setChannelError] = useState<string | null>(null);
  const [channelToast, setChannelToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [i18nData, setI18nData] = useState<Record<string, Record<string, string>>>({});
  const [localeTab, setLocaleTab] = useState('en');
  const [newLocaleCode, setNewLocaleCode] = useState('');
  const [i18nError, setI18nError] = useState<string | null>(null);
  const [i18nSaving, setI18nSaving] = useState(false);
  const [previewLocale, setPreviewLocale] = useState('en');

  const bindingViews = useMemo(() => {
    const out: Array<{
      id: string;
      channelId: string;
      channelKey: string;
      channelName: string;
      layoutConfigText: string;
      layoutConfig: unknown;
    }> = [];

    // API-backed bindings (templateCrudService)
    for (const b of extractBindingsFromTemplate(detail)) {
      const channel = channels.find((c) => c.id === b.channelId);
      const raw = b.layoutConfig ? stringifyJson(b.layoutConfig) : defaultBindingConfigText();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = b.layoutConfig ?? null;
      }
      out.push({
        id: b.id,
        channelId: b.channelId,
        channelKey: channel?.key ?? 'channel',
        channelName: channel?.name ?? b.channelId,
        layoutConfigText: raw,
        layoutConfig: parsed,
      });
    }

    return out;
  }, [detail, channels]);

  const q = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') as TemplateStatus | 'ALL' | null) ?? 'ALL';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.get('pageSize')))
    ? Number(searchParams.get('pageSize'))
    : 10;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    templateCrudService
      .list({ search: q, status })
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load templates');
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [q, status]);

  useEffect(() => {
    if (!templateId) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    templateCrudService
      .getById(templateId)
      .then((row) => {
        if (cancelled) return;
        setDetail(row);
      })
      .catch((e) => {
        if (cancelled) return;
        setDetail(null);
        setDetailError(e instanceof Error ? e.message : 'Failed to load template detail');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  useEffect(() => {
    // Legacy bindings fetch removed: bindings now come from templateCrudService.getById().
    // (Kept as an effect placeholder to avoid refactor churn when adding features.)
    return undefined;
  }, [detail?.id]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  useEffect(() => {
    if (currentPage !== page) {
      setSearchParams((prev) => {
        prev.set('page', String(currentPage));
        return prev;
      });
    }
  }, [currentPage, page, setSearchParams]);

  useEffect(() => {
    if (location.pathname.endsWith('/edit') && detail) {
      setFormMode('edit');
      setFormData({
        name: detail.name,
        description: detail.description ?? '',
        status: detail.status,
      });
      setFormErrors({});
      setMutationError(null);
      setShowForm(true);
    }
  }, [detail, location.pathname]);

  useEffect(() => {
    if (!detail) return;
    const norm = normalizeI18n(detail.i18n);
    setI18nData(norm);
    const locales = Object.keys(norm);
    if (locales.length > 0) {
      setLocaleTab((prev) => (locales.includes(prev) ? prev : locales[0]));
      setPreviewLocale((prev) => (locales.includes(prev) ? prev : locales[0]));
    } else {
      setLocaleTab('en');
      setPreviewLocale('en');
    }
    setI18nError(null);
  }, [detail]);

  useEffect(() => {
    const clonedFrom = (location.state as { clonedFrom?: string } | null)?.clonedFrom;
    if (clonedFrom) {
      setCloneBanner(clonedFrom);
      const timer = setTimeout(() => setCloneBanner(null), 5000);
      return () => clearTimeout(timer);
    }
    setCloneBanner(null);
  }, [location.state, location.pathname]);

  useEffect(() => {
    if (!channelToast) return;
    const t = setTimeout(() => setChannelToast(null), 3200);
    return () => clearTimeout(t);
  }, [channelToast]);

  useEffect(() => {
    let cancelled = false;
    setChannelsLoading(true);
    templateCrudService
      .listChannels()
      .then((rows) => {
        if (!cancelled) setChannels(rows);
      })
      .catch(() => {
        if (!cancelled) setChannels([]);
      })
      .finally(() => {
        if (!cancelled) setChannelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function validateForm(data: typeof formData): { name?: string; description?: string } {
    const next: { name?: string; description?: string } = {};
    const name = data.name.trim();
    if (!name) next.name = 'Name is required';
    else if (name.length > 200) next.name = 'Name must be 200 characters or fewer';
    if (data.description.length > 1000) next.description = 'Description must be 1000 characters or fewer';
    return next;
  }

  function openCreateForm() {
    setFormMode('create');
    setFormData({ name: '', description: '', status: 'DRAFT' });
    setFormErrors({});
    setFormServerError(null);
    setMutationError(null);
    setShowForm(true);
  }

  function openEditForm(t: TemplateRecord) {
    setFormMode('edit');
    setFormData({
      name: t.name,
      description: t.description ?? '',
      status: t.status,
    });
    setFormErrors({});
    setFormServerError(null);
    setMutationError(null);
    setShowForm(true);
    navigate(`/templates/${t.id}/edit`);
  }

  function applyBackendValidation(errorMessage: string): boolean {
    const msg = errorMessage.toLowerCase();
    const next: { name?: string; description?: string } = {};

    if (msg.includes('name')) {
      next.name = errorMessage;
    } else if (msg.includes('description')) {
      next.description = errorMessage;
    } else {
      return false;
    }

    setFormErrors((prev) => ({ ...prev, ...next }));
    return true;
  }

  async function onSubmitForm() {
    const errors = validateForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setMutating(true);
    setFormServerError(null);
    setMutationError(null);
    try {
      if (formMode === 'create') {
        const payload: CreateTemplateInput = {
          name: formData.name.trim(),
          description: formData.description.trim(),
        };
        const created = await templateCrudService.create(payload);
        setItems((prev) => [created, ...prev]);
        setShowForm(false);
        navigate(`/templates/${created.id}`);
      } else if (detail) {
        const payload: UpdateTemplateInput = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          status: formData.status,
        };
        const updated = await templateCrudService.update(detail.id, payload);
        setItems((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setDetail(updated);
        setShowForm(false);
        navigate(`/templates/${updated.id}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Operation failed';
      const mapped = applyBackendValidation(message);
      if (!mapped) {
        setFormServerError(message);
      }
    } finally {
      setMutating(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setMutating(true);
    setMutationError(null);
    try {
      await templateCrudService.remove(deleteTarget.id);
      setItems((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      if (detail?.id === deleteTarget.id) {
        setDetail(null);
        navigate('/templates');
      }
      setDeleteTarget(null);
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setMutating(false);
    }
  }

  async function confirmClone() {
    if (!cloneTarget) return;
    setMutating(true);
    setMutationError(null);
    try {
      const sourceName = cloneTarget.name;
      let cloned = await templateCrudService.clone(cloneTarget.id);

      // Safety: guarantee copy-style name even if backend returns unchanged name.
      const lowerName = cloned.name.toLowerCase();
      const hasCopySuffix = lowerName.includes('(copy');
      if (!hasCopySuffix || cloned.name.trim() === sourceName.trim()) {
        const desired = nextCopyName(sourceName, [cloned, ...items]);
        cloned = await templateCrudService.update(cloned.id, { name: desired });
      }

      setItems((prev) => [cloned, ...prev]);
      setCloneTarget(null);
      navigate(`/templates/${cloned.id}/edit`, { state: { clonedFrom: sourceName } });
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Clone failed');
    } finally {
      setMutating(false);
    }
  }

  function openAddChannelDialog() {
    setEditingBindingId(null);
    const firstUnbound = channels.find(
      (c) => !detail?.bindings?.some((b) => b.channelId === c.id),
    );
    setChannelIdInput(firstUnbound?.id ?? '');
    setChannelConfigInput(defaultBindingConfigText());
    setChannelError(null);
    setShowChannelDialog(true);
  }

  function openEditChannelDialog(binding: NonNullable<TemplateRecord['bindings']>[number]) {
    setEditingBindingId(binding.id);
    setChannelIdInput(binding.channelId);
    setChannelConfigInput(binding.layoutConfig ? stringifyJson(binding.layoutConfig) : defaultBindingConfigText());
    setChannelError(null);
    setShowChannelDialog(true);
  }

  async function submitChannelDialog() {
    if (!detail) return;
    if (!channelIdInput) {
      setChannelError('Please select a channel.');
      return;
    }
    try {
      JSON.parse(channelConfigInput);
    } catch {
      setChannelError('Layout config must be valid JSON.');
      return;
    }

    setMutating(true);
    setChannelError(null);
    setMutationError(null);
    try {
      if (editingBindingId) {
        const existing = detail.bindings?.find((b) => b.id === editingBindingId);
        if (!existing) throw new Error('Binding not found');
        if (existing.channelId !== channelIdInput) {
          await templateCrudService.removeChannelBinding(detail.id, editingBindingId);
          await templateCrudService.addChannelBinding(detail.id, {
            channelId: channelIdInput,
            layoutConfig: JSON.parse(channelConfigInput),
          });
        } else {
          // No PATCH binding endpoint: re-create to persist layoutConfig changes.
          await templateCrudService.removeChannelBinding(detail.id, editingBindingId);
          await templateCrudService.addChannelBinding(detail.id, {
            channelId: channelIdInput,
            layoutConfig: JSON.parse(channelConfigInput),
          });
        }
      } else {
        await templateCrudService.addChannelBinding(detail.id, {
          channelId: channelIdInput,
          layoutConfig: JSON.parse(channelConfigInput),
        });
      }

      const refreshed = await templateCrudService.getById(detail.id);
      setDetail(refreshed);
      setItems((prev) => prev.map((t) => (t.id === refreshed.id ? refreshed : t)));
      setShowChannelDialog(false);
    } catch (e) {
      setChannelError(e instanceof Error ? e.message : 'Failed to save channel binding');
    } finally {
      setMutating(false);
    }
  }

  async function removeBinding(bindingId: string) {
    if (!detail) return;
    setMutating(true);
    setChannelError(null);
    setMutationError(null);
    try {
      await templateCrudService.removeChannelBinding(detail.id, bindingId);
      const refreshed = await templateCrudService.getById(detail.id);
      setDetail(refreshed);
      setItems((prev) => prev.map((t) => (t.id === refreshed.id ? refreshed : t)));
      setChannelToast({ type: 'success', message: 'Channel binding removed.' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to remove channel binding';
      setChannelToast({
        type: 'error',
        message: `Could not remove binding. ${message}`,
      });
    } finally {
      setMutating(false);
    }
  }

  const baseLocale = i18nData.en ? 'en' : Object.keys(i18nData)[0] ?? 'en';
  const baseKeys = useMemo(() => {
    const set = new Set<string>([
      ...Object.keys(i18nData[baseLocale] ?? {}),
      ...extractTemplateKeys(detail),
    ]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [i18nData, baseLocale, detail]);
  const selectedBundle = i18nData[localeTab] ?? {};
  const baseBundle = i18nData[baseLocale] ?? {};
  const missingCount = baseKeys.filter((k) => !selectedBundle[k]?.trim()).length;
  const previewSource = useMemo(() => {
    if (!detail) return '';
    return [
      `Template: ${detail.name}`,
      `Description: ${detail.description ?? ''}`,
      '',
      'Draft Layout:',
      JSON.stringify(detail.draftLayout, null, 2),
      '',
      'Active Layout:',
      JSON.stringify(detail.activeLayout, null, 2),
    ].join('\n');
  }, [detail]);
  const translatedPreview = useMemo(
    () => applyI18nFallback(previewSource, previewLocale, i18nData, baseLocale),
    [previewSource, previewLocale, i18nData, baseLocale],
  );

  const layoutForPreview = useMemo(() => {
    if (!detail) return null;
    return detail.activeLayout ?? detail.draftLayout ?? null;
  }, [detail]);

  function updateTranslation(key: string, value: string) {
    setI18nData((prev) => ({
      ...prev,
      [localeTab]: {
        ...(prev[localeTab] ?? {}),
        [key]: value,
      },
    }));
  }

  function addLocaleTab() {
    const code = newLocaleCode.trim();
    if (!validLocaleCode(code)) {
      setI18nError('Locale must look like "en" or "en-US".');
      return;
    }
    if (i18nData[code]) {
      setI18nError('Locale already exists.');
      return;
    }
    setI18nData((prev) => ({ ...prev, [code]: {} }));
    setLocaleTab(code);
    setNewLocaleCode('');
    setI18nError(null);
  }

  async function saveLocaleTranslations() {
    if (!detail) return;
    if (!validLocaleCode(localeTab)) {
      setI18nError('Invalid locale code.');
      return;
    }
    setI18nSaving(true);
    setI18nError(null);
    try {
      const patch = { [localeTab]: i18nData[localeTab] ?? {} };
      const updated = await templateCrudService.patchI18n(detail.id, patch);
      setDetail(updated);
      setItems((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setChannelToast({ type: 'success', message: `Saved translations for ${localeTab}.` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save translations';
      setI18nError(msg);
      setChannelToast({ type: 'error', message: msg });
    } finally {
      setI18nSaving(false);
    }
  }

  return (
    <>
      <PageShell wide className="min-h-screen text-app-text">
      <PageHeader
        title="Templates"
        accentWord="Templates"
        description="Browse reusable templates, search quickly, and open full details."
      />
      <div className="mb-6 space-y-3">
        {cloneBanner && (
          <div className="rounded-app-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Cloned from "{cloneBanner}".
          </div>
        )}
        {mutationError && (
          <div className="rounded-app-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {mutationError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Surface padding="md">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="min-w-[260px] flex-1">
              <label className="text-[12px] text-app-muted block mb-1">Search</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-faint" />
                <input
                  value={q}
                  onChange={(e) =>
                    setSearchParams((prev) => {
                      prev.set('q', e.target.value);
                      prev.set('page', '1');
                      return prev;
                    })
                  }
                  placeholder="Search by name, slug or description..."
                  className="w-full rounded-lg border border-app-border bg-app-bg-subtle pl-9 pr-3 py-2 text-sm outline-none focus:border-app-accent/50"
                />
              </div>
            </div>
            <div>
              <label className="text-[12px] text-app-muted block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) =>
                  setSearchParams((prev) => {
                    prev.set('status', e.target.value);
                    prev.set('page', '1');
                    return prev;
                  })
                }
                className="rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm"
              >
                <option value="ALL">All</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div>
              <button
                onClick={openCreateForm}
                className="rounded-lg border border-app-accent/50 bg-app-accent-muted px-3 py-2 text-sm hover:bg-app-accent/25 flex items-center gap-2"
              >
                <Plus size={14} /> New template
              </button>
            </div>
            <div>
              <label className="text-[12px] text-app-muted block mb-1">Page size</label>
              <select
                value={pageSize}
                onChange={(e) =>
                  setSearchParams((prev) => {
                    prev.set('pageSize', e.target.value);
                    prev.set('page', '1');
                    return prev;
                  })
                }
                className="rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="h-40 flex items-center justify-center text-app-muted">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading templates...
            </div>
          ) : error ? (
            <div className="rounded-app-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-app-border bg-black/20 px-3 py-6 text-sm text-app-muted text-center">
              No templates found for current filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-app-muted">
                    <tr className="border-b border-app-border">
                      <th className="py-2 pr-2 font-medium">Name</th>
                      <th className="py-2 pr-2 font-medium">Type</th>
                      <th className="py-2 pr-2 font-medium">Status</th>
                      <th className="py-2 pr-2 font-medium">Owner</th>
                      <th className="py-2 pr-2 font-medium">Updated</th>
                      <th className="py-2 pr-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => navigate(`/templates/${t.id}`)}
                        className="border-b border-app-border/80 hover:bg-app-surface cursor-pointer"
                      >
                        <td className="py-2 pr-2">
                          <div className="font-medium">{t.name}</div>
                          <div className="text-[11px] text-app-faint">{t.slug}</div>
                        </td>
                        <td className="py-2 pr-2 text-app-muted">{templateType(t)}</td>
                        <td className="py-2 pr-2">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] border ${statusPill(t.status)}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-app-muted">{t.authorId}</td>
                        <td className="py-2 pr-2 text-app-muted">
                          {new Date(t.updatedAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-2">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditForm(t);
                              }}
                              className="px-2 py-1 rounded border border-app-border hover:bg-app-surface-hover"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCloneTarget(t);
                                setMutationError(null);
                              }}
                              className="px-2 py-1 rounded border border-app-border hover:bg-app-surface-hover"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(t);
                                setMutationError(null);
                              }}
                              className="rounded border border-red-400/35 px-2 py-1 text-red-200 hover:bg-red-500/10"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-app-faint">
                  {items.length} total templates · page {currentPage} / {pageCount}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setSearchParams((prev) => {
                        prev.set('page', String(Math.max(1, currentPage - 1)));
                        return prev;
                      })
                    }
                    disabled={currentPage <= 1}
                    className="px-2 py-1 rounded border border-app-border disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() =>
                      setSearchParams((prev) => {
                        prev.set('page', String(Math.min(pageCount, currentPage + 1)));
                        return prev;
                      })
                    }
                    disabled={currentPage >= pageCount}
                    className="px-2 py-1 rounded border border-app-border disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </Surface>

        <Surface padding="md" className="min-h-[320px]">
          <h2 className="mt-0 mb-3 text-base font-semibold text-app-text">Template detail</h2>
          {!templateId ? (
            <p className="text-sm text-app-faint">Select a template from the list to view details.</p>
          ) : detailLoading ? (
            <div className="h-40 flex items-center justify-center text-app-muted">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading detail...
            </div>
          ) : detailError ? (
            <div className="rounded-app-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {detailError}
            </div>
          ) : detail ? (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-app-faint text-[12px]">Name</div>
                <div className="flex items-center justify-between gap-2">
                  <span>{detail.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setCloneTarget(detail);
                        setMutationError(null);
                      }}
                      className="px-2 py-1 rounded border border-app-border hover:bg-app-surface-hover text-xs"
                    >
                      Clone
                    </button>
                    <button
                      onClick={() => openEditForm(detail)}
                      className="px-2 py-1 rounded border border-app-border hover:bg-app-surface-hover text-xs"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-app-faint text-[12px]">Description</div>
                <div>{detail.description || '—'}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-app-faint text-[12px]">Status</div>
                  <div>{detail.status}</div>
                </div>
                <div>
                  <div className="text-app-faint text-[12px]">Owner</div>
                  <div>{detail.authorId}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-app-faint text-[12px]">Created</div>
                  <div>{new Date(detail.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-app-faint text-[12px]">Updated</div>
                  <div>{new Date(detail.updatedAt).toLocaleString()}</div>
                </div>
              </div>
              <div>
                <div className="text-app-faint text-[12px]">Bindings</div>
                <div>{detail.bindings?.length ?? 0}</div>
              </div>
              <div className="rounded-lg border border-app-border p-3 bg-black/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-app-faint text-[12px]">Bound Channels</div>
                  <button
                    onClick={openAddChannelDialog}
                    disabled={channelsLoading}
                    className="px-2 py-1 rounded border border-app-accent/45 text-xs hover:bg-app-accent-muted disabled:opacity-50"
                  >
                    Add Channel
                  </button>
                </div>
                {(!detail.bindings || detail.bindings.length === 0) && (
                  <p className="text-xs text-app-faint m-0">No channels bound yet.</p>
                )}
                <div className="space-y-2">
                  {detail.bindings?.map((b) => {
                    const channel = channels.find((c) => c.id === b.channelId);
                    return (
                      <div key={b.id} className="rounded border border-app-border p-2 bg-black/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm">{channel?.name ?? b.channelId}</div>
                            <div className="text-[11px] text-app-faint">{channel?.key ?? 'channel'}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditChannelDialog(b)}
                              className="px-2 py-1 rounded border border-app-border text-xs hover:bg-app-surface-hover"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => removeBinding(b.id)}
                              className="rounded border border-red-400/35 px-2 py-1 text-xs text-red-200 hover:bg-red-500/10"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <pre className="mt-2 text-[11px] bg-black/30 border border-app-border rounded p-2 overflow-auto max-h-28">
                          {b.layoutConfig ? stringifyJson(b.layoutConfig) : defaultBindingConfigText()}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-app-border p-3 bg-black/10">
                <div className="text-app-faint text-[12px] mb-2">Channel previews</div>
                <div className="max-h-[420px] overflow-auto pr-1">
                  <TemplateChannelPreviews layout={layoutForPreview} bindings={bindingViews} />
                </div>
              </div>
              <div className="rounded-lg border border-app-border p-3 bg-black/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-app-faint text-[12px]">Translations</div>
                  <button
                    onClick={saveLocaleTranslations}
                    disabled={i18nSaving || !detail}
                    className="px-2 py-1 rounded border border-app-accent/45 text-xs hover:bg-app-accent-muted disabled:opacity-50 flex items-center gap-1"
                  >
                    {i18nSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save {localeTab}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 items-center mb-3">
                  {Object.keys(i18nData).length === 0 && (
                    <button
                      onClick={() => setI18nData({ en: {} })}
                      className="px-2 py-1 rounded border border-app-border text-xs"
                    >
                      Init en
                    </button>
                  )}
                  {Object.keys(i18nData).map((loc) => (
                    <button
                      key={loc}
                      onClick={() => setLocaleTab(loc)}
                      className={`px-2 py-1 rounded text-xs border ${
                        localeTab === loc
                          ? 'border-app-accent/50 bg-app-accent-muted'
                          : 'border-app-border hover:bg-app-surface-hover'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                  <input
                    value={newLocaleCode}
                    onChange={(e) => setNewLocaleCode(e.target.value)}
                    placeholder="fr or en-US"
                    className="rounded border border-app-border bg-app-bg-subtle px-2 py-1 text-xs w-24"
                  />
                  <button
                    onClick={addLocaleTab}
                    className="px-2 py-1 rounded border border-app-border text-xs hover:bg-app-surface-hover"
                  >
                    Add Locale
                  </button>
                  <span className="text-[11px] text-app-faint">
                    Missing in {localeTab}: {missingCount}
                  </span>
                </div>
                {i18nError && (
                  <div className="mb-2 rounded-app-md border border-red-400/35 bg-red-500/10 px-2 py-1 text-xs text-red-200">
                    {i18nError}
                  </div>
                )}
                <div className="max-h-64 overflow-auto rounded border border-app-border">
                  <table className="w-full text-xs">
                    <thead className="bg-black/30 text-app-faint">
                      <tr>
                        <th className="text-left px-2 py-1">Key</th>
                        <th className="text-left px-2 py-1">Translation ({localeTab})</th>
                        <th className="text-left px-2 py-1">Fallback ({baseLocale})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baseKeys.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-2 py-2 text-app-faint">
                            No translatable keys found yet.
                          </td>
                        </tr>
                      )}
                      {baseKeys.map((key) => {
                        const current = selectedBundle[key] ?? '';
                        const fallback = baseBundle[key] ?? key;
                        const missing = current.trim() === '';
                        return (
                          <tr key={key} className={missing ? 'bg-amber-500/10' : ''}>
                            <td className="px-2 py-1 align-top font-mono">{key}</td>
                            <td className="px-2 py-1">
                              <input
                                value={current}
                                onChange={(e) => updateTranslation(key, e.target.value)}
                                placeholder="Enter translation"
                                className="w-full rounded border border-app-border bg-app-bg-subtle px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="px-2 py-1 text-app-muted">{fallback}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 rounded border border-app-border p-2 bg-black/20">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-[12px] text-app-muted">Template Preview</div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-app-faint">Locale</label>
                      <select
                        value={previewLocale}
                        onChange={(e) => setPreviewLocale(e.target.value)}
                        className="rounded border border-app-border bg-app-bg-subtle px-2 py-1 text-xs"
                      >
                        {Object.keys(i18nData).map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <pre className="text-[11px] bg-black/30 border border-app-border rounded p-2 overflow-auto max-h-44">
                    {translatedPreview || 'No preview available'}
                  </pre>
                  <p className="text-[11px] text-app-faint mt-2 mb-0">
                    Missing keys automatically fallback to {baseLocale}.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-app-border p-3 bg-black/10">
                <div className="text-app-faint text-[12px] mb-1">Layout status</div>
                <p className="text-xs text-app-muted m-0">
                  {detail.draftLayout != null ? 'Draft layout saved.' : 'No draft layout yet.'}{' '}
                  {detail.activeLayout != null ? 'Active layout is published.' : 'Nothing active yet.'}
                </p>
              </div>

              <div className="rounded-lg border border-app-border p-3 bg-black/10">
                <details>
                  <summary className="cursor-pointer select-none text-app-faint text-[12px]">
                    Template JSON
                  </summary>
                  <pre className="mt-2 text-[11px] bg-black/30 border border-app-border rounded p-2 overflow-auto max-h-64">
                    {JSON.stringify(detail, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          ) : (
            <p className="text-sm text-app-faint">Template unavailable.</p>
          )}
        </Surface>
      </div>

      {detail && templateId ? (
        <Surface padding="md" className="mt-6">
          <TemplateLayoutEditor
            templateId={detail.id}
            draftLayout={detail.draftLayout}
            bindingCount={detail.bindings?.length ?? 0}
            bindings={bindingViews}
            onLayoutSaved={(saved) => {
              setDetail(saved);
              setItems((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
            }}
          />
        </Surface>
      ) : null}
      </PageShell>
      {showForm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-app-xl border border-app-border/90 bg-app-bg-subtle/95 p-4 shadow-app-lift backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="m-0 text-lg font-semibold">
              {formMode === 'create' ? 'Create Template' : 'Edit Template'}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setFormServerError(null);
                if (formMode === 'edit' && detail) navigate(`/templates/${detail.id}`);
              }}
              className="p-1 rounded hover:bg-app-surface-hover"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {formServerError && (
              <div className="rounded-app-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {formServerError}
              </div>
            )}
            <div>
              <label className="text-[12px] text-app-muted block mb-1">Name</label>
              <input
                value={formData.name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                  if (formServerError) setFormServerError(null);
                }}
                className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm"
              />
              {formErrors.name && <p className="mt-1 mb-0 text-xs text-red-300">{formErrors.name}</p>}
            </div>
            <div>
              <label className="text-[12px] text-app-muted block mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, description: e.target.value }));
                  if (formErrors.description) setFormErrors((prev) => ({ ...prev, description: undefined }));
                  if (formServerError) setFormServerError(null);
                }}
                rows={4}
                className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm"
              />
              {formErrors.description && (
                <p className="mt-1 mb-0 text-xs text-red-300">{formErrors.description}</p>
              )}
            </div>
            {formMode === 'edit' && (
              <div>
                <label className="text-[12px] text-app-muted block mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, status: e.target.value as TemplateStatus }))
                  }
                  className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
            )}
            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormServerError(null);
                  if (formMode === 'edit' && detail) navigate(`/templates/${detail.id}`);
                }}
                className="px-3 py-2 rounded border border-app-border text-sm"
              >
                Cancel
              </button>
              <button
                disabled={mutating}
                onClick={onSubmitForm}
                className="px-3 py-2 rounded border border-app-accent/50 bg-app-accent-muted text-sm disabled:opacity-50"
              >
                {mutating ? 'Saving...' : formMode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
      {deleteTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-app-xl border border-app-border/90 bg-app-bg-subtle/95 p-4 shadow-app-lift backdrop-blur-xl">
          <h3 className="m-0 text-lg font-semibold">Delete Template</h3>
          <p className="text-sm text-app-muted mt-2 mb-0">
            Are you sure you want to delete <span className="font-medium text-app-text">{deleteTarget.name}</span>?
          </p>
          <p className="text-xs text-app-faint mt-1">
            Deletion may be blocked if this template is active or currently in use.
          </p>
          <div className="pt-3 flex justify-end gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-3 py-2 rounded border border-app-border text-sm"
            >
              Cancel
            </button>
            <button
              disabled={mutating}
              onClick={confirmDelete}
              className="rounded-app-md border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm text-red-200 disabled:opacity-50"
            >
              {mutating ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
      )}
      {cloneTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-app-xl border border-app-border/90 bg-app-bg-subtle/95 p-4 shadow-app-lift backdrop-blur-xl">
            <h3 className="m-0 text-lg font-semibold">Clone Template</h3>
            <p className="mt-2 mb-0 text-sm text-app-muted">
              Create a deep copy of <span className="font-medium text-app-text">{cloneTarget.name}</span>?
            </p>
            <p className="text-xs text-app-faint mt-1">
              A new template will be created with a copy suffix and draft status.
            </p>
            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={() => setCloneTarget(null)}
                className="px-3 py-2 rounded border border-app-border text-sm"
              >
                Cancel
              </button>
              <button
                disabled={mutating}
                onClick={confirmClone}
                className="px-3 py-2 rounded border border-app-accent/50 bg-app-accent-muted text-sm disabled:opacity-50"
              >
                {mutating ? 'Cloning...' : 'Clone'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showChannelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-app-xl border border-app-border/90 bg-app-bg-subtle/95 p-4 shadow-app-lift backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-lg font-semibold">
                {editingBindingId ? 'Edit Channel Binding' : 'Add Channel Binding'}
              </h3>
              <button
                onClick={() => setShowChannelDialog(false)}
                className="p-1 rounded hover:bg-app-surface-hover"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[12px] text-app-muted block mb-1">Channel</label>
                <select
                  value={channelIdInput}
                  onChange={(e) => setChannelIdInput(e.target.value)}
                  className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm"
                >
                  <option value="">Select a channel</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.key})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[12px] text-app-muted block mb-1">
                  Channel Rendering Config (JSON)
                </label>
                <textarea
                  rows={8}
                  value={channelConfigInput}
                  onChange={(e) => setChannelConfigInput(e.target.value)}
                  className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm font-mono"
                />
              </div>
              {channelError && (
                <div className="rounded-app-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {channelError}
                </div>
              )}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setShowChannelDialog(false)}
                  className="px-3 py-2 rounded border border-app-border text-sm"
                >
                  Cancel
                </button>
                <button
                  disabled={mutating}
                  onClick={submitChannelDialog}
                  className="px-3 py-2 rounded border border-app-accent/50 bg-app-accent-muted text-sm disabled:opacity-50"
                >
                  {mutating ? 'Saving...' : editingBindingId ? 'Update Binding' : 'Add Binding'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {channelToast && (
        <div className="fixed bottom-4 right-4 z-[70]">
          <div
            className={`max-w-sm rounded-lg border px-3 py-2 text-sm shadow-lg ${
              channelToast.type === 'error'
                ? 'border-red-400/40 bg-red-500/15 text-red-100'
                : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
            }`}
          >
            {channelToast.message}
          </div>
        </div>
      )}
    </>
  );
}

