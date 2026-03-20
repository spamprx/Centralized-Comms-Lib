import { useCallback, useEffect, useMemo, useState } from 'react';
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

export default function EditorLayout() {
  const [title, setTitle] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('editor-title') || '';
    }
    return '';
  });
  const [content, setContent] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('editor-content') || '<p></p>';
    }
    return '<p></p>';
  });
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
      // Clear localStorage after successful save
      localStorage.removeItem('editor-title');
      localStorage.removeItem('editor-content');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  }, [title, content, contentId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('editor-title', title);
    }
  }, [title]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('editor-content', content);
    }
  }, [content]);


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
        style: [
          'min-height:400px',
          'padding:24px',
          'background:rgba(255,255,255,0.02)',
          'border:1px solid rgba(255,255,255,0.05)',
          'border-radius:12px',
          'color:#e2e4f0',
          'font-size:15px',
          'line-height:1.8',
          'outline:none',
          'box-sizing:border-box',
        ].join(';'),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== content) {
      // `setContent` expects an options object in this TipTap version.
      // We only need to sync the editor when `content` changes, so rely on defaults.
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Topbar */}
      <div style={{
        padding: '12px 24px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setShowPreview(!showPreview)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: showPreview ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: 6,
              color: showPreview ? '#a78bfa' : '#8b8fa8',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <Eye size={16} /> {showPreview ? 'Edit' : 'Preview'}
          </button>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <span style={{ fontSize: 13, color: saveError ? '#f87171' : '#555870' }}>
            {saveError
              ? saveError
              : lastSaved
                ? `Last saved: ${lastSaved.toLocaleTimeString()}`
                : 'Not saved yet'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: '#8b8fa8',
            fontSize: 13,
            cursor: 'pointer',
          }}>
            <Settings size={16} /> Settings
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: saving
                ? 'rgba(139, 92, 246, 0.4)'
                : lastSaved
                  ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                  : 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            {saving ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : lastSaved ? (
              <Check size={16} />
            ) : (
              <Save size={16} />
            )}
            {saving ? 'Saving...' : lastSaved ? 'Saved' : 'Save Draft'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Insert Panel */}
        <div style={{
          width: 200,
          background: 'rgba(255,255,255,0.02)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          padding: 16,
          overflowY: 'auto',
        }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: '#555870', textTransform: 'uppercase', marginBottom: 12 }}>
            Insert Blocks
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {insertBlocks.map((block) => (
              <button
                key={block.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 6,
                  color: '#8b8fa8',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onClick={() => block.onClick()}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${block.color}11`;
                  e.currentTarget.style.borderColor = `${block.color}33`;
                  e.currentTarget.style.color = block.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = '#8b8fa8';
                }}
              >
                <block.icon size={16} />
                {block.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title..."
            style={{
              padding: '16px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              color: '#e2e4f0',
              fontSize: 24,
              fontWeight: 700,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {/* Editor/Preview Area */}
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            {showPreview ? (
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 12,
                padding: 32,
                minHeight: '100%',
                boxSizing: 'border-box',
              }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e2e4f0', margin: '0 0 16px' }}>
                  {title || 'Untitled'}
                </h1>
                <div
                  className="tiptap-content"
                  style={{ fontSize: 15, color: '#8b8fa8', lineHeight: 1.8 }}
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
        <div style={{
          width: 280,
          background: 'rgba(255,255,255,0.02)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          padding: 20,
          overflowY: 'auto',
        }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: '#555870', textTransform: 'uppercase', marginBottom: 16 }}>
            Properties
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#8b8fa8', marginBottom: 6, display: 'block' }}>
                Content Type
              </label>
              <select style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                color: '#e2e4f0',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}>
                <option>Article</option>
                <option>Guide</option>
                <option>Documentation</option>
                <option>Blog Post</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#8b8fa8', marginBottom: 6, display: 'block' }}>
                Tags
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['tutorial', 'guide', '2025'].map(tag => (
                  <span key={tag} style={{
                    padding: '4px 10px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    borderRadius: 12,
                    fontSize: 11,
                    color: '#a78bfa',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    {tag}
                    <button style={{
                      background: 'none',
                      border: 'none',
                      color: '#a78bfa',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                    }}>×</button>
                  </span>
                ))}
                <button style={{
                  padding: '4px 10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px dashed rgba(255,255,255,0.2)',
                  borderRadius: 12,
                  fontSize: 11,
                  color: '#555870',
                  cursor: 'pointer',
                }}>+ Add</button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#8b8fa8', marginBottom: 6, display: 'block' }}>
                Visibility
              </label>
              <select style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                color: '#e2e4f0',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}>
                <option>Public</option>
                <option>Team Only</option>
                <option>Private</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#8b8fa8', marginBottom: 6, display: 'block' }}>
                Featured Image
              </label>
              <div style={{
                height: 120,
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(255,255,255,0.2)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#555870',
                fontSize: 12,
                cursor: 'pointer',
              }}>
                Click to upload
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
