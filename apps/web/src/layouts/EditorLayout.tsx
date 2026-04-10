import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Save,
  Eye,
  Settings,
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
import { useEditorStore } from '../store/editorStore';
import SimilarContentWidget from '../components/content/SimilarContentWidget';

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
    editorProps: {
      attributes: {
        class: 'min-h-[400px] p-6 bg-white/[0.02] border border-white/5 rounded-xl text-[#e2e4f0] text-[15px] leading-relaxed outline-none box-border',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

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
      { icon: Image, label: 'Image (soon)', color: '#555870', onClick: () => {} },
    ],
    [editor],
  );

  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <div className="px-6 py-3 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-3.5 py-2 border-none rounded-md text-[13px] cursor-pointer ${
              showPreview ? 'bg-violet-500/15 text-violet-400' : 'bg-white/5 text-[#8b8fa8]'
            }`}
          >
            <Eye size={16} /> {showPreview ? 'Edit' : 'Preview'}
          </button>
          <span className="text-white/20">|</span>
          <span className={`text-[13px] ${saveError ? 'text-red-400' : 'text-[#555870]'}`}>
            {saveError
              ? saveError
              : lastSaved
                ? `Last saved: ${lastSaved.toLocaleTimeString()}`
                : 'Not saved yet'}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 rounded-md text-[#8b8fa8] text-[13px] cursor-pointer">
            <Settings size={16} /> Settings
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2 border-none rounded-md text-white text-[13px] font-semibold transition-all duration-200 ${
              saving
                ? 'bg-violet-500/40 cursor-not-allowed opacity-70'
                : lastSaved
                  ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 cursor-pointer'
                  : 'bg-gradient-to-br from-violet-500 to-cyan-500 cursor-pointer'
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

      <div className="flex flex-1 overflow-hidden">
        {/* Insert Panel */}
        <div className="w-[200px] bg-white/[0.02] border-r border-white/5 p-4 overflow-y-auto">
          <h3 className="text-[11px] font-semibold text-[#555870] uppercase mb-3">
            Insert Blocks
          </h3>
          <div className="flex flex-col gap-1">
            {insertBlocks.map((block) => (
              <button
                key={block.label}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-white/[0.03] border border-white/5 rounded-md text-[#8b8fa8] text-xs cursor-pointer text-left hover:text-[var(--block-color)] transition-colors"
                style={{ '--block-color': block.color } as React.CSSProperties}
                onClick={() => block.onClick()}
              >
                <block.icon size={16} />
                {block.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title..."
            className="px-6 py-4 bg-transparent border-none border-b border-white/5 text-[#e2e4f0] text-2xl font-bold outline-none box-border"
          />

          <div className="px-6 pb-3 pt-1">
            <SimilarContentWidget title={title} bodyHtml={content} contentId={similarCheckContentId} />
          </div>

          {/* Editor/Preview Area */}
          <div className="flex-1 overflow-auto p-6">
            {showPreview ? (
              <div className="bg-white/[0.02] rounded-xl p-8 min-h-full box-border">
                <h1 className="text-[28px] font-bold text-[#e2e4f0] mb-4">
                  {title || 'Untitled'}
                </h1>
                <div
                  className="tiptap-content text-[15px] text-[#8b8fa8] leading-relaxed"
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
        </div>

        {/* Properties Panel */}
        <div className="w-[280px] bg-white/[0.02] border-l border-white/5 p-5 overflow-y-auto">
          <h3 className="text-[11px] font-semibold text-[#555870] uppercase mb-4">
            Properties
          </h3>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-[#8b8fa8] mb-1.5 block">
                Content Type
              </label>
              <select className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-md text-[#e2e4f0] text-[13px] outline-none box-border">
                <option>Article</option>
                <option>Guide</option>
                <option>Documentation</option>
                <option>Blog Post</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#8b8fa8] mb-1.5 block">
                Tags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['tutorial', 'guide', '2025'].map(tag => (
                  <span key={tag} className="px-2.5 py-1 bg-violet-500/15 rounded-xl text-[11px] text-violet-400 flex items-center gap-1">
                    {tag}
                    <button className="bg-transparent border-none text-violet-400 cursor-pointer p-0 flex">×</button>
                  </span>
                ))}
                <button className="px-2.5 py-1 bg-white/5 border border-dashed border-white/20 rounded-xl text-[11px] text-[#555870] cursor-pointer">+ Add</button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#8b8fa8] mb-1.5 block">
                Visibility
              </label>
              <select className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-md text-[#e2e4f0] text-[13px] outline-none box-border">
                <option>Public</option>
                <option>Team Only</option>
                <option>Private</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#8b8fa8] mb-1.5 block">
                Featured Image
              </label>
              <div className="h-[120px] bg-white/[0.03] border border-dashed border-white/20 rounded-md flex items-center justify-center text-[#555870] text-xs cursor-pointer">
                Click to upload
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
