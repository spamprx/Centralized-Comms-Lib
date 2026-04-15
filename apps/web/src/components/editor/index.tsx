import Slot from '../ui/Slot';

export function EditorTopbar() {
  return <Slot className="h-14 w-full shrink-0" />;
}
export function InsertPanel() {
  return <Slot className="h-full w-56 shrink-0" />;
}
export function MainEditorCanvas() {
  return <Slot className="min-h-0 flex-1" />;
}
export function PropertiesPanel() {
  return <Slot className="h-full w-72 shrink-0" />;
}
