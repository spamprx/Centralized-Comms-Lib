import { EditorLayout } from '../../layouts';

/** Full-bleed shell so the editor can own the viewport without inheriting stray page padding. */
export default function ContentEditorPage() {
  return (
    <div className="editor-page-root isolate min-h-0 min-h-screen w-full bg-app-bg">
      <EditorLayout />
    </div>
  );
}
