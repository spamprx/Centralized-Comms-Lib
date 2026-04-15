import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Loader2,
  Check,
  BookMarked,
  Link as LinkIcon,
  Puzzle,
  ChevronRight,
  LayoutTemplate,
  Users,
} from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { contentService, ContentSaveConflictError } from '../services/contentService';
import { componentService } from '../services/componentService';
import { getAuthToken } from '../services/tokenStore';
import {
  renderCitationWithFallback,
  toCitationWork,
  type CitationStyle,
  type CitationWork,
} from '../services/citationService';
import type { ContentSearchHit } from '../services/searchService';
import { useEditorStore } from '../store/editorStore';
import { useAuth } from '../context/AuthContext';
import SimilarContentWidget from '../components/content/SimilarContentWidget';
import CitationSearchDialog from '../components/editor/CitationSearchDialog';
import ComponentLibraryPanel from '../components/editor/ComponentLibraryPanel';
import SlashCommandMenu from '../components/editor/SlashCommandMenu';
import UseTemplateDialog from '../components/editor/UseTemplateDialog';
import TipTapReadonly from '../components/editor/TipTapReadonly';
import {
  emptyReferencesSectionHtml,
  hasBibliographySection,
  upsertBibliographySection,
  type CitationMarkerMode,
} from '../lib/citationMarkers';
import { CitationMarker, citationMarkLabel } from '../tiptap/CitationMarker';
import { ComponentReference } from '../tiptap/ComponentReference';
import { layoutConfigToTipTapDoc, templateLayoutDocExtensions } from '../tiptap/templateLayoutDoc';
import { parseTemplateLayout } from '../lib/templateLayout/layoutConfig';
import type { TemplateRecord } from '../services/templateCrudService';

type CitationItem = {
  marker: number;
  style: CitationStyle;
  text: string;
  title: string;
  sourceId: string;
  work: CitationWork;
};

function maxHeadVersion(versions: Array<{ versionNumber: number }> | undefined): number {
  if (!versions?.length) return 0;
  return Math.max(...versions.map((v) => v.versionNumber));
}

function userInitials(email: string, displayName?: string | null): string {
  const s = (displayName?.trim() || email || '?').trim();
  const parts = s.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return s.slice(0, 2).toUpperCase() || '?';
}

