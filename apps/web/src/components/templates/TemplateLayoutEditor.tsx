import React, { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor, JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import {
  Bold,
  ChevronDown,
  CheckCircle,
  Columns2,
  Columns3,
  Eye,
  FolderOpen,
  GripVertical,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Languages,
  Link2,
  Loader2,
  List,
  ListOrdered,
  Monitor,
  Mail,
  Plus,
  Save,
  Settings2,
  Smartphone,
  Trash2,
  Underline as UnderlineIcon,
  X,
} from 'lucide-react';
import {
  templateCrudService,
  type LayoutRow,
  type TemplateLayoutConfig,
  type TemplateLayoutRegion,
  type TemplateRecord,
} from '../../services/templateCrudService';
import {
  LAYOUT_VERSION,
  MIN_CELL_FLEX,
  addColumnToRow,
  addRegionToCell,
  addRowWithRegion,
  equalizeRowColumns,
  flattenRegions,
  layoutRegionCount,
  mapRegion,
  parseTemplateLayout,
  removeRegionFromRows,
  previewRowGridTemplateColumns,
  rowGridTemplateColumns,
} from '../../lib/templateLayout/layoutConfig';
import {
  TextBlockModal,
  MediaBlockModal,
  FieldBlockModal,
  type TextBlockFormValues,
  type MediaBlockFormValues,
  type FieldBlockFormValues,
} from './TemplateBlockModals';

const REGION_TYPES = {
  richText: 'richText',
  media: 'media',
  field: 'field',
} as const;

/** Inline image uploads above this size are rejected (base64 would bloat the layout JSON). */
const TEMPLATE_INLINE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** Demo rows for “asset library” until the app wires a real assets API into the editor. */
const TEMPLATE_LIBRARY_DEMO_IMAGES: { id: string; name: string; src: string }[] = [
  {
    id: 'tpl-lib-hero',
    name: 'Gradient hero',
    src:
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="160"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)" rx="14"/><text x="50%" y="50%" fill="white" font-size="15" font-family="system-ui,sans-serif" text-anchor="middle" dy=".35em">Library · Hero</text></svg>',
      ),
  },
  {
    id: 'tpl-lib-banner',
    name: 'Dark banner',
    src:
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="120"><rect width="100%" height="100%" fill="#0f172a" rx="10"/><text x="50%" y="50%" fill="#94a3b8" font-size="13" font-family="system-ui,sans-serif" text-anchor="middle" dy=".35em">Library · Banner</text></svg>',
      ),
  },
];

function TemplateImageLibraryModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (src: string) => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pick image from library"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[min(90vh,520px)] w-full max-w-lg overflow-hidden rounded-app-xl border border-app-border bg-app-bg-subtle shadow-xl">
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
            <FolderOpen size={16} className="text-app-accent" aria-hidden />
            Asset library
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-app-faint hover:bg-app-surface-hover hover:text-app-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[min(60vh,380px)] space-y-2 overflow-y-auto p-3">
          {TEMPLATE_LIBRARY_DEMO_IMAGES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onPick(a.src)}
              className="flex w-full items-center gap-3 rounded-xl border border-app-border bg-app-bg p-2 text-left hover:border-app-accent/40 hover:bg-app-accent-muted/20"
            >
              <img src={a.src} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-app-text">
                {a.name}
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-app-border px-4 py-3 text-[11px] text-app-faint">
          <RouterLink
            to="/assets"
            className="font-medium text-app-accent hover:underline"
            onClick={onClose}
          >
            Open full asset library
          </RouterLink>{' '}
          to upload and manage files. Demo thumbnails above insert placeholder images into the
          template.
        </div>
      </div>
    </div>
  );
}

function emptyDoc(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

function docFromSectionTitle(sectionTitle: string): JSONContent {
  const t = sectionTitle.trim();
  if (!t) return emptyDoc();
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: t }] },
      { type: 'paragraph' },
    ],
  };
}

function ensureRichDoc(props: Record<string, unknown> | undefined): JSONContent {
  const doc = props?.doc;
  if (
    doc &&
    typeof doc === 'object' &&
    !Array.isArray(doc) &&
    (doc as JSONContent).type === 'doc'
  ) {
    return doc as JSONContent;
  }
  return emptyDoc();
}

/** Rich-text formatting actions for the shared toolbar (targets the focused editor). */
type RichTextToolkitFlags = {
  heading1: boolean;
  heading2: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  bulletList: boolean;
  orderedList: boolean;
  link: boolean;
  insertImage: boolean;
  fieldToken: boolean;
  mediaToken: boolean;
};

type RichTextEditorProps = {
  initialDoc: JSONContent;
  placeholder: string;
  onDocChange: (doc: JSONContent) => void;
  onEditorReady?: (editor: Editor | null) => void;
};

function RichTextEditor({
  initialDoc,
  placeholder,
  onDocChange,
  onEditorReady,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: { class: 'max-w-full rounded-lg border border-white/[0.08]' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialDoc,
    onUpdate: ({ editor: ed }) => {
      onDocChange(ed.getJSON());
    },
    editorProps: {
      attributes: {
        class:
          'min-h-[132px] px-4 py-3 text-sm text-app-text leading-relaxed outline-none prose prose-invert max-w-none',
      },
    },
  });

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  return <EditorContent editor={editor} />;
}

/** Keeps the TipTap selection when clicking toolbar controls. */
function toolbarControlMouseDown(e: React.MouseEvent) {
  e.preventDefault();
}

