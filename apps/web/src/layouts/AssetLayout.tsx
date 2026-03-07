import Slot from "../components/ui/Slot";

export default function AssetLayout() {
  return (
    <div className="flex h-screen flex-col">
      <div className="shrink-0 p-6">
        <Slot name="PageHeader" className="mb-4 h-12 w-full" />
        <Slot name="UploadDropZone" className="mb-4 h-32 w-full" />
        <div className="flex gap-4">
          <Slot name="SearchBar" className="h-10 flex-1" />
          <Slot name="FilterPanel" className="h-10 w-48" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 15 }).map((_, i) => (
              <Slot key={i} name="AssetCard" className="aspect-square min-h-[8rem]" />
            ))}
          </div>
        </div>
        <Slot name="AssetDetailDrawer" className="w-80 shrink-0" />
      </div>
    </div>
  );
}
