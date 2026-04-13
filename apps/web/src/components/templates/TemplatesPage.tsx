import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  Code2,
  Copy,
  FileText,
  Globe,
  Info,
  Layout,
  LayoutTemplate,
  Link2,
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
import { layoutCellCount } from '../../lib/templateLayout/layoutConfig';
import TemplateLayoutEditor, { parseTemplateLayout } from './TemplateLayoutEditor';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const CHANNEL_LAYOUT_PRESETS = ['responsive', 'fluid', 'fixed', 'stacked'] as const;

function parseChannelLayoutConfig(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* invalid */
  }
  return null;
}

function renderConfigValue(v: unknown, depth = 0): ReactNode {
  if (v === null || v === undefined) return <span className="text-app-faint">—</span>;
  if (typeof v === 'boolean') return <span>{v ? 'On' : 'Off'}</span>;
  if (typeof v === 'number') return <span className="tabular-nums">{v}</span>;
  if (typeof v === 'string') return <span className="break-all">{v}</span>;
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string' || typeof x === 'number')) {
      return (
        <span className="flex flex-wrap gap-1">
          {v.map((x, i) => (
            <span
              key={i}
              className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-app-muted"
            >
              {String(x)}
            </span>
          ))}
        </span>
      );
    }
    return (
      <span className="text-app-faint">
        {v.length} item{v.length === 1 ? '' : 's'}
      </span>
    );
  }
  if (typeof v === 'object' && depth < 2) {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o);
    return (
      <div className="space-y-1 border-l border-white/[0.08] pl-2">
        {keys.slice(0, 8).map((k) => (
          <div key={k} className="flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="text-app-faint">{k}</span>
            <span className="min-w-0 text-app-muted">{renderConfigValue(o[k], depth + 1)}</span>
          </div>
        ))}
        {keys.length > 8 ? <span className="text-[9px] text-app-faint">+{keys.length - 8} more</span> : null}
      </div>
    );
  }
  return <span className="text-app-faint">Object</span>;
}

