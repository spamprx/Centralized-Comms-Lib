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
  Image as ImageIcon,
  Puzzle,
  ChevronRight,
  LayoutTemplate,
  Users,
  Languages,
} from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import type { JSONContent } from '@tiptap/core';
import { contentService, ContentSaveConflictError } from '../services/contentService';
import { componentService } from '../services/componentService';
import { tagService, type Tag } from '../services/tagService';
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
import TranslatePlainTextModal from '../components/common/TranslatePlainTextModal';
import {
  upsertBibliographySection,
  type CitationMarkerMode,
} from '../lib/citationMarkers';
import { CitationMarker, citationMarkLabel } from '../tiptap/CitationMarker';
import { ComponentReference } from '../tiptap/ComponentReference';
import { layoutConfigToTipTapDoc, templateLayoutDocExtensions } from '../tiptap/templateLayoutDoc';
import { parseTemplateLayout } from '../lib/templateLayout/layoutConfig';
import {
  templateCrudService,
  type ChannelRecord,
  type TemplateRecord,
} from '../services/templateCrudService';

type CitationItem = {
  marker: number;
  style: CitationStyle;
  text: string;
  title: string;
  sourceId: string;
  work: CitationWork;
};

function orderedUniqueCitationMarkersFromTipTapDoc(doc: unknown): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    const marks = Array.isArray(node.marks) ? node.marks : [];
    for (const m of marks) {
      if (!m || typeof m !== 'object') continue;
      if (m.type === 'citationMarker') {
        const marker = m.attrs?.marker;
        if (typeof marker === 'number' && Number.isFinite(marker) && !seen.has(marker)) {
          seen.add(marker);
          out.push(marker);
        }
      }
    }
    const content = Array.isArray(node.content) ? node.content : [];
    for (const child of content) visit(child);
  };
  visit(doc as any);
  return out;
}

function renumberCitationsInEditor(ed: any, orderedMarkers: number[]): boolean {
  if (!ed) return false;
  if (orderedMarkers.length === 0) return false;
  const map = new Map<number, number>();
  orderedMarkers.forEach((old, idx) => map.set(old, idx + 1));
  // If already 1..N in the same order, skip.
  const alreadySequential = orderedMarkers.every((m, idx) => m === idx + 1);
  if (alreadySequential) return false;

  const { state } = ed;
  const { schema } = state;
  const citationMarkType = schema.marks?.citationMarker;
  if (!citationMarkType) return false;

  let tr = state.tr;
  let changed = false;

  // Walk text nodes; if they carry citationMarker, update both the mark attrs + label text.
  state.doc.descendants((node: any, pos: number) => {
    if (!node || !node.isText) return true;
    const marks = Array.isArray(node.marks) ? node.marks : [];
    const cm = marks.find((m: any) => m?.type?.name === 'citationMarker');
    if (!cm) return true;
    const oldMarker = cm.attrs?.marker;
    const newMarker = typeof oldMarker === 'number' ? map.get(oldMarker) : undefined;
    if (typeof newMarker !== 'number') return true;

    const mode = (cm.attrs?.mode as CitationMarkerMode | undefined) ?? 'chip';
    const desiredText = citationMarkLabel(newMarker, mode);

    const needsTextUpdate = node.text !== desiredText;
    const needsAttrUpdate = oldMarker !== newMarker;
    if (!needsTextUpdate && !needsAttrUpdate) return true;

    const nextMarks = marks.map((m: any) => {
      if (m?.type?.name !== 'citationMarker') return m;
      return citationMarkType.create({ ...m.attrs, marker: newMarker });
    });
    tr = tr.replaceWith(pos, pos + node.nodeSize, schema.text(desiredText, nextMarks));
    changed = true;
    return true;
  });

  if (!changed) return false;
  ed.view.dispatch(tr);
  return true;
}

/** Inline image uploads above this size are rejected (base64 would bloat the HTML). */
const EDITOR_INLINE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

type EditorToolkitFlags = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  heading1: boolean;
  heading2: boolean;
  bulletList: boolean;
  orderedList: boolean;
  link: boolean;
  insertImage: boolean;
};

