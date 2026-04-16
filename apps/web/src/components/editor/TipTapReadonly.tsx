import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import type { JSONContent } from '@tiptap/core';
import { templateLayoutDocExtensions } from '../../tiptap/templateLayoutDoc';
import { CitationMarker } from '../../tiptap/CitationMarker';
import { ComponentReference } from '../../tiptap/ComponentReference';

type TipTapReadonlyProps = {
  doc: JSONContent;
  className?: string;
  onSelectionChange?: (sel: { from: number; to: number; text: string }) => void;
};

export default function TipTapReadonly({
  doc,
  className,
  onSelectionChange,
}: Readonly<TipTapReadonlyProps>) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      CitationMarker,
      ComponentReference,
      Link.configure({
        openOnClick: true,
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
      ...templateLayoutDocExtensions,
    ],
    content: doc,
    editable: false,
    editorProps: {
      attributes: {
        class: className ?? '',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(doc);
  }, [doc, editor]);

  useEffect(() => {
    if (!editor) return;
    if (!onSelectionChange) return;
    const handler = () => {
      const { from, to } = editor.state.selection;
      const text = from === to ? '' : editor.state.doc.textBetween(from, to, ' ').trim();
      onSelectionChange({ from, to, text });
    };
    handler();
    editor.on('selectionUpdate', handler);
    return () => {
      editor.off('selectionUpdate', handler);
    };
  }, [editor, onSelectionChange]);

  return (
    <div className="tiptap-readonly-root min-w-0 rounded-app-md border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <EditorContent editor={editor} />
    </div>
  );
}
