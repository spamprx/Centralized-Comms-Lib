import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

export type SlashCommandMenuProps = {
  editor: Editor | null;
  onOpenCitation: () => void;
};

type SlashItem = {
  id: string;
  label: string;
  keywords: string[];
  run: (editor: Editor, range: { from: number; to: number }) => void;
};

/**
 * Slash commands in any block with inline content (paragraph, heading, list item paragraph, …).
 * Uses the last `/` before the cursor in that block so `/` works mid-line, not only at block start.
 */
function slashRange(editor: Editor): { from: number; to: number; query: string } | null {
  const { state } = editor;
  const { $from } = state.selection;
  if (!editor.isEditable) return null;

  let d = $from.depth;
  while (d > 0 && !$from.node(d).inlineContent) d -= 1;
  if (d === 0) return null;

  const blockStart = $from.start(d);
  const end = $from.pos;
  if (end <= blockStart) return null;

  const text = state.doc.textBetween(blockStart, end, '\n', '\ufffc');
  const slashIdx = text.lastIndexOf('/');
  if (slashIdx < 0) return null;

  const charBefore = slashIdx === 0 ? '' : text[slashIdx - 1];
  if (charBefore && !/\s/.test(charBefore)) return null;

  const tail = text.slice(slashIdx + 1);
  if (/\s/.test(tail)) return null;

  return {
    from: blockStart + slashIdx,
    to: end,
    query: tail.toLowerCase(),
  };
}

export default function SlashCommandMenu({ editor, onOpenCitation }: SlashCommandMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const rangeRef = useRef<{ from: number; to: number } | null>(null);

  const items = useMemo<SlashItem[]>(
    () => [
      {
        id: 'slash',
        label: 'Insert "/" character',
        keywords: ['slash', '/', 'forward', 'solidus', 'literal'],
        run: (ed, r) => {
          ed.chain().focus().deleteRange(r).insertContent('/').run();
        },
      },
      {
        id: 'h1',
        label: 'Heading 1',
        keywords: ['h1', 'heading', 'title'],
        run: (ed, r) => {
          ed.chain().focus().deleteRange(r).toggleHeading({ level: 1 }).run();
        },
      },
      {
        id: 'h2',
        label: 'Heading 2',
        keywords: ['h2', 'subtitle'],
        run: (ed, r) => {
          ed.chain().focus().deleteRange(r).toggleHeading({ level: 2 }).run();
        },
      },
      {
        id: 'p',
        label: 'Paragraph',
        keywords: ['p', 'text', 'body'],
        run: (ed, r) => {
          ed.chain().focus().deleteRange(r).setParagraph().run();
        },
      },
      {
        id: 'bold',
        label: 'Bold',
        keywords: ['bold', 'strong'],
        run: (ed, r) => {
          ed.chain().focus().deleteRange(r).toggleBold().run();
        },
      },
      {
        id: 'italic',
        label: 'Italic',
        keywords: ['italic', 'emphasis', 'em'],
        run: (ed, r) => {
          ed.chain().focus().deleteRange(r).toggleItalic().run();
        },
      },
      {
        id: 'underline',
        label: 'Underline',
        keywords: ['underline', 'u'],
        run: (ed, r) => {
          ed.chain().focus().deleteRange(r).toggleUnderline().run();
        },
      },
      {
        id: 'bullet',
        label: 'Bullet list',
        keywords: ['bullet', 'ul', 'list'],
        run: (ed, r) => {
          ed.chain().focus().deleteRange(r).toggleBulletList().run();
        },
      },
      {
        id: 'ordered',
        label: 'Numbered list',
        keywords: ['numbered', 'ordered', 'ol'],
        run: (ed, r) => {
          ed.chain().focus().deleteRange(r).toggleOrderedList().run();
        },
      },
      {
        id: 'link',
        label: 'Link',
        keywords: ['link', 'url', 'href'],
        run: (ed, r) => {
          ed.chain().focus().deleteRange(r).run();
          const previousUrl = ed.getAttributes('link')?.href as string | undefined;
          const url = window.prompt('Enter URL', previousUrl ?? '');
          if (url === null) return;
          if (url === '') {
            ed.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
          }
          ed.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        },
      },
      {
        id: 'citation',
        label: 'Citation',
        keywords: ['citation', 'cite', 'reference'],
        run: (ed, r) => {
          ed.chain().focus().deleteRange(r).run();
          onOpenCitation();
        },
      },
      {
        id: 'image',
        label: 'Image',
        keywords: ['image', 'img', 'photo'],
        run: (ed, r) => {
          ed.chain().focus().deleteRange(r).run();
        },
      },
    ],
    [onOpenCitation],
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return items;
    return items.filter((it) => {
      const hay = `${it.label} ${it.keywords.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const sync = useCallback(() => {
    if (!editor) {
      setOpen(false);
      return;
    }
    const r = slashRange(editor);
    if (!r) {
      setOpen(false);
      rangeRef.current = null;
      return;
    }
    rangeRef.current = { from: r.from, to: r.to };
    setQuery(r.query);
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    setPos({ top: coords.bottom + window.scrollY + 4, left: coords.left + window.scrollX });
    setOpen(true);
    setActive(0);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => sync();
    editor.on('update', onUpdate);
    editor.on('selectionUpdate', onUpdate);
    return () => {
      editor.off('update', onUpdate);
      editor.off('selectionUpdate', onUpdate);
    };
  }, [editor, sync]);

  useEffect(() => {
    if (!open) return;
    setActive((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length, open]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.('[data-slash-menu]')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const pick = useCallback(
    (index: number) => {
      if (!editor || !rangeRef.current || !filtered[index]) return;
      const range = rangeRef.current;
      filtered[index].run(editor, range);
      setOpen(false);
    },
    [editor, filtered],
  );

  useEffect(() => {
    if (!open || !editor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => (a + 1) % Math.max(1, filtered.length));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => (a - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered.length > 0) pick(active);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, editor, filtered, open, pick]);

  if (!open || !editor) return null;

  return (
    <div
      data-slash-menu
      className="slash-menu fixed z-50 min-w-[220px] max-h-[min(280px,70vh)] overflow-auto rounded-[var(--editor-radius-input)] border border-white/12 py-1 text-[12px] text-[var(--editor-doc-text)]"
      style={{ top: pos.top, left: pos.left }}
      role="listbox"
      aria-label="Insert block"
    >
      <div className="border-b border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] leading-snug text-[var(--editor-faint)]">
        Type <span className="font-mono text-[var(--editor-primary)]">/</span> in a paragraph or
        heading to open this menu.
      </div>
      {filtered.length === 0 ? (
        <div className="px-2.5 py-2 text-[var(--editor-faint)]">No matching blocks</div>
      ) : (
        filtered.map((it, i) => (
          <button
            key={it.id}
            type="button"
            role="option"
            aria-selected={i === active}
            className={`flex w-full cursor-pointer border-none px-2.5 py-1.5 text-left transition-[background-color,color] duration-150 ${
              i === active
                ? 'bg-[var(--editor-primary-muted)] text-[var(--editor-doc-text)] shadow-[inset_2px_0_0_0_var(--editor-primary)]'
                : 'bg-transparent text-[var(--editor-muted)] hover:bg-white/[0.04]'
            }`}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(i)}
          >
            <span className="font-medium">{it.label}</span>
          </button>
        ))
      )}
    </div>
  );
}