function SharedRichTextToolkitBar({
  toolkit,
  editor,
  activeRegionTitle,
  activeRegionId,
  getEditorByRegionId,
}: {
  toolkit: RichTextToolkitFlags;
  editor: Editor | null;
  activeRegionTitle: string | null;
  activeRegionId: string | null;
  getEditorByRegionId: (regionId: string) => Editor | null;
}) {
  const [, setToolbarRenderTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    let raf = 0;
    const sync = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setToolbarRenderTick((t) => t + 1);
      });
    };
    editor.on('selectionUpdate', sync);
    editor.on('transaction', sync);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      editor.off('selectionUpdate', sync);
      editor.off('transaction', sync);
    };
  }, [editor]);

  const [showFieldPopover, setShowFieldPopover] = useState(false);
  const [showMediaPopover, setShowMediaPopover] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);
  const [imagePickMessage, setImagePickMessage] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [fieldTokenInput, setFieldTokenInput] = useState('firstName');
  const [mediaTokenInput, setMediaTokenInput] = useState('avatarImage');
  const [showTranslatePopover, setShowTranslatePopover] = useState(false);
  const [inlineTranslateTo, setInlineTranslateTo] = useState('es');
  const [inlineTranslating, setInlineTranslating] = useState(false);
  const [translateCapture, setTranslateCapture] = useState<{
    regionId: string;
    text: string;
    from: number;
    to: number;
  } | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const insertToken = useCallback(
    (token: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(token).run();
    },
    [editor],
  );

  const insertFieldTokenFromPopover = useCallback(() => {
    const key = fieldTokenInput.trim();
    if (!key) return;
    insertToken(`{{${key}}}`);
    setShowFieldPopover(false);
  }, [fieldTokenInput, insertToken]);

  const insertMediaTokenFromPopover = useCallback(() => {
    const key = mediaTokenInput.trim();
    if (!key) return;
    insertToken(`<${key}>`);
    setShowMediaPopover(false);
  }, [mediaTokenInput, insertToken]);

  const insertImageFromSrc = useCallback(
    (src: string) => {
      if (!editor || !src.trim()) return;
      setImagePickMessage(null);
      editor.chain().focus().setImage({ src: src.trim(), alt: 'Template image' }).run();
    },
    [editor],
  );

  const onImageFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setImagePickMessage('Please choose an image file.');
        return;
      }
      if (file.size > TEMPLATE_INLINE_IMAGE_MAX_BYTES) {
        setImagePickMessage(
          `Image is too large (max ${Math.round(TEMPLATE_INLINE_IMAGE_MAX_BYTES / (1024 * 1024))} MB).`,
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result;
        if (typeof r === 'string') insertImageFromSrc(r);
      };
      reader.onerror = () => setImagePickMessage('Could not read that file.');
      reader.readAsDataURL(file);
      setShowImageMenu(false);
    },
    [insertImageFromSrc],
  );

  const fmtBtn = (active: boolean) =>
    `inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-[11px] ${
      active
        ? 'border-app-accent/45 bg-app-accent-muted/40 text-app-accent'
        : 'border-app-border bg-app-bg-subtle/40 text-app-muted hover:bg-app-surface-hover'
    }`;

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

  const hasEditor = !!editor;

  return (
    <>
      <div
        data-shared-rich-toolbar
        className="shrink-0 border-b border-white/[0.07] bg-[#0d0f18] px-4 py-2"
      >
        <div className="mb-1.5 flex min-h-[14px] flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-app-faint">
          <span className="font-medium uppercase tracking-[0.06em] text-app-muted">Formatting</span>
          <span className="text-app-faint">·</span>
          {activeRegionTitle ? (
            <span className="min-w-0 truncate text-app-muted">{activeRegionTitle}</span>
          ) : (
            <span className="text-app-faint italic">Click a rich text block to target it</span>
          )}
        </div>
        <div
          className={`flex flex-wrap items-center gap-2 rounded-app-md border border-app-border/60 p-2 ${
            hasEditor ? 'bg-app-bg-subtle/50' : 'bg-app-bg-subtle/20 opacity-50'
          }`}
        >
          {toolkit.heading1 ? (
            <button
              type="button"
              disabled={!hasEditor}
              onMouseDown={toolbarControlMouseDown}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              className={fmtBtn(Boolean(editor?.isActive('heading', { level: 1 })))}
              title="Heading 1"
            >
              <Heading1 size={13} />
            </button>
          ) : null}
          {toolkit.heading2 ? (
            <button
              type="button"
              disabled={!hasEditor}
              onMouseDown={toolbarControlMouseDown}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={fmtBtn(Boolean(editor?.isActive('heading', { level: 2 })))}
              title="Heading 2"
            >
              <Heading2 size={13} />
            </button>
          ) : null}
          {toolkit.bold ? (
            <button
              type="button"
              disabled={!hasEditor}
              onMouseDown={toolbarControlMouseDown}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={fmtBtn(Boolean(editor?.isActive('bold')))}
              title="Bold"
            >
              <Bold size={13} />
            </button>
          ) : null}
          {toolkit.italic ? (
            <button
              type="button"
              disabled={!hasEditor}
              onMouseDown={toolbarControlMouseDown}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={fmtBtn(Boolean(editor?.isActive('italic')))}
              title="Italic"
            >
              <Italic size={13} />
            </button>
          ) : null}
          {toolkit.underline ? (
            <button
              type="button"
              disabled={!hasEditor}
              onMouseDown={toolbarControlMouseDown}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              className={fmtBtn(Boolean(editor?.isActive('underline')))}
              title="Underline"
            >
              <UnderlineIcon size={13} />
            </button>
          ) : null}
          {toolkit.bulletList ? (
            <button
              type="button"
              disabled={!hasEditor}
              onMouseDown={toolbarControlMouseDown}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={fmtBtn(Boolean(editor?.isActive('bulletList')))}
              title="Bullet list"
            >
              <List size={13} />
            </button>
          ) : null}
          {toolkit.orderedList ? (
            <button
              type="button"
              disabled={!hasEditor}
              onMouseDown={toolbarControlMouseDown}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={fmtBtn(Boolean(editor?.isActive('orderedList')))}
              title="Ordered list"
            >
              <ListOrdered size={13} />
            </button>
          ) : null}
          {toolkit.link ? (
            <button
              type="button"
              disabled={!hasEditor}
              onMouseDown={toolbarControlMouseDown}
              onClick={setLink}
              className={fmtBtn(Boolean(editor?.isActive('link')))}
              title="Link"
            >
              <Link2 size={13} />
            </button>
          ) : null}
          {toolkit.insertImage ? (
            <div className="relative">
              <button
                type="button"
                disabled={!hasEditor}
                onMouseDown={toolbarControlMouseDown}
                onClick={() => {
                  setShowFieldPopover(false);
                  setShowMediaPopover(false);
                  setImagePickMessage(null);
                  setShowImageMenu((v) => !v);
                }}
                className={fmtBtn(false)}
                title="Insert image (device or asset library)"
              >
                <ImageIcon size={13} />
              </button>
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onImageFileChange}
              />
              {showImageMenu && hasEditor ? (
                <div className="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[210px] rounded-lg border border-app-border bg-app-bg py-1 shadow-lg">
                  <button
                    type="button"
                    onMouseDown={toolbarControlMouseDown}
                    className="block w-full px-3 py-2 text-left text-xs text-app-text hover:bg-app-surface-hover"
                    onClick={() => {
                      setImagePickMessage(null);
                      imageFileInputRef.current?.click();
                    }}
                  >
                    Upload from device…
                  </button>
                  <button
                    type="button"
                    onMouseDown={toolbarControlMouseDown}
                    className="block w-full px-3 py-2 text-left text-xs text-app-text hover:bg-app-surface-hover"
                    onClick={() => {
                      setShowImageMenu(false);
                      setImagePickMessage(null);
                      setShowAssetLibrary(true);
                    }}
                  >
                    Choose from asset library…
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {toolkit.fieldToken ? (
            <button
              type="button"
              disabled={!hasEditor}
              onMouseDown={toolbarControlMouseDown}
              onClick={() => {
                setShowImageMenu(false);
                setShowMediaPopover(false);
                setShowFieldPopover((v) => !v);
              }}
              className="rounded border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
            >
              Add field token
            </button>
          ) : null}
          {toolkit.mediaToken ? (
            <button
              type="button"
              disabled={!hasEditor}
              onMouseDown={toolbarControlMouseDown}
              onClick={() => {
                setShowImageMenu(false);
                setShowFieldPopover(false);
                setShowMediaPopover((v) => !v);
              }}
              className="rounded border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-40"
            >
              Add media token
            </button>
          ) : null}
          {showFieldPopover && hasEditor ? (
            <div className="w-full max-w-[340px] rounded border border-amber-400/30 bg-black/25 p-2.5">
              <label className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-app-faint">
                Field key
              </label>
              <div className="flex gap-2">
                <input
                  value={fieldTokenInput}
                  onChange={(e) => setFieldTokenInput(e.target.value)}
                  placeholder="firstName"
                  className="flex-1 rounded border border-app-border bg-app-bg px-2 py-1.5 text-xs text-app-text"
                />
                <button
                  type="button"
                  onMouseDown={toolbarControlMouseDown}
                  onClick={insertFieldTokenFromPopover}
                  className="rounded border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
                >
                  Insert
                </button>
              </div>
            </div>
          ) : null}
          {showMediaPopover && hasEditor ? (
            <div className="w-full max-w-[340px] rounded border border-cyan-400/30 bg-black/25 p-2.5">
              <label className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-app-faint">
                Media key
              </label>
              <div className="flex gap-2">
                <input
                  value={mediaTokenInput}
                  onChange={(e) => setMediaTokenInput(e.target.value)}
                  placeholder="avatarImage"
                  className="flex-1 rounded border border-app-border bg-app-bg px-2 py-1.5 text-xs text-app-text"
                />
                <button
                  type="button"
                  onMouseDown={toolbarControlMouseDown}
                  onClick={insertMediaTokenFromPopover}
                  className="rounded border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20"
                >
                  Insert
                </button>
              </div>
            </div>
          ) : null}
          {imagePickMessage ? (
            <p className="w-full basis-full text-[11px] leading-snug text-red-300">
              {imagePickMessage}
            </p>
          ) : null}

          {/* Divider */}
          <div className="mx-0.5 hidden h-5 w-px bg-app-border/40 sm:block" />

          {/* Translate selection */}
          <div className="relative">
            <button
              type="button"
              disabled={!hasEditor}
              onMouseDown={toolbarControlMouseDown}
              onClick={() => {
                setShowFieldPopover(false);
                setShowMediaPopover(false);
                setShowImageMenu(false);
                setTranslateError(null);
                if (showTranslatePopover) {
                  setShowTranslatePopover(false);
                  setTranslateCapture(null);
                  return;
                }
                if (!editor || !activeRegionId) return;
                const { from, to } = editor.state.selection;
                const text = editor.state.doc.textBetween(from, to, ' ');
                setTranslateCapture({ regionId: activeRegionId, text, from, to });
                setShowTranslatePopover(true);
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
              title="Translate selected text"
            >
              <Languages size={12} />
              <span className="hidden sm:inline">Translate</span>
            </button>
            {showTranslatePopover && hasEditor ? (
              <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[260px] rounded-lg border border-app-border bg-app-bg shadow-lg">
                <div className="border-b border-app-border/40 px-3 py-2">
                  <span className="text-[10px] font-medium text-app-muted">
                    {translateCapture?.text
                      ? `Translate: "${translateCapture.text.length > 30 ? translateCapture.text.slice(0, 30) + '…' : translateCapture.text}"`
                      : 'Select text first, then click Translate'}
                  </span>
                </div>
                <div className="max-h-[220px] overflow-y-auto py-1">
                  {[
                    { code: 'en', name: 'English' },
                    { code: 'es', name: 'Spanish' },
                    { code: 'fr', name: 'French' },
                    { code: 'de', name: 'German' },
                    { code: 'hi', name: 'Hindi' },
                    { code: 'pt', name: 'Portuguese' },
                    { code: 'ja', name: 'Japanese' },
                    { code: 'ko', name: 'Korean' },
                    { code: 'zh-CN', name: 'Chinese (Simplified)' },
                    { code: 'zh-TW', name: 'Chinese (Traditional)' },
                    { code: 'ar', name: 'Arabic' },
                    { code: 'ru', name: 'Russian' },
                    { code: 'it', name: 'Italian' },
                    { code: 'nl', name: 'Dutch' },
                    { code: 'pl', name: 'Polish' },
                    { code: 'tr', name: 'Turkish' },
                    { code: 'vi', name: 'Vietnamese' },
                    { code: 'th', name: 'Thai' },
                    { code: 'id', name: 'Indonesian' },
                    { code: 'sv', name: 'Swedish' },
                    { code: 'te', name: 'Telugu' },
                    { code: 'ta', name: 'Tamil' },
                    { code: 'bn', name: 'Bengali' },
                    { code: 'mr', name: 'Marathi' },
                    { code: 'ur', name: 'Urdu' },
                    { code: 'uk', name: 'Ukrainian' },
                    { code: 'el', name: 'Greek' },
                    { code: 'he', name: 'Hebrew' },
                    { code: 'cs', name: 'Czech' },
                    { code: 'ro', name: 'Romanian' },
                  ].map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onMouseDown={toolbarControlMouseDown}
                      onClick={() => {
                        const cap = translateCapture;
                        if (!cap?.text.trim()) return;
                        setInlineTranslateTo(l.code);
                        setInlineTranslating(true);
                        setTranslateError(null);
                        void (async () => {
                          try {
                            const { translated } = await templateCrudService.translateText(
                              cap.text,
                              l.code,
                            );
                            const ed = getEditorByRegionId(cap.regionId) ?? editor;
                            if (!ed) {
                              setTranslateError('Editor for this block is no longer available.');
                              return;
                            }
                            const textNode = ed.state.schema.text(translated);
                            ed.chain()
                              .focus()
                              .command(({ tr }) => {
                                tr.replaceWith(cap.from, cap.to, textNode);
                                return true;
                              })
                              .run();
                            setShowTranslatePopover(false);
                            setTranslateCapture(null);
                            setTranslateError(null);
                          } catch (e) {
                            setTranslateError(
                              e instanceof Error ? e.message : 'Translation failed',
                            );
                          } finally {
                            setInlineTranslating(false);
                          }
                        })();
                      }}
                      disabled={inlineTranslating || !translateCapture?.text.trim()}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] hover:bg-app-surface-hover disabled:opacity-50 ${
                        inlineTranslateTo === l.code ? 'text-emerald-300' : 'text-app-text'
                      }`}
                    >
                      <span>{l.name}</span>
                      <span className="text-[9px] text-app-faint">{l.code}</span>
                    </button>
                  ))}
                </div>
                {inlineTranslating && (
                  <div className="flex items-center gap-1.5 border-t border-app-border/40 px-3 py-2 text-[10px] text-emerald-300">
                    <Loader2 size={10} className="animate-spin" /> Translating…
                  </div>
                )}
                {translateError ? (
                  <div className="border-t border-app-border/40 px-3 py-2 text-[10px] text-red-300">
                    {translateError}
                  </div>
                ) : null}
                <div className="border-t border-app-border/40 px-3 py-1.5">
                  <p className="text-[8px] text-app-faint">
                    {translateCapture?.text.trim()
                      ? 'Pick a language to replace the selection with its translation.'
                      : 'Select text in the editor first, then click the Translate button.'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <TemplateImageLibraryModal
        open={showAssetLibrary}
        onClose={() => setShowAssetLibrary(false)}
        onPick={(src) => {
          insertImageFromSrc(src);
          setShowAssetLibrary(false);
        }}
      />
    </>
  );
}

type SortableRegionProps = {
  region: TemplateLayoutRegion;
  onUpdateDoc: (id: string, doc: JSONContent) => void;
  onConfigure: (id: string) => void;
  onRemove: (id: string) => void;
  onEditorFocusRegion?: (regionId: string) => void;
  onEditorBlurRegion?: (regionId: string, relatedTarget: EventTarget | null) => void;
  onRichTextEditorRegister?: (regionId: string, editor: Editor | null) => void;
};

function SortableRegionCard({
  region,
  onUpdateDoc,
  onConfigure,
  onRemove,
  onEditorFocusRegion,
  onEditorBlurRegion,
  onRichTextEditorRegister,
}: SortableRegionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: region.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const doc = region.type === REGION_TYPES.richText ? ensureRichDoc(region.props) : emptyDoc();
  const editorPlaceholder =
    region.type === REGION_TYPES.richText
      ? String(
          (region.props as { editorPlaceholder?: string } | undefined)?.editorPlaceholder ??
            'Write section content…',
        )
      : 'Write section content…';
  const sectionTitle =
    region.type === REGION_TYPES.richText
      ? String((region.props as { sectionTitle?: string } | undefined)?.sectionTitle ?? '').trim()
      : '';
  const fieldKey =
    region.type === REGION_TYPES.field
      ? String((region.props as { fieldKey?: string } | undefined)?.fieldKey ?? 'field_name')
      : '';
  const fieldLabel =
    region.type === REGION_TYPES.field
      ? String((region.props as { label?: string } | undefined)?.label ?? '')
      : '';
  const fieldHelp =
    region.type === REGION_TYPES.field
      ? String((region.props as { helpText?: string } | undefined)?.helpText ?? '')
      : '';
  const fieldRequired =
    region.type === REGION_TYPES.field
      ? Boolean((region.props as { required?: boolean } | undefined)?.required)
      : false;
  const mediaRole =
    region.type === REGION_TYPES.media
      ? String((region.props as { role?: string } | undefined)?.role ?? 'inline')
      : '';
  const mediaAlt =
    region.type === REGION_TYPES.media
      ? String((region.props as { alt?: string } | undefined)?.alt ?? '')
      : '';
  const mediaCaption =
    region.type === REGION_TYPES.media
      ? String((region.props as { caption?: string } | undefined)?.caption ?? '')
      : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-app-md border border-app-border bg-app-bg-subtle ${
        isDragging ? 'opacity-80 ring-1 ring-app-accent/40' : 'hover:border-app-accent/25'
      }`}
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-black/15 px-3 py-2.5">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-app-faint hover:bg-app-surface-hover hover:text-app-muted"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <span className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-app-muted">
          {region.type === REGION_TYPES.richText && (sectionTitle || 'Rich text')}
          {region.type === REGION_TYPES.media && `Media · ${mediaRole}`}
          {region.type === REGION_TYPES.field && (fieldLabel || fieldKey || 'Field')}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onConfigure(region.id)}
          className="rounded p-1 text-app-faint hover:bg-app-surface-hover hover:text-app-muted"
          title="Configure block"
          aria-label="Configure block"
        >
          <Settings2 size={14} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(region.id)}
          className="rounded p-1 text-app-faint hover:bg-red-500/15 hover:text-red-200"
          aria-label="Remove section"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-4">
        {region.type === REGION_TYPES.richText && (
          <div
            className="space-y-3"
            onFocusCapture={() => onEditorFocusRegion?.(region.id)}
            onBlurCapture={(e) => onEditorBlurRegion?.(region.id, e.relatedTarget)}
          >
            <RichTextEditor
              key={`${region.id}-${editorPlaceholder}`}
              initialDoc={doc}
              placeholder={editorPlaceholder}
              onDocChange={(d) => onUpdateDoc(region.id, d)}
              onEditorReady={(ed) => onRichTextEditorRegister?.(region.id, ed)}
            />
          </div>
        )}
        {region.type === REGION_TYPES.media && (
          <div className="space-y-2">
            <div className="flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-app-md border border-dashed border-app-border/70 bg-app-bg-subtle/50 px-4 py-4 text-center">
              <ImageIcon size={22} className="text-app-faint" />
              <span className="text-[11px] text-app-muted">
                {mediaCaption || 'Media placeholder'}
              </span>
              <span className="text-[10px] text-app-faint">Alt: {mediaAlt || '—'}</span>
            </div>
          </div>
        )}
        {region.type === REGION_TYPES.field && (
          <div className="rounded-app-md border border-app-border/60 bg-app-bg-subtle/50 px-3.5 py-3">
            <div className="font-mono text-sm text-amber-200/90">{`{{${fieldKey}}}`}</div>
            {fieldLabel ? <div className="mt-1 text-xs text-app-muted">{fieldLabel}</div> : null}
            {fieldHelp ? <p className="mt-1 mb-0 text-[11px] text-app-faint">{fieldHelp}</p> : null}
            {fieldRequired ? (
              <span className="mt-1 inline-block text-[10px] text-amber-200/80">Required</span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

type ResizeHandleProps = {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
};

function ColumnResizeHandle({ onPointerDown }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="group relative w-3 shrink-0 cursor-col-resize select-none touch-none"
      onPointerDown={onPointerDown}
    >
      <div className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-app-border/90 group-hover:bg-app-accent/60 group-active:bg-app-accent" />
    </div>
  );
}

type SortableLayoutRowProps = {
  row: LayoutRow;
  onResizePointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    rowId: string,
    leftCellIndex: number,
  ) => void;
  onRequestAddColumn: (rowId: string) => void;
  /** Stack another block in this column (same grid track, rows stack vertically). */
  onRequestAddToCell: (rowId: string, cellId: string) => void;
  onEqualizeColumns: (rowId: string) => void;
  onUpdateDoc: (id: string, doc: JSONContent) => void;
  onConfigure: (id: string) => void;
  onRemove: (id: string) => void;
  onEditorFocusRegion: (regionId: string) => void;
  onEditorBlurRegion: (regionId: string, relatedTarget: EventTarget | null) => void;
  onRichTextEditorRegister: (regionId: string, editor: Editor | null) => void;
  addColumnDisabled?: boolean;
  addToCellDisabled?: (rowId: string, cellId: string) => boolean;
};

function SortableLayoutRow({
  row,
  onResizePointerDown,
  onRequestAddColumn,
  onRequestAddToCell,
  onEqualizeColumns,
  onUpdateDoc,
  onConfigure,
  onRemove,
  onEditorFocusRegion,
  onEditorBlurRegion,
  onRichTextEditorRegister,
  addColumnDisabled,
  addToCellDisabled,
}: SortableLayoutRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const gridCols = rowGridTemplateColumns(row.cells);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-layout-row
      className={`rounded-app-lg border border-app-border bg-app-bg-subtle ${
        isDragging ? 'opacity-80 ring-1 ring-app-accent/40' : 'hover:border-app-accent/25'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-black/15 px-2 py-2 sm:px-3">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-app-faint hover:bg-app-surface-hover hover:text-app-muted"
          aria-label="Drag to reorder row"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <span className="text-[10px] font-medium tabular-nums text-app-faint">
          Row · {row.cells.length}
        </span>
        <div className="flex-1" />
        {row.cells.length > 1 ? (
          <button
            type="button"
            onClick={() => onEqualizeColumns(row.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-black/20 px-2.5 py-1 text-[10px] font-medium text-app-muted hover:border-app-accent/25 hover:text-app-text"
            title="Equal column widths"
          >
            <Columns3 size={12} aria-hidden />
            Equal
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onRequestAddColumn(row.id)}
          disabled={addColumnDisabled}
          className="inline-flex items-center gap-1.5 rounded-md border border-app-accent/35 bg-app-accent-muted/40 px-2.5 py-1 text-[10px] font-medium text-app-accent hover:bg-app-accent-muted disabled:opacity-40"
          title={
            addColumnDisabled
              ? 'Column limit reached for this channel'
              : 'Add a new column block in this row'
          }
        >
          <Columns2 size={12} aria-hidden />+ Column
        </button>
      </div>
      <div
        className="grid min-w-0 items-stretch overflow-x-auto p-2 sm:p-3"
        style={{ gridTemplateColumns: gridCols }}
      >
        {row.cells.flatMap((cell, i) => {
          const chunk: React.ReactElement[] = [
            <div key={cell.id} className="flex min-w-0 flex-col gap-3">
              {cell.regions.map((region) => (
                <SortableRegionCard
                  key={region.id}
                  region={region}
                  onUpdateDoc={onUpdateDoc}
                  onConfigure={onConfigure}
                  onRemove={onRemove}
                  onEditorFocusRegion={onEditorFocusRegion}
                  onEditorBlurRegion={onEditorBlurRegion}
                  onRichTextEditorRegister={onRichTextEditorRegister}
                />
              ))}
              <button
                type="button"
                onClick={() => onRequestAddToCell(row.id, cell.id)}
                disabled={addToCellDisabled?.(row.id, cell.id)}
                className="flex w-full items-center justify-center gap-1 rounded-app-md border border-dashed border-white/[0.1] bg-black/15 py-1.5 text-[10px] font-medium text-app-faint hover:border-app-accent/35 hover:bg-app-accent-muted/20 hover:text-app-accent disabled:opacity-30 disabled:pointer-events-none"
              >
                <Plus size={11} aria-hidden />+ Block
              </button>
            </div>,
          ];
          if (i < row.cells.length - 1) {
            chunk.push(
              <div
                key={`${row.id}-gutter-${i}`}
                className="flex min-w-0 items-stretch justify-center"
              >
                <ColumnResizeHandle onPointerDown={(e) => onResizePointerDown(e, row.id, i)} />
              </div>,
            );
          }
          return chunk;
        })}
      </div>
    </div>
  );
}

type PreviewProps = {
  rows: LayoutRow[];
  breakpoint: 'desktop' | 'mobile';
};

function ReadOnlyRich({ doc }: { doc: JSONContent }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: { class: 'max-w-full rounded-lg border border-white/[0.08]' },
      }),
    ],
    content: doc,
    editable: false,
    editorProps: {
      attributes: {
        class:
          'text-sm text-app-text leading-relaxed opacity-95 prose prose-invert max-w-none px-0.5 py-0.5',
      },
    },
  });
  return <EditorContent editor={editor} />;
}

function PreviewRegionCard({ region }: { region: TemplateLayoutRegion }) {
  const richDoc = ensureRichDoc(region.props);
  const richDocKey = `${region.id}:${JSON.stringify(richDoc)}`;
  return (
    <div className="h-full rounded-app-md border border-app-border bg-app-bg-subtle p-4">
      {region.type === REGION_TYPES.richText && <ReadOnlyRich key={richDocKey} doc={richDoc} />}
      {region.type === REGION_TYPES.media && (
        <div className="space-y-1.5 rounded-app-md border border-dashed border-app-border/70 bg-app-bg-subtle/40 p-4 text-xs text-app-muted">
          <div className="text-[10px] uppercase tracking-wide text-app-faint">
            {String((region.props as { role?: string })?.role ?? 'inline')}
          </div>
          {(region.props as { caption?: string })?.caption ? (
            <div>{String((region.props as { caption?: string }).caption)}</div>
          ) : (
            <div>Media placeholder</div>
          )}
          <div className="text-[10px] text-app-faint">
            Alt: {String((region.props as { alt?: string })?.alt ?? '—')}
          </div>
        </div>
      )}
      {region.type === REGION_TYPES.field && (
        <div className="text-sm">
          <div className="font-mono text-amber-200/90">
            {`{{${String((region.props as { fieldKey?: string })?.fieldKey ?? 'field')}}}`}
          </div>
          {(region.props as { label?: string })?.label ? (
            <div className="mt-1 text-xs text-app-muted">
              {String((region.props as { label?: string }).label)}
            </div>
          ) : null}
          {(region.props as { helpText?: string })?.helpText ? (
            <p className="mt-1 mb-0 text-[11px] text-app-faint">
              {String((region.props as { helpText?: string }).helpText)}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function extractTextFromDoc(doc: JSONContent): string {
  const parts: string[] = [];
  const walk = (node: JSONContent | null | undefined) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'text' && typeof node.text === 'string') {
      parts.push(node.text);
      return;
    }
    if (node.type === 'hardBreak') {
      parts.push('\n');
      return;
    }
    const isBlock =
      node.type === 'paragraph' || node.type === 'heading' || node.type === 'blockquote';
    if (Array.isArray(node.content)) {
      node.content.forEach((child) => walk(child as JSONContent));
      if (isBlock) parts.push('\n');
    }
  };
  walk(doc);
  return parts
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function InlineTemplateText({ text }: { text: string }) {
  const pieces = text.split(/(\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\})/g);
  return (
    <>
      {pieces.map((p, i) =>
        /^\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}$/.test(p) ? (
          <span
            key={`${p}-${i}`}
            className="mx-0.5 inline-flex items-center rounded-[4px] border border-[rgba(124,111,247,0.2)] bg-[rgba(124,111,247,0.15)] px-1.5 py-0.5 font-mono text-[13px] text-[#9d94f5]"
          >
            {p}
          </span>
        ) : (
          <span key={`${p}-${i}`}>{p}</span>
        ),
      )}
    </>
  );
}

function highlightJsonHtml(raw: string): string {
  const esc = (s: string) =>
    s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return esc(raw).replace(
    /"([^"\\]*(?:\\.[^"\\]*)*)"(\s*:\s*)?("([^"\\]*(?:\\.[^"\\]*)*)")?/g,
    (_m, keyText: string, sep: string | undefined, quotedVal: string | undefined) => {
      const key = `<span style="color:#9d94f5">"${esc(keyText)}"</span>`;
      if (!sep) return key;
      const s = `<span style="color:rgba(255,255,255,0.3)">${esc(sep)}</span>`;
      if (!quotedVal) return `${key}${s}`;
      return `${key}${s}<span style="color:#1D9E75">${esc(quotedVal)}</span>`;
    },
  );
}

export function TemplateLayoutLivePreview({ rows, breakpoint }: PreviewProps) {
  const frame =
    breakpoint === 'mobile' ? 'max-w-[375px] mx-auto border-x border-app-border/60' : 'w-full';

  const blockCount = layoutRegionCount({ version: LAYOUT_VERSION, rows });

  return (
    <div className={`space-y-4 ${frame}`}>
      {blockCount === 0 ? (
        <p className="px-2 py-8 text-center text-sm leading-relaxed text-app-muted">
          Nothing to preview yet — add blocks in the editor.
        </p>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className={`grid min-w-0 gap-2 ${breakpoint === 'mobile' ? 'grid-cols-1' : ''}`}
            data-layout-row
            style={
              breakpoint === 'mobile'
                ? undefined
                : { gridTemplateColumns: previewRowGridTemplateColumns(row.cells) }
            }
          >
            {row.cells.map((cell) => (
              <div key={cell.id} className="flex min-w-0 flex-col gap-2">
                {cell.regions.map((region) => (
                  <PreviewRegionCard key={region.id} region={region} />
                ))}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

export type TemplateLayoutEditorHandle = {
  saveDraft: () => Promise<void>;
  activate: () => Promise<void>;
};

type TemplateLayoutEditorProps = {
  templateId: string;
  draftLayout: unknown;
  bindingCount: number;
  onLayoutSaved: (record: TemplateRecord) => void;
  /** Hide internal header and save/activate bar so the parent can host them in a topbar */
  compact?: boolean;
  /** Mutable ref that receives the saveDraft function – caller can invoke it from a topbar button */
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  /** Mutable ref that receives the activate function */
  activateRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  /** Called whenever saving state changes */
  onSavingChange?: (saving: boolean) => void;
  /** Called whenever activating state changes */
  onActivatingChange?: (activating: boolean) => void;
  previewChannels?: Array<{
    bindingId: string;
    channelId: string;
    channelName: string;
    channelKey: string;
    layoutConfig?: Record<string, unknown> | null;
    /** When set (e.g. from API channel record), toolbar matches this binding in preview. */
    compatibility?: {
      fieldTypes?: string[];
      restrictions?: {
        maxCharacters?: number;
        [key: string]: unknown;
      };
    } | null;
  }>;
  channelCompatibility?: {
    fieldTypes?: string[];
    restrictions?: {
      maxCharacters?: number;
      [key: string]: unknown;
    };
  } | null;
  channelLabel?: string;
  /** Fired when dirty / save / activate eligibility changes (used by compact topbar). */
  onToolbarState?: (s: {
    dirty: boolean;
    canActivate: boolean;
    canSaveDraft: boolean;
    exceedsCharacterLimit: boolean;
  }) => void;
  /** HTTP 200 after a successful draft save (parent may show a toast). */
  onDraftSaved?: () => void;
};

type BlockModalState =
  | null
  | { flow: 'add'; kind: 'text' | 'media' | 'field' }
  | { flow: 'edit'; kind: 'text' | 'media' | 'field'; regionId: string };

export default function TemplateLayoutEditor({
  templateId,
  draftLayout,
  bindingCount,
  onLayoutSaved,
  compact,
  saveRef,
  activateRef,
  onSavingChange,
  onActivatingChange,
  previewChannels = [],
  channelCompatibility,
  channelLabel,
  onToolbarState,
  onDraftSaved,
}: TemplateLayoutEditorProps) {
  const [rows, setRows] = useState<LayoutRow[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [appendToRowId, setAppendToRowId] = useState<string | null>(null);
  /** Next palette add stacks inside this column (same grid track) */
  const [appendToCell, setAppendToCell] = useState<{ rowId: string; cellId: string } | null>(null);
  const [blockModal, setBlockModal] = useState<BlockModalState>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [previewBp, setPreviewBp] = useState<'desktop' | 'mobile'>('desktop');
  const [previewBindingId, setPreviewBindingId] = useState<string>('');
  const [previewFieldJson, setPreviewFieldJson] = useState<string>('{}');
  /** Full-width editor vs full-width preview — avoids splitting horizontal space */
  const [workspaceTab, setWorkspaceTab] = useState<'editor' | 'preview'>('editor');
  const selectedPreviewChannel = useMemo(
    () =>
      previewChannels.find((c) => c.bindingId === previewBindingId) ?? previewChannels[0] ?? null,
    [previewChannels, previewBindingId],
  );
  const effectiveChannelCompatibility = useMemo(
    () => selectedPreviewChannel?.compatibility ?? channelCompatibility ?? null,
    [selectedPreviewChannel, channelCompatibility],
  );
  const supportedFieldTypes = useMemo(
    () =>
      new Set((effectiveChannelCompatibility?.fieldTypes ?? []).map((v) => String(v).toLowerCase())),
    [effectiveChannelCompatibility?.fieldTypes],
  );
  const hasFieldTypeRestrictions = supportedFieldTypes.size > 0;
  const allows = useCallback(
    (name: string) => !hasFieldTypeRestrictions || supportedFieldTypes.has(name.toLowerCase()),
    [hasFieldTypeRestrictions, supportedFieldTypes],
  );
  /** Legacy `restrictions.supportsUnderline`; matrix `underline` in fieldTypes is the source of truth when saving. */
  const underlineRestrictionOk =
    effectiveChannelCompatibility?.restrictions?.supportsUnderline !== false;
  const allowRichText = allows('richText') || allows('paragraph');
  const allowMedia = allows('media') || allows('image');
  const allowField = allows('field');
  const richTextEditorsRef = useRef<Map<string, Editor>>(new Map());
  const [focusedRichRegionId, setFocusedRichRegionId] = useState<string | null>(null);
  const [editorRegistryEpoch, setEditorRegistryEpoch] = useState(0);

  const handleEditorFocusRegion = useCallback((regionId: string) => {
    setFocusedRichRegionId(regionId);
  }, []);

  const handleEditorBlurRegion = useCallback(
    (regionId: string, relatedTarget: EventTarget | null) => {
      const el = relatedTarget as HTMLElement | null;
      if (el?.closest?.('[data-shared-rich-toolbar]')) return;
      if (el?.closest?.('.ProseMirror')) return;
      if (!el) {
        window.setTimeout(() => {
          const ae = document.activeElement as HTMLElement | null;
          if (ae?.closest?.('[data-shared-rich-toolbar]')) return;
          if (ae?.closest?.('.ProseMirror')) return;
          setFocusedRichRegionId((prev) => (prev === regionId ? null : prev));
        }, 0);
        return;
      }
      setFocusedRichRegionId((prev) => (prev === regionId ? null : prev));
    },
    [],
  );

  const registerRichTextEditor = useCallback((regionId: string, editor: Editor | null) => {
    if (editor) {
      if (richTextEditorsRef.current.get(regionId) === editor) return;
      richTextEditorsRef.current.set(regionId, editor);
    } else {
      if (!richTextEditorsRef.current.has(regionId)) return;
      richTextEditorsRef.current.delete(regionId);
    }
    setEditorRegistryEpoch((e) => e + 1);
  }, []);

  const handleLayoutDragStart = useCallback(() => {
    setFocusedRichRegionId(null);
  }, []);

  useEffect(() => {
    if (workspaceTab !== 'editor') setFocusedRichRegionId(null);
  }, [workspaceTab]);

  const activeRichToolbarEditor = useMemo(() => {
    void editorRegistryEpoch;
    if (!focusedRichRegionId) return null;
    return richTextEditorsRef.current.get(focusedRichRegionId) ?? null;
  }, [focusedRichRegionId, editorRegistryEpoch]);

  const whatsAppBindingToolkit = useMemo(() => {
    const key = selectedPreviewChannel?.channelKey?.toLowerCase() ?? '';
    const model = effectiveChannelCompatibility?.restrictions?.contentModel;
    return key === 'whatsapp' || model === 'whatsapp';
  }, [selectedPreviewChannel?.channelKey, effectiveChannelCompatibility?.restrictions?.contentModel]);

  const richTextToolkit = useMemo<RichTextToolkitFlags>(
    () => ({
      heading1: allows('heading1'),
      heading2: allows('heading2'),
      bold: allows('bold'),
      italic: allows('italic'),
      underline: allows('underline') && underlineRestrictionOk,
      bulletList: allows('bullet_list'),
      orderedList: allows('ordered_list'),
      link: allows('link'),
      /** WhatsApp supports images in-channel; allow toolbar when `image` or legacy `media`-only matrix. */
      insertImage: allows('image') || (whatsAppBindingToolkit && allows('media')),
      fieldToken: allows('field'),
      mediaToken: allows('media'),
    }),
    [allows, underlineRestrictionOk, whatsAppBindingToolkit],
  );

  /** JSON snapshot last synced with the server (load or successful save). */
  const lastSyncedLayoutJsonRef = useRef('');
  /** Bumps when the synced baseline changes so dirty recomputes. */
  const [layoutBaselineEpoch, setLayoutBaselineEpoch] = useState(0);

  useEffect(() => {
    const parsed = parseTemplateLayout(draftLayout);
    const nextRows = parsed?.rows?.length ? parsed.rows : [];
    setRows(nextRows);
    setFocusedRichRegionId(null);
    richTextEditorsRef.current.clear();
    setEditorRegistryEpoch((e) => e + 1);
    lastSyncedLayoutJsonRef.current = JSON.stringify({
      version: LAYOUT_VERSION,
      rows: nextRows,
    });
    setLayoutBaselineEpoch((e) => e + 1);
  }, [templateId, draftLayout]);

  const flatRegions = useMemo(() => flattenRegions({ version: LAYOUT_VERSION, rows }), [rows]);

  const activeRichToolbarTitle = useMemo(() => {
    if (!focusedRichRegionId) return null;
    const r = flatRegions.find((x) => x.id === focusedRichRegionId);
    if (!r || r.type !== REGION_TYPES.richText) return null;
    const st = String((r.props as { sectionTitle?: string })?.sectionTitle ?? '').trim();
    return st || 'Rich text';
  }, [flatRegions, focusedRichRegionId]);

  const layoutConfig = useMemo(
    (): TemplateLayoutConfig => ({
      version: LAYOUT_VERSION,
      rows,
    }),
    [rows],
  );

  const currentLayoutJson = useMemo(() => JSON.stringify(layoutConfig), [layoutConfig]);

  const dirty = useMemo(() => {
    void layoutBaselineEpoch;
    return currentLayoutJson !== lastSyncedLayoutJsonRef.current;
  }, [currentLayoutJson, layoutBaselineEpoch]);

  const regionCount = layoutRegionCount({ version: LAYOUT_VERSION, rows });

  const previewTokens = useMemo(() => {
    const field = new Set<string>();
    const fieldPattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

    const walkDoc = (node: JSONContent | null | undefined) => {
      if (!node || typeof node !== 'object') return;
      const t = node.type;
      if (t === 'text' && typeof node.text === 'string') {
        const text = node.text;
        let m: RegExpExecArray | null;
        fieldPattern.lastIndex = 0;
        while ((m = fieldPattern.exec(text)) !== null) field.add(m[1]);
      }
      if (Array.isArray(node.content)) {
        node.content.forEach((child) => walkDoc(child as JSONContent));
      }
    };

    rows.forEach((row) => {
      row.cells.forEach((cell) => {
        cell.regions.forEach((region) => {
          if (region.type === REGION_TYPES.field) {
            const key = String(
              (region.props as { fieldKey?: string } | undefined)?.fieldKey ?? '',
            ).trim();
            if (key) field.add(key);
          }
          if (region.type === REGION_TYPES.richText) {
            const doc = ensureRichDoc(region.props);
            walkDoc(doc);
          }
        });
      });
    });

    return {
      field: Array.from(field).sort((a, b) => a.localeCompare(b)),
    };
  }, [rows]);

  const previewFieldValues = useMemo((): Record<string, string> => {
    try {
      const parsed = JSON.parse(previewFieldJson) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          out[key] = String(value);
        }
      }
      return out;
    } catch {
      return {};
    }
  }, [previewFieldJson]);

  const previewFieldJsonError = useMemo(() => {
    try {
      const parsed = JSON.parse(previewFieldJson) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return 'Field values must be a JSON object like {"firstName":"Praneeth"}';
      }
      return null;
    } catch {
      return 'Invalid JSON format.';
    }
  }, [previewFieldJson]);

  const previewFieldJsonHighlighted = useMemo(
    () => highlightJsonHtml(previewFieldJson),
    [previewFieldJson],
  );
  const richTextCharCount = useMemo(() => {
    let total = 0;
    rows.forEach((row) => {
      row.cells.forEach((cell) => {
        cell.regions.forEach((region) => {
          if (region.type !== REGION_TYPES.richText) return;
          total += extractTextFromDoc(ensureRichDoc(region.props)).length;
        });
      });
    });
    return total;
  }, [rows]);
  const maxCharacters = Number(effectiveChannelCompatibility?.restrictions?.maxCharacters);
  const hasMaxCharacters = Number.isFinite(maxCharacters) && maxCharacters > 0;
  const exceedsCharacterLimit = hasMaxCharacters ? richTextCharCount > maxCharacters : false;

  // --- Structural restrictions ---
  const restrictions = effectiveChannelCompatibility?.restrictions;
  const structMaxRows = restrictions?.maxRows;
  const structMaxColsPerRow = restrictions?.maxColumnsPerRow;
  const structMaxRichText = restrictions?.maxRichTextRegions;
  const structMaxMedia = restrictions?.maxMediaRegions;
  const structMaxField = restrictions?.maxFieldRegions;
  const structMaxTotal = restrictions?.maxTotalRegions;
  const structAllowedSeqs = restrictions?.allowedRegionSequences;

  const regionCounts = useMemo(() => {
    let richText = 0;
    let media = 0;
    let field = 0;
    let total = 0;
    rows.forEach((row) => {
      row.cells.forEach((cell) => {
        cell.regions.forEach((region) => {
          total++;
          if (region.type === REGION_TYPES.richText) richText++;
          else if (region.type === REGION_TYPES.media) media++;
          else if (region.type === REGION_TYPES.field) field++;
        });
      });
    });
    return { richText, media, field, total };
  }, [rows]);

  const structuralViolations = useMemo(() => {
    const msgs: string[] = [];
    const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

    if (fin(structMaxRows) && rows.length > structMaxRows) {
      msgs.push(`Max ${structMaxRows} row(s) allowed; layout has ${rows.length}.`);
    }
    if (fin(structMaxColsPerRow)) {
      for (const row of rows) {
        if (row.cells.length > structMaxColsPerRow) {
          msgs.push(`Max ${structMaxColsPerRow} column(s) per row allowed.`);
          break;
        }
      }
    }
    if (fin(structMaxRichText) && regionCounts.richText > structMaxRichText) {
      msgs.push(
        `Max ${structMaxRichText} text block(s) allowed; layout has ${regionCounts.richText}.`,
      );
    }
    if (fin(structMaxMedia) && regionCounts.media > structMaxMedia) {
      msgs.push(`Max ${structMaxMedia} media block(s) allowed; layout has ${regionCounts.media}.`);
    }
    if (fin(structMaxField) && regionCounts.field > structMaxField) {
      msgs.push(`Max ${structMaxField} field block(s) allowed; layout has ${regionCounts.field}.`);
    }
    if (fin(structMaxTotal) && regionCounts.total > structMaxTotal) {
      msgs.push(`Max ${structMaxTotal} total block(s) allowed; layout has ${regionCounts.total}.`);
    }

    if (Array.isArray(structAllowedSeqs) && structAllowedSeqs.length > 0) {
      for (const row of rows) {
        for (const cell of row.cells) {
          const seq = cell.regions.map((r) => r.type);
          const ok = structAllowedSeqs.some(
            (allowed: string[]) =>
              allowed.length === seq.length &&
              allowed.every((t: string, i: number) => t === seq[i]),
          );
          if (!ok && seq.length > 0) {
            const seqStr = seq.join(' → ');
            const allowedStr = structAllowedSeqs.map((s) => s.join('+')).join(', ');
            msgs.push(
              `Block sequence [${seqStr}] is not allowed for this channel (valid: ${allowedStr}).`,
            );
            break;
          }
        }
      }
    }

    return msgs;
  }, [
    rows,
    structMaxRows,
    structMaxColsPerRow,
    structMaxRichText,
    structMaxMedia,
    structMaxField,
    structMaxTotal,
    structAllowedSeqs,
    regionCounts,
  ]);

  const hasStructuralViolation = structuralViolations.length > 0;

  /** Whether adding a new row is possible given structural limits. */
  const canAddRow = useMemo(() => {
    const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
    if (fin(structMaxRows) && rows.length >= structMaxRows) return false;
    return true;
  }, [structMaxRows, rows.length]);

  /** Whether a specific block type can still be added (global count caps). */
  const canAddBlockType = useCallback(
    (type: string): boolean => {
      const fin = (v: unknown): v is number =>
        typeof v === 'number' && Number.isFinite(v) && v >= 0;
      if (fin(structMaxTotal) && regionCounts.total >= structMaxTotal) return false;
      if (
        type === REGION_TYPES.richText &&
        fin(structMaxRichText) &&
        regionCounts.richText >= structMaxRichText
      )
        return false;
      if (
        type === REGION_TYPES.media &&
        fin(structMaxMedia) &&
        regionCounts.media >= structMaxMedia
      )
        return false;
      if (
        type === REGION_TYPES.field &&
        fin(structMaxField) &&
        regionCounts.field >= structMaxField
      )
        return false;
      return true;
    },
    [structMaxTotal, structMaxRichText, structMaxMedia, structMaxField, regionCounts],
  );

  /** Whether adding a column to a row is allowed. */
  const canAddColumnToRow = useCallback(
    (rowId: string): boolean => {
      const fin = (v: unknown): v is number =>
        typeof v === 'number' && Number.isFinite(v) && v >= 0;
      if (!fin(structMaxColsPerRow)) return true;
      const row = rows.find((r) => r.id === rowId);
      if (!row) return true;
      return row.cells.length < structMaxColsPerRow;
    },
    [structMaxColsPerRow, rows],
  );

  /** Whether adding a block of a given type into a specific cell would produce a valid region sequence. */
  const canAddToCellSeq = useCallback(
    (rowId: string, cellId: string, regionType: string): boolean => {
      if (!Array.isArray(structAllowedSeqs) || structAllowedSeqs.length === 0) return true;
      const row = rows.find((r) => r.id === rowId);
      if (!row) return true;
      const cell = row.cells.find((c) => c.id === cellId);
      if (!cell) return true;
      const candidateSeq = [...cell.regions.map((r) => r.type), regionType];
      return structAllowedSeqs.some(
        (allowed: string[]) =>
          allowed.length === candidateSeq.length &&
          allowed.every((t: string, i: number) => t === candidateSeq[i]),
      );
    },
    [structAllowedSeqs, rows],
  );

  const canSaveDraft = useMemo(
    () => dirty && !exceedsCharacterLimit && !hasStructuralViolation,
    [dirty, exceedsCharacterLimit, hasStructuralViolation],
  );

  const canActivate = useMemo(
    () =>
      !dirty &&
      bindingCount >= 1 &&
      regionCount >= 1 &&
      !exceedsCharacterLimit &&
      !hasStructuralViolation,
    [dirty, bindingCount, regionCount, exceedsCharacterLimit, hasStructuralViolation],
  );

  useEffect(() => {
    onToolbarState?.({ dirty, canActivate, canSaveDraft, exceedsCharacterLimit });
  }, [dirty, canActivate, canSaveDraft, exceedsCharacterLimit, onToolbarState]);

  const resolvedPreviewRows = useMemo((): LayoutRow[] => {
    const applyTokens = (node: JSONContent): JSONContent => {
      const cloned: JSONContent = { ...node };
      if (cloned.type === 'text' && typeof cloned.text === 'string') {
        let next = cloned.text;
        next = next.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key: string) => {
          const value = previewFieldValues[key];
          return value?.trim() ? value : match;
        });
        cloned.text = next;
      }
      if (Array.isArray(cloned.content)) {
        cloned.content = cloned.content.map((child) => applyTokens(child as JSONContent));
      }
      return cloned;
    };

    return rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => ({
        ...cell,
        regions: cell.regions.map((region) => {
          if (region.type !== REGION_TYPES.richText) return region;
          const doc = ensureRichDoc(region.props);
          const resolvedDoc = applyTokens(doc);
          return { ...region, props: { ...(region.props ?? {}), doc: resolvedDoc } };
        }),
      })),
    }));
  }, [previewFieldValues, rows]);

  useEffect(() => {
    setPreviewFieldJson((prev) => {
      let base: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(prev) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          base = parsed as Record<string, unknown>;
        }
      } catch {
        /* ignore malformed */
      }
      const next: Record<string, string> = {};
      previewTokens.field.forEach((key) => {
        const existing = base[key];
        next[key] = typeof existing === 'string' ? existing : '';
      });
      return JSON.stringify(next, null, 2);
    });
  }, [previewTokens.field]);

  useEffect(() => {
    if (!previewChannels.length) {
      setPreviewBindingId('');
      return;
    }
    if (!previewBindingId || !previewChannels.some((c) => c.bindingId === previewBindingId)) {
      setPreviewBindingId(previewChannels[0].bindingId);
    }
  }, [previewBindingId, previewChannels]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows((items) => {
      const oldIndex = items.findIndex((r) => r.id === active.id);
      const newIndex = items.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, rowId: string, leftIdx: number) => {
      e.preventDefault();
      const row = rowsRef.current.find((r) => r.id === rowId);
      if (!row || leftIdx >= row.cells.length - 1) return;
      const startLeft = row.cells[leftIdx].flexGrow;
      const startRight = row.cells[leftIdx + 1].flexGrow;
      const pool = startLeft + startRight;
      const host = (e.currentTarget as HTMLElement).closest(
        '[data-layout-row]',
      ) as HTMLElement | null;
      const width = Math.max(120, host?.getBoundingClientRect().width ?? 400);
      const startX = e.clientX;
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const deltaRatio = dx / width;
        let nextLeft = startLeft + deltaRatio * pool;
        nextLeft = Math.max(MIN_CELL_FLEX, Math.min(pool - MIN_CELL_FLEX, nextLeft));
        const nextRight = pool - nextLeft;
        setRows((prev) =>
          prev.map((r) => {
            if (r.id !== rowId) return r;
            const cells = r.cells.map((c, i) => {
              if (i === leftIdx) return { ...c, flexGrow: nextLeft };
              if (i === leftIdx + 1) return { ...c, flexGrow: nextRight };
              return c;
            });
            return { ...r, cells };
          }),
        );
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [],
  );

  const mergeRegionProps = useCallback((id: string, updates: Record<string, unknown>) => {
    setRows((prev) => mapRegion(prev, id, (r) => ({ ...r, props: { ...r.props, ...updates } })));
  }, []);

  const removeRegion = useCallback((id: string) => {
    setRows((prev) => removeRegionFromRows(prev, id));
    setFocusedRichRegionId((cur) => (cur === id ? null : cur));
    richTextEditorsRef.current.delete(id);
    setEditorRegistryEpoch((e) => e + 1);
  }, []);

  const updateDoc = useCallback((id: string, doc: JSONContent) => {
    setRows((prev) => mapRegion(prev, id, (r) => ({ ...r, props: { ...r.props, doc } })));
  }, []);

  function openConfigure(regionId: string) {
    const r = flatRegions.find((x) => x.id === regionId);
    if (!r) return;
    if (r.type === REGION_TYPES.richText) setBlockModal({ flow: 'edit', kind: 'text', regionId });
    else if (r.type === REGION_TYPES.media)
      setBlockModal({ flow: 'edit', kind: 'media', regionId });
    else if (r.type === REGION_TYPES.field)
      setBlockModal({ flow: 'edit', kind: 'field', regionId });
  }

  function closeBlockModal() {
    setBlockModal(null);
    setAppendToRowId(null);
    setAppendToCell(null);
  }

  const createDefaultRichTextRegion = useCallback((): TemplateLayoutRegion => {
    const id = crypto.randomUUID();
    return {
      id,
      type: REGION_TYPES.richText,
      props: {
        sectionTitle: '',
        editorPlaceholder: 'Write section content...',
        doc: emptyDoc(),
      },
    };
  }, []);

  const textModalInitial = useMemo((): Partial<TextBlockFormValues> | undefined => {
    if (!blockModal || blockModal.kind !== 'text' || blockModal.flow !== 'edit') return undefined;
    const r = flatRegions.find((x) => x.id === blockModal.regionId);
    if (!r?.props) return undefined;
    const p = r.props as Record<string, unknown>;
    return {
      sectionTitle: String(p.sectionTitle ?? ''),
      editorPlaceholder: String(p.editorPlaceholder ?? ''),
    };
  }, [blockModal, flatRegions]);

  const mediaModalInitial = useMemo((): Partial<MediaBlockFormValues> | undefined => {
    if (!blockModal || blockModal.kind !== 'media' || blockModal.flow !== 'edit') return undefined;
    const r = flatRegions.find((x) => x.id === blockModal.regionId);
    if (!r?.props) return undefined;
    const p = r.props as Record<string, unknown>;
    return {
      role: (p.role as MediaBlockFormValues['role']) ?? 'inline',
      alt: String(p.alt ?? ''),
      caption: String(p.caption ?? ''),
    };
  }, [blockModal, flatRegions]);

  const fieldModalInitial = useMemo((): Partial<FieldBlockFormValues> | undefined => {
    if (!blockModal || blockModal.kind !== 'field' || blockModal.flow !== 'edit') return undefined;
    const r = flatRegions.find((x) => x.id === blockModal.regionId);
    if (!r?.props) return undefined;
    const p = r.props as Record<string, unknown>;
    return {
      fieldKey: String(p.fieldKey ?? ''),
      label: String(p.label ?? ''),
      helpText: String(p.helpText ?? ''),
      required: Boolean(p.required),
    };
  }, [blockModal, flatRegions]);

  function handleTextModalSubmit(values: TextBlockFormValues) {
    if (!allowRichText) return;
    if (!blockModal || blockModal.kind !== 'text') return;
    if (blockModal.flow === 'add') {
      const id = crypto.randomUUID();
      const doc = docFromSectionTitle(values.sectionTitle);
      const region: TemplateLayoutRegion = {
        id,
        type: REGION_TYPES.richText,
        props: {
          sectionTitle: values.sectionTitle,
          editorPlaceholder: values.editorPlaceholder,
          doc,
        },
      };
      if (appendToCell) {
        setRows((prev) => addRegionToCell(prev, appendToCell.rowId, appendToCell.cellId, region));
      } else if (appendToRowId) {
        setRows((prev) => addColumnToRow(prev, appendToRowId, region));
      } else {
        setRows((prev) => addRowWithRegion(prev, region));
      }
    } else {
      mergeRegionProps(blockModal.regionId, {
        sectionTitle: values.sectionTitle,
        editorPlaceholder: values.editorPlaceholder,
      });
    }
    closeBlockModal();
  }

  function handleMediaModalSubmit(values: MediaBlockFormValues) {
    if (!allowMedia) return;
    if (!blockModal || blockModal.kind !== 'media') return;
    const payload = {
      role: values.role,
      alt: values.alt,
      caption: values.caption,
      variant: 'placeholder' as const,
    };
    if (blockModal.flow === 'add') {
      const id = crypto.randomUUID();
      const region: TemplateLayoutRegion = { id, type: REGION_TYPES.media, props: payload };
      if (appendToCell) {
        setRows((prev) => addRegionToCell(prev, appendToCell.rowId, appendToCell.cellId, region));
      } else if (appendToRowId) {
        setRows((prev) => addColumnToRow(prev, appendToRowId, region));
      } else {
        setRows((prev) => addRowWithRegion(prev, region));
      }
    } else {
      mergeRegionProps(blockModal.regionId, payload);
    }
    closeBlockModal();
  }

  function handleFieldModalSubmit(values: FieldBlockFormValues) {
    if (!allowField) return;
    if (!blockModal || blockModal.kind !== 'field') return;
    const payload = {
      fieldKey: values.fieldKey,
      label: values.label,
      helpText: values.helpText,
      required: values.required,
    };
    if (blockModal.flow === 'add') {
      const id = crypto.randomUUID();
      const region: TemplateLayoutRegion = { id, type: REGION_TYPES.field, props: payload };
      if (appendToCell) {
        setRows((prev) => addRegionToCell(prev, appendToCell.rowId, appendToCell.cellId, region));
      } else if (appendToRowId) {
        setRows((prev) => addColumnToRow(prev, appendToRowId, region));
      } else {
        setRows((prev) => addRowWithRegion(prev, region));
      }
    } else {
      mergeRegionProps(blockModal.regionId, payload);
    }
    closeBlockModal();
  }

  const addRichTextRegion = useCallback(
    (target?: { rowId?: string; cellId?: string }) => {
      const region = createDefaultRichTextRegion();
      if (target?.rowId && target?.cellId) {
        setRows((prev) => addRegionToCell(prev, target.rowId!, target.cellId!, region));
        return;
      }
      if (target?.rowId) {
        setRows((prev) => addColumnToRow(prev, target.rowId!, region));
        return;
      }
      setRows((prev) => addRowWithRegion(prev, region));
    },
    [createDefaultRichTextRegion],
  );

  function onPaletteAdd() {
    if (!canAddRow) return;
    if (allowRichText && canAddBlockType(REGION_TYPES.richText)) {
      addRichTextRegion();
      return;
    }
    if (allowMedia && canAddBlockType(REGION_TYPES.media)) {
      setAppendToRowId(null);
      setAppendToCell(null);
      setBlockModal({ flow: 'add', kind: 'media' });
      return;
    }
    if (allowField && canAddBlockType(REGION_TYPES.field)) {
      setAppendToRowId(null);
      setAppendToCell(null);
      setBlockModal({ flow: 'add', kind: 'field' });
    }
  }

  function onRequestAddColumn(rowId: string) {
    if (!canAddColumnToRow(rowId)) return;
    if (!allowRichText && !allowMedia && !allowField) return;
    if (allowRichText && canAddBlockType(REGION_TYPES.richText)) {
      addRichTextRegion({ rowId });
      return;
    }
    setAppendToRowId(rowId);
    setAppendToCell(null);
    if (allowMedia && canAddBlockType(REGION_TYPES.media)) {
      setBlockModal({ flow: 'add', kind: 'media' });
    } else if (allowField && canAddBlockType(REGION_TYPES.field)) {
      setBlockModal({ flow: 'add', kind: 'field' });
    }
  }

  function onRequestAddToCell(rowId: string, cellId: string) {
    if (!allowRichText && !allowMedia && !allowField) return;
    if (
      allowRichText &&
      canAddBlockType(REGION_TYPES.richText) &&
      canAddToCellSeq(rowId, cellId, REGION_TYPES.richText)
    ) {
      addRichTextRegion({ rowId, cellId });
      return;
    }
    if (
      allowMedia &&
      canAddBlockType(REGION_TYPES.media) &&
      canAddToCellSeq(rowId, cellId, REGION_TYPES.media)
    ) {
      setAppendToRowId(null);
      setAppendToCell({ rowId, cellId });
      setBlockModal({ flow: 'add', kind: 'media' });
      return;
    }
    if (
      allowField &&
      canAddBlockType(REGION_TYPES.field) &&
      canAddToCellSeq(rowId, cellId, REGION_TYPES.field)
    ) {
      setAppendToRowId(null);
      setAppendToCell({ rowId, cellId });
      setBlockModal({ flow: 'add', kind: 'field' });
      return;
    }
  }

  const onEqualizeColumns = useCallback((rowId: string) => {
    setRows((prev) => equalizeRowColumns(prev, rowId));
  }, []);

  /** Returns true if no block type can legally be added to the given cell. */
  const isCellAddDisabled = useCallback(
    (rowId: string, cellId: string): boolean => {
      const types = [REGION_TYPES.richText, REGION_TYPES.media, REGION_TYPES.field] as const;
      for (const t of types) {
        const fieldAllowed =
          (t === REGION_TYPES.richText && allowRichText) ||
          (t === REGION_TYPES.media && allowMedia) ||
          (t === REGION_TYPES.field && allowField);
        if (fieldAllowed && canAddBlockType(t) && canAddToCellSeq(rowId, cellId, t)) return false;
      }
      return true;
    },
    [allowRichText, allowMedia, allowField, canAddBlockType, canAddToCellSeq],
  );

  const handleSaveDraft = useCallback(async () => {
    if (exceedsCharacterLimit) {
      setSaveError(
        hasMaxCharacters
          ? `This channel allows at most ${maxCharacters} characters in rich text. Shorten content before saving.`
          : 'Content exceeds the channel character limit. Shorten content before saving.',
      );
      return;
    }
    if (hasStructuralViolation) {
      setSaveError(structuralViolations.join(' '));
      return;
    }
    setSaving(true);
    setSaveError(null);
    onSavingChange?.(true);
    try {
      const updated = await templateCrudService.saveDraftLayout(templateId, layoutConfig);
      lastSyncedLayoutJsonRef.current = JSON.stringify(layoutConfig);
      setLayoutBaselineEpoch((e) => e + 1);
      onLayoutSaved(updated);
      onDraftSaved?.();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save draft layout');
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  }, [
    templateId,
    layoutConfig,
    onLayoutSaved,
    onSavingChange,
    onDraftSaved,
    exceedsCharacterLimit,
    hasMaxCharacters,
    maxCharacters,
    hasStructuralViolation,
    structuralViolations,
  ]);

  const handleActivate = useCallback(async () => {
    setActivating(true);
    setActivateError(null);
    onActivatingChange?.(true);
    try {
      const updated = await templateCrudService.activateTemplate(templateId);
      onLayoutSaved(updated);
    } catch (e) {
      setActivateError(e instanceof Error ? e.message : 'Activation failed');
    } finally {
      setActivating(false);
      onActivatingChange?.(false);
    }
  }, [templateId, onLayoutSaved, onActivatingChange]);

  // Expose imperative handles via refs for parent topbar
  const saveDraftStable = useRef(handleSaveDraft);
  const activateStable = useRef(handleActivate);
  saveDraftStable.current = handleSaveDraft;
  activateStable.current = handleActivate;

  useEffect(() => {
    if (saveRef) saveRef.current = () => saveDraftStable.current();
    if (activateRef) activateRef.current = () => activateStable.current();
  }, [saveRef, activateRef]);

  return (
    <div className={compact ? 'space-y-6' : 'space-y-8'}>
      {!compact && (
        <header className="border-b border-white/[0.08] pb-4">
          <h3 className="m-0 text-base font-semibold tracking-tight text-app-text">Layout</h3>
        </header>
      )}

      {saveError && (
        <div className="rounded-app-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {saveError}
        </div>
      )}
      {activateError && (
        <div className="rounded-app-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {activateError}
        </div>
      )}

      <div className="flex min-h-[680px] flex-1 flex-col overflow-hidden rounded-app-xl border border-white/[0.1] bg-[#0a0c12]/95 shadow-app-lift ring-1 ring-white/[0.05] [background-image:radial-gradient(rgba(147,124,248,0.06)_1px,transparent_1px),radial-gradient(rgba(45,212,191,0.04)_1px,transparent_1px)] [background-size:22px_22px,22px_22px] [background-position:0_0,11px_11px] backdrop-blur-sm">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] bg-app-bg/40 px-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-8 items-center rounded-full border border-white/[0.12] bg-black/25 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <button
                type="button"
                onClick={() => setWorkspaceTab('editor')}
                className={`h-7 rounded-full px-4 text-[13px] font-medium transition-all duration-(--duration-app-slow) ease-(--ease-app-out) ${
                  workspaceTab === 'editor'
                    ? 'bg-gradient-to-r from-app-accent to-app-accent-2 text-app-bg shadow-[0_0_20px_-6px_rgba(147,124,248,0.55)]'
                    : 'bg-transparent text-app-muted hover:text-app-text'
                }`}
              >
                Editor
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('preview')}
                className={`h-7 rounded-full px-4 text-[13px] font-medium transition-all duration-(--duration-app-slow) ease-(--ease-app-out) ${
                  workspaceTab === 'preview'
                    ? 'bg-gradient-to-r from-app-accent to-app-accent-2 text-app-bg shadow-[0_0_20px_-6px_rgba(147,124,248,0.55)]'
                    : 'bg-transparent text-app-muted hover:text-app-text'
                }`}
              >
                Preview
              </button>
            </div>
            {workspaceTab === 'preview' ? (
              <>
                <span className="h-5 w-px bg-white/[0.09]" />
                <div className="flex items-center gap-2 text-[12px] text-app-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]" />
                  Live preview
                </div>
              </>
            ) : null}
            {channelLabel ? (
              <>
                <span className="h-5 w-px bg-white/[0.09]" />
                <div className="flex items-center gap-2 text-[12px] text-app-muted">
                  Channel: {channelLabel}
                </div>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {workspaceTab === 'preview' ? (
              <>
                <div className="flex h-8 items-center rounded-full border border-white/[0.12] bg-black/25 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <button
                    type="button"
                    onClick={() => setPreviewBp('desktop')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-all duration-(--duration-app-slow) ease-(--ease-app-out) ${
                      previewBp === 'desktop'
                        ? 'bg-white text-[#0a0c12] shadow-[0_0_16px_-4px_rgba(255,255,255,0.25)]'
                        : 'bg-transparent text-app-muted hover:text-app-text'
                    }`}
                  >
                    <Monitor size={13} /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewBp('mobile')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-all duration-(--duration-app-slow) ease-(--ease-app-out) ${
                      previewBp === 'mobile'
                        ? 'bg-white text-[#0a0c12] shadow-[0_0_16px_-4px_rgba(255,255,255,0.25)]'
                        : 'bg-transparent text-app-muted hover:text-app-text'
                    }`}
                  >
                    <Smartphone size={13} /> Mobile
                  </button>
                </div>
                <span className="h-5 w-px bg-white/[0.09]" />
              </>
            ) : null}
            <button
              type="button"
              onClick={onPaletteAdd}
              disabled={
                (!allowRichText && !allowMedia && !allowField) ||
                !canAddRow ||
                !(
                  (allowRichText && canAddBlockType(REGION_TYPES.richText)) ||
                  (allowMedia && canAddBlockType(REGION_TYPES.media)) ||
                  (allowField && canAddBlockType(REGION_TYPES.field))
                )
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-app-md border border-white/[0.14] bg-white/[0.04] px-3 text-[13px] font-medium text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-(--duration-app-slow) ease-(--ease-app-out) hover:border-app-accent/35 hover:bg-app-accent/10 hover:text-app-text disabled:opacity-40"
            >
              <Plus size={14} /> Add block
            </button>
          </div>
        </div>
        <SharedRichTextToolkitBar
          toolkit={richTextToolkit}
          editor={workspaceTab === 'editor' ? activeRichToolbarEditor : null}
          activeRegionTitle={activeRichToolbarTitle}
          activeRegionId={focusedRichRegionId}
          getEditorByRegionId={(id) => richTextEditorsRef.current.get(id) ?? null}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {hasMaxCharacters ? (
            <div
              className={`border-b px-4 py-2 text-[11px] ${
                exceedsCharacterLimit
                  ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                  : 'border-white/[0.07] text-app-faint'
              }`}
            >
              Character usage: {richTextCharCount} / {maxCharacters}
              {exceedsCharacterLimit ? ' (reduce content for this channel)' : ''}
            </div>
          ) : null}
          {hasStructuralViolation ? (
            <div className="border-b border-red-400/30 bg-red-500/10 px-4 py-2 text-[11px] text-red-200">
              {structuralViolations.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          ) : null}

          {workspaceTab === 'editor' ? (
            <div className="min-w-0 flex flex-col gap-0">
              <div className="border-b border-white/[0.07] bg-black/20 px-4 py-2.5 text-[11px] leading-relaxed text-app-faint backdrop-blur-sm">
                Drag rows, resize gutters, use{' '}
                <span className="text-app-accent-2/90">+ Column</span>, and stack blocks with dashed
                +. Click inside a rich text editor to move the caret — the toolbar directly under
                the Editor / Preview tabs applies formatting to that block.
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleLayoutDragStart}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={rows.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4 px-4 pb-4">
                    {rows.length === 0 ? (
                      <div className="rounded-app-xl border border-dashed border-app-accent/35 bg-gradient-to-b from-app-accent/8 to-transparent px-4 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <p className="m-0 text-[13px] text-app-faint">
                          Empty — add a block from the bar above.
                        </p>
                      </div>
                    ) : (
                      rows.map((row) => (
                        <SortableLayoutRow
                          key={row.id}
                          row={row}
                          onResizePointerDown={handleResizePointerDown}
                          onRequestAddColumn={onRequestAddColumn}
                          onRequestAddToCell={onRequestAddToCell}
                          onEqualizeColumns={onEqualizeColumns}
                          onUpdateDoc={updateDoc}
                          onConfigure={openConfigure}
                          onRemove={removeRegion}
                          onEditorFocusRegion={handleEditorFocusRegion}
                          onEditorBlurRegion={handleEditorBlurRegion}
                          onRichTextEditorRegister={registerRichTextEditor}
                          addColumnDisabled={!canAddColumnToRow(row.id)}
                          addToCellDisabled={isCellAddDisabled}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DndContext>

              {!compact && (
                <div className="mt-4 flex flex-col gap-4 border-t border-app-border/50 px-4 pb-6 pt-6 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    disabled={saving || !canSaveDraft}
                    title={
                      exceedsCharacterLimit
                        ? 'Reduce rich text length to satisfy this channel’s limit before saving'
                        : hasStructuralViolation
                          ? 'Fix layout structure violations before saving'
                          : dirty
                            ? 'Save draft layout to the server'
                            : 'No unsaved changes'
                    }
                    onClick={handleSaveDraft}
                    className="inline-flex items-center justify-center gap-2 rounded-app-md border border-app-accent/45 bg-app-accent-muted px-4 py-2.5 text-sm font-medium hover:bg-app-accent/20 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save draft layout
                  </button>
                  <button
                    type="button"
                    disabled={activating || !canActivate}
                    onClick={handleActivate}
                    title={
                      dirty
                        ? 'Save draft changes before activating'
                        : bindingCount < 1
                          ? 'Add at least one channel binding before activating'
                          : regionCount < 1
                            ? 'Add at least one section before activating'
                            : exceedsCharacterLimit
                              ? 'Reduce content length to satisfy channel character limit'
                              : hasStructuralViolation
                                ? 'Fix layout structure violations before activating'
                                : 'Promote draft layout to active'
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-app-md border border-emerald-400/40 bg-emerald-500/12 px-4 py-2.5 text-sm font-medium text-emerald-100 hover:bg-emerald-500/18 disabled:opacity-40"
                  >
                    {activating ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    Activate template
                  </button>
                  {bindingCount < 1 ? (
                    <span className="text-xs leading-snug text-app-faint sm:max-w-56">
                      Activation needs at least one channel binding on this template.
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-auto bg-[#0a0c14] px-4 py-5">
                <div
                  className={`mx-auto overflow-hidden rounded-[12px] border border-white/[0.09] bg-[#12141e] transition-all duration-300 ease-in ${
                    previewBp === 'mobile' ? 'w-[375px]' : 'w-[640px]'
                  }`}
                >
                  <div className="flex h-8 items-center justify-between border-b border-white/[0.07] bg-white/[0.03] px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    </div>
                    <span className="text-[12px] text-app-muted">Email preview</span>
                    <span className="w-7" />
                  </div>
                  <div className="space-y-2 p-8">
                    {resolvedPreviewRows.length === 0 ? (
                      <div className="rounded-[8px] border border-white/[0.06] bg-white/[0.03] p-4 text-[14px] text-app-muted">
                        Add blocks to start previewing.
                      </div>
                    ) : (
                      resolvedPreviewRows.map((row) => (
                        <div
                          key={row.id}
                          className="grid gap-2"
                          style={{
                            gridTemplateColumns:
                              previewBp === 'mobile'
                                ? '1fr'
                                : previewRowGridTemplateColumns(row.cells),
                          }}
                        >
                          {row.cells.map((cell) => (
                            <div key={cell.id} className="space-y-2">
                              {cell.regions.map((region) => {
                                const doc = ensureRichDoc(region.props);
                                const text = extractTextFromDoc(doc);
                                return (
                                  <div
                                    key={region.id}
                                    className="rounded-[8px] border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[14px] leading-[1.6] text-white/85"
                                  >
                                    {text ? (
                                      <InlineTemplateText text={text} />
                                    ) : (
                                      <span className="text-app-faint">Empty block</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <p className="mt-3 text-center text-[11px] text-app-muted">
                  Read-only · use field values below to test variable substitution
                </p>
              </div>

              <div className="grid h-[180px] shrink-0 grid-cols-2 gap-4 border-t border-white/[0.07] bg-[#12141e] p-4">
                <div className="min-w-0">
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.06em] text-app-faint">
                    Preview channel
                  </label>
                  <div className="relative flex h-9 items-center justify-between rounded-[8px] border border-white/[0.1] bg-white/[0.05] px-3 text-[13px]">
                    <span className="inline-flex items-center gap-2 text-app-text">
                      <Mail size={13} className="text-app-muted" />
                      {selectedPreviewChannel
                        ? `${selectedPreviewChannel.channelName} (${selectedPreviewChannel.channelKey})`
                        : 'No channel'}
                    </span>
                    <ChevronDown size={14} className="text-app-muted" />
                    <select
                      value={previewBindingId}
                      onChange={(e) => setPreviewBindingId(e.target.value)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      disabled={previewChannels.length < 1}
                    >
                      {previewChannels.length < 1 ? (
                        <option value="">No channel bindings</option>
                      ) : (
                        previewChannels.map((ch) => (
                          <option key={ch.bindingId} value={ch.bindingId}>
                            {ch.channelName} ({ch.channelKey})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-[8px] border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[11px] text-app-muted">
                    <Eye size={11} />
                    Layout: {String(selectedPreviewChannel?.layoutConfig?.layout ?? 'responsive')}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-app-faint">
                      Field values
                    </label>
                    <span className="rounded-[4px] bg-white/[0.07] px-1.5 py-0.5 font-mono text-[11px] text-app-muted">
                      JSON
                    </span>
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[11px] text-app-muted">Available:</span>
                    <div className="flex flex-wrap gap-1">
                      {previewTokens.field.map((key) => (
                        <span
                          key={key}
                          className="rounded-[4px] border border-[rgba(124,111,247,0.2)] bg-[rgba(124,111,247,0.12)] px-2 py-0.5 font-mono text-[11px] text-[#9d94f5]"
                        >
                          {`{{${key}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="relative h-[90px] overflow-hidden rounded-[8px] border border-white/[0.09] bg-[#0d0f18]">
                    <pre
                      aria-hidden
                      className="pointer-events-none absolute inset-0 m-0 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[12px] leading-[1.6] text-white/30"
                      dangerouslySetInnerHTML={{ __html: previewFieldJsonHighlighted }}
                    />
                    <textarea
                      value={previewFieldJson}
                      onChange={(e) => setPreviewFieldJson(e.target.value)}
                      placeholder={'{\n  "firstName": "Praneeth"\n}'}
                      className="absolute inset-0 h-full w-full resize-none bg-transparent px-3 py-2 font-mono text-[12px] leading-[1.6] text-transparent caret-white outline-none"
                    />
                  </div>
                  {previewFieldJsonError ? (
                    <p className="mt-1 text-[11px] text-amber-200/85">{previewFieldJsonError}</p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <TextBlockModal
        open={Boolean(blockModal && blockModal.kind === 'text')}
        mode={blockModal?.flow === 'edit' ? 'edit' : 'add'}
        initial={textModalInitial}
        onClose={closeBlockModal}
        onSubmit={handleTextModalSubmit}
      />
      <MediaBlockModal
        open={Boolean(blockModal && blockModal.kind === 'media')}
        mode={blockModal?.flow === 'edit' ? 'edit' : 'add'}
        initial={mediaModalInitial}
        onClose={closeBlockModal}
        onSubmit={handleMediaModalSubmit}
      />
      <FieldBlockModal
        open={Boolean(blockModal && blockModal.kind === 'field')}
        mode={blockModal?.flow === 'edit' ? 'edit' : 'add'}
        initial={fieldModalInitial}
        onClose={closeBlockModal}
        onSubmit={handleFieldModalSubmit}
      />
    </div>
  );
}
