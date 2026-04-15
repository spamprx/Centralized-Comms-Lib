import Slot from '../ui/Slot';

export function UploadZone() {
  return <Slot className="h-32 w-full" />;
}
export function AssetGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 15 }).map((_, i) => (
        <Slot key={i} className="aspect-square min-h-[8rem]" />
      ))}
    </div>
  );
}
export function AssetDetailDrawer() {
  return <Slot className="h-full w-80 shrink-0" />;
}
