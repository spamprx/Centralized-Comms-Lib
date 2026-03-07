import Slot from "../ui/Slot";

export function PageHeader() {
  return <Slot className="h-12 w-full" />;
}
export function StatsRow() {
  return (
    <div className="flex gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Slot key={i} className="h-20 min-w-[10rem] flex-1" />
      ))}
    </div>
  );
}
export function ContentTable() {
  return <Slot className="min-h-[24rem] flex-1" />;
}
