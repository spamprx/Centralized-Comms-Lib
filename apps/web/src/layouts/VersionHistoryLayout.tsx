import Slot from "../components/ui/Slot";

export default function VersionHistoryLayout() {
  return (
    <div className="flex h-screen flex-col p-6">
      <Slot name="PageHeader" className="mb-6 h-12 w-full" />
      <div className="flex flex-1 gap-6 overflow-hidden">
        <Slot name="VersionTimelineList" className="w-72 shrink-0 overflow-auto" />
        <Slot name="DiffViewPanel" className="min-w-0 flex-1 overflow-auto" />
      </div>
    </div>
  );
}
