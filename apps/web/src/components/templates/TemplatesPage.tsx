import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Fingerprint,
  Globe,
  Info,
  Layout,
  LayoutTemplate,
  Link2,
  Loader2,
  Pencil,
  Plus,
  PowerOff,
  Save,
  Search,
  Sparkles,
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
import { PageShell, Surface, formInputClass, formLabelClass, formSelectClass } from '../ui';
import TemplateLayoutEditor from './TemplateLayoutEditor';

const TEMPLATES_LIST_SEARCH_KEY = 'templates:listSearch';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

function parseChannelLayoutConfig(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* invalid */
  }
  return null;
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
    channelId: '',
  });
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    description?: string;
    channelId?: string;
  }>({});
  const [formServerError, setFormServerError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<TemplateRecord | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<TemplateRecord | null>(null);
  const [cloneTarget, setCloneTarget] = useState<TemplateRecord | null>(null);
  const [cloneBanner, setCloneBanner] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelToast, setChannelToast] = useState<{
    type: 'error' | 'success';
    message: string;
  } | null>(null);
  const [copiedMeta, setCopiedMeta] = useState<string | null>(null);

  const q = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') as TemplateStatus | 'ALL' | null) ?? 'ALL';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.get('pageSize')))
    ? Number(searchParams.get('pageSize'))
    : 10;

  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutActivating, setLayoutActivating] = useState(false);
  const [layoutToolbar, setLayoutToolbar] = useState({
    dirty: false,
    canActivate: false,
    canSaveDraft: false,
    exceedsCharacterLimit: false,
  });
  const [layoutDraftSavedNotice, setLayoutDraftSavedNotice] = useState(false);
  const layoutDraftSavedTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  /** Below xl: switch between metadata rail and layout canvas */
  const [mobileWorkspace, setMobileWorkspace] = useState<'template' | 'layout'>('layout');

  const saveDraftRef = useRef<(() => Promise<void>) | null>(null);
  const activateDraftRef = useRef<(() => Promise<void>) | null>(null);

  const handleLayoutToolbarState = useCallback(
    (s: {
      dirty: boolean;
      canActivate: boolean;
      canSaveDraft: boolean;
      exceedsCharacterLimit: boolean;
    }) => {
      setLayoutToolbar((prev) =>
        prev.dirty === s.dirty &&
        prev.canActivate === s.canActivate &&
        prev.canSaveDraft === s.canSaveDraft &&
        prev.exceedsCharacterLimit === s.exceedsCharacterLimit
          ? prev
          : s,
      );
    },
    [],
  );

  const handleLayoutDraftSaved = useCallback(() => {
    setLayoutDraftSavedNotice(true);
    if (layoutDraftSavedTimerRef.current) window.clearTimeout(layoutDraftSavedTimerRef.current);
    layoutDraftSavedTimerRef.current = window.setTimeout(() => {
      setLayoutDraftSavedNotice(false);
      layoutDraftSavedTimerRef.current = null;
    }, 2200);
  }, []);

  const hasTemplateSelected = Boolean(templateId);

  /** Keep last list filters so "All templates" works after refresh or when router state is missing. */
  useEffect(() => {
    if (templateId) return;
    if (location.pathname !== '/templates') return;
    try {
      window.sessionStorage.setItem(TEMPLATES_LIST_SEARCH_KEY, location.search ?? '');
    } catch {
      /* ignore */
    }
  }, [templateId, location.pathname, location.search]);

  /** Query string (with leading `?`) to restore when returning to the list. */
  const effectiveListSearch = useMemo(() => {
    const raw = (location.state as { listSearch?: string } | null)?.listSearch;
    const fromState = typeof raw === 'string' ? raw.trim() : '';
    if (fromState) return fromState.startsWith('?') ? fromState : `?${fromState}`;
    if (typeof window === 'undefined') return '';
    try {
      const fromStore = (window.sessionStorage.getItem(TEMPLATES_LIST_SEARCH_KEY) ?? '').trim();
      if (fromStore) return fromStore.startsWith('?') ? fromStore : `?${fromStore}`;
    } catch {
      /* ignore */
    }
    return '';
  }, [location.state, location.key, templateId]);

  const templatesListHref = effectiveListSearch ? `/templates${effectiveListSearch}` : '/templates';

  const navigateToTemplatesList = useCallback(() => {
    if (effectiveListSearch) {
      void navigate({ pathname: '/templates', search: effectiveListSearch });
    } else {
      void navigate('/templates');
    }
  }, [navigate, effectiveListSearch]);

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
  }, [templateId]);

  useEffect(() => {
    if (!templateId) return;
    setLayoutToolbar({
      dirty: false,
      canActivate: false,
      canSaveDraft: false,
      exceedsCharacterLimit: false,
    });
    setLayoutDraftSavedNotice(false);
    if (layoutDraftSavedTimerRef.current) {
      window.clearTimeout(layoutDraftSavedTimerRef.current);
      layoutDraftSavedTimerRef.current = null;
    }
  }, [templateId]);

  useEffect(() => {
    return () => {
      if (layoutDraftSavedTimerRef.current) window.clearTimeout(layoutDraftSavedTimerRef.current);
    };
  }, []);

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
        channelId: detail.bindings?.[0]?.channelId ?? '',
      });
      setFormErrors({});
      setMutationError(null);
      setShowForm(true);
    }
  }, [detail, location.pathname]);

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

  function validateForm(data: typeof formData): {
    name?: string;
    description?: string;
    channelId?: string;
  } {
    const next: { name?: string; description?: string; channelId?: string } = {};
    const name = data.name.trim();
    if (!name) next.name = 'Name is required';
    else if (name.length > 200) next.name = 'Name must be 200 characters or fewer';
    if (data.description.length > 1000)
      next.description = 'Description must be 1000 characters or fewer';
    return next;
  }

  function openCreateForm() {
    setFormMode('create');
    setFormData({ name: '', description: '', status: 'DRAFT', channelId: '' });
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
      channelId: t.bindings?.[0]?.channelId ?? '',
    });
    setFormErrors({});
    setFormServerError(null);
    setMutationError(null);
    setShowForm(true);
    navigate(`/templates/${t.id}/edit`);
  }

  function applyBackendValidation(errorMessage: string): boolean {
    const msg = errorMessage.toLowerCase();
    const next: { name?: string; description?: string; channelId?: string } = {};

    if (msg.includes('name')) {
      next.name = errorMessage;
    } else if (msg.includes('description')) {
      next.description = errorMessage;
    } else if (msg.includes('channel')) {
      next.channelId = errorMessage;
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
        let bindings = created.bindings ?? [];
        if (formData.channelId.trim()) {
          const binding = await templateCrudService.addChannelBinding(created.id, {
            channelId: formData.channelId.trim(),
          });
          bindings = [binding];
        }
        const createdRecord: TemplateRecord = { ...created, bindings };
        setItems((prev) => [createdRecord, ...prev]);
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
        navigate(`/templates/${updated.id}`, { state: { listSearch: effectiveListSearch } });
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

  async function confirmDeactivate() {
    if (!deactivateTarget || deactivateTarget.status !== 'ACTIVE') return;
    setMutating(true);
    setMutationError(null);
    try {
      const updated = await templateCrudService.update(deactivateTarget.id, { status: 'DRAFT' });
      setItems((prev) =>
        prev.map((t) =>
          t.id === updated.id ? { ...updated, bindings: updated.bindings ?? t.bindings } : t,
        ),
      );
      if (detail?.id === updated.id) {
        setDetail((prev) =>
          prev && prev.id === updated.id
            ? { ...updated, bindings: updated.bindings ?? prev.bindings }
            : prev,
        );
      }
      setDeactivateTarget(null);
      setChannelToast({
        type: 'success',
        message: 'Template deactivated (draft). You can delete it if it is not in use.',
      });
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Deactivate failed');
    } finally {
      setMutating(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.status === 'ACTIVE') return;
    setMutating(true);
    setMutationError(null);
    try {
      await templateCrudService.remove(deleteTarget.id);
      setItems((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      if (detail?.id === deleteTarget.id) {
        setDetail(null);
        navigate(
          effectiveListSearch
            ? { pathname: '/templates', search: effectiveListSearch }
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
        state: { clonedFrom: sourceName, listSearch: effectiveListSearch },
      });
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Clone failed');
    } finally {
      setMutating(false);
    }
  }

  const copyTemplateMeta = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedMeta(key);
      window.setTimeout(() => setCopiedMeta(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  const layoutPreviewChannels = useMemo(() => {
    if (!detail?.bindings?.length) return [];
    return detail.bindings.map((b) => {
      const ch = channels.find((c) => c.id === b.channelId);
      const raw = readBindingConfig(b.id);
      const parsed = parseChannelLayoutConfig(raw);
      return {
        bindingId: b.id,
        channelId: b.channelId,
        channelName: ch?.name ?? 'Channel',
        channelKey: ch?.key ?? 'channel',
        layoutConfig: parsed,
        compatibility: ch?.compatibility,
      };
    });
  }, [channels, detail?.bindings]);
  const activeEditorChannel = useMemo(() => {
    const channelId = detail?.bindings?.[0]?.channelId;
    if (!channelId) return null;
    return channels.find((c) => c.id === channelId) ?? null;
  }, [channels, detail?.bindings]);

  return (
    <>
      {hasTemplateSelected ? (
        /* Full-height editor — same shell rhythm as content editor */
        <div className="relative flex h-screen flex-col overflow-hidden bg-app-bg app-main-canvas">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
            <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-app-accent/10 blur-[100px]" />
            <div className="absolute right-0 top-24 h-64 w-64 rounded-full bg-app-accent-2/8 blur-[90px]" />
          </div>
          <header className="relative z-40 shrink-0 border-b border-white/[0.08] bg-app-bg/70 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:px-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <nav
                  aria-label="Breadcrumb"
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] leading-tight"
                >
                  <button
                    type="button"
                    title={templatesListHref}
                    aria-label="Back to all templates"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => navigateToTemplatesList()}
                    className="group flex shrink-0 cursor-pointer items-center gap-1 rounded-app-md border border-transparent px-2 py-1.5 text-left text-app-muted hover:border-app-border hover:bg-app-surface-hover hover:text-app-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/35"
                  >
                    <ChevronLeft size={15} className="shrink-0" aria-hidden />
                    <span className="hidden sm:inline">All templates</span>
                    <span className="sm:hidden">List</span>
                  </button>
                  <ChevronRight size={13} className="shrink-0 text-app-faint" aria-hidden />
                  {detailLoading ? (
                    <span
                      className="h-4 w-36 max-w-[50vw] rounded-md bg-app-border/50"
                      aria-hidden
                    />
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
                    <div className="flex items-center gap-1 rounded-app-md border border-app-border bg-app-bg-subtle p-0.5">
                      <button
                        type="button"
                        title="Clone this template"
                        onClick={() => {
                          setCloneTarget(detail);
                          setMutationError(null);
                        }}
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-app-muted hover:bg-app-surface-hover hover:text-app-text"
                      >
                        <Copy size={14} />
                        <span className="hidden md:inline">Clone</span>
                      </button>
                      <button
                        type="button"
                        title="Edit name and description"
                        onClick={() => openEditForm(detail)}
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-app-muted hover:bg-app-surface-hover hover:text-app-text"
                      >
                        <Pencil size={14} />
                        <span className="hidden md:inline">Details</span>
                      </button>
                      {detail.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          title="Unpublish: set template to draft so it can be deleted or edited safely"
                          onClick={() => {
                            setDeactivateTarget(detail);
                            setMutationError(null);
                          }}
                          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-amber-200/95 hover:bg-amber-500/15 hover:text-amber-100"
                        >
                          <PowerOff size={14} />
                          <span className="hidden md:inline">Deactivate</span>
                        </button>
                      ) : null}
                    </div>

                    <span className="hidden h-6 w-px bg-app-border/50 md:block" aria-hidden />

                    <button
                      type="button"
                      title={
                        layoutToolbar.exceedsCharacterLimit && layoutToolbar.dirty
                          ? 'Reduce rich text to satisfy this channel’s character limit before saving'
                          : layoutToolbar.dirty
                            ? 'Save layout draft to the server'
                            : 'No unsaved layout changes'
                      }
                      onClick={() => saveDraftRef.current?.()}
                      disabled={layoutSaving || detailLoading || !layoutToolbar.canSaveDraft}
                      className={`flex items-center gap-1.5 rounded-app-md border px-3.5 py-2 text-[13px] font-medium ${
                        layoutSaving
                          ? 'cursor-not-allowed border-app-border/60 bg-app-bg/30 text-app-faint opacity-70'
                          : !layoutToolbar.canSaveDraft
                            ? 'cursor-not-allowed border-app-border/60 bg-app-bg/30 text-app-faint opacity-50'
                            : 'border-app-border/90 bg-app-bg/45 text-app-muted hover:border-app-accent/35 hover:bg-app-accent-muted hover:text-app-accent'
                      }`}
                    >
                      {layoutSaving ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      <span className="hidden sm:inline">Save draft</span>
                    </button>
                    <button
                      type="button"
                      title={
                        layoutToolbar.dirty
                          ? 'Save draft changes before activating'
                          : !layoutToolbar.canActivate
                            ? 'Fix layout or channel requirements before activating'
                            : 'Publish layout as active'
                      }
                      onClick={() => activateDraftRef.current?.()}
                      disabled={layoutActivating || !layoutToolbar.canActivate}
                      className={`flex items-center gap-1.5 rounded-app-md border px-3 py-1.5 text-[12px] font-semibold ${
                        layoutActivating
                          ? 'cursor-not-allowed border-emerald-500/20 bg-emerald-500/10 text-emerald-300/50 opacity-70'
                          : !layoutToolbar.canActivate
                            ? 'cursor-not-allowed border-app-border/60 bg-app-bg/30 text-app-faint opacity-50'
                            : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20'
                      }`}
                    >
                      {layoutActivating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle size={14} />
                      )}
                      <span className="hidden sm:inline">Activate</span>
                    </button>
                  </div>
                )}
              </div>

              {layoutSaving ||
              layoutActivating ||
              cloneBanner ||
              mutationError ||
              (layoutDraftSavedNotice && !layoutSaving) ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-app-border/40 pt-2 text-[11px] sm:text-[12px]">
                  {(layoutSaving || layoutActivating) && (
                    <span className="text-app-faint">
                      {layoutSaving ? 'Saving draft…' : 'Activating template…'}
                    </span>
                  )}
                  {layoutDraftSavedNotice && !layoutSaving && !layoutActivating && (
                    <span className="text-emerald-300/90">Draft saved on server.</span>
                  )}
                  {cloneBanner && (
                    <span className="text-emerald-300/95">
                      Cloned from &quot;{cloneBanner}&quot;
                    </span>
                  )}
                  {mutationError && <span className="text-red-300">{mutationError}</span>}
                </div>
              ) : null}
            </div>
          </header>

          {/* Mobile / tablet: switch metadata vs layout (mirrors content editor split) */}
          <div
            className="relative z-10 flex shrink-0 gap-1 border-b border-white/[0.08] bg-app-bg/60 px-2 py-2 backdrop-blur-md xl:hidden"
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
              className={`flex flex-1 items-center justify-center gap-2 rounded-app-md border border-transparent py-2 text-[12px] font-medium ${
                mobileWorkspace === 'template'
                  ? 'border-app-accent/35 bg-app-accent-muted/70 text-app-accent'
                  : 'text-app-faint hover:bg-app-surface-hover hover:text-app-muted'
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
              className={`flex flex-1 items-center justify-center gap-2 rounded-app-md border border-transparent py-2 text-[12px] font-medium ${
                mobileWorkspace === 'layout'
                  ? 'border-app-accent/35 bg-app-accent-muted/70 text-app-accent'
                  : 'text-app-faint hover:bg-app-surface-hover hover:text-app-muted'
              }`}
            >
              <LayoutTemplate size={15} aria-hidden />
              Layout
            </button>
          </div>

          {/* Main workspace — sidebar fixed left, editor fills remainder */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-row overflow-hidden bg-app-bg/25">
            {/* Left: template metadata & overview */}
            <aside
              id="template-meta-panel"
              role="tabpanel"
              aria-labelledby="tab-workspace-template"
              className={`order-1 flex w-full shrink-0 flex-col overflow-hidden border-r border-white/[0.08] bg-app-bg/55 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl supports-backdrop-filter:bg-app-bg/40 md:w-[17.5rem] lg:w-[19rem] ${
                mobileWorkspace === 'template' ? 'flex' : 'hidden'
              } xl:flex`}
            >
              <div className="flex shrink-0 flex-col gap-2 border-b border-white/[0.07] px-2.5 pb-2.5 pt-2.5 sm:px-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-app-faint">
                  Inspector
                </p>
                <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-app-bg px-2.5 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-app-accent/25 bg-app-accent-muted/35 text-app-accent">
                    <Info size={15} strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold leading-tight text-app-text">
                      Overview
                    </p>
                    <p className="mt-0.5 text-[9px] leading-snug text-app-faint">
                      Status, channel (fixed at creation), identifiers
                    </p>
                  </div>
                </div>
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
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-app-accent/85" aria-hidden />
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-app-faint">
                          About
                        </p>
                      </div>
                      {detail.description ? (
                        <p className="mt-2 leading-relaxed text-[12px] text-app-muted">
                          {detail.description}
                        </p>
                      ) : (
                        <p className="mt-2 text-[11px] italic text-app-faint">
                          No description yet. Use Details in the header to add one.
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-app-border bg-app-bg p-3.5">
                      <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-app-faint">
                        <Fingerprint size={14} className="text-emerald-400/75" aria-hidden />
                        Template record
                      </p>
                      <div className="space-y-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] text-app-faint">Status</p>
                            <p className="mt-1">
                              <span
                                className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  detail.status === 'ACTIVE'
                                    ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                                    : detail.status === 'DRAFT'
                                      ? 'border-amber-400/35 bg-amber-500/12 text-amber-200'
                                      : 'border-zinc-500/35 bg-zinc-500/10 text-zinc-300'
                                }`}
                              >
                                {detail.status}
                              </span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-app-faint">Layout</p>
                            <p className="mt-1 text-[11px] text-app-muted">
                              {detail.draftLayout != null ? (
                                <span className="text-app-text">Draft saved</span>
                              ) : (
                                <span className="text-app-faint">No draft</span>
                              )}
                              <span className="text-app-faint"> · </span>
                              {detail.activeLayout != null ? (
                                <span className="text-emerald-300/90">Published</span>
                              ) : (
                                <span>Not active</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] text-app-faint">Bound channel</p>
                          {(() => {
                            const binding = detail.bindings?.[0];
                            if (!binding)
                              return (
                                <div className="mt-1">
                                  <p className="text-[11px] text-app-muted">
                                    None{' '}
                                    <span className="text-app-faint">
                                      (unrestricted layout and toolkit)
                                    </span>
                                  </p>
                                </div>
                              );
                            const channel = channels.find((c) => c.id === binding.channelId);
                            return (
                              <div className="mt-1">
                                <p className="text-[12px] text-app-text">
                                  <span className="font-semibold">
                                    {channel?.name ?? 'Channel'}
                                  </span>{' '}
                                  <span className="text-app-faint">
                                    ({channel?.key ?? binding.channelId})
                                  </span>
                                </p>
                                <p className="mt-1 text-[10px] leading-snug text-app-faint">
                                  Set when the template was created. It cannot be changed from the
                                  editor.
                                </p>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <p className="flex items-center gap-1 text-[10px] text-app-faint">
                              <Calendar size={12} aria-hidden />
                              Created
                            </p>
                            <p className="mt-1 tabular-nums text-[11px] text-app-muted">
                              {new Date(detail.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="flex items-center gap-1 text-[10px] text-app-faint">
                              <Clock size={12} aria-hidden />
                              Updated
                            </p>
                            <p className="mt-1 tabular-nums text-[11px] text-app-muted">
                              {new Date(detail.updatedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] text-app-faint">Workspace</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <code className="min-w-0 flex-1 truncate rounded-md bg-white/[0.05] px-2 py-1 font-mono text-[10px] text-app-muted">
                              {detail.workspaceId}
                            </code>
                            <button
                              type="button"
                              title="Copy workspace ID"
                              onClick={() => copyTemplateMeta(detail.workspaceId, 'ws')}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-app-muted hover:border-app-accent/35 hover:bg-app-accent-muted/30 hover:text-app-accent"
                            >
                              {copiedMeta === 'ws' ? (
                                <CheckCircle size={14} className="text-emerald-400" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] text-app-faint">Slug</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <code className="min-w-0 flex-1 truncate rounded-md bg-white/[0.05] px-2 py-1 font-mono text-[10px] text-app-text">
                              {detail.slug ?? '—'}
                            </code>
                            {detail.slug ? (
                              <button
                                type="button"
                                title="Copy slug"
                                onClick={() => copyTemplateMeta(detail.slug, 'slug')}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-app-muted hover:border-app-accent/35 hover:bg-app-accent-muted/30 hover:text-app-accent"
                              >
                                {copiedMeta === 'slug' ? (
                                  <CheckCircle size={14} className="text-emerald-400" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] text-app-faint">Template ID</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <code className="min-w-0 flex-1 truncate rounded-md bg-white/[0.05] px-2 py-1 font-mono text-[10px] text-app-muted">
                              {detail.id}
                            </code>
                            <button
                              type="button"
                              title="Copy template ID"
                              onClick={() => copyTemplateMeta(detail.id, 'id')}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-app-muted hover:border-app-accent/35 hover:bg-app-accent-muted/30 hover:text-app-accent"
                            >
                              {copiedMeta === 'id' ? (
                                <CheckCircle size={14} className="text-emerald-400" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
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
                    <Loader2
                      size={24}
                      className="absolute inset-0 m-auto animate-spin text-app-accent"
                    />
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
                <div className="flex-1 overflow-y-auto bg-gradient-to-b from-transparent via-app-bg/40 to-app-bg px-4 py-5 sm:px-6">
                  <TemplateLayoutEditor
                    templateId={detail.id}
                    draftLayout={detail.draftLayout}
                    previewChannels={layoutPreviewChannels}
                    channelCompatibility={activeEditorChannel?.compatibility ?? null}
                    channelLabel={
                      activeEditorChannel
                        ? `${activeEditorChannel.name} (${activeEditorChannel.key})`
                        : undefined
                    }
                    onLayoutSaved={(saved) => {
                      setDetail((prev) =>
                        prev && prev.id === saved.id
                          ? { ...saved, bindings: saved.bindings ?? prev.bindings }
                          : saved,
                      );
                      setItems((prev) =>
                        prev.map((t) =>
                          t.id === saved.id
                            ? { ...saved, bindings: saved.bindings ?? t.bindings }
                            : t,
                        ),
                      );
                    }}
                    compact
                    saveRef={saveDraftRef}
                    activateRef={activateDraftRef}
                    onSavingChange={setLayoutSaving}
                    onActivatingChange={setLayoutActivating}
                    onToolbarState={handleLayoutToolbarState}
                    onDraftSaved={handleLayoutDraftSaved}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        /* List view */
        <PageShell wide className="app-main-canvas min-h-screen text-app-text">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
            <div className="absolute -left-16 top-20 h-56 w-56 rounded-full bg-app-accent/10 blur-[90px]" />
            <div className="absolute right-0 top-40 h-48 w-48 rounded-full bg-app-accent-2/10 blur-[80px]" />
          </div>
          <PageHeader
            title="Templates"
            accentWord="Templates"
            description="Search, filter, then open a template to edit its layout."
          />
          <div className="animate-fade-in mb-5 space-y-2">
            {cloneBanner && (
              <div className="rounded-app-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                Cloned from &quot;{cloneBanner}&quot;.
              </div>
            )}
            {mutationError && (
              <div className="rounded-app-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {mutationError}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="min-w-0">
              <Surface
                variant="glass"
                padding="md"
                className="relative mb-5 overflow-hidden shadow-app-lift transition-shadow duration-(--duration-app-slow) ease-app-out hover:shadow-app-soft"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 top-0 h-36 w-36 rounded-full bg-app-accent/12 blur-3xl"
                />
                <div className="relative z-1 flex flex-wrap items-end gap-x-4 gap-y-3">
                  <div className="min-w-[min(100%,220px)] flex-1">
                    <label htmlFor="templates-search" className={formLabelClass}>
                      Search
                    </label>
                    <div className="relative">
                      <Search
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 z-1 -translate-y-1/2 text-app-accent/70"
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
                        className={`${formInputClass} py-2.5 pl-9 pr-3 text-sm`}
                      />
                    </div>
                  </div>
                  <div className="w-[min(100%,8.5rem)]">
                    <label htmlFor="templates-status" className={formLabelClass}>
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
                      className={`${formSelectClass} px-3 py-2.5 text-sm`}
                    >
                      <option value="ALL">All</option>
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>
                  <div className="w-[min(100%,5.5rem)]">
                    <label htmlFor="templates-page-size" className={formLabelClass}>
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
                      className={`${formSelectClass} px-3 py-2.5 text-sm`}
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
                      className="flex w-full items-center justify-center gap-2 rounded-app-md bg-gradient-to-r from-app-accent to-app-accent-2 px-4 py-2.5 text-sm font-semibold text-app-bg shadow-[0_0_24px_-8px_rgba(147,124,248,0.45)] ring-1 ring-white/15 transition-[transform,box-shadow,filter] duration-(--duration-app-slow) ease-(--ease-app-out) hover:brightness-105 active:scale-[0.98] sm:w-auto"
                    >
                      <Plus size={15} aria-hidden /> New template
                    </button>
                  </div>
                </div>
              </Surface>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-2xl border border-white/[0.08] bg-app-bg/40 shadow-app-lift backdrop-blur-md supports-backdrop-filter:bg-app-bg/30"
                    >
                      <div className="flex items-center gap-5 px-6 py-4 pl-6">
                        <div
                          className="absolute left-0 h-full w-[3px] rounded-l-2xl bg-app-border/60"
                          aria-hidden
                        />
                        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-app-border" />
                        <div className="flex-1 space-y-2.5">
                          <div className="flex items-center justify-between gap-4">
                            <div className="h-[15px] w-1/2 rounded-md bg-app-border" />
                            <div className="h-5 w-14 rounded-full bg-app-border/60" />
                          </div>
                          <div className="h-3 w-3/4 rounded-md bg-app-border/50" />
                          <div className="flex gap-3 pt-0.5">
                            <div className="h-3 w-20 rounded-full bg-app-border/40" />
                            <div className="h-3 w-16 rounded-full bg-app-border/40" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-400/35 bg-red-500/10 p-8 text-center shadow-app-lift backdrop-blur-md">
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-app-bg/35 py-20 text-center shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/28">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/12 bg-gradient-to-br from-app-accent/20 to-app-accent-2/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-white/10">
                    <FileText className="h-7 w-7 text-app-faint" />
                  </div>
                  <h3 className="mb-2 text-[15px] font-semibold tracking-tight text-app-text">
                    No templates found
                  </h3>
                  <p className="max-w-xs text-[13px] leading-relaxed text-app-muted">
                    Nothing matches your current filters. Try adjusting the search or status.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchParams({})}
                    className="mt-6 rounded-xl border border-app-border/80 bg-app-surface/60 px-4 py-2 text-[13px] font-medium text-app-muted hover:border-app-accent/35 hover:bg-app-accent-muted hover:text-app-accent"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pageRows.map((t) => (
                    <div
                      key={t.id}
                      onClick={() =>
                        navigate(`/templates/${t.id}`, { state: { listSearch: location.search } })
                      }
                      className="group relative flex cursor-pointer overflow-hidden rounded-2xl border border-white/[0.09] bg-app-bg/45 shadow-app-lift backdrop-blur-md transition-[transform,border-color,box-shadow] duration-(--duration-app-slow) ease-(--ease-app-out) supports-backdrop-filter:bg-app-bg/32 hover:-translate-y-px hover:border-app-accent/40 hover:shadow-app-glow motion-reduce:transform-none"
                    >
                      {/* Status accent left strip */}
                      <div
                        className={`absolute left-0 top-0 h-full w-[3px] rounded-l-2xl ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-500/70'
                            : t.status === 'DRAFT'
                              ? 'bg-amber-500/70'
                              : 'bg-zinc-500/60'
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
                              <div className="text-[15px] font-semibold leading-tight tracking-tight text-app-text group-hover:text-app-accent">
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
                              <Clock
                                className="h-3 w-3 shrink-0 text-app-accent-2/75"
                                aria-hidden
                              />
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
                      <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditForm(t);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-app-border bg-app-bg text-app-faint hover:border-app-accent/40 hover:text-app-accent"
                          title="Edit template"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCloneTarget(t);
                            setMutationError(null);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-app-border bg-app-bg text-app-faint hover:border-app-accent/40 hover:text-app-accent"
                          title="Clone template"
                        >
                          <Copy size={12} />
                        </button>
                        {t.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeactivateTarget(t);
                              setMutationError(null);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/30 bg-app-bg text-app-faint hover:border-amber-400/50 hover:text-amber-200"
                            title="Deactivate (unpublish) template"
                          >
                            <PowerOff size={12} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(t);
                            setMutationError(null);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-400/25 bg-app-bg text-app-faint hover:border-red-400/50 hover:text-red-400"
                          title="Delete template"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="mt-5 flex items-center justify-between px-1 text-xs text-app-faint">
                    <div>
                      Showing <span className="font-medium text-app-text">{pageRows.length}</span>{' '}
                      of <span className="font-medium text-app-text">{items.length}</span>
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
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-app-bg/40 text-app-muted backdrop-blur-sm transition-colors hover:border-app-accent/35 hover:bg-white/6 hover:text-app-accent disabled:opacity-40"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <div className="rounded-xl border border-white/10 bg-app-bg/50 px-4 py-1.5 text-[11px] tabular-nums text-app-muted backdrop-blur-sm">
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
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-app-bg/40 text-app-muted backdrop-blur-sm transition-colors hover:border-app-accent/35 hover:bg-white/6 hover:text-app-accent disabled:opacity-40"
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
                <div className="overflow-hidden rounded-app-xl border border-white/[0.1] bg-app-bg/45 shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/32">
                  <div className="flex h-20 items-center justify-center border-b border-white/[0.08] bg-app-bg/50">
                    <div className="flex h-12 w-12 items-center justify-center rounded-app-lg border border-white/10 bg-gradient-to-br from-app-accent/25 to-app-accent-2/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                      <LayoutTemplate className="h-6 w-6 text-app-accent" strokeWidth={1.5} />
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="mb-1 text-[15px] font-semibold tracking-tight text-app-text">
                      Template Studio
                    </h3>
                    <p className="text-[13px] leading-relaxed text-app-muted">
                      Click any template to open the full-height editor with layout blocks and auto
                      translations. Optional delivery channel is chosen when you create a template.
                    </p>
                  </div>
                </div>

                {/* Feature hints */}
                {(
                  [
                    {
                      icon: Layout,
                      label: 'Layout blocks',
                      desc: 'Drag-and-drop visual regions for your content structure.',
                    },
                    {
                      icon: Link2,
                      label: 'Delivery channel',
                      desc: 'Optional at template creation; fixed afterward for that template.',
                    },
                    {
                      icon: Globe,
                      label: 'Translations',
                      desc: 'Manage i18n keys and preview locale-specific output.',
                    },
                  ] as const
                ).map(({ icon: Icon, label, desc }) => (
                  <div
                    key={label}
                    className="flex gap-3 rounded-app-lg border border-white/[0.08] bg-app-bg/35 p-4 shadow-app-soft backdrop-blur-md transition-[border-color,transform] duration-(--duration-app) ease-app-out hover:border-white/14 hover:-translate-y-0.5 motion-reduce:transform-none"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-app-md border border-white/10 bg-white/[0.05]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-app-xl border border-app-border bg-app-bg-subtle p-5">
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
              {formMode === 'create' && (
                <div>
                  <label className="mb-1 block text-[12px] text-app-muted">
                    Bound channel <span className="font-normal text-app-faint">(optional)</span>
                  </label>
                  <p className="mb-2 text-[11px] leading-relaxed text-app-faint">
                    Leave unset for an unrestricted layout: full toolkit and no channel caps on rich
                    text or block structure. If you pick a channel, it is fixed for this template
                    and cannot be changed from the layout editor.
                  </p>
                  <select
                    value={formData.channelId}
                    title="Select channel to bind, or none"
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, channelId: e.target.value }));
                      if (formErrors.channelId)
                        setFormErrors((prev) => ({ ...prev, channelId: undefined }));
                      if (formServerError) setFormServerError(null);
                    }}
                    className="w-full rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm outline-none"
                    disabled={channelsLoading}
                  >
                    <option value="">
                      {channelsLoading ? 'Loading channels…' : 'No channel (unrestricted)'}
                    </option>
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.key})
                      </option>
                    ))}
                  </select>
                  {formErrors.channelId && (
                    <p className="mt-1 text-xs text-red-300">{formErrors.channelId}</p>
                  )}
                </div>
              )}
              <div>
                <label className="mb-1 block text-[12px] text-app-muted">Description</label>
                <textarea
                  value={formData.description}
                  title="Template description"
                  placeholder="Optional description"
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, description: e.target.value }));
                    if (formErrors.description)
                      setFormErrors((prev) => ({ ...prev, description: undefined }));
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
                  className="rounded-lg border border-app-accent/50 bg-app-accent-muted px-3.5 py-2 text-sm hover:bg-app-accent/20 disabled:opacity-50"
                >
                  {mutating ? 'Saving…' : formMode === 'create' ? 'Create' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-app-xl border border-app-border bg-app-bg-subtle p-5">
            <h3 className="m-0 text-base font-semibold text-app-text">Delete Template</h3>
            {deleteTarget.status === 'ACTIVE' ? (
              <>
                <p className="mt-2 text-sm text-app-muted">
                  <span className="font-medium text-app-text">{deleteTarget.name}</span> is still{' '}
                  <span className="font-semibold text-emerald-200/90">ACTIVE</span>. Published
                  templates cannot be deleted until they are deactivated.
                </p>
                <p className="mt-2 text-xs text-app-faint">
                  Deactivate moves it back to draft; you can delete afterward if no content
                  references it.
                </p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-lg border border-app-border px-3.5 py-2 text-sm text-app-muted hover:bg-app-surface-hover"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const t = deleteTarget;
                      setDeleteTarget(null);
                      setDeactivateTarget(t);
                    }}
                    className="rounded-lg border border-amber-400/45 bg-amber-500/15 px-3.5 py-2 text-sm text-amber-100 hover:bg-amber-500/25"
                  >
                    Deactivate…
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-app-muted">
                  Are you sure you want to delete{' '}
                  <span className="font-medium text-app-text">{deleteTarget.name}</span>?
                </p>
                <p className="mt-1 text-xs text-app-faint">
                  Deletion may be blocked if this template is in use.
                </p>
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
                    className="rounded-lg border border-red-400/40 bg-red-500/15 px-3.5 py-2 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {mutating ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-app-xl border border-app-border bg-app-bg-subtle p-5">
            <h3 className="m-0 text-base font-semibold text-app-text">Deactivate template</h3>
            <p className="mt-2 text-sm text-app-muted">
              Unpublish <span className="font-medium text-app-text">{deactivateTarget.name}</span>?
              It will become a <span className="font-medium text-amber-200/90">DRAFT</span> and will
              no longer be the active layout for new sends. You can edit or delete it afterward (if
              nothing references it).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeactivateTarget(null)}
                className="rounded-lg border border-app-border px-3.5 py-2 text-sm text-app-muted hover:bg-app-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mutating || deactivateTarget.status !== 'ACTIVE'}
                onClick={confirmDeactivate}
                className="rounded-lg border border-amber-400/45 bg-amber-500/15 px-3.5 py-2 text-sm text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
              >
                {mutating ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cloneTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-app-xl border border-app-border bg-app-bg-subtle p-5">
            <h3 className="m-0 text-base font-semibold text-app-text">Clone Template</h3>
            <p className="mt-2 text-sm text-app-muted">
              Create a deep copy of{' '}
              <span className="font-medium text-app-text">{cloneTarget.name}</span>?
            </p>
            <p className="mt-1 text-xs text-app-faint">
              A new draft template will be created with a copy suffix.
            </p>
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
                className="rounded-lg border border-app-accent/50 bg-app-accent-muted px-3.5 py-2 text-sm hover:bg-app-accent/20 disabled:opacity-50"
              >
                {mutating ? 'Cloning…' : 'Clone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {channelToast && (
        <div className="fixed bottom-4 right-4 z-70">
          <div
            className={`max-w-sm rounded-xl border px-4 py-2.5 text-sm ${
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
