import Slot from "../components/ui/Slot";

export default function EditorLayout() {
  return (
    <div className="flex h-screen flex-col">
      <Slot name="EditorTopbar" className="h-14 w-full shrink-0" />
      <div className="flex flex-1 overflow-hidden">
        <Slot name="InsertPanel" className="w-56 shrink-0" />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Slot name="ContentTitleInput" className="h-12 w-full shrink-0" />
          <div className="flex flex-1 overflow-hidden">
            <Slot name="RichTextEditor" className="min-h-0 flex-1 overflow-auto" />
          </div>
        </div>
        <Slot name="Properties Panel" className="w-72 shrink-0" />
      </div>
    </div>
  );
}