export default function EditorLayout() {
  const { user } = useAuth();
  const { contentId: routeContentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const { draftTitle, setDraftTitle, draftContent, setDraftContent, clearDraft } = useEditorStore();
  const [title, setTitle] = useState(draftTitle);
  const [content, setContent] = useState(draftContent || '<p></p>');
  const [mainTab, setMainTab] = useState<'edit' | 'preview'>('edit');
  const [contentId, setContentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Server head revision when last save returned 409 (another editor saved first). */
  const [saveConflictVersion, setSaveConflictVersion] = useState<number | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<{ title: string; content: string } | null>(
    null,
  );
  const [showSaveComponentModal, setShowSaveComponentModal] = useState(false);
  const [componentName, setComponentName] = useState('');
  const [componentKey, setComponentKey] = useState('');
  const [componentMode, setComponentMode] = useState<'linked' | 'detached'>('linked');
  const [componentDescription, setComponentDescription] = useState('');
  const [componentSaving, setComponentSaving] = useState(false);
  const [componentSaveError, setComponentSaveError] = useState<string | null>(null);
  const [componentNotice, setComponentNotice] = useState<string | null>(null);
  const [selectionText, setSelectionText] = useState('');
  const [showCitationDialog, setShowCitationDialog] = useState(false);
  const [citationDialogMountKey, setCitationDialogMountKey] = useState(0);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA');
  const [citationMarkerMode, setCitationMarkerMode] = useState<CitationMarkerMode>('chip');
  const [referenceNotice, setReferenceNotice] = useState<string | null>(null);
  const [citationItems, setCitationItems] = useState<CitationItem[]>([]);
  const citationItemsRef = useRef(citationItems);
  citationItemsRef.current = citationItems;
  const [rightPanelTab, setRightPanelTab] = useState<'library' | 'properties' | 'similar' | 'refs'>(
    'library',
  );
  const [libraryCatalogSource, setLibraryCatalogSource] = useState<'loading' | 'api' | 'demo'>(
    'loading',
  );
  const [wordCount, setWordCount] = useState(0);
  /** Co-authors with a recent editor heartbeat (excluding the current user). */
  const [editorPresenceOthers, setEditorPresenceOthers] = useState<
    Array<{ userId: string; displayName: string; email: string; lastSeenAt: string }>
  >([]);
  const [presenceStatus, setPresenceStatus] = useState<
    { kind: 'ok' } | { kind: 'error'; status: number }
  >({ kind: 'ok' });
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [showUseTemplateDialog, setShowUseTemplateDialog] = useState(false);
  /** Passed to create draft only for new content (first save) so formatting rules bind to the template. */
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [contentType, setContentType] = useState<'ARTICLE' | 'VIDEO' | 'PODCAST' | 'DOCUMENT'>(
    'ARTICLE',
  );
  const [lifecycleState, setLifecycleState] = useState<
    'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED'
  >('DRAFT');
  const hydratedIdRef = useRef<string | null>(null);
  /** Latest `content_versions.versionNumber` for optimistic save concurrency. */
  const headVersionRef = useRef<number>(0);

  const persistedContentId = useMemo(
    () => contentId ?? (routeContentId && routeContentId !== 'new' ? routeContentId : null),
    [contentId, routeContentId],
  );

  const dirty = useMemo(() => {
    if (!savedSnapshot) return true;
    return title.trim() !== savedSnapshot.title || content !== savedSnapshot.content;
  }, [title, content, savedSnapshot]);

  const similarCheckContentId =
    contentId ?? (routeContentId && routeContentId !== 'new' ? routeContentId : null);

  useEffect(() => {
    if (!persistedContentId || !user?.id) {
      setPresenceStatus({ kind: 'ok' });
      setEditorPresenceOthers([]);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setPresenceStatus({ kind: 'error', status: 401 });
      setEditorPresenceOthers([]);
      return;
    }

    let closed = false;
    let ws: WebSocket | null = null;
    let pingId: number | null = null;

    const connect = () => {
      const api = String(import.meta.env.VITE_API_URL ?? '').trim();
      const u = new URL(api || globalThis.location.origin);
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      u.pathname = '/ws';
      u.searchParams.set('token', token);

      ws = new WebSocket(u.toString());

      ws.addEventListener('open', () => {
        if (closed || !ws) return;
        setPresenceStatus({ kind: 'ok' });
        ws.send(JSON.stringify({ type: 'presence:join', contentId: persistedContentId }));
        pingId = globalThis.setInterval(() => {
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify({ type: 'presence:ping', contentId: persistedContentId }));
        }, 15_000);
      });

      ws.addEventListener('message', (e) => {
        if (closed) return;
        let data: unknown = null;
        try {
          data = JSON.parse(String(e.data));
        } catch {
          return;
        }
        if (!data || typeof data !== 'object') return;
        const m = data as Record<string, unknown>;
        if (m.type === 'presence:error') {
          const status = typeof m.status === 'number' ? m.status : 500;
          setPresenceStatus({ kind: 'error', status });
          setEditorPresenceOthers([]);
          return;
        }
        if (m.type === 'presence:update' && m.contentId === persistedContentId) {
          const users = Array.isArray(m.users) ? (m.users as any[]) : [];
          const normalized = users
            .map((p) => ({
              userId: String(p.userId ?? ''),
              displayName: String(p.displayName ?? ''),
              email: String(p.email ?? ''),
              lastSeenAt: '',
            }))
            .filter((p) => p.userId && p.userId !== user.id);
          setPresenceStatus({ kind: 'ok' });
          setEditorPresenceOthers(normalized);
        }
        if (m.type === 'presence:restore_requested' && m.contentId === persistedContentId) {
          const by = m.requestedBy && typeof m.requestedBy === 'object' ? (m.requestedBy as any) : null;
          const name = by && typeof by.displayName === 'string' ? by.displayName : 'The author';
          setRestoreNotice(`${name} requested a version restore. Please finish up and leave the editor.`);
          setRestoreModalOpen(true);
        }
      });

      ws.addEventListener('close', () => {
        if (closed) return;
        setPresenceStatus({ kind: 'error', status: 0 });
      });
    };

    connect();

    return () => {
      closed = true;
      if (pingId) globalThis.clearInterval(pingId);
      try {
        ws?.send(JSON.stringify({ type: 'presence:leave', contentId: persistedContentId }));
      } catch {
        // ignore
      }
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [persistedContentId, user?.id]);

  useEffect(() => {
    setDraftTitle(title);
  }, [title, setDraftTitle]);

  useEffect(() => {
    setDraftContent(content);
  }, [content, setDraftContent]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Underline,
        CitationMarker,
        ComponentReference,
        ...templateLayoutDocExtensions,
        Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: {
            rel: 'noopener noreferrer nofollow',
            target: '_blank',
          },
        }),
        Placeholder.configure({
          placeholder: ({ editor: ed }) => (ed.isEmpty ? 'Press / to insert a block' : ''),
        }),
      ],
      content,
      onUpdate: ({ editor: ed }) => setContent(ed.getHTML()),
      onSelectionUpdate: ({ editor: ed }) => {
        const { from, to } = ed.state.selection;
        const text = from === to ? '' : ed.state.doc.textBetween(from, to, ' ').trim();
        setSelectionText(text);
      },
      editorProps: {
        attributes: {
          class:
            'editor-prose min-h-[360px] px-8 py-6 text-[15px] leading-relaxed text-[var(--editor-doc-text)] outline-none box-border selection:bg-[var(--editor-primary-muted)]',
        },
      },
    },
    [],
  );

  // When opening an existing content item (`/editor/:contentId`), hydrate the editor from the latest saved body.
  // Without this, the editor starts blank and a "Save Draft" would create a new content item, making it look
  // like history was lost after a restore.
  useEffect(() => {
    const id = routeContentId && routeContentId !== 'new' ? routeContentId : null;
    if (!id) return;
    if (!editor) return;
    // Always hydrate when the route id changes; the editor store may contain a previous draft.
    if (hydratedIdRef.current === id) return;

    let cancelled = false;
    setSaveError(null);
    setSaveConflictVersion(null);
    setContentId(id);

    void (async () => {
      try {
        const details = await contentService.getById(id);
        if (cancelled) return;

        headVersionRef.current = maxHeadVersion(details.versions);
        const nextTitle = details.content.title || 'Untitled';
        const nextType = details.content.contentType ?? 'ARTICLE';
        const nextLifecycle = details.content.lifecycleState ?? 'DRAFT';
        const bodyVersions = (details.versions ?? []).filter(
          (v) =>
            (v.changeType === 'MANUAL_SAVE' || v.changeType === 'AI_GENERATED') && v.body != null,
        );
        const latestWithBody =
          bodyVersions.length > 0
            ? bodyVersions.reduce((prev, curr) =>
                curr.versionNumber > prev.versionNumber ? curr : prev,
              )
            : null;
        const doc =
          latestWithBody?.body ?? ({ type: 'doc', content: [{ type: 'paragraph' }] } as const);

        setTitle(nextTitle);
        setContentType(nextType);
        setLifecycleState(nextLifecycle);
        editor.commands.setContent(doc as any);
        const html = editor.getHTML();
        setContent(html);
        setSavedSnapshot({ title: nextTitle.trim(), content: html });
        setLastSaved(new Date());
        hydratedIdRef.current = id;
      } catch (e) {
        if (cancelled) return;
        setSaveError(e instanceof Error ? e.message : 'Failed to load content');
      } finally {
        // no-op
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeContentId, editor]);

  const isPublished = lifecycleState === 'PUBLISHED';

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isPublished);
  }, [editor, isPublished]);

  const handleConvertToDraft = useCallback(async () => {
    const id = persistedContentId;
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    setSaveConflictVersion(null);
    try {
      const updated = await contentService.transitionState(id, 'DRAFT');
      setLifecycleState(updated.lifecycleState ?? 'DRAFT');
      // Re-hydrate from server so title/body/type stay consistent.
      hydratedIdRef.current = null;
      const details = await contentService.getById(id);
      headVersionRef.current = maxHeadVersion(details.versions);
      setTitle(details.content.title || 'Untitled');
      setContentType(details.content.contentType ?? 'ARTICLE');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to convert to draft');
    } finally {
      setSaving(false);
    }
  }, [persistedContentId]);

  useEffect(() => {
    if (!editor) return;
    const updateCount = () => {
      const text = editor.getText().trim();
      setWordCount(text ? text.split(/\s+/).filter(Boolean).length : 0);
    };
    updateCount();
    editor.on('update', updateCount);
    return () => {
      editor.off('update', updateCount);
    };
  }, [editor]);

  const handleSaveDraft = useCallback(async () => {
    if (!title.trim()) {
      setSaveError('Title is required');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveConflictVersion(null);
    try {
      const bodyDoc =
        editor?.getJSON() ?? ({ type: 'doc', content: [{ type: 'paragraph' }] } as const);

      if (!contentId) {
        const result = await contentService.createDraft(title.trim(), bodyDoc, {
          templateId: pendingTemplateId ?? undefined,
          contentType,
        });
        setContentId(result.content.id);
        setPendingTemplateId(null);
        headVersionRef.current = result.version?.versionNumber ?? 1;
      } else {
        const saved = await contentService.saveDraft(contentId, {
          title: title.trim(),
          body: bodyDoc,
          contentType,
          baseVersionNumber: headVersionRef.current,
        });
        headVersionRef.current = saved.versionNumber;
      }
      const t = title.trim();
      setSavedSnapshot({ title: t, content: editor?.getHTML() ?? content });
      setLastSaved(new Date());
      clearDraft();
    } catch (err) {
      if (err instanceof ContentSaveConflictError) {
        headVersionRef.current = err.currentVersionNumber;
        setSaveConflictVersion(err.currentVersionNumber);
        setSaveError(err.message);
      } else {
        setSaveError(err instanceof Error ? err.message : 'Failed to save draft');
      }
    } finally {
      setSaving(false);
    }
  }, [title, content, contentId, clearDraft, editor, pendingTemplateId, contentType]);

  const applyTemplateRecord = useCallback(
    (record: TemplateRecord) => {
      if (!editor) return;
      const emptyTitle = !title.trim();
      const editorEmpty = editor.isEmpty;
      if (
        (!editorEmpty || !emptyTitle) &&
        !window.confirm('Replace the current title and body with this template?')
      ) {
        return;
      }
      const parsed =
        parseTemplateLayout(record.activeLayout) ?? parseTemplateLayout(record.draftLayout);
      const doc = parsed
        ? layoutConfigToTipTapDoc(parsed)
        : { type: 'doc', content: [{ type: 'paragraph' }] };
      editor.chain().focus().setContent(doc).run();
      const html = editor.getHTML();
      setContent(html);
      setTitle(record.name.trim() || 'Untitled');
      const isNew = !persistedContentId;
      setPendingTemplateId(isNew ? record.id : null);
      setSavedSnapshot(null);
      setMainTab('edit');
      if (!isNew) {
        setComponentNotice('Body replaced from template. Save draft to persist.');
        window.setTimeout(() => setComponentNotice(null), 4000);
      } else {
        setComponentNotice(null);
      }
    },
    [editor, persistedContentId, title],
  );

  const selectedText = selectionText;

  const openSaveComponentModal = useCallback(() => {
    if (!selectedText) return;
    const compact = selectedText.replace(/\s+/g, ' ').trim();
    const defaultName = compact.slice(0, 42) || 'New Component';
    const suggestedKey = defaultName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    setComponentName(defaultName);
    setComponentKey(suggestedKey || `component-${Date.now().toString(36)}`);
    setComponentMode('linked');
    setComponentDescription('');
    setComponentSaveError(null);
    setShowSaveComponentModal(true);
  }, [selectedText]);

  const handleSaveSelectionAsComponent = useCallback(async () => {
    if (!editor) return;
    if (!componentName.trim() || !componentKey.trim()) {
      setComponentSaveError('Component name and key are required');
      return;
    }
    const { from, to } = editor.state.selection;
    if (from === to) {
      setComponentSaveError('Please select text before saving as a component');
      return;
    }

    setComponentSaving(true);
    setComponentSaveError(null);
    try {
      const created = await componentService.create({
        key: componentKey.trim(),
        name: componentName.trim(),
        description: componentDescription.trim() || null,
      });

      const sourceContentId =
        contentId ?? (routeContentId && routeContentId !== 'new' ? routeContentId : null);

      const linkRefs =
        componentMode === 'linked'
          ? {
              mode: 'linked',
              source: {
                contentId: sourceContentId,
                selection: { from, to },
              },
            }
          : {
              mode: 'detached',
            };

      await componentService.createVersion(created.id, {
        version: 'v1',
        linkRefs,
        propSchema: {
          mode: componentMode,
          selection: { from, to },
          snapshotText: selectedText,
          snapshotHtml: editor.getHTML(),
          savedAt: new Date().toISOString(),
        },
      });

      setShowSaveComponentModal(false);
      setRightPanelTab('library');
      setComponentNotice(
        `Saved “${componentName.trim()}” as ${componentMode === 'linked' ? 'linked' : 'snapshot'}`,
      );
      window.setTimeout(() => setComponentNotice(null), 3500);
    } catch (err) {
      setComponentSaveError(err instanceof Error ? err.message : 'Failed to save component');
    } finally {
      setComponentSaving(false);
    }
  }, [
    componentDescription,
    componentKey,
    componentMode,
    componentName,
    contentId,
    editor,
    routeContentId,
    selectedText,
  ]);

  const openCitationDialog = useCallback(() => {
    setCitationDialogMountKey((k) => k + 1);
    setShowCitationDialog(true);
  }, []);

  useEffect(() => {
    const snapshot = citationItemsRef.current;
    if (snapshot.length === 0) return;
    let cancelled = false;
    void (async () => {
      const updated = await Promise.all(
        snapshot.map(async (c) => ({
          ...c,
          style: citationStyle,
          text: await renderCitationWithFallback(citationStyle, c.work),
        })),
      );
      if (cancelled) return;
      setCitationItems(updated);
      setContent((prev) => upsertBibliographySection(prev, updated));
    })();
    return () => {
      cancelled = true;
    };
  }, [citationStyle]);

  const placeReferencesSectionHere = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    if (hasBibliographySection(html)) {
      setReferenceNotice('This draft already has a References section.');
      window.setTimeout(() => setReferenceNotice(null), 4000);
      return;
    }
    editor.chain().focus().insertContent(emptyReferencesSectionHtml()).run();
    setReferenceNotice('References block inserted. Add citations from Cite.');
    window.setTimeout(() => setReferenceNotice(null), 4000);
  }, [editor]);

  const applyCitationWithBibliography = useCallback(
    async (hit: ContentSearchHit) => {
      if (!editor) return;
      const work = toCitationWork(hit);
      const text = await renderCitationWithFallback(citationStyle, work);
      let marker = 0;
      setCitationItems((prev) => {
        marker = prev.length + 1;
        const next: CitationItem[] = [
          ...prev,
          {
            marker,
            style: citationStyle,
            text,
            title: work.title,
            sourceId: hit.contentId,
            work,
          },
        ];
        const nextHtml = upsertBibliographySection(editor.getHTML(), next);
        setContent(nextHtml);
        return next;
      });

      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: citationMarkLabel(marker, citationMarkerMode),
          marks: [{ type: 'citationMarker', attrs: { marker, mode: citationMarkerMode } }],
        })
        .run();
      setShowCitationDialog(false);
    },
    [citationMarkerMode, citationStyle, editor],
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link')?.href as string | undefined;
    const url = window.prompt('Enter URL', previousUrl ?? '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const fmtBtn = (active: boolean) =>
    `flex h-8 min-w-8 items-center justify-center rounded-[var(--editor-radius-input)] px-2 text-[13px] transition-[background-color,border-color,color,box-shadow] duration-200 ${
      active
        ? 'border border-[var(--editor-primary)]/45 bg-[var(--editor-primary-muted)] text-[var(--editor-primary)] shadow-[0_0_0_1px_rgba(147,124,248,0.12)]'
        : 'border border-transparent text-[var(--editor-muted)] hover:border-white/10 hover:bg-white/[0.05] hover:text-[var(--editor-doc-text)]'
    }`;

  const tabChip = (active: boolean) =>
    `rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ${
      active
        ? 'bg-gradient-to-b from-white/[0.14] to-white/[0.04] text-[var(--editor-doc-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
        : 'text-[var(--editor-muted)] hover:text-[var(--editor-doc-text)]'
    }`;

  const rightTabs = (
    <div
      className="mb-2 flex shrink-0 gap-0.5 rounded-[10px] border border-white/10 bg-[var(--editor-panel-bg)] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md"
      role="tablist"
      aria-label="Side panel"
    >
      {(['library', 'properties', 'similar', 'refs'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={rightPanelTab === tab}
          onClick={() => setRightPanelTab(tab)}
          className={`flex-1 rounded-[8px] px-1 py-1.5 text-[10px] font-semibold leading-tight transition-colors ${
            rightPanelTab === tab
              ? 'bg-white/[0.1] text-[var(--editor-doc-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-[var(--editor-faint)] hover:bg-white/[0.04] hover:text-[var(--editor-muted)]'
          }`}
        >
          {tab === 'refs'
            ? 'Refs'
            : tab === 'properties'
              ? 'Props'
              : tab === 'similar'
                ? 'Similar'
                : 'Library'}
        </button>
      ))}
    </div>
  );

  const draftLabel = title.trim() || 'Untitled draft';
  const versionLabel = persistedContentId ? `ID ${persistedContentId.slice(0, 8)}…` : 'New draft';

  const autosaveLabel = saving
    ? 'Saving…'
    : saveError
      ? saveError
      : !lastSaved
        ? 'Not saved'
        : dirty
          ? 'Unsaved changes'
          : `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="editor-workspace relative flex h-screen min-h-0 flex-col overflow-hidden bg-[var(--editor-canvas-bg)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-app-accent/14 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-app-accent-2/12 blur-[90px]" />
      </div>
      <header className="relative z-20 flex h-[52px] shrink-0 items-center border-b border-white/[0.08] bg-[var(--editor-topbar-bg)] px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl supports-backdrop-filter:bg-[var(--editor-topbar-bg)]">
        <div className="flex min-w-0 flex-1 items-center gap-1 text-[13px] text-[var(--editor-muted)]">
          <RouterLink
            to="/library"
            className="shrink-0 font-medium text-[var(--editor-muted)] no-underline hover:text-[var(--editor-primary)]"
          >
            Articles
          </RouterLink>
          <ChevronRight size={14} className="shrink-0 text-[var(--editor-faint)]" aria-hidden />
          <span className="min-w-0 truncate text-[var(--editor-doc-text)]">{draftLabel}</span>
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <nav
            className="pointer-events-auto flex items-center gap-0.5 rounded-[10px] border border-white/10 bg-[var(--editor-panel-bg)] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
            aria-label="Editor mode"
          >
            <button
              type="button"
              onClick={() => setMainTab('edit')}
              className={tabChip(mainTab === 'edit')}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setMainTab('preview')}
              className={tabChip(mainTab === 'preview')}
            >
              Preview
            </button>
            {persistedContentId ? (
              <RouterLink
                to={`/history/${persistedContentId}`}
                className={`${tabChip(false)} no-underline`}
              >
                History
              </RouterLink>
            ) : (
              <span
                className="cursor-not-allowed rounded-[8px] px-3 py-1.5 text-[13px] font-medium text-[var(--editor-faint)]"
                title="Save the draft first to open version history"
              >
                History
              </span>
            )}
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          {isPublished ? (
            <button
              type="button"
              onClick={handleConvertToDraft}
              disabled={saving || !persistedContentId}
              className="flex items-center gap-1.5 rounded-[var(--editor-radius-input)] border border-white/12 bg-white/[0.05] px-3.5 py-2 text-[13px] font-semibold text-[var(--editor-doc-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-white/18 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              title="Convert to draft to edit"
            >
              Convert to draft
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || isPublished}
            className="flex items-center gap-1.5 rounded-[var(--editor-radius-input)] border border-white/15 bg-gradient-to-r from-app-accent to-app-accent-2 px-3.5 py-2 text-[13px] font-semibold text-app-bg shadow-[0_0_28px_-8px_rgba(147,124,248,0.5)] ring-1 ring-white/12 transition-[filter,transform] hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : lastSaved && !dirty ? (
              <Check size={16} />
            ) : (
              <Save size={16} />
            )}
            {isPublished ? 'Locked (published)' : saving ? 'Saving…' : 'Save Draft'}
          </button>
          {/* <button
            type="button"
            onClick={openCitationDialog}
            className="flex items-center gap-1.5 rounded-[var(--editor-radius-input)] border-[0.5px] border-transparent bg-transparent px-3 py-2 text-[13px] font-medium text-[var(--editor-muted)] hover:bg-[var(--editor-canvas-bg)]"
          >
            <BookMarked size={16} />
            Cite
          </button>
          <button
            type="button"
            onClick={shareDocument}
            className="flex items-center gap-1.5 rounded-[var(--editor-radius-input)] border-[0.5px] border-transparent bg-transparent px-3 py-2 text-[13px] font-medium text-[var(--editor-muted)] hover:bg-[var(--editor-canvas-bg)]"
          >
            <Share2 size={16} />
            Share
          </button> */}
          <div
            className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-gradient-to-br from-white/[0.1] to-white/[0.02] text-[11px] font-semibold text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-app-accent/20"
            title={user?.email ?? 'Signed in'}
          >
            {user ? userInitials(user.email, user.displayName) : '?'}
          </div>
        </div>
      </header>

      {saveConflictVersion !== null ? (
        <div
          className="relative z-20 flex shrink-0 items-center justify-center gap-3 border-b border-amber-500/35 bg-amber-500/10 px-4 py-2 text-[13px] text-amber-100"
          role="status"
        >
          <span>
            Another collaborator saved first (revision {saveConflictVersion}). Reload to continue
            from the latest version, or copy your edits elsewhere before reloading.
          </span>
          <button
            type="button"
            onClick={() => globalThis.location.reload()}
            className="shrink-0 rounded-lg border border-amber-400/50 bg-amber-500/20 px-3 py-1.5 font-semibold text-amber-50 hover:bg-amber-500/30"
          >
            Reload latest
          </button>
        </div>
      ) : null}

      {mainTab === 'edit' && (
        <div className="relative z-10 flex h-9 shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-[var(--editor-topbar-bg)] px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl">
          <div className="flex min-w-0 flex-wrap items-center gap-0.5">
            <button
              type="button"
              disabled={!editor || isPublished}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={fmtBtn(!!editor?.isActive('bold'))}
              title="Bold"
            >
              <Bold size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor || isPublished}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={fmtBtn(!!editor?.isActive('italic'))}
              title="Italic"
            >
              <Italic size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor || isPublished}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              className={fmtBtn(!!editor?.isActive('underline'))}
              title="Underline"
            >
              <UnderlineIcon size={16} strokeWidth={2.25} />
            </button>
            <span className="mx-1 h-4 w-px shrink-0 bg-[var(--editor-border)]" aria-hidden />
            <button
              type="button"
              disabled={!editor || isPublished}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              className={fmtBtn(!!editor?.isActive('heading', { level: 1 }))}
              title="Heading 1"
            >
              <Heading1 size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor || isPublished}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={fmtBtn(!!editor?.isActive('heading', { level: 2 }))}
              title="Heading 2"
            >
              <Heading2 size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor || isPublished}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={fmtBtn(!!editor?.isActive('bulletList'))}
              title="Bullet list"
            >
              <List size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor || isPublished}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={fmtBtn(!!editor?.isActive('orderedList'))}
              title="Numbered list"
            >
              <ListOrdered size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor || isPublished}
              onClick={setLink}
              className={fmtBtn(!!editor?.isActive('link'))}
              title="Link"
            >
              <LinkIcon size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor || isPublished}
              onClick={openCitationDialog}
              className={fmtBtn(false)}
              title="Citation"
            >
              <BookMarked size={16} strokeWidth={2.25} />
            </button>
          </div>
          <span className="shrink-0 tabular-nums text-[13px] text-[var(--editor-faint)]">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
        </div>
      )}

      <div className="relative z-10 flex min-h-0 flex-1 gap-0 overflow-hidden">
        <div className="hidden w-[190px] shrink-0 border-r border-white/[0.08] bg-[var(--editor-panel-bg)] px-3 py-3 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl lg:block">
          {persistedContentId && user ? (
            <div
              className="sticky top-3 rounded-[10px] border border-white/10 bg-[var(--editor-canvas-bg)]/40 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--editor-muted)]">
                <Users size={14} className="shrink-0 text-[var(--editor-primary)]" aria-hidden />
                Activity
              </div>
              {presenceStatus.kind === 'error' ? (
                <p className="mb-0 mt-1.5 text-[11px] leading-snug text-rose-200/90">
                  Presence unavailable
                  {presenceStatus.status ? ` (HTTP ${presenceStatus.status})` : ''}. If this keeps happening,
                  the websocket route may not be deployed or you may not have access.
                </p>
              ) : editorPresenceOthers.length === 0 ? (
                <p className="mb-0 mt-1.5 text-[11px] leading-snug text-[var(--editor-faint)]">
                  No one else has this editor open.
                </p>
              ) : (
                <ul className="mb-0 mt-2 list-none space-y-1.5 p-0">
                  {editorPresenceOthers.map((p) => (
                    <li
                      key={p.userId}
                      className="flex min-w-0 items-center gap-2 text-[11px] text-[var(--editor-doc-text)]"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/12 bg-gradient-to-br from-white/[0.12] to-white/[0.02] text-[10px] font-semibold text-app-accent"
                        title={p.email}
                      >
                        {userInitials(p.email, p.displayName)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
                      <span className="shrink-0 text-[10px] font-medium text-emerald-400/90">
                        In editor
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {restoreNotice ? (
                <div className="mt-2 rounded-lg border border-amber-400/25 bg-amber-500/[0.08] p-2 text-[11px] leading-snug text-amber-50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1">{restoreNotice}</span>
                    <button
                      type="button"
                      onClick={() => setRestoreNotice(null)}
                      className="shrink-0 text-amber-100/80 hover:text-amber-50"
                      aria-label="Dismiss notice"
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="editor-canvas-area relative min-w-0 flex-1 overflow-auto bg-[var(--editor-canvas-bg)] px-6 py-6">
          <div
            className="editor-doc-sheet mx-auto max-w-3xl rounded-[var(--editor-radius-card)] border border-[var(--editor-card-edge)] bg-[var(--editor-card-bg)] backdrop-blur-sm"
            style={{ minHeight: 'calc(100% - 8px)' }}
          >
            {mainTab === 'preview' ? (
              <div className="px-8 pb-8 pt-6">
                <h1 className="m-0 text-[28px] font-bold leading-tight text-[var(--editor-doc-text)]">
                  {title || 'Untitled'}
                </h1>
                {editor ? (
                  <div className="tiptap-content mt-4">
                    <TipTapReadonly
                      doc={editor.getJSON()}
                      className="tiptap-readonly-preview ProseMirror text-[15px] leading-relaxed text-[var(--editor-muted)] outline-none selection:bg-app-accent/25"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                {isPublished ? (
                  <div className="px-8 pb-3 pt-6">
                    <h1 className="m-0 text-[28px] font-bold leading-tight text-[var(--editor-doc-text)]">
                      {title || 'Untitled'}
                    </h1>
                    <p className="mt-2 mb-0 text-[12px] text-[var(--editor-faint)]">
                      This content is published and locked. Convert to draft to edit.
                    </p>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title"
                    className="box-border w-full border-b border-white/[0.08] bg-transparent px-8 pb-3 pt-6 text-[28px] font-bold leading-tight tracking-tight text-[var(--editor-doc-text)] outline-none placeholder:text-[var(--editor-faint)]"
                  />
                )}
                <div className="tiptap-content px-0 pb-8">
                  <EditorContent editor={editor} />
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="flex w-[240px] shrink-0 flex-col border-l border-white/[0.08] bg-[var(--editor-panel-bg)] px-3 py-3 shadow-[inset_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
          {rightTabs}
          {rightPanelTab === 'library' && (
            <ComponentLibraryPanel
              editor={editor}
              onCatalogSourceChange={setLibraryCatalogSource}
            />
          )}
          {rightPanelTab === 'similar' && user ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden text-[12px] text-[var(--editor-muted)]">
              <p className="m-0 shrink-0 text-[11px] leading-snug text-[var(--editor-faint)]">
                Suggestions update as you edit the title or body. Indexed drafts use search;
                otherwise we match against your other titles.
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <SimilarContentWidget
                  title={title}
                  bodyHtml={content}
                  contentId={similarCheckContentId}
                  appearance="neutral"
                  className="w-full"
                  defaultExpanded
                  listMaxHeightClassName="max-h-[min(52vh,440px)]"
                />
              </div>
            </div>
          ) : null}
          {rightPanelTab === 'properties' && (
            <div className="min-h-0 flex-1 overflow-y-auto text-[12px] text-[var(--editor-muted)]">
              <div className="flex flex-col gap-3">
                <div>
                  <button
                    type="button"
                    onClick={() => setShowUseTemplateDialog(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-2 py-2 text-[12px] font-medium text-[var(--editor-doc-text)] hover:bg-[var(--editor-canvas-bg)]"
                  >
                    <LayoutTemplate size={14} strokeWidth={2} />
                    Use template…
                  </button>
                  <p className="mt-1.5 text-[10px] leading-snug text-[var(--editor-faint)]">
                    Load layout from an existing template into this draft.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="editor-content-type"
                    className="mb-1 block font-medium text-[var(--editor-doc-text)]"
                  >
                    Content type
                  </label>
                  <select
                    id="editor-content-type"
                    value={contentType}
                    onChange={(e) =>
                      setContentType(
                        e.target.value === 'VIDEO' ||
                          e.target.value === 'PODCAST' ||
                          e.target.value === 'DOCUMENT'
                          ? e.target.value
                          : 'ARTICLE',
                      )
                    }
                    className="box-border w-full rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-2.5 py-2 text-[12px] text-[var(--editor-doc-text)] outline-none"
                  >
                    <option value="ARTICLE">Article</option>
                    <option value="VIDEO">Video</option>
                    <option value="PODCAST">Podcast</option>
                    <option value="DOCUMENT">Document</option>
                  </select>
                  <p className="mt-1.5 text-[10px] leading-snug text-[var(--editor-faint)]">
                    Saved with the draft and used for library filtering + color.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[var(--editor-doc-text)]">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {['tutorial', 'guide', '2026'].map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-2 py-0.5 text-[11px] text-[var(--editor-muted)]"
                      >
                        {tag}
                        <span className="cursor-pointer text-[var(--editor-faint)]">×</span>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="cursor-pointer rounded-[var(--editor-radius-input)] border-[0.5px] border-dashed border-[var(--editor-border)] bg-transparent px-2 py-0.5 text-[11px] text-[var(--editor-faint)]"
                    >
                      + Add
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[var(--editor-doc-text)]">
                    Visibility
                  </label>
                  <select className="box-border w-full rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-2.5 py-2 text-[12px] text-[var(--editor-doc-text)] outline-none">
                    <option>Public</option>
                    <option>Team only</option>
                    <option>Private</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[var(--editor-doc-text)]">
                    Featured image
                  </label>
                  <div className="flex h-[100px] cursor-pointer items-center justify-center rounded-[var(--editor-radius-input)] border-[0.5px] border-dashed border-[var(--editor-border)] bg-[var(--editor-card-bg)] text-[11px] text-[var(--editor-faint)]">
                    Upload
                  </div>
                </div>
                <div className="border-t-[0.5px] border-[var(--editor-border)] pt-3">
                  <button
                    type="button"
                    onClick={openSaveComponentModal}
                    disabled={!selectedText}
                    className="flex w-full items-center justify-center gap-2 rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-2 py-2 text-[12px] font-medium text-[var(--editor-doc-text)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Puzzle size={14} />
                    Save selection as component
                  </button>
                  <p className="mt-1.5 text-[10px] leading-snug text-[var(--editor-faint)]">
                    Select text in the document, then save it to the library.
                  </p>
                </div>
              </div>
            </div>
          )}
          {rightPanelTab === 'refs' && (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto text-[12px] text-[var(--editor-muted)]">
              <button
                type="button"
                onClick={placeReferencesSectionHere}
                className="w-full rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-2 py-2 text-left text-[12px] font-medium text-[var(--editor-doc-text)] hover:bg-[var(--editor-canvas-bg)]"
              >
                Insert References block
              </button>
              <button
                type="button"
                onClick={openCitationDialog}
                className="w-full rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-primary)] bg-[var(--editor-primary-muted)] px-2 py-2 text-[12px] font-medium text-[var(--editor-primary)]"
              >
                Add citation…
              </button>
              {referenceNotice && (
                <p className="m-0 text-[11px] text-[var(--editor-muted)]">{referenceNotice}</p>
              )}
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--editor-faint)]">
                In this draft ({citationItems.length})
              </div>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {citationItems.map((c) => (
                  <li
                    key={`${c.marker}-${c.sourceId}`}
                    className="rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-2 py-1.5"
                  >
                    <span className="font-mono text-[10px] text-[var(--editor-primary)]">
                      [{c.marker}]
                    </span>{' '}
                    <span className="text-[var(--editor-doc-text)]">{c.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {restoreModalOpen && restoreNotice ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden
            onClick={() => setRestoreModalOpen(false)}
          />
          <div
            className="relative w-full max-w-[420px] rounded-[16px] border border-white/12 bg-[var(--editor-panel-bg)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            role="dialog"
            aria-modal="true"
            aria-label="Restore requested"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">
                  Attention
                </div>
                <div className="mt-1 text-[15px] font-semibold text-[var(--editor-doc-text)]">
                  Version restore requested
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px] font-semibold text-[var(--editor-muted)] hover:bg-white/[0.08]"
              >
                Close
              </button>
            </div>
            <p className="mb-0 mt-2 text-[13px] leading-snug text-[var(--editor-muted)]">
              {restoreNotice}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                className="rounded-[10px] border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] font-semibold text-[var(--editor-doc-text)] hover:bg-white/[0.08]"
              >
                I’ll leave soon
              </button>
              <button
                type="button"
                onClick={() => {
                  setRestoreModalOpen(false);
                  setRestoreNotice(null);
                  navigate('/my-content');
                }}
                className="rounded-[10px] border border-amber-300/30 bg-amber-500/[0.16] px-3 py-2 text-[13px] font-semibold text-amber-50 hover:bg-amber-500/[0.22]"
              >
                Leave editor now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="relative z-20 flex h-[28px] shrink-0 items-center justify-between gap-3 border-t border-white/[0.08] bg-[var(--editor-status-bg)] px-4 text-[10px] leading-none text-[var(--editor-faint)] backdrop-blur-md">
        <span className="min-w-0 truncate">
          {autosaveLabel}
          {componentNotice ? ` · ${componentNotice}` : ''}
        </span>
        <span className="shrink-0 tabular-nums">
          {wordCount} {wordCount === 1 ? 'word' : 'words'} · {versionLabel}
        </span>
        <span className="hidden max-w-[45%] truncate text-right sm:inline">
          {libraryCatalogSource === 'loading'
            ? 'Loading component catalog…'
            : libraryCatalogSource === 'api'
              ? 'Component catalog from API (seeded components in DB).'
              : 'Component catalog: offline fallback (API unreachable).'}
        </span>
      </footer>

      <SlashCommandMenu editor={editor} onOpenCitation={openCitationDialog} />

      {showUseTemplateDialog ? (
        <UseTemplateDialog
          onClose={() => setShowUseTemplateDialog(false)}
          onSelectTemplate={applyTemplateRecord}
        />
      ) : null}

      <CitationSearchDialog
        key={citationDialogMountKey}
        open={showCitationDialog}
        onClose={() => setShowCitationDialog(false)}
        citationStyle={citationStyle}
        onCitationStyleChange={setCitationStyle}
        citationMarkerMode={citationMarkerMode}
        onCitationMarkerModeChange={setCitationMarkerMode}
        onPlaceReferencesHere={placeReferencesSectionHere}
        existingCitationCount={citationItems.length}
        onInsert={applyCitationWithBibliography}
      />
      {showSaveComponentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-[520px] overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/92 p-5 text-app-text shadow-app-lift backdrop-blur-2xl">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/50 to-transparent"
              aria-hidden
            />
            <h3 className="m-0 text-lg font-semibold">Save selection as component</h3>
            <p className="mb-4 mt-1 text-[12px] text-app-muted">
              Create a reusable component from the current selection.
            </p>

            <div className="mb-2 text-[11px] text-app-faint">Selection preview</div>
            <div className="mb-4 max-h-[90px] overflow-auto rounded-app-md border border-white/10 bg-app-bg-subtle/80 p-3 text-[12px] text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              {selectedText || 'No selection'}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <input
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                placeholder="Component name"
                className="rounded-app-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-app-accent/40 focus:ring-2 focus:ring-app-accent/20"
              />
              <input
                value={componentKey}
                onChange={(e) => setComponentKey(e.target.value)}
                placeholder="component-key"
                className="rounded-app-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-app-accent/40 focus:ring-2 focus:ring-app-accent/20"
              />
              <textarea
                value={componentDescription}
                onChange={(e) => setComponentDescription(e.target.value)}
                placeholder="Description (optional)"
                className="min-h-[72px] rounded-app-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-app-accent/40 focus:ring-2 focus:ring-app-accent/20"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComponentMode('linked')}
                  className={`rounded-app-md border px-3 py-2 text-[12px] transition-colors ${
                    componentMode === 'linked'
                      ? 'border-app-accent/45 bg-app-accent/15 text-app-accent'
                      : 'border-white/10 bg-white/[0.03] text-app-muted hover:border-white/16'
                  }`}
                >
                  Linked
                </button>
                <button
                  type="button"
                  onClick={() => setComponentMode('detached')}
                  className={`rounded-app-md border px-3 py-2 text-[12px] transition-colors ${
                    componentMode === 'detached'
                      ? 'border-app-accent/45 bg-app-accent/15 text-app-accent'
                      : 'border-white/10 bg-white/[0.03] text-app-muted hover:border-white/16'
                  }`}
                >
                  Snapshot
                </button>
              </div>
              {componentSaveError && (
                <div className="text-[12px] text-red-400">{componentSaveError}</div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaveComponentModal(false)}
                className="rounded-app-md border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] text-app-muted transition-colors hover:bg-white/[0.07]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSelectionAsComponent}
                disabled={componentSaving}
                className="rounded-app-md border border-white/15 bg-gradient-to-r from-app-accent to-app-accent-2 px-3 py-2 text-[13px] font-semibold text-app-bg shadow-[0_0_20px_-8px_rgba(147,124,248,0.45)] ring-1 ring-white/10 transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {componentSaving ? 'Saving…' : 'Save component'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