/**
 * Count real media items in the editor HTML:
 * - <img …> tags (file-picker inline images)
 * - <TOKEN> angle-bracket placeholders that resolve to media at send-time
 *   (e.g. <avatarImage>, <heroImage>) — distinguished from standard HTML tags.
 */
function countMediaItems(html: string): number {
  const htmlTags = new Set([
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'a',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'span',
    'div',
    'table',
    'thead',
    'tbody',
    'tr',
    'td',
    'th',
    'hr',
    'img',
    'figure',
    'figcaption',
    'mark',
    'sub',
    'sup',
  ]);
  let count = (html.match(/<img\b/gi) ?? []).length;
  // TipTap encodes `<` and `>` in text nodes, so typed tokens appear as `&lt;token&gt;` in HTML.
  const tokenRes: RegExp[] = [/<([a-zA-Z_][a-zA-Z0-9_]*)>/g, /&lt;([a-zA-Z_][a-zA-Z0-9_]*)&gt;/g];
  for (const re of tokenRes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      if (!htmlTags.has(m[1].toLowerCase())) count++;
    }
  }
  return count;
}

function stripHtmlToText(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\u200B/g, '') // zero-width space
    .trim();
}

function firstMediaMarkerIndex(html: string): number | null {
  const htmlTags = new Set([
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'a',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'span',
    'div',
    'table',
    'thead',
    'tbody',
    'tr',
    'td',
    'th',
    'hr',
    'img',
    'figure',
    'figcaption',
    'mark',
    'sub',
    'sup',
  ]);
  let best: number | null = null;

  const imgRe = /<img\b/gi;
  const imgMatch = imgRe.exec(html);
  if (imgMatch?.index != null) best = imgMatch.index;

  const tokenRes: RegExp[] = [/<([a-zA-Z_][a-zA-Z0-9_]*)>/g, /&lt;([a-zA-Z_][a-zA-Z0-9_]*)&gt;/g];
  for (const re of tokenRes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const name = m[1]?.toLowerCase?.() ?? '';
      if (!name || htmlTags.has(name)) continue;
      if (best == null || m.index < best) best = m.index;
      break; // earliest for this regex
    }
  }

  return best;
}

function computeToolkitForChannel(channel: ChannelRecord | null): EditorToolkitFlags {
  const restrictions = channel?.compatibility?.restrictions ?? undefined;
  const model = restrictions?.contentModel;
  const underlineOk = restrictions?.supportsUnderline !== false;
  const disallowInlineMedia = restrictions?.disallowInlineImagesInRichText === true;

  // Default: full toolkit.
  let base: EditorToolkitFlags = {
    bold: true,
    italic: true,
    underline: underlineOk,
    heading1: true,
    heading2: true,
    bulletList: true,
    orderedList: true,
    link: true,
    insertImage: true,
  };

  if (model === 'sms') {
    // SMS: plain text + links only, no inline images (template tokens are text, allowed).
    base = {
      bold: false,
      italic: false,
      underline: false,
      heading1: false,
      heading2: false,
      bulletList: false,
      orderedList: false,
      link: true,
      insertImage: false,
    };
  } else if (model === 'push') {
    // Push: no inline images; rich formatting ok for body text.
    base.underline = underlineOk;
    base.insertImage = false;
  } else if (model === 'whatsapp') {
    // WhatsApp: insertImage allowed but max 1 total media (image or token).
    base.underline = underlineOk;
    base.insertImage = true;
  } else {
    base.underline = underlineOk;
  }

  if (disallowInlineMedia) base.insertImage = false;
  return base;
}

