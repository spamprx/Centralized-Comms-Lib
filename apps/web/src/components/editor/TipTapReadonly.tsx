import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import type { JSONContent } from '@tiptap/core';
import { templateLayoutDocExtensions } from '../../tiptap/templateLayoutDoc';

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
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
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

  return <EditorContent editor={editor} />;
}
