import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
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
  Share2,
  ChevronRight,
  LayoutTemplate,
} from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { contentService } from '../services/contentService';
import { componentService } from '../services/componentService';
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
import {
  emptyReferencesSectionHtml,
  hasBibliographySection,
  upsertBibliographySection,
  type CitationMarkerMode,
} from '../lib/citationMarkers';
import { CitationMarker, citationMarkLabel } from '../tiptap/CitationMarker';
import { tipTapDocFromTemplateRecord } from '../lib/templateToTipTapDoc';
import type { TemplateRecord } from '../services/templateCrudService';

type CitationItem = {
  marker: number;
  style: CitationStyle;
  text: string;
  title: string;
  sourceId: string;
  work: CitationWork;
};

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
  const { draftTitle, setDraftTitle, draftContent, setDraftContent, clearDraft } = useEditorStore();
  const [title, setTitle] = useState(draftTitle);
  const [content, setContent] = useState(draftContent || '<p></p>');
  const [mainTab, setMainTab] = useState<'edit' | 'preview'>('edit');
  const [contentId, setContentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<{ title: string; content: string } | null>(null);
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
  const [rightPanelTab, setRightPanelTab] = useState<'library' | 'properties' | 'refs'>('library');
  const [wordCount, setWordCount] = useState(0);
  const [showUseTemplateDialog, setShowUseTemplateDialog] = useState(false);
  /** Passed to create draft only for new content (first save) so formatting rules bind to the template. */
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

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
    setDraftTitle(title);
  }, [title, setDraftTitle]);

  useEffect(() => {
    setDraftContent(content);
  }, [content, setDraftContent]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      CitationMarker,
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
          'editor-prose min-h-[360px] px-8 py-6 text-[15px] leading-relaxed text-[var(--editor-doc-text)] outline-none box-border',
      },
    },
  });

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

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const handleSaveDraft = useCallback(async () => {
    if (!title.trim()) {
      setSaveError('Title is required');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const bodyDoc =
        editor?.getJSON() ?? ({ type: 'doc', content: [{ type: 'paragraph' }] } as const);

      if (!contentId) {
        const result = await contentService.createDraft(title.trim(), bodyDoc, {
          templateId: pendingTemplateId ?? undefined,
        });
        setContentId(result.content.id);
        setPendingTemplateId(null);
      } else {
        await contentService.saveDraft(contentId, { title: title.trim(), body: bodyDoc });
      }
      const t = title.trim();
      setSavedSnapshot({ title: t, content: editor?.getHTML() ?? content });
      setLastSaved(new Date());
      clearDraft();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  }, [title, content, contentId, clearDraft, editor, pendingTemplateId]);

  const applyTemplateRecord = useCallback(
    (record: TemplateRecord) => {
      if (!editor) return;
      const emptyTitle = !title.trim();
      const editorEmpty = editor.isEmpty;
      if ((!editorEmpty || !emptyTitle) && !window.confirm('Replace the current title and body with this template?')) {
        return;
      }
      const doc = tipTapDocFromTemplateRecord(record);
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
      setComponentNotice(`Saved “${componentName.trim()}” as ${componentMode === 'linked' ? 'linked' : 'snapshot'}`);
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

  const shareDocument = useCallback(() => {
    const url = window.location.href;
    const shareTitle = title.trim() || 'Draft';
    if (typeof navigator !== 'undefined' && navigator.share) {
      void navigator.share({ title: shareTitle, url }).catch(() => {
        void navigator.clipboard.writeText(url);
      });
    } else {
      void navigator.clipboard.writeText(url);
    }
  }, [title]);

  const fmtBtn = (active: boolean) =>
    `flex h-8 min-w-8 items-center justify-center rounded-[var(--editor-radius-input)] border-[0.5px] px-2 text-[13px] transition-colors ${
      active
        ? 'border-[var(--editor-primary)] bg-[var(--editor-primary-muted)] text-[var(--editor-primary)]'
        : 'border-transparent bg-transparent text-[var(--editor-muted)] hover:bg-[var(--editor-canvas-bg)]'
    }`;

  const tabChip = (active: boolean) =>
    `rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
      active
        ? 'bg-[var(--editor-card-bg)] text-[var(--editor-doc-text)]'
        : 'text-[var(--editor-muted)] hover:text-[var(--editor-doc-text)]'
    }`;

  const rightTabs = (
    <div
      className="mb-2 flex shrink-0 gap-0.5 rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-panel-bg)] p-0.5"
      role="tablist"
      aria-label="Side panel"
    >
      {(['library', 'properties', 'refs'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={rightPanelTab === tab}
          onClick={() => setRightPanelTab(tab)}
          className={`flex-1 rounded-[6px] px-1.5 py-1.5 text-[11px] font-semibold capitalize ${
            rightPanelTab === tab
              ? 'bg-[var(--editor-card-bg)] text-[var(--editor-doc-text)]'
              : 'text-[var(--editor-faint)] hover:text-[var(--editor-muted)]'
          }`}
        >
          {tab === 'refs' ? 'Refs' : tab}
        </button>
      ))}
    </div>
  );

  const draftLabel = title.trim() || 'Untitled draft';
  const versionLabel = persistedContentId
    ? `ID ${persistedContentId.slice(0, 8)}…`
    : 'New draft';

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
    <div className="editor-workspace flex h-screen min-h-0 flex-col">
      <header className="relative z-20 flex h-[52px] shrink-0 items-center border-b-[0.5px] border-[var(--editor-border)] bg-[var(--editor-topbar-bg)] px-4">
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
            className="pointer-events-auto flex items-center gap-0.5 rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-panel-bg)] p-0.5"
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
                className="cursor-not-allowed rounded-[6px] px-3 py-1.5 text-[13px] font-medium text-[var(--editor-faint)]"
                title="Save the draft first to open version history"
              >
                History
              </span>
            )}
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-primary)] bg-[var(--editor-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--editor-primary-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : lastSaved && !dirty ? (
              <Check size={16} />
            ) : (
              <Save size={16} />
            )}
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button
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
          </button>
          <div
            className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] text-[11px] font-semibold text-[var(--editor-primary)]"
            title={user?.email ?? 'Signed in'}
          >
            {user ? userInitials(user.email, user.displayName) : '?'}
          </div>
        </div>
      </header>

      {mainTab === 'edit' && (
        <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b-[0.5px] border-[var(--editor-border)] bg-[var(--editor-topbar-bg)] px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-0.5">
            <button
              type="button"
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={fmtBtn(!!editor?.isActive('bold'))}
              title="Bold"
            >
              <Bold size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={fmtBtn(!!editor?.isActive('italic'))}
              title="Italic"
            >
              <Italic size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              className={fmtBtn(!!editor?.isActive('underline'))}
              title="Underline"
            >
              <UnderlineIcon size={16} strokeWidth={2.25} />
            </button>
            <span className="mx-1 h-4 w-px shrink-0 bg-[var(--editor-border)]" aria-hidden />
            <button
              type="button"
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              className={fmtBtn(!!editor?.isActive('heading', { level: 1 }))}
              title="Heading 1"
            >
              <Heading1 size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={fmtBtn(!!editor?.isActive('heading', { level: 2 }))}
              title="Heading 2"
            >
              <Heading2 size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={fmtBtn(!!editor?.isActive('bulletList'))}
              title="Bullet list"
            >
              <List size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={fmtBtn(!!editor?.isActive('orderedList'))}
              title="Numbered list"
            >
              <ListOrdered size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor}
              onClick={setLink}
              className={fmtBtn(!!editor?.isActive('link'))}
              title="Link"
            >
              <LinkIcon size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!editor}
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

      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        <div className="editor-canvas-area min-w-0 flex-1 overflow-auto bg-[var(--editor-canvas-bg)] px-6 py-5">
          <div
            className="mx-auto max-w-3xl rounded-[var(--editor-radius-card)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)]"
            style={{ minHeight: 'calc(100% - 8px)' }}
          >
            {mainTab === 'preview' ? (
              <div className="px-8 pb-8 pt-6">
                <h1 className="m-0 text-[28px] font-bold leading-tight text-[var(--editor-doc-text)]">
                  {title || 'Untitled'}
                </h1>
                {content && content !== '<p></p>' ? (
                  <div
                    className="tiptap-content mt-4 text-[15px] leading-relaxed text-[var(--editor-muted)]"
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                ) : (
                  <p className="mt-4 text-[15px] text-[var(--editor-faint)]">Nothing to preview yet.</p>
                )}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  className="box-border w-full border-b-[0.5px] border-[var(--editor-border)] bg-transparent px-8 pb-3 pt-6 text-[28px] font-bold leading-tight text-[var(--editor-doc-text)] outline-none placeholder:text-[var(--editor-faint)]"
                />
                <div className="tiptap-content px-0 pb-8">
                  <EditorContent editor={editor} />
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="flex w-[240px] shrink-0 flex-col border-l-[0.5px] border-[var(--editor-border)] bg-[var(--editor-panel-bg)] px-3 py-3">
          {rightTabs}
          {rightPanelTab === 'library' && <ComponentLibraryPanel editor={editor} />}
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
                {user ? (
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--editor-faint)]">
                      Related drafts
                    </p>
                    <SimilarContentWidget
                      title={title}
                      bodyHtml={content}
                      contentId={similarCheckContentId}
                      appearance="neutral"
                      className="w-full"
                    />
                  </div>
                ) : null}
                <div>
                  <label className="mb-1 block font-medium text-[var(--editor-doc-text)]">Content type</label>
                  <select className="box-border w-full rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-2.5 py-2 text-[12px] text-[var(--editor-doc-text)] outline-none">
                    <option>Article</option>
                    <option>Guide</option>
                    <option>Documentation</option>
                    <option>Blog post</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[var(--editor-doc-text)]">Tags</label>
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
                  <label className="mb-1 block font-medium text-[var(--editor-doc-text)]">Visibility</label>
                  <select className="box-border w-full rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-2.5 py-2 text-[12px] text-[var(--editor-doc-text)] outline-none">
                    <option>Public</option>
                    <option>Team only</option>
                    <option>Private</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[var(--editor-doc-text)]">Featured image</label>
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
                    <span className="font-mono text-[10px] text-[var(--editor-primary)]">[{c.marker}]</span>{' '}
                    <span className="text-[var(--editor-doc-text)]">{c.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <footer className="flex h-[26px] shrink-0 items-center justify-between gap-3 border-t-[0.5px] border-[var(--editor-border)] bg-[var(--editor-status-bg)] px-4 text-[10px] leading-none text-[var(--editor-faint)]">
        <span className="min-w-0 truncate">
          {autosaveLabel}
          {componentNotice ? ` · ${componentNotice}` : ''}
        </span>
        <span className="shrink-0 tabular-nums">
          {wordCount} {wordCount === 1 ? 'word' : 'words'} · {versionLabel}
        </span>
        <span className="hidden max-w-[45%] truncate text-right sm:inline">
          Library panel uses demo data until the components API is wired.
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-[520px] rounded-(--editor-radius-card) border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] p-5 text-[var(--editor-doc-text)]"
            style={{ color: 'var(--editor-doc-text)' }}
          >
            <h3 className="m-0 text-lg font-semibold">Save selection as component</h3>
            <p className="mb-4 mt-1 text-[12px] text-(--editor-muted)">
              Create a reusable component from the current selection.
            </p>

            <div className="mb-2 text-[11px] text-(--editor-faint)">Selection preview</div>
            <div className="mb-4 max-h-[90px] overflow-auto rounded-(--editor-radius-input) border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-canvas-bg)] p-3 text-[12px] text-[var(--editor-muted)]">
              {selectedText || 'No selection'}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <input
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                placeholder="Component name"
                className="rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-3 py-2 text-[13px] text-[var(--editor-doc-text)] outline-none"
              />
              <input
                value={componentKey}
                onChange={(e) => setComponentKey(e.target.value)}
                placeholder="component-key"
                className="rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-3 py-2 text-[13px] text-[var(--editor-doc-text)] outline-none"
              />
              <textarea
                value={componentDescription}
                onChange={(e) => setComponentDescription(e.target.value)}
                placeholder="Description (optional)"
                className="min-h-[72px] rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-3 py-2 text-[13px] text-[var(--editor-doc-text)] outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComponentMode('linked')}
                  className={`rounded-[var(--editor-radius-input)] border-[0.5px] px-3 py-2 text-[12px] ${
                    componentMode === 'linked'
                      ? 'border-[var(--editor-primary)] bg-[var(--editor-primary-muted)] text-[var(--editor-primary)]'
                      : 'border-[var(--editor-border)] bg-[var(--editor-card-bg)] text-[var(--editor-muted)]'
                  }`}
                >
                  Linked
                </button>
                <button
                  type="button"
                  onClick={() => setComponentMode('detached')}
                  className={`rounded-[var(--editor-radius-input)] border-[0.5px] px-3 py-2 text-[12px] ${
                    componentMode === 'detached'
                      ? 'border-[var(--editor-primary)] bg-[var(--editor-primary-muted)] text-[var(--editor-primary)]'
                      : 'border-[var(--editor-border)] bg-[var(--editor-card-bg)] text-[var(--editor-muted)]'
                  }`}
                >
                  Snapshot
                </button>
              </div>
              {componentSaveError && <div className="text-[12px] text-red-500">{componentSaveError}</div>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaveComponentModal(false)}
                className="rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-3 py-2 text-[13px] text-[var(--editor-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSelectionAsComponent}
                disabled={componentSaving}
                className="rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-primary)] bg-[var(--editor-primary)] px-3 py-2 text-[13px] font-medium text-[var(--editor-primary-fg)] disabled:opacity-60"
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