function validateHtmlAgainstChannel(
  html: string,
  textLen: number,
  channel: ChannelRecord,
): string | null {
  const r = channel.compatibility?.restrictions ?? undefined;
  const model = r?.contentModel;

  // Character limit (all channel models).
  const maxChars =
    typeof r?.maxCharacters === 'number' && Number.isFinite(r.maxCharacters)
      ? r.maxCharacters
      : null;
  if (maxChars && textLen > maxChars) {
    return `This channel allows at most ${maxChars} characters. Shorten the content before saving.`;
  }

  const hasImg = /<img\b/i.test(html) || /data:image\//i.test(html);

  // Generic flag set by admin.
  if (r?.disallowInlineImagesInRichText === true && hasImg) {
    return 'This channel does not allow inline images inside rich text.';
  }

  if (model === 'whatsapp') {
    // WhatsApp: max 1 media item (inline image OR media token placeholder).
    const mediaCount = countMediaItems(html);
    if (mediaCount > 1) {
      return `WhatsApp messages can contain at most 1 media item. You have ${mediaCount}. Remove the extra images or media tokens.`;
    }
    // WhatsApp ordering: if media is present, it must come first (caption after).
    if (mediaCount === 1) {
      const idx = firstMediaMarkerIndex(html);
      if (idx != null && idx > 0) {
        const prefixText = stripHtmlToText(html.slice(0, idx));
        if (prefixText.length > 0) {
          return 'WhatsApp messages must be either: media only, media + caption, or text only. If media is present, it must come first (no text before media).';
        }
      }
    }
  }

  if (model === 'push') {
    // Push: no inline images in the body (use the media field in the layout instead).
    if (hasImg)
      return 'Push notifications do not support inline images. Use a media block in the template layout instead.';
  }

  if (model === 'sms') {
    // SMS: plain text + links only; no rich formatting, no inline images.
    // Template tokens like <avatarImage> are text placeholders — they are allowed.
    const forbidden = [
      { re: /<(strong|b)\b/i, msg: 'SMS channel does not allow bold text.' },
      { re: /<(em|i)\b/i, msg: 'SMS channel does not allow italic text.' },
      { re: /<u\b/i, msg: 'SMS channel does not allow underline.' },
      { re: /<h[1-6]\b/i, msg: 'SMS channel does not allow headings.' },
      { re: /<(ul|ol|li)\b/i, msg: 'SMS channel does not allow lists.' },
    ];
    for (const f of forbidden) {
      if (f.re.test(html)) return f.msg;
    }
    if (hasImg) return 'SMS channel does not allow inline images. Use a URL link instead.';
  }

  if (
    typeof r?.maxInlineImagesInRichText === 'number' &&
    Number.isFinite(r.maxInlineImagesInRichText)
  ) {
    const max = r.maxInlineImagesInRichText;
    const n = (html.match(/<img\b/gi) ?? []).length;
    if (n > max) return `This channel allows at most ${max} inline image(s) in rich text.`;
  }

  return null;
}

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
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translateSource, setTranslateSource] = useState<{ text: string; modeLabel: string } | null>(
    null,
  );
  const [showCitationDialog, setShowCitationDialog] = useState(false);
  const [citationDialogMountKey, setCitationDialogMountKey] = useState(0);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA');
  const [citationMarkerMode, setCitationMarkerMode] = useState<CitationMarkerMode>('chip');
  const [referenceNotice, setReferenceNotice] = useState<string | null>(null);
  const [citationItems, setCitationItems] = useState<CitationItem[]>([]);
  const citationItemsRef = useRef(citationItems);
  citationItemsRef.current = citationItems;
  const citationNormalizeInFlightRef = useRef(false);
  const [rightPanelTab, setRightPanelTab] = useState<'library' | 'properties' | 'similar' | 'refs'>(
    'library',
  );
  const [libraryCatalogSource, setLibraryCatalogSource] = useState<'loading' | 'api' | 'demo'>(
    'loading',
  );
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
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
  /** Template id to persist on next save (both new and existing content). */
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  /** Channel id to persist on next save alongside pendingTemplateId. */
  const [pendingChannelId, setPendingChannelId] = useState<string | null>(null);
  const [templateChannel, setTemplateChannel] = useState<ChannelRecord | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [imagePickMessage, setImagePickMessage] = useState<string | null>(null);
  const [contentType, setContentType] = useState<'ARTICLE' | 'VIDEO' | 'PODCAST' | 'DOCUMENT'>(
    'ARTICLE',
  );
  const [tags, setTags] = useState<Tag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagQuery, setTagQuery] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [tagBusy, setTagBusy] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
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

  const filteredTagSuggestions = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    const unused = availableTags.filter((t) => !tags.some((x) => x.id === t.id));
    if (!q) return unused.slice(0, 10);
    return unused
      .filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q))
      .slice(0, 10);
  }, [availableTags, tagQuery, tags]);

  const handleAddTag = useCallback(
    async (name: string) => {
      const contentIdForTags = persistedContentId;
      const trimmed = name.trim();
      if (!trimmed) return;
      setTagError(null);
      if (!contentIdForTags) {
        setTagError('Save this draft once before adding tags.');
        return;
      }
      if (tagBusy) return;
      setTagBusy(true);
      try {
        const existing = availableTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
        const tag = existing ?? (await tagService.create({ name: trimmed }));
        if (!existing) setAvailableTags((prev) => [...prev, tag]);
        await contentService.assignTag(contentIdForTags, tag.id);
        setTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
        setTagQuery('');
        setShowTagSuggestions(false);
      } catch (e) {
        setTagError(e instanceof Error ? e.message : 'Failed to add tag');
      } finally {
        setTagBusy(false);
      }
    },
    [availableTags, persistedContentId, tagBusy],
  );

  const handleRemoveTag = useCallback(
    async (tagId: string) => {
      const contentIdForTags = persistedContentId;
      setTagError(null);
      if (!contentIdForTags) return;
      if (tagBusy) return;
      setTagBusy(true);
      try {
        await contentService.removeTag(contentIdForTags, tagId);
        setTags((prev) => prev.filter((t) => t.id !== tagId));
      } catch (e) {
        setTagError(e instanceof Error ? e.message : 'Failed to remove tag');
      } finally {
        setTagBusy(false);
      }
    },
    [persistedContentId, tagBusy],
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
          const users = Array.isArray(m.users) ? (m.users as unknown[]) : [];
          const normalized = users
            .map((u) => {
              const p = u && typeof u === 'object' ? (u as Record<string, unknown>) : {};
              return {
                userId: String(p.userId ?? ''),
                displayName: String(p.displayName ?? ''),
                email: String(p.email ?? ''),
                lastSeenAt: '',
              };
            })
            .filter((p) => p.userId && p.userId !== user.id);
          setPresenceStatus({ kind: 'ok' });
          setEditorPresenceOthers(normalized);
        }
        if (m.type === 'presence:restore_requested' && m.contentId === persistedContentId) {
          const by =
            m.requestedBy && typeof m.requestedBy === 'object'
              ? (m.requestedBy as Record<string, unknown>)
              : null;
          const name =
            by && typeof by.displayName === 'string' ? by.displayName : 'The author';
          setRestoreNotice(
            `${name} requested a version restore. Please finish up and leave the editor.`,
          );
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await tagService.list();
        if (!cancelled) setAvailableTags(all);
      } catch {
        if (!cancelled) setAvailableTags([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        Image.configure({
          inline: true,
          allowBase64: true,
          HTMLAttributes: { class: 'max-w-full rounded-lg border border-white/[0.08]' },
        }),
        Placeholder.configure({
          placeholder: ({ editor: ed }) => (ed.isEmpty ? 'Press / to insert a block' : ''),
        }),
      ],
      content,
      onUpdate: ({ editor: ed }) => {
        if (citationNormalizeInFlightRef.current) return;
        const docJson = ed.getJSON();
        const html = ed.getHTML();

        // Determine the citation sequence BEFORE any renumbering so we never reattach
        // reference text to a different citation.
        const orderedMarkers = orderedUniqueCitationMarkersFromTipTapDoc(docJson);
        const used = new Set(orderedMarkers);
        const renumberMap = new Map<number, number>();
        orderedMarkers.forEach((m, idx) => renumberMap.set(m, idx + 1));
        const needsRenumber = orderedMarkers.some((m, idx) => m !== idx + 1);

        // Sync sidebar + References block to the actual citations present.
        // Important: only update marker numbers; never change `text/work/sourceId`.
        setCitationItems((prev) => {
          if (prev.length === 0) return prev;
          const kept = prev.filter((c) => used.has(c.marker));
          const next = needsRenumber
            ? kept
                .map((c) => ({
                  ...c,
                  marker: renumberMap.get(c.marker) ?? c.marker,
                }))
                .sort((a, b) => a.marker - b.marker)
            : kept.sort((a, b) => a.marker - b.marker);

          const changedLen = next.length !== prev.length;
          const changedMarkers = next.some((c, i) => prev[i]?.marker !== c.marker);
          if (!changedLen && !changedMarkers) return prev;

          // Update the References block to match the new sequence.
          // (We also update `content` so dirty-check + save snapshot reflect the bibliography.)
          setContent(upsertBibliographySection(html, next));
          return next;
        });

        // Finally, renumber the inline markers in the document (if needed).
        if (needsRenumber && orderedMarkers.length > 0) {
          citationNormalizeInFlightRef.current = true;
          try {
            const changed = renumberCitationsInEditor(ed, orderedMarkers);
            if (changed) return; // a new update will fire with the normalized content
          } finally {
            citationNormalizeInFlightRef.current = false;
          }
        }

        setContent(html);
      },
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

  const openContentTranslate = useCallback(() => {
    if (!editor) return;
    if (mainTab === 'preview') {
      setTranslateSource({
        text: editor.getText(),
        modeLabel: 'Full document (plain text) — Preview tab',
      });
      setTranslateOpen(true);
      return;
    }
    const { from, to } = editor.state.selection;
    const sel = editor.state.doc.textBetween(from, to, ' ').trim();
    if (sel) {
      setTranslateSource({ text: sel, modeLabel: 'Selected text in the editor' });
    } else {
      setTranslateSource({
        text: editor.getText(),
        modeLabel: 'Full document (plain text) — no text selected',
      });
    }
    setTranslateOpen(true);
  }, [editor, mainTab]);

  // When opening an existing content item (`/editor/:contentId`), hydrate the editor from the latest saved body.
  // Without this, the editor starts blank and a "Save Draft" would create a new content item, making it look
  // like history was lost after a restore.
  useEffect(() => {
    const id = routeContentId && routeContentId !== 'new' ? routeContentId : null;
    if (!id) {
      // Reset channel when starting a new (unsaved) draft.
      setTemplateChannel(null);
      setPendingTemplateId(null);
      setPendingChannelId(null);
      return;
    }
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
        setTags((details.tags as Tag[]) ?? []);
        editor.commands.setContent(doc as JSONContent);
        const html = editor.getHTML();
        setContent(html);
        setSavedSnapshot({ title: nextTitle.trim(), content: html });
        setLastSaved(new Date());

        // Channel is now stored directly on the content row (channelId FK).
        // GET /content/:id returns it as `channel` with no extra join.
        if (cancelled) return;
        setTemplateChannel((details.channel as unknown as ChannelRecord) ?? null);

        // Clear pending ids — channel is now persisted in DB, no need to re-send.
        setPendingTemplateId(null);
        setPendingChannelId(null);
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
      // Resync channel validation state from the freshly-fetched row.
      setTemplateChannel((details.channel as unknown as ChannelRecord) ?? null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to convert to draft');
    } finally {
      setSaving(false);
    }
  }, [persistedContentId]);

  useEffect(() => {
    if (!editor) return;
    const updateCount = () => {
      const textTrim = editor.getText().trim();
      setWordCount(textTrim ? textTrim.split(/\s+/).filter(Boolean).length : 0);
      setCharCount(editor.getText().length);
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
    if (editor && templateChannel) {
      const msg = validateHtmlAgainstChannel(
        editor.getHTML(),
        editor.getText().length,
        templateChannel,
      );
      if (msg) {
        setSaveError(msg);
        return;
      }
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
          channelId: pendingChannelId ?? undefined,
          contentType,
        });
        setContentId(result.content.id);
        setPendingTemplateId(null);
        setPendingChannelId(null);
        headVersionRef.current = result.version?.versionNumber ?? 1;
      } else {
        const saved = await contentService.saveDraft(contentId, {
          title: title.trim(),
          body: bodyDoc,
          contentType,
          baseVersionNumber: headVersionRef.current,
          ...(pendingTemplateId ? { templateId: pendingTemplateId } : {}),
          ...(pendingChannelId ? { channelId: pendingChannelId } : {}),
        });
        headVersionRef.current = saved.versionNumber;
        if (pendingTemplateId) setPendingTemplateId(null);
        if (pendingChannelId) setPendingChannelId(null);
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
  }, [
    title,
    content,
    contentId,
    clearDraft,
    editor,
    pendingTemplateId,
    pendingChannelId,
    contentType,
    templateChannel,
  ]);

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
      void (async () => {
        let full: TemplateRecord = record;
        try {
          full = await templateCrudService.getById(record.id);
        } catch {
          /* fall back to list row */
        }

        const parsed =
          parseTemplateLayout(full.activeLayout) ?? parseTemplateLayout(full.draftLayout);
        const doc = parsed
          ? layoutConfigToTipTapDoc(parsed)
          : { type: 'doc', content: [{ type: 'paragraph' }] };
        editor.chain().focus().setContent(doc).run();
        const html = editor.getHTML();
        setContent(html);
        setTitle(full.name.trim() || 'Untitled');

        const channelId = full.bindings?.[0]?.channelId ?? '';
        if (channelId) {
          try {
            const ch = await templateCrudService.getChannelById(channelId);
            setTemplateChannel(ch);
            setPendingChannelId(channelId);
          } catch {
            setTemplateChannel(null);
            setPendingChannelId(null);
          }
        } else {
          setTemplateChannel(null);
          setPendingChannelId(null);
        }

        // Always record the template id so saveDraft can persist/update it in the DB,
        // ensuring channel restrictions survive across page refreshes for both new and existing content.
        const isNewContent = !persistedContentId;
        setPendingTemplateId(full.id);
        setSavedSnapshot(null);
        setMainTab('edit');
        if (!isNewContent) {
          setComponentNotice('Body replaced from template. Save draft to persist.');
          window.setTimeout(() => setComponentNotice(null), 4000);
        } else {
          setComponentNotice(null);
        }
      })();
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

  const channelMaxCharacters = useMemo(() => {
    const r = templateChannel?.compatibility?.restrictions ?? undefined;
    return typeof r?.maxCharacters === 'number' && Number.isFinite(r.maxCharacters)
      ? r.maxCharacters
      : null;
  }, [templateChannel]);

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
    const nextHtml = upsertBibliographySection(html, citationItemsRef.current);
    if (nextHtml !== html) {
      editor.chain().focus().setContent(nextHtml).run();
      setContent(nextHtml);
    }
    setReferenceNotice('References updated at the end of the document.');
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

  const toolkit = useMemo(() => computeToolkitForChannel(templateChannel), [templateChannel]);

  const insertImageFromSrc = useCallback(
    (src: string) => {
      if (!editor || !src.trim()) return;
      setImagePickMessage(null);
      editor.chain().focus().setImage({ src: src.trim(), alt: 'Uploaded image' }).run();
    },
    [editor],
  );

  const onImageFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setImagePickMessage('Please choose an image file.');
        window.setTimeout(() => setImagePickMessage(null), 3200);
        return;
      }
      if (file.size > EDITOR_INLINE_IMAGE_MAX_BYTES) {
        setImagePickMessage(
          `Image is too large (max ${Math.round(EDITOR_INLINE_IMAGE_MAX_BYTES / (1024 * 1024))} MB).`,
        );
        window.setTimeout(() => setImagePickMessage(null), 4200);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result;
        if (typeof r === 'string') insertImageFromSrc(r);
      };
      reader.onerror = () => {
        setImagePickMessage('Could not read that file.');
        window.setTimeout(() => setImagePickMessage(null), 4200);
      };
      reader.readAsDataURL(file);
    },
    [insertImageFromSrc],
  );

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
          <button
            type="button"
            onClick={openContentTranslate}
            disabled={!editor}
            title="Translate selected text or the full document as plain text (not saved)"
            className="flex items-center gap-1.5 rounded-[var(--editor-radius-input)] border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-[13px] font-semibold text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Languages size={16} strokeWidth={2} />
            <span className="hidden sm:inline">Translate</span>
          </button>
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

      {saveError ? (
        <div
          className="relative z-20 flex shrink-0 items-start justify-between gap-3 border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-100"
          role="alert"
        >
          <div className="min-w-0">
            <div className="font-semibold text-rose-100">Fix before saving</div>
            <div className="mt-0.5 break-words text-rose-100/90">{saveError}</div>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="shrink-0 rounded-lg border border-rose-400/40 bg-rose-500/10 px-2.5 py-1 text-[12px] font-semibold text-rose-50 hover:bg-rose-500/20"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {mainTab === 'edit' && (
        <div className="relative z-10 flex h-9 shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-[var(--editor-topbar-bg)] px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl">
          <div className="flex min-w-0 flex-wrap items-center gap-0.5">
            {toolkit.bold ? (
              <button
                type="button"
                disabled={!editor || isPublished}
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={fmtBtn(!!editor?.isActive('bold'))}
                title="Bold"
              >
                <Bold size={16} strokeWidth={2.25} />
              </button>
            ) : null}
            {toolkit.italic ? (
              <button
                type="button"
                disabled={!editor || isPublished}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={fmtBtn(!!editor?.isActive('italic'))}
                title="Italic"
              >
                <Italic size={16} strokeWidth={2.25} />
              </button>
            ) : null}
            {toolkit.underline ? (
              <button
                type="button"
                disabled={!editor || isPublished}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                className={fmtBtn(!!editor?.isActive('underline'))}
                title="Underline"
              >
                <UnderlineIcon size={16} strokeWidth={2.25} />
              </button>
            ) : null}
            <span className="mx-1 h-4 w-px shrink-0 bg-[var(--editor-border)]" aria-hidden />
            {toolkit.heading1 ? (
              <button
                type="button"
                disabled={!editor || isPublished}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                className={fmtBtn(!!editor?.isActive('heading', { level: 1 }))}
                title="Heading 1"
              >
                <Heading1 size={16} strokeWidth={2.25} />
              </button>
            ) : null}
            {toolkit.heading2 ? (
              <button
                type="button"
                disabled={!editor || isPublished}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                className={fmtBtn(!!editor?.isActive('heading', { level: 2 }))}
                title="Heading 2"
              >
                <Heading2 size={16} strokeWidth={2.25} />
              </button>
            ) : null}
            {toolkit.bulletList ? (
              <button
                type="button"
                disabled={!editor || isPublished}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className={fmtBtn(!!editor?.isActive('bulletList'))}
                title="Bullet list"
              >
                <List size={16} strokeWidth={2.25} />
              </button>
            ) : null}
            {toolkit.orderedList ? (
              <button
                type="button"
                disabled={!editor || isPublished}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                className={fmtBtn(!!editor?.isActive('orderedList'))}
                title="Numbered list"
              >
                <ListOrdered size={16} strokeWidth={2.25} />
              </button>
            ) : null}
            {toolkit.link ? (
              <button
                type="button"
                disabled={!editor || isPublished}
                onClick={setLink}
                className={fmtBtn(!!editor?.isActive('link'))}
                title="Link"
              >
                <LinkIcon size={16} strokeWidth={2.25} />
              </button>
            ) : null}
            {toolkit.insertImage ? (
              <button
                type="button"
                disabled={!editor || isPublished}
                onClick={() => {
                  setImagePickMessage(null);
                  imageFileInputRef.current?.click();
                }}
                className={fmtBtn(false)}
                title={imagePickMessage ? `Insert image · ${imagePickMessage}` : 'Insert image'}
              >
                <ImageIcon size={16} strokeWidth={2.25} />
              </button>
            ) : null}
            <button
              type="button"
              disabled={!editor || isPublished}
              onClick={openCitationDialog}
              className={fmtBtn(false)}
              title="Citation"
            >
              <BookMarked size={16} strokeWidth={2.25} />
            </button>
            <input
              ref={imageFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onImageFileChange}
            />
          </div>
          <span className="shrink-0 tabular-nums text-[13px] text-[var(--editor-faint)]">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
            {channelMaxCharacters ? (
              <span
                className={
                  charCount > channelMaxCharacters ? 'text-rose-300' : 'text-[var(--editor-faint)]'
                }
              >
                {' '}
                · {charCount}/{channelMaxCharacters} chars
              </span>
            ) : null}
          </span>
        </div>
      )}

      {/* Channel-model restriction banner */}
      {templateChannel && templateChannel.compatibility?.restrictions?.contentModel
        ? (() => {
            const cm = templateChannel.compatibility.restrictions.contentModel;
            const maxCh = templateChannel.compatibility.restrictions.maxCharacters;
            if (cm === 'sms')
              return (
                <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-sky-400/20 bg-sky-500/[0.07] px-3 py-2 text-[12px] text-sky-200/80">
                  <span className="mt-0.5 shrink-0 text-sky-400">ℹ</span>
                  <span>
                    <strong className="font-semibold text-sky-300">SMS</strong> — plain text and
                    links only. No rich formatting or inline images.
                    {maxCh ? (
                      <>
                        {' '}
                        Max <strong>{maxCh}</strong> characters.
                      </>
                    ) : null}
                  </span>
                </div>
              );
            if (cm === 'push')
              return (
                <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-violet-400/20 bg-violet-500/[0.07] px-3 py-2 text-[12px] text-violet-200/80">
                  <span className="mt-0.5 shrink-0 text-violet-400">ℹ</span>
                  <span>
                    <strong className="font-semibold text-violet-300">Push notification</strong> —
                    this field is the <strong>body</strong> text. No inline images allowed; media
                    must be added via a media block in the template layout.
                  </span>
                </div>
              );
            return null;
          })()
        : null}

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
                  {presenceStatus.status ? ` (HTTP ${presenceStatus.status})` : ''}. If this keeps
                  happening, the websocket route may not be deployed or you may not have access.
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
                  {tagError ? (
                    <div className="mb-2 rounded-[var(--editor-radius-input)] border-[0.5px] border-red-400/35 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200">
                      {tagError}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-1">
                    {tags.length === 0 ? (
                      <span className="text-[11px] text-[var(--editor-faint)]">No tags</span>
                    ) : (
                      tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="flex items-center gap-1 rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-2 py-0.5 text-[11px] text-[var(--editor-muted)]"
                        >
                          {tag.name}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag.id)}
                            disabled={tagBusy || !persistedContentId}
                            className="cursor-pointer text-[var(--editor-faint)] disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Remove tag ${tag.name}`}
                            title="Remove tag"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="relative mt-2">
                    <input
                      value={tagQuery}
                      onChange={(e) => setTagQuery(e.target.value)}
                      onFocus={() => setShowTagSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleAddTag(tagQuery);
                        }
                      }}
                      disabled={tagBusy}
                      placeholder={
                        persistedContentId ? 'Type to search/create tags…' : 'Save once to add tags…'
                      }
                      className="box-border w-full rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-2.5 py-2 text-[12px] text-[var(--editor-doc-text)] outline-none placeholder:text-[var(--editor-faint)]"
                    />
                    {showTagSuggestions && persistedContentId ? (
                      <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-panel-bg)] p-1 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                        {filteredTagSuggestions.length > 0 ? (
                          filteredTagSuggestions.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => void handleAddTag(t.name)}
                              disabled={tagBusy}
                              className="flex w-full items-center justify-between rounded-[10px] px-2.5 py-2 text-left text-[12px] text-[var(--editor-doc-text)] hover:bg-white/[0.06] disabled:opacity-50"
                            >
                              <span>{t.name}</span>
                              <span className="text-[10px] text-[var(--editor-faint)]">{t.slug}</span>
                            </button>
                          ))
                        ) : tagQuery.trim() ? (
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => void handleAddTag(tagQuery)}
                            disabled={tagBusy}
                            className="w-full rounded-[10px] px-2.5 py-2 text-left text-[12px] text-[var(--editor-doc-text)] hover:bg-white/[0.06] disabled:opacity-50"
                          >
                            Create “{tagQuery.trim()}”
                          </button>
                        ) : (
                          <div className="px-2.5 py-2 text-[11px] text-[var(--editor-faint)]">
                            No available tags
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div>
                  {/* Visibility control moved to My Content for better UX. */}
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
      <TranslatePlainTextModal
        open={translateOpen}
        onClose={() => {
          setTranslateOpen(false);
          setTranslateSource(null);
        }}
        subjectLabel={title.trim() || 'Untitled'}
        contextHint="Content editor · top bar"
        sourceModeLabel={translateSource?.modeLabel ?? ''}
        sourceText={translateSource?.text ?? ''}
        cautionText="This translation runs in your browser only. It does not change your draft until you paste the text into the editor and save. Only plain text is translated — layout, images, media tokens, and citations are not preserved in the translation request."
      />
    </div>
  );
}
