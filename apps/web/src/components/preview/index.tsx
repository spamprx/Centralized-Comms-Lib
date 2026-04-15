import Slot from '../ui/Slot';

export function PreviewTopbar() {
  return <Slot className="h-14 w-full shrink-0" />;
}
export function ChannelSwitcher() {
  return <Slot className="h-12 w-full shrink-0" />;
}
export function PreviewCanvas() {
  return <Slot className="min-h-0 flex-1 overflow-auto" />;
}
export function ConditionalSectionsPanel() {
  return <Slot className="w-64 shrink-0" />;
}
