import Slot from "../components/ui/Slot";

export default function PreviewLayout() {
  return (
    <div className="flex h-screen flex-col">
      <Slot name="PreviewTopbar" className="h-14 w-full shrink-0" />
      <Slot name="ChannelSwitcher" className="h-12 w-full shrink-0" />
      <div className="flex flex-1 overflow-hidden">
        <Slot name="PreviewCanvas" className="min-h-0 flex-1 overflow-auto" />
        <Slot name="ConditionalSectionsPanel" className="w-64 shrink-0" />
      </div>
    </div>
  );
}
