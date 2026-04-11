import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import {
  Save,
  Eye,
  Settings,
  Puzzle,
  BookMarked,
  Type,
  Image,
  Link as LinkIcon,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Loader2,
  Check,
} from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
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
import SimilarContentWidget from '../components/content/SimilarContentWidget';
import CitationSearchDialog from '../components/editor/CitationSearchDialog';
import ComponentLibraryPanel from '../components/editor/ComponentLibraryPanel';
import { Surface } from '../components/ui/Surface';
import {
  emptyReferencesSectionHtml,
  hasBibliographySection,
  upsertBibliographySection,
  type CitationMarkerMode,
} from '../lib/citationMarkers';
import { CitationMarker, citationMarkLabel } from '../tiptap/CitationMarker';

type CitationItem = {
  marker: number;
  style: CitationStyle;
  text: string;
  title: string;
  sourceId: string;
  work: CitationWork;
};

export default function EditorLayout() {
  const { contentId: routeContentId } = useParams<{ contentId: string }>();
  const { draftTitle, setDraftTitle, draftContent, setDraftContent, clearDraft } = useEditorStore();
  const [title, setTitle] = useState(draftTitle);
  const [content, setContent] = useState(draftContent || '<p></p>');
  const [showPreview, setShowPreview] = useState(false);
  const [contentId, setContentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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
  const [rightPanelTab, setRightPanelTab] = useState<'properties' | 'library'>('library');

  const handleSaveDraft = useCallback(async () => {
    if (!title.trim()) {
      setSaveError('Title is required');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // Build TipTap JSON from HTML for API
      const bodyDoc = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: content.replace(/<[^>]*>/g, '') || '' }] }],
      };

      if (!contentId) {
        // First save — create a new draft
        const result = await contentService.createDraft(title.trim(), bodyDoc);
        setContentId(result.content.id);
      } else {
        // Subsequent save — update existing draft
        await contentService.saveDraft(contentId, { title: title.trim(), body: bodyDoc });
      }
      setLastSaved(new Date());
      // Clear draft from context after successful save
      clearDraft();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  }, [title, content, contentId, clearDraft]);

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
        placeholder: 'Start writing your content here...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => setContent(editor.getHTML()),
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const text = from === to ? '' : editor.state.doc.textBetween(from, to, ' ').trim();
      setSelectionText(text);
    },
    editorProps: {
      attributes: {
        class: 'min-h-[400px] p-6 bg-app-bg/60 border border-app-border/80 rounded-xl text-app-text text-[15px] leading-relaxed outline-none box-border',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

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
        `Saved "${componentName.trim()}" as ${componentMode === 'linked' ? 'linked' : 'detached'} component`,
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

  /** Re-render bibliography entries when the global citation format changes. */
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
    setReferenceNotice('References block inserted at the cursor. Add citations from the Cite dialog.');
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

  const insertBlocks = useMemo(
    () => [
      {
        icon: Heading1,
        label: 'Heading 1',
        color: '#8b5cf6',
        onClick: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        icon: Heading2,
        label: 'Heading 2',
        color: '#06b6d4',
        onClick: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      { icon: Type, label: 'Paragraph', color: '#f59e0b', onClick: () => editor?.chain().focus().setParagraph().run() },
      { icon: Bold, label: 'Bold', color: '#10b981', onClick: () => editor?.chain().focus().toggleBold().run() },
      { icon: Italic, label: 'Italic', color: '#ec4899', onClick: () => editor?.chain().focus().toggleItalic().run() },
      { icon: List, label: 'Bullet List', color: '#6366f1', onClick: () => editor?.chain().focus().toggleBulletList().run() },
      { icon: ListOrdered, label: 'Numbered List', color: '#14b8a6', onClick: () => editor?.chain().focus().toggleOrderedList().run() },
      {
        icon: LinkIcon,
        label: 'Link',
        color: '#a78bfa',
        onClick: () => {
          const previousUrl = editor?.getAttributes('link')?.href as string | undefined;
          const url = window.prompt('Enter URL', previousUrl ?? '');
          if (!editor) return;
          if (url === null) return;
          if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        },
      },
      { icon: BookMarked, label: 'Citation', color: '#22d3ee', onClick: () => openCitationDialog() },
      { icon: Image, label: 'Image (soon)', color: '#555870', onClick: () => {} },
    ],
    [editor, openCitationDialog],
  );

  return (
    <div className="flex h-screen flex-col bg-app-bg">
      {/* Topbar */}
      <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-app-border/80 bg-app-surface/70 px-4 py-3 shadow-app-soft backdrop-blur-xl supports-[backdrop-filter]:bg-app-surface/50 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex shrink-0 items-center gap-1.5 rounded-app-md px-3.5 py-2 text-[13px] transition-colors ${
              showPreview
                ? 'bg-app-accent-muted text-app-accent shadow-[0_0_0_1px_rgba(147,124,248,0.25)]'
                : 'bg-app-bg/50 text-app-muted hover:bg-app-elevated'
            }`}
          >
            <Eye size={16} /> {showPreview ? 'Edit' : 'Preview'}
          </button>
          <span className="hidden h-4 w-px shrink-0 bg-app-border sm:block" aria-hidden />
          <span className={`min-w-0 truncate text-[13px] ${saveError ? 'text-red-300' : 'text-app-faint'}`}>
            {saveError
              ? saveError
              : lastSaved
                ? `Last saved: ${lastSaved.toLocaleTimeString()}`
                : 'Not saved yet'}
          </span>
          {componentNotice && (
            <>
              <span className="hidden h-4 w-px shrink-0 bg-app-border sm:block" aria-hidden />
              <span className="hidden truncate text-[13px] text-emerald-300/95 sm:inline">{componentNotice}</span>
            </>
          )}
          {referenceNotice && (
            <>
              <span className="hidden h-4 w-px shrink-0 bg-app-border sm:block" aria-hidden />
              <span className="hidden truncate text-[13px] text-cyan-300/90 sm:inline">{referenceNotice}</span>
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={placeReferencesSectionHere}
            className="flex items-center gap-1.5 rounded-app-md border border-app-border/90 bg-app-bg/45 px-3 py-2 text-[13px] text-app-muted transition-colors hover:border-cyan-500/35 hover:text-cyan-300"
            title="Insert “References” heading and list at the cursor (citations fill this block)"
          >
            <ListOrdered size={16} /> <span className="hidden md:inline">Refs block</span>
          </button>
          <button
            onClick={openCitationDialog}
            className="flex items-center gap-1.5 rounded-app-md border border-app-border/90 bg-app-bg/45 px-3 py-2 text-[13px] text-app-muted transition-colors hover:border-app-accent/30 hover:text-app-accent"
            title="Search references — marker is inserted where the cursor is"
          >
            <BookMarked size={16} /> <span className="hidden sm:inline">Cite</span>
          </button>
          <button
            onClick={openSaveComponentModal}
            disabled={!selectedText}
            className={`flex items-center gap-1.5 rounded-app-md border px-3 py-2 text-[13px] ${
              selectedText
                ? 'border-app-border/90 bg-app-bg/45 text-app-muted hover:border-app-accent/30 hover:text-app-accent'
                : 'cursor-not-allowed border-app-border/60 bg-app-bg/30 text-app-faint'
            }`}
            title={selectedText ? 'Save selected text as reusable component' : 'Select text in editor first'}
          >
            <Puzzle size={16} /> <span className="hidden md:inline">Save as Component</span>
          </button>
          <button
            type="button"
            className="hidden items-center gap-1.5 rounded-app-md border border-app-border/90 bg-app-bg/45 px-3 py-2 text-[13px] text-app-muted hover:bg-app-elevated lg:flex"
          >
            <Settings size={16} /> Settings
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className={`flex items-center gap-1.5 rounded-app-md px-4 py-2 text-[13px] font-semibold text-white shadow-app-glow transition-all duration-200 ${
              saving
                ? 'cursor-not-allowed bg-app-accent/35 opacity-70'
                : lastSaved
                  ? 'bg-gradient-to-br from-emerald-500 to-app-accent-2'
                  : 'bg-gradient-to-br from-app-accent to-app-accent-2'
            }`}
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : lastSaved ? (
              <Check size={16} />
            ) : (
              <Save size={16} />
            )}
            {saving ? 'Saving...' : lastSaved ? 'Saved' : 'Save Draft'}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-2 overflow-hidden p-2 sm:p-3">
        {/* Insert Panel */}
        <Surface variant="glass" padding="sm" className="hidden w-[200px] shrink-0 overflow-y-auto sm:block">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-app-faint">
            Insert Blocks
          </h3>
          <div className="flex flex-col gap-1">
            {insertBlocks.map((block) => (
              <button
                key={block.label}
                type="button"
                className="flex items-center gap-2.5 rounded-app-md border border-app-border/60 bg-app-bg/35 px-3 py-2.5 text-left text-xs text-app-muted transition-[border-color,background-color,color] hover:border-app-border-strong hover:bg-app-elevated hover:text-[var(--block-color)]"
                style={{ '--block-color': block.color } as CSSProperties & { '--block-color': string }}
                onClick={() => block.onClick()}
              >
                <block.icon size={16} className="shrink-0 opacity-90" />
                {block.label}
              </button>
            ))}
          </div>
        </Surface>

        {/* Main Editor */}
        <Surface variant="default" padding="none" className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title..."
            className="box-border border-b border-app-border/70 bg-transparent px-5 py-4 text-2xl font-bold text-app-text outline-none placeholder:text-app-faint sm:px-6"
          />

          <div className="px-5 pb-3 pt-2 sm:px-6">
            <SimilarContentWidget title={title} bodyHtml={content} contentId={similarCheckContentId} />
          </div>

          {/* Editor/Preview Area */}
          <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
            {showPreview ? (
              <div className="min-h-full rounded-app-xl border border-app-border/60 bg-app-bg-subtle/80 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8">
                <h1 className="mb-4 text-[28px] font-bold text-app-text">
                  {title || 'Untitled'}
                </h1>
                <div
                  className="tiptap-content text-[15px] leading-relaxed text-app-muted"
                  dangerouslySetInnerHTML={{
                    __html: content && content !== '<p></p>' ? content : '<p>Start writing to see preview...</p>',
                  }}
                />
              </div>
            ) : (
              <div className="tiptap-content">
                <EditorContent editor={editor} />
              </div>
            )}
          </div>
        </Surface>

        {/* Properties + component library */}
        <Surface
          variant="glass"
          padding="md"
          className="hidden min-h-0 w-[300px] shrink-0 flex-col overflow-hidden lg:flex"
        >
          <div
            className="mb-3 flex shrink-0 gap-1 rounded-app-md border border-app-border/60 bg-app-bg/30 p-1"
            role="tablist"
            aria-label="Editor sidebar"
          >
            <button
              type="button"
              role="tab"
              aria-selected={rightPanelTab === 'library'}
              onClick={() => setRightPanelTab('library')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                rightPanelTab === 'library'
                  ? 'bg-app-accent-muted text-app-accent shadow-[0_0_0_1px_rgba(147,124,248,0.2)]'
                  : 'text-app-faint hover:bg-app-elevated hover:text-app-muted'
              }`}
            >
              <Puzzle size={14} />
              Library
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rightPanelTab === 'properties'}
              onClick={() => setRightPanelTab('properties')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                rightPanelTab === 'properties'
                  ? 'bg-app-accent-muted text-app-accent shadow-[0_0_0_1px_rgba(147,124,248,0.2)]'
                  : 'text-app-faint hover:bg-app-elevated hover:text-app-muted'
              }`}
            >
              <Settings size={14} />
              Properties
            </button>
          </div>

          {rightPanelTab === 'library' ? (
            <ComponentLibraryPanel editor={editor} />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-app-faint">
                Properties
              </h3>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-app-muted">Content Type</label>
                  <select className="box-border w-full rounded-md border border-app-border bg-app-surface px-3 py-2.5 text-[13px] text-app-text outline-none">
                    <option>Article</option>
                    <option>Guide</option>
                    <option>Documentation</option>
                    <option>Blog Post</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-app-muted">Tags</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['tutorial', 'guide', '2025'].map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-xl bg-violet-500/15 px-2.5 py-1 text-[11px] text-violet-400"
                      >
                        {tag}
                        <button
                          type="button"
                          className="flex cursor-pointer border-none bg-transparent p-0 text-violet-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="cursor-pointer rounded-xl border border-dashed border-app-border-strong bg-app-surface px-2.5 py-1 text-[11px] text-app-faint"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-app-muted">Visibility</label>
                  <select className="box-border w-full rounded-md border border-app-border bg-app-surface px-3 py-2.5 text-[13px] text-app-text outline-none">
                    <option>Public</option>
                    <option>Team Only</option>
                    <option>Private</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-app-muted">Featured Image</label>
                  <div className="flex h-[120px] cursor-pointer items-center justify-center rounded-app-md border border-dashed border-app-border-strong bg-app-surface/50 text-xs text-app-faint">
                    Click to upload
                  </div>
                </div>
              </div>
            </div>
          )}
        </Surface>
      </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[520px] rounded-app-xl border border-app-border/90 bg-app-bg-subtle/95 p-5 shadow-app-lift backdrop-blur-xl">
            <h3 className="m-0 text-lg text-app-text font-semibold">Save Selection as Component</h3>
            <p className="mt-1 mb-4 text-[12px] text-app-muted">
              Create a reusable component from current selection.
            </p>

            <div className="text-[11px] text-app-faint mb-2">Selection preview</div>
            <div className="rounded-md border border-app-border bg-app-surface p-3 text-[12px] text-app-muted max-h-[90px] overflow-auto mb-4">
              {selectedText || 'No selection'}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <input
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                placeholder="Component name"
                className="px-3 py-2.5 bg-app-surface border border-app-border rounded-md text-app-text text-[13px] outline-none"
              />
              <input
                value={componentKey}
                onChange={(e) => setComponentKey(e.target.value)}
                placeholder="component-key"
                className="px-3 py-2.5 bg-app-surface border border-app-border rounded-md text-app-text text-[13px] outline-none"
              />
              <textarea
                value={componentDescription}
                onChange={(e) => setComponentDescription(e.target.value)}
                placeholder="Description (optional)"
                className="px-3 py-2.5 bg-app-surface border border-app-border rounded-md text-app-text text-[13px] outline-none min-h-[72px]"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComponentMode('linked')}
                  className={`px-3 py-2 rounded-md text-[12px] border ${
                    componentMode === 'linked'
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                      : 'bg-app-surface text-app-muted border-app-border'
                  }`}
                >
                  Linked (live-sync)
                </button>
                <button
                  type="button"
                  onClick={() => setComponentMode('detached')}
                  className={`px-3 py-2 rounded-md text-[12px] border ${
                    componentMode === 'detached'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'bg-app-surface text-app-muted border-app-border'
                  }`}
                >
                  Detached (snapshot)
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
                className="px-3 py-2 text-[13px] bg-app-surface border border-app-border rounded-md text-app-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSelectionAsComponent}
                disabled={componentSaving}
                className="px-3 py-2 text-[13px] rounded-md text-white bg-gradient-to-br from-violet-500 to-cyan-500 disabled:opacity-70"
              >
                {componentSaving ? 'Saving…' : 'Save Component'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