function ChannelBindingConfigSummary({ configText }: { configText: string }) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseChannelLayoutConfig(configText), [configText]);
  const entries = parsed ? Object.entries(parsed) : [];

  if (!parsed) {
    return (
      <div className="rounded-md border border-amber-400/35 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-100/95">
        Config isn&apos;t valid JSON. Use <strong>Edit</strong> to fix it.
      </div>
    );
  }

  const layout = typeof parsed.layout === 'string' ? parsed.layout : null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {layout != null ? (
          <span className="inline-flex items-center rounded-full border border-app-accent/35 bg-app-accent-muted/50 px-2 py-0.5 text-[10px] font-medium text-app-accent">
            Layout: {layout}
          </span>
        ) : null}
        {typeof parsed.mediaHandling === 'string' ? (
          <span className="inline-flex items-center rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] text-app-muted">
            Media: {parsed.mediaHandling}
          </span>
        ) : null}
        {Array.isArray(parsed.fields) && parsed.fields.length > 0 ? (
          <span className="text-[10px] text-app-muted">{parsed.fields.length} field(s)</span>
        ) : null}
      </div>
      {entries.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5 text-left text-[10px] text-app-muted transition-colors hover:border-white/[0.1] hover:bg-black/25"
        >
          <span>{open ? 'Hide' : 'View'} details{entries.length > 0 ? ` (${entries.length} propert${entries.length === 1 ? 'y' : 'ies'})` : ''}</span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      ) : null}
      {open ? (
        <dl className="space-y-2 rounded-md border border-white/[0.06] bg-black/25 p-2 text-[10px]">
          {entries.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-2 gap-y-0.5">
              <dt className="font-medium text-app-faint">{k}</dt>
              <dd className="min-w-0 text-app-muted">{renderConfigValue(v)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
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

function bindingConfigKey(bindingId: string): string {
  return `template_binding_config_${bindingId}`;
}

function readBindingConfig(bindingId: string): string {
  const raw = localStorage.getItem(bindingConfigKey(bindingId));
  return raw || '{\n  "layout": "responsive"\n}';
}

function writeBindingConfig(bindingId: string, jsonText: string): void {
  localStorage.setItem(bindingConfigKey(bindingId), jsonText);
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
  const [channelJsonAdvancedOpen, setChannelJsonAdvancedOpen] = useState(false);
  const [i18nExpandDraftJson, setI18nExpandDraftJson] = useState(false);
  const [i18nExpandActiveJson, setI18nExpandActiveJson] = useState(false);

  const q = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') as TemplateStatus | 'ALL' | null) ?? 'ALL';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.get('pageSize')))
    ? Number(searchParams.get('pageSize'))
    : 10;

  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutActivating, setLayoutActivating] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'info' | 'channels' | 'i18n'>('info');
  /** Below xl: switch between metadata rail and layout canvas */
  const [mobileWorkspace, setMobileWorkspace] = useState<'template' | 'layout'>('layout');
  const saveDraftRef = useRef<(() => Promise<void>) | null>(null);
  const activateDraftRef = useRef<(() => Promise<void>) | null>(null);

  const hasTemplateSelected = Boolean(templateId);

  /** Query string to restore when returning to the list (from list navigation state). */
  const listSearchRestore = (location.state as { listSearch?: string } | null)?.listSearch ?? '';

  const templatesListHref =
    listSearchRestore && listSearchRestore.length > 0
      ? `/templates${listSearchRestore.startsWith('?') ? listSearchRestore : `?${listSearchRestore}`}`
      : '/templates';

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
    if (!templateId) return;
    setMobileWorkspace('layout');
    setSidebarTab('info');
  }, [templateId]);

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
        navigate(`/templates/${created.id}`, { state: { listSearch: location.search } });
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
        navigate(`/templates/${updated.id}`, { state: { listSearch: listSearchRestore } });
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
        navigate(
          listSearchRestore
            ? { pathname: '/templates', search: listSearchRestore }
            : '/templates',
        );
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
      navigate(`/templates/${cloned.id}/edit`, {
        state: { clonedFrom: sourceName, listSearch: listSearchRestore },
      });
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
    setChannelConfigInput('{\n  "layout": "responsive"\n}');
    setChannelError(null);
    setShowChannelDialog(true);
  }

  function openEditChannelDialog(bindingId: string, channelId: string) {
    setEditingBindingId(bindingId);
    setChannelIdInput(channelId);
    setChannelConfigInput(readBindingConfig(bindingId));
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
          const created = await templateCrudService.addChannelBinding(detail.id, {
            channelId: channelIdInput,
            layoutConfig: JSON.parse(channelConfigInput),
          });
          writeBindingConfig(created.id, channelConfigInput);
          localStorage.removeItem(bindingConfigKey(editingBindingId));
        } else {
          writeBindingConfig(editingBindingId, channelConfigInput);
        }
      } else {
        const created = await templateCrudService.addChannelBinding(detail.id, {
          channelId: channelIdInput,
          layoutConfig: JSON.parse(channelConfigInput),
        });
        writeBindingConfig(created.id, channelConfigInput);
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
      localStorage.removeItem(bindingConfigKey(bindingId));
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
  const missingCount = baseKeys.filter((k) => !selectedBundle[k]?.trim()).length;
  const draftLayoutParsed = useMemo(() => parseTemplateLayout(detail?.draftLayout ?? null), [detail?.draftLayout]);
  const activeLayoutParsed = useMemo(() => parseTemplateLayout(detail?.activeLayout ?? null), [detail?.activeLayout]);
  const previewName = useMemo(
    () => (detail ? applyI18nFallback(detail.name, previewLocale, i18nData, baseLocale) : ''),
    [detail, previewLocale, i18nData, baseLocale],
  );
  const previewDesc = useMemo(
    () => (detail ? applyI18nFallback(detail.description ?? '', previewLocale, i18nData, baseLocale) : ''),
    [detail, previewLocale, i18nData, baseLocale],
  );
  const draftJsonForI18n = useMemo(() => {
    try {
      return JSON.stringify(detail?.draftLayout ?? null, null, 2);
    } catch {
      return '';
    }
  }, [detail?.draftLayout]);
  const activeJsonForI18n = useMemo(() => {
    try {
      return JSON.stringify(detail?.activeLayout ?? null, null, 2);
    } catch {
      return '';
    }
  }, [detail?.activeLayout]);
  const draftJsonTranslated = useMemo(
    () => applyI18nFallback(draftJsonForI18n, previewLocale, i18nData, baseLocale),
    [draftJsonForI18n, previewLocale, i18nData, baseLocale],
  );
  const activeJsonTranslated = useMemo(
    () => applyI18nFallback(activeJsonForI18n, previewLocale, i18nData, baseLocale),
    [activeJsonForI18n, previewLocale, i18nData, baseLocale],
  );

  const channelFormParsed = useMemo(() => parseChannelLayoutConfig(channelConfigInput), [channelConfigInput]);
  const channelConfigValid = useMemo(() => parseChannelLayoutConfig(channelConfigInput) !== null, [channelConfigInput]);
  const channelFieldsJoined = useMemo(() => {
    const f = channelFormParsed?.fields;
    if (!Array.isArray(f)) return '';
    return f.filter((x): x is string => typeof x === 'string').join(', ');
  }, [channelFormParsed]);

  const layoutSelectCurrent = useMemo(() => {
    const L = typeof channelFormParsed?.layout === 'string' ? channelFormParsed.layout : null;
    return L ?? 'responsive';
  }, [channelFormParsed]);

  const channelLayoutSelectOptions = useMemo(() => {
    const base = [...CHANNEL_LAYOUT_PRESETS];
    if (layoutSelectCurrent && !(base as readonly string[]).includes(layoutSelectCurrent)) {
      return [...base, layoutSelectCurrent];
    }
    return base;
  }, [layoutSelectCurrent]);

  const channelMediaHandling =
    typeof channelFormParsed?.mediaHandling === 'string' ? channelFormParsed.mediaHandling : '';

  const mergeChannelConfig = useCallback((updates: Record<string, unknown | undefined | null>) => {
    setChannelConfigInput((prev) => {
      let base: Record<string, unknown> = {};
      try {
        const p = JSON.parse(prev) as unknown;
        if (p && typeof p === 'object' && !Array.isArray(p)) base = p as Record<string, unknown>;
      } catch {
        /* keep empty */
      }
      const next = { ...base };
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === null) {
          delete next[k];
        } else if (k === 'fields' && Array.isArray(v) && v.length === 0) {
          delete next[k];
        } else {
          next[k] = v;
        }
      }
      return JSON.stringify(next, null, 2);
    });
  }, []);

  useEffect(() => {
    if (showChannelDialog) setChannelJsonAdvancedOpen(false);
  }, [showChannelDialog]);

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
      {hasTemplateSelected ? (
        /* Full-height editor — same shell rhythm as content editor */
        <div className="relative flex h-screen flex-col overflow-hidden bg-app-bg">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_0%_-10%,rgba(147,124,248,0.09),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_100%,rgba(45,212,191,0.05),transparent_50%)]"
            aria-hidden
          />
          <header className="relative z-20 shrink-0 border-b border-white/[0.08] bg-[linear-gradient(180deg,rgba(18,22,32,0.92)_0%,rgba(10,13,20,0.88)_100%)] px-4 py-3 shadow-[0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:px-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] leading-tight">
                  <Link
                    to={templatesListHref}
                    className="group flex shrink-0 items-center gap-1 rounded-app-md border border-transparent px-2 py-1.5 text-app-muted transition-colors hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-app-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/35"
                  >
                    <ChevronLeft size={15} className="shrink-0 transition-transform group-hover:-translate-x-0.5" aria-hidden />
                    <span className="hidden sm:inline">All templates</span>
                    <span className="sm:hidden">List</span>
                  </Link>
                  <ChevronRight size={13} className="shrink-0 text-app-faint" aria-hidden />
                  {detailLoading ? (
                    <span className="h-4 w-36 max-w-[50vw] animate-pulse rounded-md bg-app-border/50" aria-hidden />
                  ) : detail ? (
                    <span
                      className="min-w-0 truncate font-semibold tracking-tight text-app-text"
                      title={detail.name}
                      aria-current="page"
                    >
                      {detail.name}
                    </span>
                  ) : (
                    <span className="text-app-faint">Template</span>
                  )}
                  {detail && !detailLoading && (
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        detail.status === 'ACTIVE'
                          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                          : detail.status === 'DRAFT'
                            ? 'border-amber-400/40 bg-amber-500/10 text-amber-300'
                            : 'border-zinc-400/40 bg-zinc-500/10 text-zinc-400'
                      }`}
                    >
                      {detail.status}
                    </span>
                  )}
                </nav>

                {detail && !detailLoading && (
                  <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                    <div className="flex items-center gap-1 rounded-app-md border border-white/[0.08] bg-white/[0.03] p-0.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                      <button
                        type="button"
                        title="Clone this template"
                        onClick={() => {
                          setCloneTarget(detail);
                          setMutationError(null);
                        }}
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-app-muted transition-colors hover:bg-white/[0.06] hover:text-app-text"
                      >
                        <Copy size={14} />
                        <span className="hidden md:inline">Clone</span>
                      </button>
                      <button
                        type="button"
                        title="Edit name and description"
                        onClick={() => openEditForm(detail)}
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-app-muted transition-colors hover:bg-white/[0.06] hover:text-app-text"
                      >
                        <Pencil size={14} />
                        <span className="hidden md:inline">Details</span>
                      </button>
                    </div>

                    <span className="hidden h-6 w-px bg-app-border/50 md:block" aria-hidden />

                    <button
                      type="button"
                      title="Save layout draft"
                      onClick={() => saveDraftRef.current?.()}
                      disabled={layoutSaving || detailLoading}
                      className={`flex items-center gap-1.5 rounded-app-md border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                        layoutSaving
                          ? 'cursor-not-allowed border-app-border/60 bg-app-bg/30 text-app-faint opacity-70'
                          : 'border-app-border/90 bg-app-bg/45 text-app-muted hover:border-app-accent/35 hover:bg-app-accent-muted hover:text-app-accent'
                      }`}
                    >
                      {layoutSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      <span className="hidden sm:inline">Save draft</span>
                    </button>
                    <button
                      type="button"
                      title={
                        (detail?.bindings?.length ?? 0) < 1
                          ? 'Add at least one channel binding before activating'
                          : 'Publish layout as active'
                      }
                      onClick={() => activateDraftRef.current?.()}
                      disabled={layoutActivating || (detail?.bindings?.length ?? 0) < 1}
                      className={`flex items-center gap-1.5 rounded-app-md px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                        layoutActivating
                          ? 'cursor-not-allowed bg-emerald-500/10 text-emerald-300/50 opacity-70'
                          : (detail?.bindings?.length ?? 0) < 1
                            ? 'cursor-not-allowed border border-app-border/60 bg-app-bg/30 text-app-faint opacity-50'
                            : 'bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] hover:from-emerald-400 hover:to-emerald-500'
                      }`}
                    >
                      {layoutActivating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      <span className="hidden sm:inline">Activate</span>
                    </button>
                  </div>
                )}
              </div>

              <AnimatePresence mode="popLayout">
                {(layoutSaving || layoutActivating || cloneBanner || mutationError) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-wrap gap-x-4 gap-y-1 border-t border-app-border/40 pt-2 text-[11px] sm:text-[12px]"
                  >
                    {(layoutSaving || layoutActivating) && (
                      <span className="text-app-faint">
                        {layoutSaving ? 'Saving draft…' : 'Activating template…'}
                      </span>
                    )}
                    {cloneBanner && (
                      <span className="text-emerald-300/95">Cloned from &quot;{cloneBanner}&quot;</span>
                    )}
                    {mutationError && <span className="text-red-300">{mutationError}</span>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </header>

          {/* Mobile / tablet: switch metadata vs layout (mirrors content editor split) */}
          <div
            className="relative z-10 flex shrink-0 gap-1 border-b border-white/[0.07] bg-app-bg-subtle/40 px-2 py-2 backdrop-blur-sm xl:hidden"
            role="tablist"
            aria-label="Editor workspace"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mobileWorkspace === 'template'}
              aria-controls="template-meta-panel"
              id="tab-workspace-template"
              onClick={() => setMobileWorkspace('template')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-app-md py-2 text-[12px] font-medium transition-colors ${
                mobileWorkspace === 'template'
                  ? 'bg-app-accent-muted/70 text-app-accent shadow-none ring-1 ring-app-accent/30'
                  : 'text-app-faint hover:bg-white/[0.04] hover:text-app-muted'
              }`}
            >
              <Info size={15} aria-hidden />
              Details
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileWorkspace === 'layout'}
              aria-controls="template-layout-panel"
              id="tab-workspace-layout"
              onClick={() => setMobileWorkspace('layout')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-app-md py-2 text-[12px] font-medium transition-colors ${
                mobileWorkspace === 'layout'
                  ? 'bg-app-accent-muted/70 text-app-accent shadow-none ring-1 ring-app-accent/30'
                  : 'text-app-faint hover:bg-white/[0.04] hover:text-app-muted'
              }`}
            >
              <LayoutTemplate size={15} aria-hidden />
              Layout
            </button>
          </div>

          {/* Main workspace — sidebar fixed left, editor fills remainder */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-row overflow-hidden">
            {/* Left: template details, channel bindings, translations */}
            <aside
              id="template-meta-panel"
              role="tabpanel"
              aria-labelledby="tab-workspace-template"
              className={`order-1 flex w-full shrink-0 flex-col overflow-hidden border-r border-white/[0.08] bg-[linear-gradient(180deg,rgba(14,17,26,0.92)_0%,rgba(10,13,20,0.88)_100%)] shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-md md:w-64 lg:w-[17rem] ${
                mobileWorkspace === 'template' ? 'flex' : 'hidden'
              } xl:flex`}
            >
              <div className="flex shrink-0 flex-col gap-3 border-b border-white/[0.08] px-3 pb-3 pt-3 sm:px-3.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-app-faint">Template</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-app-muted/90">Overview, channels, and copy.</p>
                </div>
                <nav className="flex flex-col gap-1" role="tablist" aria-label="Template details sections">
                  {(
                    [
                      {
                        id: 'info' as const,
                        label: 'Overview',
                        hint: 'Metadata & status',
                        icon: Info,
                      },
                      {
                        id: 'channels' as const,
                        label: 'Channel bindings',
                        hint: 'Where this template runs',
                        icon: Link2,
                      },
                      {
                        id: 'i18n' as const,
                        label: 'Translations',
                        hint: 'Locales & strings',
                        icon: Globe,
                      },
                    ] as const
                  ).map(({ id, label, hint, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={sidebarTab === id}
                      onClick={() => setSidebarTab(id)}
                      className={`group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        sidebarTab === id
                          ? 'border-app-accent/35 bg-app-accent-muted/80 text-app-text shadow-[0_0_0_1px_rgba(147,124,248,0.12)]'
                          : 'border-transparent bg-white/[0.02] text-app-muted hover:border-white/[0.08] hover:bg-white/[0.05]'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                          sidebarTab === id
                            ? 'border-app-accent/40 bg-app-accent-muted/50 text-app-accent'
                            : 'border-white/[0.08] bg-black/25 text-app-faint group-hover:text-app-muted'
                        }`}
                      >
                        <Icon size={15} strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-semibold leading-tight tracking-tight">{label}</span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-app-faint group-hover:text-app-muted">
                          {hint}
                        </span>
                      </span>
                    </button>
                  ))}
                </nav>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-xs sm:px-3.5">
                {detailLoading ? (
                  <div className="flex flex-col items-center gap-2 py-10">
                    <Loader2 size={18} className="animate-spin text-app-accent" />
                    <p className="text-[11px] text-app-faint">Loading…</p>
                  </div>
                ) : detailError ? (
                  <div className="rounded-lg border border-red-400/30 bg-red-500/5 p-3 text-[11px] text-red-200">
                    {detailError}
                  </div>
                ) : detail ? (
                  <>
                    {sidebarTab === 'info' && (
                      <div className="flex flex-col gap-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-app-faint">Summary</p>
                          {detail.description ? (
                            <p className="mt-1.5 leading-relaxed text-app-muted">{detail.description}</p>
                          ) : (
                            <p className="mt-1.5 text-[11px] italic text-app-faint">No description.</p>
                          )}
                        </div>
                        <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 shadow-app-soft ring-1 ring-white/[0.03]">
                          <div>
                            <div className="text-[10px] text-app-faint">Owner</div>
                            <div className="truncate font-mono text-[11px] text-app-text">{detail.authorId ?? '—'}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-app-faint">Slug</div>
                            <div className="truncate font-mono text-[11px] text-app-text">{detail.slug ?? '—'}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-app-faint">Updated</div>
                            <div className="tabular-nums text-[11px] text-app-text">
                              {new Date(detail.updatedAt).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-app-faint">Layout</div>
                            <div className="text-[11px] text-app-text">
                              {detail.draftLayout != null ? 'Draft saved' : 'No draft'} &middot;{' '}
                              {detail.activeLayout != null ? 'Active' : 'Not published'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {sidebarTab === 'channels' && (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-app-faint">Bindings</p>
                            <p className="mt-0.5 text-[11px] text-app-muted">
                              {detail.bindings?.length ?? 0} channel{(detail.bindings?.length ?? 0) === 1 ? '' : 's'}{' '}
                              linked
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={openAddChannelDialog}
                            disabled={channelsLoading}
                            className="shrink-0 rounded-lg border border-app-accent/35 bg-app-accent-muted/50 px-2.5 py-1 text-[10px] font-medium text-app-accent transition-colors hover:bg-app-accent-muted disabled:opacity-50"
                          >
                            + Add channel
                          </button>
                        </div>
                        {!detail.bindings || detail.bindings.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-white/[0.1] bg-black/15 px-3 py-4 text-center text-[11px] leading-relaxed text-app-faint">
                            No channels yet. Bind at least one to activate this template.
                          </p>
                        ) : (
                          <ul className="flex list-none flex-col gap-2.5 p-0">
                            {detail.bindings.map((b) => {
                              const channel = channels.find((c) => c.id === b.channelId);
                              return (
                                <li
                                  key={b.id}
                                  className="rounded-xl border border-white/[0.08] bg-black/20 p-3 ring-1 ring-white/[0.03]"
                                >
                                  <div className="mb-2 flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="truncate text-[12px] font-medium text-app-text">
                                        {channel?.name ?? b.channelId}
                                      </div>
                                      <div className="mt-0.5 font-mono text-[10px] text-app-faint">{channel?.key ?? 'channel'}</div>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                      <button
                                        type="button"
                                        onClick={() => openEditChannelDialog(b.id, b.channelId)}
                                        className="rounded-md border border-white/[0.1] px-2 py-1 text-[10px] text-app-muted transition-colors hover:bg-white/[0.06]"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeBinding(b.id)}
                                        className="rounded-md border border-red-400/25 px-2 py-1 text-[10px] text-red-300 transition-colors hover:bg-red-500/10"
                                        title="Remove binding"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                  <ChannelBindingConfigSummary configText={readBindingConfig(b.id)} />
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}

                    {sidebarTab === 'i18n' && (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-app-faint">Strings</p>
                            <p className="mt-0.5 text-[11px] text-app-muted">Locale bundles & preview</p>
                          </div>
                          <span className="shrink-0 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200/95">
                            {missingCount} missing
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(i18nData).length === 0 && (
                            <button
                              type="button"
                              onClick={() => setI18nData({ en: {} })}
                              className="rounded border border-app-border/70 px-1.5 py-0.5 text-[10px] hover:bg-app-surface-hover"
                            >
                              Init en
                            </button>
                          )}
                          {Object.keys(i18nData).map((loc) => (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => setLocaleTab(loc)}
                              className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                                localeTab === loc
                                  ? 'border-app-accent/50 bg-app-accent-muted text-app-accent'
                                  : 'border-app-border/70 hover:bg-app-surface-hover'
                              }`}
                            >
                              {loc}
                            </button>
                          ))}
                          <div className="flex items-center gap-1">
                            <input
                              value={newLocaleCode}
                              onChange={(e) => setNewLocaleCode(e.target.value)}
                              placeholder="en-US"
                              title="New locale code"
                              className="w-14 rounded border border-app-border/70 bg-app-bg-subtle px-1 py-0.5 text-[10px] outline-none"
                            />
                            <button
                              type="button"
                              onClick={addLocaleTab}
                              className="rounded border border-app-border/70 px-1.5 py-0.5 text-[10px] hover:bg-app-surface-hover"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {i18nError && (
                          <div className="rounded border border-red-400/30 bg-red-500/5 px-2 py-1 text-[10px] text-red-200">
                            {i18nError}
                          </div>
                        )}
                        <div className="max-h-48 overflow-auto rounded border border-app-border/60">
                          <table className="w-full text-[10px]">
                            <thead className="sticky top-0 bg-app-surface text-app-faint">
                              <tr>
                                <th className="px-1.5 py-1 text-left">Key</th>
                                <th className="px-1.5 py-1 text-left">{localeTab}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {baseKeys.length === 0 && (
                                <tr>
                                  <td colSpan={2} className="px-1.5 py-3 text-center text-app-faint">No keys yet.</td>
                                </tr>
                              )}
                              {baseKeys.map((key) => {
                                const current = selectedBundle[key] ?? '';
                                const missing = current.trim() === '';
                                return (
                                  <tr key={key} className={missing ? 'bg-amber-500/5' : ''}>
                                    <td className="px-1.5 py-0.5 align-top font-mono text-[9px] text-app-faint">{key}</td>
                                    <td className="px-1.5 py-0.5">
                                      <input
                                        value={current}
                                        onChange={(e) => updateTranslation(key, e.target.value)}
                                        placeholder="…"
                                        className="w-full rounded border border-app-border/60 bg-app-bg-subtle px-1 py-0.5 text-[9px] outline-none"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <button
                          type="button"
                          onClick={saveLocaleTranslations}
                          disabled={i18nSaving || !detail}
                          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-app-border/70 bg-app-surface/40 py-1.5 text-[11px] text-app-muted transition-colors hover:bg-app-surface-hover disabled:opacity-50"
                        >
                          {i18nSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                          Save {localeTab}
                        </button>
                        <div className="rounded border border-app-border/60 bg-black/10 p-2">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-medium text-app-muted">Translation preview</span>
                            <label className="flex items-center gap-1 text-[10px] text-app-faint">
                              Locale
                              <select
                                value={previewLocale}
                                onChange={(e) => setPreviewLocale(e.target.value)}
                                title="Preview locale"
                                className="rounded border border-app-border/60 bg-app-bg-subtle px-1.5 py-0.5 text-[10px] outline-none"
                              >
                                {Object.keys(i18nData).map((loc) => (
                                  <option key={loc} value={loc}>{loc}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="space-y-2 text-[10px] leading-snug">
                            <div>
                              <div className="mb-0.5 text-app-faint">Name</div>
                              <div className="rounded border border-white/[0.06] bg-black/20 px-2 py-1.5 text-app-text">
                                {previewName || '—'}
                              </div>
                            </div>
                            <div>
                              <div className="mb-0.5 text-app-faint">Description</div>
                              <div className="max-h-16 overflow-y-auto rounded border border-white/[0.06] bg-black/20 px-2 py-1.5 text-app-muted">
                                {previewDesc || '—'}
                              </div>
                            </div>
                            <div className="rounded border border-white/[0.06] bg-black/15">
                              <button
                                type="button"
                                onClick={() => setI18nExpandDraftJson((x) => !x)}
                                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-app-muted transition-colors hover:bg-white/[0.04]"
                              >
                                <span>
                                  Draft layout
                                  {draftLayoutParsed
                                    ? ` · v${draftLayoutParsed.version} · ${layoutCellCount(draftLayoutParsed)} blocks`
                                    : detail?.draftLayout == null
                                      ? ' · none'
                                      : ' · unparsed'}
                                </span>
                                <ChevronDown
                                  size={14}
                                  className={`shrink-0 transition-transform ${i18nExpandDraftJson ? 'rotate-180' : ''}`}
                                  aria-hidden
                                />
                              </button>
                              {i18nExpandDraftJson ? (
                                <div className="border-t border-white/[0.06] px-2 py-1.5">
                                  <div className="mb-1 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void navigator.clipboard.writeText(draftJsonTranslated);
                                      }}
                                      className="inline-flex items-center gap-1 rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-app-muted hover:bg-white/[0.06]"
                                    >
                                      <Copy size={10} aria-hidden /> Copy
                                    </button>
                                  </div>
                                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded border border-app-border/50 bg-black/25 p-1.5 font-mono text-[9px] text-app-faint">
                                    {draftJsonTranslated || '—'}
                                  </pre>
                                </div>
                              ) : null}
                            </div>
                            <div className="rounded border border-white/[0.06] bg-black/15">
                              <button
                                type="button"
                                onClick={() => setI18nExpandActiveJson((x) => !x)}
                                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-app-muted transition-colors hover:bg-white/[0.04]"
                              >
                                <span>
                                  Active layout
                                  {activeLayoutParsed
                                    ? ` · v${activeLayoutParsed.version} · ${layoutCellCount(activeLayoutParsed)} blocks`
                                    : detail?.activeLayout == null
                                      ? ' · none'
                                      : ' · unparsed'}
                                </span>
                                <ChevronDown
                                  size={14}
                                  className={`shrink-0 transition-transform ${i18nExpandActiveJson ? 'rotate-180' : ''}`}
                                  aria-hidden
                                />
                              </button>
                              {i18nExpandActiveJson ? (
                                <div className="border-t border-white/[0.06] px-2 py-1.5">
                                  <div className="mb-1 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void navigator.clipboard.writeText(activeJsonTranslated);
                                      }}
                                      className="inline-flex items-center gap-1 rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-app-muted hover:bg-white/[0.06]"
                                    >
                                      <Copy size={10} aria-hidden /> Copy
                                    </button>
                                  </div>
                                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded border border-app-border/50 bg-black/25 p-1.5 font-mono text-[9px] text-app-faint">
                                    {activeJsonTranslated || '—'}
                                  </pre>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </aside>

            {/* Main layout editor */}
            <div
              id="template-layout-panel"
              role="tabpanel"
              aria-labelledby="tab-workspace-layout"
              className={`order-2 min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
                mobileWorkspace === 'layout' ? 'flex' : 'hidden'
              } xl:flex`}
            >
              {detailLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-24 text-app-muted">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-2 border-app-border/30" />
                    <Loader2 size={24} className="absolute inset-0 m-auto animate-spin text-app-accent" />
                  </div>
                  <p className="text-sm">Preparing editor…</p>
                </div>
              ) : detailError ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
                    <X className="h-7 w-7 text-red-400" />
                  </div>
                  <p className="max-w-xs text-sm text-red-200">{detailError}</p>
                </div>
              ) : detail ? (
                <div className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(147,124,248,0.045),transparent_65%)] px-4 py-5 sm:px-6">
                  <TemplateLayoutEditor
                    templateId={detail.id}
                    draftLayout={detail.draftLayout}
                    bindingCount={detail.bindings?.length ?? 0}
                    onLayoutSaved={(saved) => {
                      setDetail(saved);
                      setItems((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
                    }}
                    compact
                    saveRef={saveDraftRef}
                    activateRef={activateDraftRef}
                    onSavingChange={setLayoutSaving}
                    onActivatingChange={setLayoutActivating}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        /* List view */
        <PageShell wide className="min-h-screen text-app-text">
          <PageHeader
            title="Templates"
            accentWord="Templates"
            description="Search, filter, then open a template to edit its layout."
          />
          <div className="mb-5 space-y-2">
            {cloneBanner && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-app-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
              >
                Cloned from &quot;{cloneBanner}&quot;.
              </motion.div>
            )}
            {mutationError && (
              <div className="rounded-app-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {mutationError}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="min-w-0">
              <div className="mb-5 rounded-app-lg border border-white/[0.08] bg-app-surface/50 p-4 shadow-app-soft ring-1 ring-white/[0.04] backdrop-blur-sm sm:p-5">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                  <div className="min-w-[min(100%,220px)] flex-1">
                    <label htmlFor="templates-search" className="mb-1.5 block text-xs font-medium text-app-muted">
                      Search
                    </label>
                    <div className="relative">
                      <Search
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-faint"
                        aria-hidden
                      />
                      <input
                        id="templates-search"
                        value={q}
                        onChange={(e) =>
                          setSearchParams((prev) => {
                            prev.set('q', e.target.value);
                            prev.set('page', '1');
                            return prev;
                          })
                        }
                        placeholder="Name, slug, description…"
                        title="Search templates"
                        autoComplete="off"
                        className="w-full rounded-app-md border border-app-border bg-app-bg-subtle py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-app-accent/45 focus:ring-1 focus:ring-app-accent/25"
                      />
                    </div>
                  </div>
                  <div className="w-[min(100%,8.5rem)]">
                    <label htmlFor="templates-status" className="mb-1.5 block text-xs font-medium text-app-muted">
                      Status
                    </label>
                    <select
                      id="templates-status"
                      value={status}
                      onChange={(e) =>
                        setSearchParams((prev) => {
                          prev.set('status', e.target.value);
                          prev.set('page', '1');
                          return prev;
                        })
                      }
                      title="Filter by status"
                      className="w-full rounded-app-md border border-app-border bg-app-bg-subtle px-3 py-2.5 text-sm outline-none focus:border-app-accent/45"
                    >
                      <option value="ALL">All</option>
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>
                  <div className="w-[min(100%,5.5rem)]">
                    <label htmlFor="templates-page-size" className="mb-1.5 block text-xs font-medium text-app-muted">
                      Per page
                    </label>
                    <select
                      id="templates-page-size"
                      value={pageSize}
                      onChange={(e) =>
                        setSearchParams((prev) => {
                          prev.set('pageSize', e.target.value);
                          prev.set('page', '1');
                          return prev;
                        })
                      }
                      title="Page size"
                      className="w-full rounded-app-md border border-app-border bg-app-bg-subtle px-3 py-2.5 text-sm outline-none focus:border-app-accent/45"
                    >
                      {PAGE_SIZE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex w-full min-w-0 flex-[1_1_100%] justify-end sm:w-auto sm:flex-[0_0_auto]">
                    <button
                      type="button"
                      onClick={openCreateForm}
                      className="flex w-full items-center justify-center gap-2 rounded-app-md border-transparent bg-gradient-to-br from-app-accent to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_-4px_rgba(147,124,248,0.5)] transition-all duration-200 hover:brightness-110 hover:shadow-[0_6px_28px_-4px_rgba(147,124,248,0.55)] active:scale-[0.98] sm:w-auto"
                    >
                      <Plus size={15} aria-hidden /> New template
                    </button>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="overflow-hidden rounded-2xl border border-app-border/70 bg-app-surface/50">
                      <div className="flex items-center gap-5 px-6 py-4 pl-6">
                        <div className="absolute left-0 h-full w-[3px] animate-pulse rounded-l-2xl bg-app-border/60" aria-hidden />
                        <div className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-app-border" />
                        <div className="flex-1 space-y-2.5">
                          <div className="flex items-center justify-between gap-4">
                            <div className="h-[15px] w-1/2 animate-pulse rounded-md bg-app-border" />
                            <div className="h-5 w-14 animate-pulse rounded-full bg-app-border/60" />
                          </div>
                          <div className="h-3 w-3/4 animate-pulse rounded-md bg-app-border/50" />
                          <div className="flex gap-3 pt-0.5">
                            <div className="h-3 w-20 animate-pulse rounded-full bg-app-border/40" />
                            <div className="h-3 w-16 animate-pulse rounded-full bg-app-border/40" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-400/30 bg-red-500/5 p-8 text-center">
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-app-border/80 bg-app-surface/20 py-20 text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-app-border/80 bg-app-elevated ring-1 ring-app-border/40">
                    <FileText className="h-7 w-7 text-app-faint" />
                  </div>
                  <h3 className="mb-2 text-[15px] font-semibold tracking-tight text-app-text">No templates found</h3>
                  <p className="max-w-xs text-[13px] leading-relaxed text-app-muted">
                    Nothing matches your current filters. Try adjusting the search or status.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchParams({})}
                    className="mt-6 rounded-xl border border-app-border/80 bg-app-surface/60 px-4 py-2 text-[13px] font-medium text-app-muted transition-colors hover:border-app-accent/35 hover:bg-app-accent-muted hover:text-app-accent"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pageRows.map((t, index) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                      onClick={() =>
                        navigate(`/templates/${t.id}`, { state: { listSearch: location.search } })
                      }
                      className="group relative flex cursor-pointer overflow-hidden rounded-2xl border border-white/[0.08] bg-app-surface/50 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] transition-all duration-250 hover:-translate-y-0.5 hover:border-app-accent/40 hover:bg-white/[0.05] hover:shadow-app-lift"
                    >
                      {/* Status accent left strip */}
                      <div
                        className={`absolute left-0 top-0 h-full w-[3px] rounded-l-2xl transition-opacity duration-200 group-hover:opacity-100 ${
                          t.status === 'ACTIVE'
                            ? 'bg-gradient-to-b from-emerald-400 to-emerald-600/40 opacity-80'
                            : t.status === 'DRAFT'
                              ? 'bg-gradient-to-b from-amber-400 to-amber-600/40 opacity-60'
                              : 'bg-gradient-to-b from-zinc-500 to-zinc-700/40 opacity-40'
                        }`}
                        aria-hidden
                      />

                      <div className="flex min-w-0 flex-1 gap-5 px-5 py-4 pl-6">
                        {/* Status dot */}
                        <div
                          className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-transparent ${
                            t.status === 'ACTIVE'
                              ? 'bg-emerald-400 ring-emerald-400/30'
                              : t.status === 'DRAFT'
                                ? 'bg-amber-400 ring-amber-400/30'
                                : 'bg-zinc-500 ring-zinc-500/30'
                          }`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-[15px] font-semibold leading-tight tracking-tight text-app-text transition-colors duration-150 group-hover:text-app-accent">
                                {t.name}
                              </div>
                              {t.slug && (
                                <div className="mt-0.5 font-mono text-[11px] text-app-faint">
                                  {t.slug}
                                </div>
                              )}
                            </div>
                            <span
                              className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${
                                t.status === 'ACTIVE'
                                  ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-300'
                                  : t.status === 'DRAFT'
                                    ? 'border-amber-400/40 bg-amber-500/12 text-amber-300'
                                    : 'border-zinc-400/40 bg-zinc-500/10 text-zinc-400'
                              }`}
                            >
                              {t.status}
                            </span>
                          </div>

                          {t.description && (
                            <p className="mt-1.5 line-clamp-1 pr-24 text-[13px] leading-relaxed text-app-muted">
                              {t.description}
                            </p>
                          )}

                          <div className="mt-2.5 flex items-center gap-3 text-[11px] text-app-faint">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 shrink-0 text-app-accent-2/75" aria-hidden />
                              <span>
                                {new Date(t.updatedAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                            <span className="text-app-border/60">&middot;</span>
                            <span className="text-app-faint/80">{templateType(t)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Hover action buttons */}
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 transition-all duration-150 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openEditForm(t); }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-app-border/80 bg-app-bg/80 text-app-faint backdrop-blur-sm transition-colors hover:border-app-accent/40 hover:text-app-accent"
                          title="Edit template"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setCloneTarget(t); setMutationError(null); }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-app-border/80 bg-app-bg/80 text-app-faint backdrop-blur-sm transition-colors hover:border-app-accent/40 hover:text-app-accent"
                          title="Clone template"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); setMutationError(null); }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-400/25 bg-app-bg/80 text-app-faint backdrop-blur-sm transition-colors hover:border-red-400/50 hover:text-red-400"
                          title="Delete template"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  <div className="mt-5 flex items-center justify-between px-1 text-xs text-app-faint">
                    <div>
                      Showing <span className="font-medium text-app-text">{pageRows.length}</span> of{' '}
                      <span className="font-medium text-app-text">{items.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Previous page"
                        onClick={() =>
                          setSearchParams((prev) => {
                            prev.set('page', String(Math.max(1, currentPage - 1)));
                            return prev;
                          })
                        }
                        disabled={currentPage <= 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-app-border text-app-muted transition-colors hover:bg-app-surface-hover disabled:opacity-40"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <div className="rounded-xl border border-app-border bg-app-surface px-4 py-1.5 text-[11px] tabular-nums text-app-muted">
                        {currentPage} / {pageCount}
                      </div>
                      <button
                        type="button"
                        title="Next page"
                        onClick={() =>
                          setSearchParams((prev) => {
                            prev.set('page', String(Math.min(pageCount, currentPage + 1)));
                            return prev;
                          })
                        }
                        disabled={currentPage >= pageCount}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-app-border text-app-muted transition-colors hover:bg-app-surface-hover disabled:opacity-40"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:block">
              <div className="sticky top-6 space-y-4">
                {/* Quick-start card */}
                <div className="overflow-hidden rounded-app-xl border border-app-border/80 bg-app-surface/50 shadow-app-soft backdrop-blur-md">
                  {/* Gradient banner */}
                  <div className="relative h-20 bg-[radial-gradient(ellipse_120%_120%_at_10%_-20%,rgba(147,124,248,0.35),transparent_60%),radial-gradient(ellipse_80%_80%_at_90%_110%,rgba(45,212,191,0.18),transparent_55%)]">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-app-lg border border-white/[0.12] bg-app-bg/60 shadow-app-soft backdrop-blur-sm">
                        <LayoutTemplate className="h-6 w-6 text-app-accent" strokeWidth={1.5} />
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="mb-1 text-[15px] font-semibold tracking-tight text-app-text">
                      Template Studio
                    </h3>
                    <p className="text-[13px] leading-relaxed text-app-muted">
                      Click any template to open the full-height editor with layout blocks, channel bindings, and i18n translations.
                    </p>
                  </div>
                </div>

                {/* Feature hints */}
                {(
                  [
                    { icon: Layout, label: 'Layout blocks', desc: 'Drag-and-drop visual regions for your content structure.' },
                    { icon: Link2, label: 'Channel bindings', desc: 'Publish to email, web, or any configured channel.' },
                    { icon: Globe, label: 'Translations', desc: 'Manage i18n keys and preview locale-specific output.' },
                  ] as const
                ).map(({ icon: Icon, label, desc }) => (
                  <div
                    key={label}
                    className="flex gap-3 rounded-app-lg border border-app-border/60 bg-app-surface/30 p-4 backdrop-blur-sm"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-app-md border border-app-border/60 bg-app-bg/60">
                      <Icon className="h-4 w-4 text-app-accent/80" strokeWidth={1.75} />
                    </div>
                    <div>
                      <div className="mb-0.5 text-[13px] font-semibold text-app-text">{label}</div>
                      <p className="text-[12px] leading-relaxed text-app-faint">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PageShell>
      )}

      {/* Modals */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg rounded-app-xl border border-app-border/90 bg-app-bg-subtle/95 p-5 shadow-app-lift backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-base font-semibold text-app-text">
                {formMode === 'create' ? 'New Template' : 'Edit Template'}
              </h3>
              <button
                type="button"
                title="Close"
                onClick={() => {
                  setShowForm(false);
                  setFormServerError(null);
                  if (formMode === 'edit' && detail) navigate(`/templates/${detail.id}`);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-app-faint hover:bg-app-surface-hover hover:text-app-muted"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {formServerError && (
                <div className="rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {formServerError}
                </div>
              )}
              <div>
                <label className="mb-1 block text-[12px] text-app-muted">Name</label>
                <input
                  value={formData.name}
                  title="Template name"
                  placeholder="Enter template name"
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, name: e.target.value }));
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                    if (formServerError) setFormServerError(null);
                  }}
                  className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm outline-none focus:border-app-accent/50"
                />
                {formErrors.name && <p className="mt-1 text-xs text-red-300">{formErrors.name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-[12px] text-app-muted">Description</label>
                <textarea
                  value={formData.description}
                  title="Template description"
                  placeholder="Optional description"
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, description: e.target.value }));
                    if (formErrors.description) setFormErrors((prev) => ({ ...prev, description: undefined }));
                    if (formServerError) setFormServerError(null);
                  }}
                  rows={4}
                  className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm outline-none focus:border-app-accent/50"
                />
                {formErrors.description && (
                  <p className="mt-1 text-xs text-red-300">{formErrors.description}</p>
                )}
              </div>
              {formMode === 'edit' && (
                <div>
                  <label className="mb-1 block text-[12px] text-app-muted">Status</label>
                  <select
                    value={formData.status}
                    title="Template status"
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, status: e.target.value as TemplateStatus }))
                    }
                    className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm outline-none"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormServerError(null);
                    if (formMode === 'edit' && detail) navigate(`/templates/${detail.id}`);
                  }}
                  className="rounded-lg border border-app-border px-3.5 py-2 text-sm text-app-muted hover:bg-app-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={mutating}
                  onClick={onSubmitForm}
                  className="rounded-lg border border-app-accent/50 bg-app-accent-muted px-3.5 py-2 text-sm transition-colors hover:bg-app-accent/20 disabled:opacity-50"
                >
                  {mutating ? 'Saving…' : formMode === 'create' ? 'Create' : 'Save'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md rounded-app-xl border border-app-border/90 bg-app-bg-subtle/95 p-5 shadow-app-lift backdrop-blur-xl"
          >
            <h3 className="m-0 text-base font-semibold text-app-text">Delete Template</h3>
            <p className="mt-2 text-sm text-app-muted">
              Are you sure you want to delete{' '}
              <span className="font-medium text-app-text">{deleteTarget.name}</span>?
            </p>
            <p className="mt-1 text-xs text-app-faint">Deletion may be blocked if this template is active or in use.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-app-border px-3.5 py-2 text-sm text-app-muted hover:bg-app-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mutating}
                onClick={confirmDelete}
                className="rounded-lg border border-red-400/40 bg-red-500/15 px-3.5 py-2 text-sm text-red-200 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                {mutating ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {cloneTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md rounded-app-xl border border-app-border/90 bg-app-bg-subtle/95 p-5 shadow-app-lift backdrop-blur-xl"
          >
            <h3 className="m-0 text-base font-semibold text-app-text">Clone Template</h3>
            <p className="mt-2 text-sm text-app-muted">
              Create a deep copy of{' '}
              <span className="font-medium text-app-text">{cloneTarget.name}</span>?
            </p>
            <p className="mt-1 text-xs text-app-faint">A new draft template will be created with a copy suffix.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCloneTarget(null)}
                className="rounded-lg border border-app-border px-3.5 py-2 text-sm text-app-muted hover:bg-app-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mutating}
                onClick={confirmClone}
                className="rounded-lg border border-app-accent/50 bg-app-accent-muted px-3.5 py-2 text-sm transition-colors hover:bg-app-accent/20 disabled:opacity-50"
              >
                {mutating ? 'Cloning…' : 'Clone'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showChannelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg rounded-app-xl border border-app-border/90 bg-app-bg-subtle/95 p-5 shadow-app-lift backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-base font-semibold text-app-text">
                {editingBindingId ? 'Edit Channel Binding' : 'Add Channel Binding'}
              </h3>
              <button
                type="button"
                title="Close"
                onClick={() => setShowChannelDialog(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-app-faint hover:bg-app-surface-hover"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] text-app-muted">Channel</label>
                <select
                  value={channelIdInput}
                  onChange={(e) => setChannelIdInput(e.target.value)}
                  title="Select channel"
                  className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm outline-none"
                >
                  <option value="">Select a channel</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.key})
                    </option>
                  ))}
                </select>
              </div>
              {channelConfigValid ? (
                <div className="space-y-3 rounded-lg border border-white/[0.06] bg-black/15 p-3">
                  <div className="text-[11px] font-medium text-app-muted">Rendering options</div>
                  <div>
                    <label className="mb-1 block text-[11px] text-app-faint">Layout mode</label>
                    <select
                      value={layoutSelectCurrent}
                      onChange={(e) => mergeChannelConfig({ layout: e.target.value })}
                      title="How this channel lays out the template"
                      className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm outline-none"
                    >
                      {channelLayoutSelectOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-app-faint">Media handling</label>
                    <select
                      value={channelMediaHandling}
                      onChange={(e) => {
                        const v = e.target.value;
                        mergeChannelConfig({ mediaHandling: v ? v : undefined });
                      }}
                      title="Media processing preference for this channel"
                      className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm outline-none"
                    >
                      <option value="">Default (unset)</option>
                      <option value="optimized">Optimized</option>
                      <option value="original">Original</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-app-faint">Content fields</label>
                    <input
                      value={channelFieldsJoined}
                      onChange={(e) => {
                        const parts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                        mergeChannelConfig({ fields: parts.length ? parts : undefined });
                      }}
                      placeholder="title, content, image"
                      title="Comma-separated field names stored in config"
                      className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm outline-none placeholder:text-app-faint"
                    />
                    <p className="mt-1 text-[10px] text-app-faint">Separate with commas. Leave empty to omit.</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
                  Config isn&apos;t valid JSON yet. Edit the raw JSON below until it parses, then the short form will
                  return.
                </div>
              )}
              <div>
                {channelConfigValid ? (
                  <button
                    type="button"
                    onClick={() => setChannelJsonAdvancedOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-app-bg-subtle/80 px-3 py-2 text-left text-[12px] text-app-muted transition-colors hover:border-app-accent/30 hover:bg-app-accent-muted/20"
                  >
                    <span className="flex items-center gap-2">
                      <Code2 size={15} className="text-app-accent" aria-hidden />
                      {channelJsonAdvancedOpen ? 'Hide raw JSON' : 'Advanced: edit raw JSON'}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 transition-transform ${channelJsonAdvancedOpen ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>
                ) : (
                  <div className="text-[11px] font-medium text-app-muted">Raw JSON</div>
                )}
                {(channelJsonAdvancedOpen || !channelConfigValid) ? (
                  <textarea
                    rows={!channelConfigValid ? 10 : 8}
                    value={channelConfigInput}
                    onChange={(e) => setChannelConfigInput(e.target.value)}
                    title="Full channel rendering config as JSON"
                    className="mt-2 w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 font-mono text-xs leading-relaxed outline-none"
                  />
                ) : null}
              </div>
              {channelError && (
                <div className="rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {channelError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowChannelDialog(false)}
                  className="rounded-lg border border-app-border px-3.5 py-2 text-sm text-app-muted hover:bg-app-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={mutating}
                  onClick={submitChannelDialog}
                  className="rounded-lg border border-app-accent/50 bg-app-accent-muted px-3.5 py-2 text-sm transition-colors hover:bg-app-accent/20 disabled:opacity-50"
                >
                  {mutating ? 'Saving…' : editingBindingId ? 'Update Binding' : 'Add Binding'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {channelToast && (
        <div className="fixed bottom-4 right-4 z-70">
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            className={`max-w-sm rounded-xl border px-4 py-2.5 text-sm shadow-app-lift ${
              channelToast.type === 'error'
                ? 'border-red-400/40 bg-red-500/15 text-red-100'
                : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
            }`}
          >
            {channelToast.message}
          </motion.div>
        </div>
      )}
    </>
  );
}
